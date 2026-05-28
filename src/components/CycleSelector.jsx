import { CYCLES } from '../lib/cycles.js'
import { tapLight } from '../lib/feedback.js'

export default function CycleSelector({ selectedCycleId, onSelect, disabled }) {
  return (
    <div className="cycle-selector" role="radiogroup" aria-label="Cycle temperature">
      {Object.values(CYCLES).map((cycle) => {
        const isActive = cycle.id === selectedCycleId

        return (
          <button
            key={cycle.id}
            type="button"
            className={`cycle-chip${isActive ? ' is-active' : ''}`}
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => {
              if (disabled || isActive) {
                return
              }
              tapLight()
              onSelect(cycle.id)
            }}
          >
            <span className="cycle-name">{cycle.label}</span>
            <span className="cycle-temp">{cycle.targetC}°C</span>
          </button>
        )
      })}
    </div>
  )
}
