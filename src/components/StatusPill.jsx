const STATUS = {
  disconnected: { label: 'Offline', tone: 'neutral' },
  connecting: { label: 'Pairing', tone: 'pulse' },
  idle: { label: 'Standby', tone: 'gold' },
  heating: { label: 'Heating', tone: 'warm' },
  ready: { label: 'Ready', tone: 'gold' },
  fanning: { label: 'Extract', tone: 'cool' },
  complete: { label: 'Complete', tone: 'gold' },
  error: { label: 'Attention', tone: 'error' },
}

export default function StatusPill({ phase }) {
  const { label, tone } = STATUS[phase] || STATUS.disconnected

  return (
    <div className={`status-pill tone-${tone}${phase === 'ready' ? ' is-ready' : ''}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{label}</span>
    </div>
  )
}
