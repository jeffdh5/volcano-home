import {
  currentTemperatureUuid,
  fanOffUuid,
  fanOnUuid,
  heatOffUuid,
  heatOnUuid,
  LEDbrightnessUuid,
  writeTemperatureUuid,
} from './uuids.js'
import { getCycle, SESSION } from '../lib/cycles.js'
import { getCharacteristic } from './cache.js'
import { enqueue } from './queue.js'
import {
  convertCurrentTemperatureCharacteristicToCelcius,
  convertToUInt16BLE,
  convertToUInt32BLE,
  convertToUInt8BLE,
  sleep,
} from './utils.js'

export { CYCLES, SESSION, getCycle } from '../lib/cycles.js'

export async function readCurrentTemperature() {
  return enqueue(async () => {
    const characteristic = getCharacteristic(currentTemperatureUuid)
    const value = await characteristic.readValue()
    return convertCurrentTemperatureCharacteristicToCelcius(value)
  })
}

export async function setTargetTemperature(celsius) {
  return enqueue(async () => {
    const characteristic = getCharacteristic(writeTemperatureUuid)
    await characteristic.writeValue(convertToUInt32BLE(celsius * 10))
  })
}

export async function setHeatOn(isOn) {
  return enqueue(async () => {
    const characteristic = getCharacteristic(isOn ? heatOnUuid : heatOffUuid)
    await characteristic.writeValue(convertToUInt8BLE(0))
  })
}

export async function setFanOn(isOn) {
  return enqueue(async () => {
    const characteristic = getCharacteristic(isOn ? fanOnUuid : fanOffUuid)
    await characteristic.writeValue(convertToUInt8BLE(0))
  })
}

export async function setLEDBrightness(brightness) {
  return enqueue(async () => {
    const characteristic = getCharacteristic(LEDbrightnessUuid)
    await characteristic.writeValue(convertToUInt16BLE(brightness))
  })
}

async function waitForStableTemperature(targetC, stabilitySeconds, signal, onProgress) {
  let stableSeconds = 0

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const current = await readCurrentTemperature()
    onProgress?.(current)

    if (current >= targetC) {
      stableSeconds += 1
      if (stableSeconds >= stabilitySeconds) {
        return current
      }
    } else {
      stableSeconds = 0
    }

    await sleep(1000, signal)
  }
}

export async function runSession({
  cycleId,
  signal,
  onPhase,
  onTemperature,
  onFanRemaining,
  waitForExtract,
}) {
  const cycle = getCycle(cycleId)
  const { stabilitySeconds, soakSeconds, fanSeconds, heatOffAfter, dimDisplayAfter } = SESSION
  const { targetC } = cycle

  onPhase('heating')
  await setTargetTemperature(targetC)
  await setHeatOn(true)
  await waitForStableTemperature(targetC, stabilitySeconds, signal, onTemperature)

  if (soakSeconds > 0) {
    for (let remaining = soakSeconds; remaining > 0; remaining -= 1) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      await sleep(1000, signal)
    }
  }

  onPhase('ready')
  await waitForExtract(signal)

  onPhase('fanning')
  await setFanOn(true)

  for (let remaining = fanSeconds; remaining > 0; remaining -= 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    onFanRemaining?.(remaining)
    await sleep(1000, signal)
  }

  await setFanOn(false)

  if (heatOffAfter) {
    await setHeatOn(false)
  }

  if (dimDisplayAfter) {
    await setLEDBrightness(0)
  }

  onPhase('complete')
}

export async function stopSession() {
  await setFanOn(false)
}
