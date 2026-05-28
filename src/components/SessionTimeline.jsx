const STEPS = [
  { id: 'heat', label: 'Heat' },
  { id: 'ready', label: 'Ready' },
  { id: 'extract', label: 'Extract' },
]

function stepState(stepId, phase) {
  const order = ['heating', 'ready', 'fanning', 'complete']
  const stepPhase = {
    heat: 'heating',
    ready: 'ready',
    extract: 'fanning',
  }

  const currentIndex = order.indexOf(phase)
  const stepIndex = order.indexOf(stepPhase[stepId])

  if (phase === 'complete') {
    return 'done'
  }

  if (currentIndex === -1 || stepIndex === -1) {
    return 'idle'
  }

  if (stepIndex < currentIndex) {
    return 'done'
  }

  if (stepIndex === currentIndex) {
    return 'active'
  }

  return 'idle'
}

export default function SessionTimeline({ phase }) {
  const isVisible = ['heating', 'ready', 'fanning', 'complete'].includes(phase)

  if (!isVisible) {
    return null
  }

  return (
    <div className="session-timeline" aria-label="Session progress">
      {STEPS.map((step, index) => {
        const state = stepState(step.id, phase)

        return (
          <div key={step.id} className="timeline-item">
            <div className={`timeline-node state-${state}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <span className="timeline-label">{step.label}</span>
            </div>
            {index < STEPS.length - 1 ? (
              <div className={`timeline-line state-${state}`} aria-hidden="true" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
