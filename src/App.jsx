import { useCallback, useEffect, useRef, useState } from 'react'
import { connectToVolcano, disconnectVolcano, onDisconnect } from './ble/connect.js'
import { isConnected } from './ble/cache.js'
import { getCycle, readCurrentTemperature, runSession, stopSession } from './ble/volcano.js'
import {
  celebrateReady,
  ensureNotificationPermission,
  notifyReady,
} from './lib/feedback.js'
import { estimateHeatEtaSeconds, formatEta } from './lib/eta.js'
import {
  finishSessionRecord,
  getLastSession,
  getPreferredCycleId,
  saveSessionRecord,
  setPreferredCycleId,
  startSessionRecord,
} from './lib/sessions.js'
import StatusPill from './components/StatusPill.jsx'
import RemoteDial from './components/RemoteDial.jsx'
import ActionDock from './components/ActionDock.jsx'
import SessionTimeline from './components/SessionTimeline.jsx'
import CycleSelector from './components/CycleSelector.jsx'
import LastSession from './components/LastSession.jsx'

const COMPLETE_HOLD_MS = 2600

function getPhaseHint(phase, targetC) {
  const hints = {
    disconnected: 'Your private control awaits.',
    connecting: 'Choose Volcano Hybrid from the dialog.',
    idle: 'Choose a cycle, then begin.',
    heating: `Ascending to ${targetC} degrees.`,
    ready: 'Attach your bag, then tap Extract.',
    fanning: 'Drawing vapor through the chamber.',
    complete: 'Session complete.',
    error: 'Please attempt to connect again.',
  }

  return hints[phase] || hints.idle
}

