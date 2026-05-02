export function formatLoadDuration(ms) {
  const duration = Number(ms)
  if (!Number.isFinite(duration) || duration < 0) {
    return ""
  }
  if (duration < 1000) {
    return `${Math.round(duration)} ms`
  }
  return `${(duration / 1000).toFixed(duration < 10_000 ? 1 : 0)} s`
}

export default function TechReportLoadTime({ durationMs, failed = false }) {
  if (durationMs === null || durationMs === undefined) {
    return null
  }

  return (
    <p className="page-meta-stamp tech-report-load-time">
      {failed ? "Request failed after " : "Loaded in "}{formatLoadDuration(durationMs)}.
    </p>
  )
}
