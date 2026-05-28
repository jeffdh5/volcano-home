export function tapLight() {
  navigator.vibrate?.(6)
}

export function celebrateReady() {
  navigator.vibrate?.([10, 50, 14, 50, 18])
  playReadyChime()
}

function playReadyChime() {
  try {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(392, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(523.25, context.currentTime + 0.18)

    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.76)
    oscillator.onended = () => context.close()
  } catch {
    // audio is optional
  }
}

export async function ensureNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') {
    return Notification.permission
  }

  return Notification.requestPermission()
}

export function notifyReady(cycle) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  if (!document.hidden) {
    return
  }

  new Notification('Volcano ready', {
    body: `${cycle.label} cycle at ${cycle.targetC}°C. Attach your bag, then tap Extract.`,
    tag: 'volcano-ready',
  })
}
