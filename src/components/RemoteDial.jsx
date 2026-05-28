import { useEffect, useState } from 'react'

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (value == null || value === displayValue) {
      return undefined
    }

    setIsAnimating(true)
    const timer = setTimeout(() => {
      setDisplayValue(value)
      setIsAnimating(false)
    }, 120)

    return () => clearTimeout(timer)
  }, [value, displayValue])

  return (
    <span className={`readout-number${isAnimating ? ' is-changing' : ''}`}>
      {displayValue ?? '--'}
    </span>
  )
}

export default function RemoteDial({
  progress,
  phase,
  currentTemp,
  targetC,
  fanRemaining,
  etaLabel,
}) {
  const radius = 124
  const stroke = 2.5
  const normalizedRadius = radius - stroke / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const offset = circumference - progress * circumference
  const showTemp =
    currentTemp != null &&
    !['disconnected', 'connecting', 'complete'].includes(phase)
  const showTarget = ['idle', 'ready', 'error'].includes(phase)
  const showFanCountdown = phase === 'fanning' && fanRemaining != null
  const showReadyMark = phase === 'ready'

  return (
    <div className={`remote-dial phase-${phase}`}>
      <div className="dial-halo" aria-hidden="true" />
      <div className="dial-glow" aria-hidden="true" />

      <svg className="dial-ring" viewBox="0 0 280 280" aria-hidden="true">
        <defs>
          <linearGradient id="goldArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e2b8" />
            <stop offset="45%" stopColor="#c9a962" />
            <stop offset="100%" stopColor="#7a5c28" />
          </linearGradient>
          <linearGradient id="warmArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffd08a" />
            <stop offset="100%" stopColor="#b87333" />
          </linearGradient>
          <linearGradient id="coolArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dce8f2" />
            <stop offset="100%" stopColor="#8aa3b8" />
          </linearGradient>
        </defs>

        <circle className="dial-ring-outer" cx="140" cy="140" r="132" />
        <circle className="dial-ring-track" cx="140" cy="140" r={normalizedRadius} />
        <circle
          className="dial-ring-progress"
          cx="140"
          cy="140"
          r={normalizedRadius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
        />
      </svg>

      <div className="dial-readout">
        {showFanCountdown ? (
          <>
            <div className="readout-primary fan-countdown">{fanRemaining}</div>
            <div className="readout-secondary readout-serif">seconds remaining</div>
          </>
        ) : showReadyMark ? (
          <>
            <div className="readout-ready">Ready</div>
            <div className="readout-secondary readout-serif">Attach your bag</div>
          </>
        ) : showTemp ? (
          <>
            <div className="readout-primary">
              <AnimatedNumber value={currentTemp} />
              <span className="readout-degree">°</span>
            </div>
            <div className="readout-secondary readout-serif">
              {phase === 'heating' && etaLabel
                ? etaLabel
                : showTarget
                  ? `Set to ${targetC}°C`
                  : phase === 'complete'
                    ? 'Session complete'
                    : 'Chamber temperature'}
            </div>
          </>
        ) : (
          <>
            <div className="readout-monogram" aria-hidden="true">
              V
            </div>
            <div className="readout-secondary readout-serif">Hybrid</div>
          </>
        )}
      </div>
    </div>
  )
}
