# Google Home + Volcano Home

Google Assistant cannot talk to a browser PWA directly. The path that works well is:

**Volcano bridge (this Mac) → Home Assistant → Google Home**

## 1. Find your Volcano Bluetooth address

On macOS, hold Option and open the Bluetooth menu, or use:

```bash
system_profiler SPBluetoothDataType | grep -A 5 "VOLCANO"
```

Set it:

```bash
export VOLCANO_MAC_ADDRESS="AA:BB:CC:DD:EE:FF"
```

## 2. Run the bridge on a machine near the Volcano

The bridge needs Bluetooth access. Use a Mac mini, always-on laptop, or Raspberry Pi in the same room as the Volcano.

```bash
cd bridge
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Test:

```bash
curl http://localhost:8787/api/status
curl -X POST http://localhost:8787/api/cycle/hot
# wait until status shows "ready"
curl -X POST http://localhost:8787/api/extract
```

## 3. Connect Home Assistant

Add to `configuration.yaml`:

```yaml
rest_command:
  volcano_hot:
    url: "http://YOUR_BRIDGE_IP:8787/api/cycle/hot"
    method: POST
  volcano_cool:
    url: "http://YOUR_BRIDGE_IP:8787/api/cycle/cool"
    method: POST
  volcano_extract:
    url: "http://YOUR_BRIDGE_IP:8787/api/extract"
    method: POST
  volcano_stop:
    url: "http://YOUR_BRIDGE_IP:8787/api/stop"
    method: POST

template:
  - sensor:
      - name: "Volcano Phase"
        state: >
          {% set data = state_attr('sensor.volcano_status', 'phase') %}
          {{ data if data else 'unknown' }}
```

Optional status polling sensor via REST or command_line.

## 4. Link Google Home to Home Assistant

1. In Home Assistant: Settings → Home Assistant Cloud → Google Assistant (or manual setup)
2. Expose scripts or automations to Google

Create scripts:

```yaml
script:
  volcano_hot_cycle:
    alias: "Volcano hot cycle"
    sequence:
      - service: rest_command.volcano_hot

  volcano_cool_cycle:
    alias: "Volcano cool cycle"
    sequence:
      - service: rest_command.volcano_cool

  volcano_extract:
    alias: "Volcano extract"
    sequence:
      - service: rest_command.volcano_extract
```

## 5. Voice commands

After syncing to Google Home:

- **"Hey Google, run Volcano hot cycle"** → preheats to 210°C, waits at Ready
- **"Hey Google, run Volcano cool cycle"** → preheats to 190°C
- **"Hey Google, run Volcano extract"** → starts the 30s fan (when status is ready)

## Notes

- The phone PWA and the bridge should not control the Volcano at the same time.
- Google Home handles preheat well; you still say **Extract** (or tap Extract in the app) once the bag is attached.
- For a single voice command end-to-end, create a Home Assistant automation with a delay — less reliable than the two-step flow above.

## Alternative

If you already use **Project Onyx Server Edition**, it exposes a TCP socket protocol. This bridge is simpler and matches the Volcano Home session flow exactly.