export default function App() {
  const [phase, setPhase] = useState('disconnected')
  const [cycleId, setCycleId] = useState(getPreferredCycleId)
  const [currentTemp, setCurrentTemp] = useState(null)
  const [fanRemaining, setFanRemaining] = useState(null)
  const [etaLabel, setEtaLabel] = useState(null)
  const [lastSession, setLastSession] = useState(getLastSession)
  const [error, setError] = useState('')
  const abortRef = useRef(null)
  const pollRef = useRef(null)
  const extractGateRef = useRef(null)
  const heatTrackingRef = useRef(null)
  const completeTimerRef = useRef(null)
  const readySignaledRef = useRef(false)
  const activeSessionRef = useRef(null)

  const cycle = getCycle(cycleId)
  const targetC = cycle.targetC

  const clearCompleteTimer = useCallback(() => {
    clearTimeout(completeTimerRef.current)
    completeTimerRef.current = null
  }, [])

  const resetToDisconnected = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    extractGateRef.current?.reject(new DOMException('Aborted', 'AbortError'))
    extractGateRef.current = null
    clearInterval(pollRef.current)
    pollRef.current = null
    clearCompleteTimer()
    heatTrackingRef.current = null
    readySignaledRef.current = false
    activeSessionRef.current = null
    setPhase('disconnected')
    setCurrentTemp(null)
    setFanRemaining(null)
    setEtaLabel(null)
    setError('')
  }, [clearCompleteTimer])

  useEffect(() => {
    onDisconnect(resetToDisconnected)
    return () => onDisconnect(null)
  }, [resetToDisconnected])

  useEffect(() => {
    if (!isConnected() || phase === 'disconnected') {
      clearInterval(pollRef.current)
      pollRef.current = null
      return undefined
    }

    const poll = async () => {
      try {
        const temp = await readCurrentTemperature()
        setCurrentTemp(temp)

        if (phase === 'heating' && heatTrackingRef.current) {
          const elapsedMs = Date.now() - heatTrackingRef.current.startedAt
          const etaSeconds = estimateHeatEtaSeconds(
            temp,
            targetC,
            heatTrackingRef.current.startTemp,
            elapsedMs,
          )
          setEtaLabel(formatEta(etaSeconds))
        }
      } catch {
        // ignore transient read errors while connected
      }
    }

    poll()
    pollRef.current = setInterval(poll, 2000)

    return () => clearInterval(pollRef.current)
  }, [phase, targetC])

  useEffect(() => {
    if (phase !== 'ready' || readySignaledRef.current) {
      return undefined
    }

    readySignaledRef.current = true
    celebrateReady()
    notifyReady(cycle)

    return undefined
  }, [phase, cycle])

  useEffect(() => {
    if (phase !== 'complete') {
      return undefined
    }

    completeTimerRef.current = setTimeout(() => {
      setPhase('idle')
      setFanRemaining(null)
      setEtaLabel(null)
      heatTrackingRef.current = null
      readySignaledRef.current = false
    }, COMPLETE_HOLD_MS)

    return clearCompleteTimer
  }, [phase, clearCompleteTimer])

  const waitForExtract = useCallback((signal) => {
    return new Promise((resolve, reject) => {
      extractGateRef.current = { resolve, reject }

      if (signal?.aborted) {
        extractGateRef.current = null
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      signal?.addEventListener(
        'abort',
        () => {
          extractGateRef.current = null
          reject(new DOMException('Aborted', 'AbortError'))
        },
        { once: true },
      )
    })
  }, [])

  const handleCycleChange = (nextCycleId) => {
    setCycleId(nextCycleId)
    setPreferredCycleId(nextCycleId)
  }

  const handleConnect = async () => {
    setError('')
    setPhase('connecting')

    try {
      await connectToVolcano()
      setPhase('idle')
      const temp = await readCurrentTemperature()
      setCurrentTemp(temp)
    } catch (err) {
      const message = err?.message || 'Could not connect.'
      if (message.includes('cancelled') || message.includes('user gesture')) {
        setPhase('disconnected')
      } else {
        setError(message)
        setPhase('error')
      }
    }
  }

  const finalizeSession = (status) => {
    if (!activeSessionRef.current) {
      return
    }

    const finished = finishSessionRecord(activeSessionRef.current, status)
    saveSessionRecord(finished)
    setLastSession(finished)
    activeSessionRef.current = null
  }

  const handleStart = async () => {
    setError('')
    readySignaledRef.current = false
    clearCompleteTimer()
    abortRef.current?.abort()

    await ensureNotificationPermission()

    const controller = new AbortController()
    abortRef.current = controller
    heatTrackingRef.current = {
      startedAt: Date.now(),
      startTemp: currentTemp,
    }
    activeSessionRef.current = startSessionRecord(cycleId, targetC)
    setEtaLabel(null)

    try {
      await runSession({
        cycleId,
        signal: controller.signal,
        onPhase: (nextPhase) => {
          if (nextPhase !== 'heating') {
            setEtaLabel(null)
          }
          setPhase(nextPhase)
        },
        onTemperature: (temp) => {
          setCurrentTemp(temp)

          if (heatTrackingRef.current) {
            const elapsedMs = Date.now() - heatTrackingRef.current.startedAt
            const etaSeconds = estimateHeatEtaSeconds(
              temp,
              targetC,
              heatTrackingRef.current.startTemp,
              elapsedMs,
            )
            setEtaLabel(formatEta(etaSeconds))
          }
        },
        onFanRemaining: setFanRemaining,
        waitForExtract,
      })
      setFanRemaining(null)
      finalizeSession('completed')
    } catch (err) {
      extractGateRef.current = null

      if (err?.name === 'AbortError') {
        finalizeSession('cancelled')
        setPhase('idle')
        setFanRemaining(null)
        setEtaLabel(null)
        readySignaledRef.current = false
        return
      }

      finalizeSession('cancelled')
      setError(err?.message || 'Session failed.')
      setPhase('error')
    }
  }

  const handleExtract = () => {
    extractGateRef.current?.resolve()
    extractGateRef.current = null
  }

  const handleStop = async () => {
    abortRef.current?.abort()
    abortRef.current = null
    extractGateRef.current?.reject(new DOMException('Aborted', 'AbortError'))
    extractGateRef.current = null
    setFanRemaining(null)
    setEtaLabel(null)
    readySignaledRef.current = false
    clearCompleteTimer()

    try {
      await stopSession()
      finalizeSession('cancelled')
      setPhase('idle')
    } catch (err) {
      setError(err?.message || 'Could not stop session.')
      setPhase('error')
    }
  }

  const handleDisconnect = async () => {
    abortRef.current?.abort()
    await disconnectVolcano()
    resetToDisconnected()
  }

  const progress =
    phase === 'heating' && currentTemp
      ? Math.min(1, Math.max(0, currentTemp / targetC))
      : phase === 'ready'
        ? 1
        : phase === 'fanning'
          ? 1 - (fanRemaining ?? 30) / 30
          : phase === 'complete'
            ? 1
            : 0

  const canPickCycle = ['idle', 'disconnected', 'error', 'complete'].includes(phase)

  return (
    <div className={`app phase-${phase} cycle-${cycleId}`}>
      <div className="ambient" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      {phase === 'ready' ? <div className="ready-flash" aria-hidden="true" /> : null}

      <div className="shell">
        <header className="remote-header">
          <div className="brand-lockup">
            <p className="remote-label">Private Suite</p>
            <h1 className="remote-title">Volcano</h1>
          </div>
          <StatusPill phase={phase} />
        </header>

        <LastSession session={lastSession} />
        <div className="header-rule" aria-hidden="true" />

        <main className="remote-body">
          <section className={`remote-card${phase === 'complete' ? ' is-complete' : ''}`}>
            <div className="card-sheen" aria-hidden="true" />
            <SessionTimeline phase={phase} />
            <RemoteDial
              progress={progress}
              phase={phase}
              currentTemp={currentTemp}
              targetC={targetC}
              fanRemaining={fanRemaining}
              etaLabel={etaLabel}
            />
            <p className="remote-hint">{getPhaseHint(phase, targetC)}</p>
          </section>
        </main>

        <ActionDock
          phase={phase}
          cycle={cycle}
          error={error}
          canPickCycle={canPickCycle}
          selectedCycleId={cycleId}
          onCycleChange={handleCycleChange}
          onConnect={handleConnect}
          onStart={handleStart}
          onExtract={handleExtract}
          onStop={handleStop}
          onDisconnect={handleDisconnect}
        />
      </div>
    </div>
  )
}
