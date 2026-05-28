# Volcano Home

A minimal luxury PWA for the Volcano Hybrid.

## Session flow

1. Choose **Cool** (190°C) or **Hot** (210°C)
2. Tap **Begin**
3. Wait for **Ready** — attach your bag
4. Tap **Extract** — 30s fan, heat off, display dimmed
5. Session is saved to local memory

## Run the app

```bash
npm install
npm run dev
```

Open `https://localhost:5173/` in Chrome or Edge.

## Google Home

See [`bridge/README.md`](bridge/README.md) for the local bridge + Home Assistant setup.

Voice flow:

- *"Hey Google, run Volcano hot cycle"* → preheat
- attach bag
- *"Hey Google, run Volcano extract"* → fan cycle

## Customize

Edit `src/lib/cycles.js` and `src/ble/volcano.js`:

```js
// cycles.js
export const CYCLES = {
  cool: { id: 'cool', label: 'Cool', targetC: 190 },
  hot: { id: 'hot', label: 'Hot', targetC: 210 },
}

// volcano.js SESSION
export const SESSION = {
  stabilitySeconds: 3,
  fanSeconds: 30,
  heatOffAfter: true,
  dimDisplayAfter: true,
}
```
