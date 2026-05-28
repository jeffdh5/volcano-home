export function estimateHeatEtaSeconds(currentTemp, targetTemp, startTemp, elapsedMs) {
  if (currentTemp == null || startTemp == null || elapsedMs < 4000) {
    return null
  }

  if (currentTemp >= targetTemp) {
    return 0
  }

  const degreesGained = currentTemp - startTemp
  if (degreesGained <= 0) {
    return null
  }

  const degreesPerSecond = degreesGained / (elapsedMs / 1000)
  if (degreesPerSecond <= 0.05) {
    return null
  }

  return Math.max(1, Math.ceil((targetTemp - currentTemp) / degreesPerSecond))
}

export function formatEta(seconds) {
  if (seconds == null) {
    return null
  }

  if (seconds <= 0) {
    return 'Arriving now'
  }

  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  if (minutes === 0) {
    return `~${remainder}s remaining`
  }

  return `~${minutes}:${String(remainder).padStart(2, '0')} remaining`
}
