import { SESSION } from '../ble/volcano.js'
import { tapLight } from '../lib/feedback.js'
import CycleSelector from './CycleSelector.jsx'

export default function ActionDock({
  phase,
  cycle,
  error,
  canPickCycle,
  selectedCycleId,
  onCycleChange,
  onConnect,
  onStart,
  onExtract,
  onStop,
  onDisconnect,
}) {
  const isSessionActive = ['heating', 'ready', 'fanning'].includes(phase)
  const isConnected = !['disconnected', 'connecting', 'error'].includes(phase)
  const showBegin = isConnected && !isSessionActive && phase !== 'complete'

  return (
    <div className="action-dock">
      {error ? <p className="dock-error">{error}</p> : null}

      {showBegin || canPickCycle ? (
        <CycleSelector
          selectedCycleId={selectedCycleId}
          onSelect={onCycleChange}
          disabled={!canPickCycle}
        />
      ) : null}

      <div className="dock-buttons">
        {isConnected && !isSessionActive ? (
          <button
            className="dock-button ghost"
            type="button"
            onClick={() => {
              tapLight()
              onDisconnect()
            }}
          >
            Unpair
          </button>
        ) : null}

        {!isConnected ? (
          <button
            className="dock-button primary"
            type="button"
            disabled={phase === 'connecting'}
            onClick={() => {
              tapLight()
              onConnect()
            }}
          >
            <span className="button-shine" aria-hidden="true" />
            {phase === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        ) : phase === 'ready' ? (
          <>
            <button
              className="dock-button stop"
              type="button"
              onClick={() => {
                tapLight()
                onStop()
              }}
            >
              Stop
            </button>
            <button
              className="dock-button primary"
              type="button"
              onClick={() => {
                tapLight()
                onExtract()
              }}
            >
              <span className="button-shine" aria-hidden="true" />
              Extract
            </button>
          </>
        ) : isSessionActive ? (
          <button
            className="dock-button stop"
            type="button"
            onClick={() => {
              tapLight()
              onStop()
            }}
          >
            Stop
          </button>
        ) : showBegin ? (
          <button
            className="dock-button primary"
            type="button"
            onClick={() => {
              tapLight()
              onStart()
            }}
          >
            <span className="button-shine" aria-hidden="true" />
            Begin {cycle.label}
          </button>
        ) : null}
      </div>

      {showBegin ? (
        <div className="dock-meta">
          <span>{cycle.label} cycle</span>
          <span className="meta-divider" aria-hidden="true" />
          <span>{SESSION.fanSeconds}s extraction</span>
        </div>
      ) : phase === 'ready' ? (
        <p className="dock-caption">Tap Extract when your bag is attached.</p>
      ) : phase === 'complete' ? (
        <p className="dock-caption">Returning to standby.</p>
      ) : phase === 'disconnected' ? (
        <p className="dock-caption">Ensure your device is powered and within range.</p>
      ) : null}
    </div>
  )
}
