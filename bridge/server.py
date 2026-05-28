#!/usr/bin/env python3
"""
Local Volcano bridge for Google Home via Home Assistant.

Requires:
  pip install -r requirements.txt
  export VOLCANO_MAC_ADDRESS=AA:BB:CC:DD:EE:FF

Endpoints:
  GET  /api/status
  POST /api/cycle/cool
  POST /api/cycle/hot
  POST /api/extract
  POST /api/stop
"""

from __future__ import annotations

import asyncio
import os
import struct
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from bleak import BleakClient
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

VOLCANO_ADDRESS = os.getenv("VOLCANO_MAC_ADDRESS", "").upper()
HOST = os.getenv("VOLCANO_BRIDGE_HOST", "0.0.0.0")
PORT = int(os.getenv("VOLCANO_BRIDGE_PORT", "8787"))

HEAT_ON = "1011000f-5354-4f52-5a26-4249434b454c"
HEAT_OFF = "10110010-5354-4f52-5a26-4249434b454c"
FAN_ON = "10110013-5354-4f52-5a26-4249434b454c"
FAN_OFF = "10110014-5354-4f52-5a26-4249434b454c"
TARGET_TEMP = "10110003-5354-4f52-5a26-4249434b454c"
CURRENT_TEMP = "10110001-5354-4f52-5a26-4249434b454c"
LED_BRIGHTNESS = "10110005-5354-4f52-5a26-4249434b454c"

CYCLES = {
    "cool": 190,
    "hot": 210,
}

STABILITY_SECONDS = 3
FAN_SECONDS = 30


class Phase(str, Enum):
    idle = "idle"
    heating = "heating"
    ready = "ready"
    fanning = "fanning"
    complete = "complete"
    error = "error"


@dataclass
class BridgeState:
    phase: Phase = Phase.idle
    cycle: Optional[str] = None
    target_c: Optional[int] = None
    current_c: Optional[int] = None
    fan_remaining: Optional[int] = None
    error: Optional[str] = None
    client: Optional[BleakClient] = None
    session_task: Optional[asyncio.Task] = None
    extract_event: asyncio.Event = field(default_factory=asyncio.Event)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


state = BridgeState()
app = FastAPI(title="Volcano Home Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_address() -> str:
    if not VOLCANO_ADDRESS:
        raise HTTPException(
            status_code=500,
            detail="Set VOLCANO_MAC_ADDRESS to your Volcano Hybrid Bluetooth address.",
        )
    return VOLCANO_ADDRESS


async def ensure_client() -> BleakClient:
    if state.client and state.client.is_connected:
        return state.client

    address = require_address()
    client = BleakClient(address)
    await client.connect()
    state.client = client
    return client


async def read_temp(client: BleakClient) -> int:
    raw = await client.read_gatt_char(CURRENT_TEMP)
    value = raw[0] + raw[1] * 256
    return round(value / 10)


async def write_target(client: BleakClient, celsius: int) -> None:
    await client.write_gatt_char(TARGET_TEMP, struct.pack("<I", celsius * 10))


async def set_heat(client: BleakClient, enabled: bool) -> None:
    await client.write_gatt_char(HEAT_ON if enabled else HEAT_OFF, bytes([0]))


async def set_fan(client: BleakClient, enabled: bool) -> None:
    await client.write_gatt_char(FAN_ON if enabled else FAN_OFF, bytes([0]))


async def set_brightness(client: BleakClient, value: int) -> None:
    await client.write_gatt_char(LED_BRIGHTNESS, struct.pack("<H", value))


async def wait_for_stable(client: BleakClient, target_c: int) -> None:
    stable = 0
    while stable < STABILITY_SECONDS:
        current = await read_temp(client)
        state.current_c = current
        if current >= target_c:
            stable += 1
        else:
            stable = 0
        await asyncio.sleep(1)


async def run_cycle(cycle_id: str) -> None:
    target_c = CYCLES[cycle_id]
    state.cycle = cycle_id
    state.target_c = target_c
    state.error = None
    state.extract_event = asyncio.Event()
    state.phase = Phase.heating

    client = await ensure_client()
    await write_target(client, target_c)
    await set_heat(client, True)
    await wait_for_stable(client, target_c)
    state.phase = Phase.ready
    await state.extract_event.wait()

    state.phase = Phase.fanning
    await set_fan(client, True)
    for remaining in range(FAN_SECONDS, 0, -1):
        state.fan_remaining = remaining
        await asyncio.sleep(1)

    await set_fan(client, False)
    await set_heat(client, False)
    await set_brightness(client, 0)
    state.fan_remaining = None
    state.phase = Phase.complete
    await asyncio.sleep(2.5)
    state.phase = Phase.idle
    state.cycle = None
    state.target_c = None


async def run_cycle_safe(cycle_id: str) -> None:
    try:
        await run_cycle(cycle_id)
    except asyncio.CancelledError:
        state.phase = Phase.idle
        state.cycle = None
        state.target_c = None
        state.fan_remaining = None
        raise
    except Exception as exc:  # noqa: BLE001
        state.phase = Phase.error
        state.error = str(exc)
        try:
            client = state.client
            if client and client.is_connected:
                await set_fan(client, False)
        except Exception:  # noqa: BLE001
            pass


def launch_cycle(cycle_id: str) -> None:
    if state.session_task and not state.session_task.done():
        raise HTTPException(status_code=409, detail="Session already running.")

    if cycle_id not in CYCLES:
        raise HTTPException(status_code=400, detail="Unknown cycle.")

    state.session_task = asyncio.create_task(run_cycle_safe(cycle_id))


@app.get("/api/status")
async def status() -> dict:
    return {
        "phase": state.phase.value,
        "cycle": state.cycle,
        "targetC": state.target_c,
        "currentC": state.current_c,
        "fanRemaining": state.fan_remaining,
        "error": state.error,
        "addressConfigured": bool(VOLCANO_ADDRESS),
    }


@app.post("/api/cycle/cool")
async def start_cool() -> dict:
    launch_cycle("cool")
    return {"ok": True, "cycle": "cool", "targetC": CYCLES["cool"]}


@app.post("/api/cycle/hot")
async def start_hot() -> dict:
    launch_cycle("hot")
    return {"ok": True, "cycle": "hot", "targetC": CYCLES["hot"]}


@app.post("/api/extract")
async def extract() -> dict:
    if state.phase != Phase.ready:
        raise HTTPException(status_code=409, detail=f"Cannot extract during {state.phase.value}.")
    state.extract_event.set()
    return {"ok": True}


@app.post("/api/stop")
async def stop() -> dict:
    if state.session_task and not state.session_task.done():
        state.session_task.cancel()
    state.extract_event.set()

    try:
        client = await ensure_client()
        await set_fan(client, False)
    except Exception:  # noqa: BLE001
        pass

    state.phase = Phase.idle
    state.cycle = None
    state.target_c = None
    state.fan_remaining = None
    state.error = None
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run("server:app", host=HOST, port=PORT, reload=False)
