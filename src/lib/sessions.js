const STORAGE_KEY = 'volcano-home-sessions'
const CYCLE_KEY = 'volcano-home-cycle'
const MAX_SESSIONS = 24

export function getPreferredCycleId() {
  return window.localStorage.getItem(CYCLE_KEY) || 'hot'
}

export function setPreferredCycleId(cycleId) {
  window.localStorage.setItem(CYCLE_KEY, cycleId)
}

export function readSessions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getLastSession() {
  const sessions = readSessions()
  return sessions[0] || null
}

export function startSessionRecord(cycleId, targetC) {
  return {
    id: crypto.randomUUID(),
    cycleId,
    targetC,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: null,
    status: 'active',
  }
}

export function finishSessionRecord(record, status) {
  const endedAt = new Date()
  const startedAt = new Date(record.startedAt)

  return {
    ...record,
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    status,
  }
}

export function saveSessionRecord(record) {
  const sessions = readSessions().filter((entry) => entry.id !== record.id)
  sessions.unshift(record)
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(sessions.slice(0, MAX_SESSIONS)),
  )
}

export function formatSessionSummary(session) {
  if (!session) {
    return null
  }

  const when = new Date(session.endedAt || session.startedAt)
  const time = when.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
  const cycle = session.cycleId === 'cool' ? 'Cool' : 'Hot'
  const minutes = session.durationMs
    ? Math.max(1, Math.round(session.durationMs / 60000))
    : null
  const status =
    session.status === 'completed'
      ? 'completed'
      : session.status === 'cancelled'
        ? 'stopped early'
        : 'in progress'

  if (!minutes) {
    return `${time} · ${cycle} · ${status}`
  }

  return `${time} · ${cycle} · ${minutes} min · ${status}`
}
