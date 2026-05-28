export const CYCLES = {
  cool: {
    id: 'cool',
    label: 'Cool',
    targetC: 190,
  },
  hot: {
    id: 'hot',
    label: 'Hot',
    targetC: 210,
  },
}

export const SESSION = {
  stabilitySeconds: 3,
  soakSeconds: 0,
  fanSeconds: 30,
  heatOffAfter: true,
  dimDisplayAfter: true,
  defaultCycleId: 'hot',
}

export function getCycle(cycleId) {
  return CYCLES[cycleId] || CYCLES[SESSION.defaultCycleId]
}
