import { formatSessionSummary } from '../lib/sessions.js'

export default function LastSession({ session }) {
  const summary = formatSessionSummary(session)

  if (!summary) {
    return null
  }

  return (
    <div className="last-session">
      <span className="last-session-label">Last session</span>
      <span className="last-session-value">{summary}</span>
    </div>
  )
}
