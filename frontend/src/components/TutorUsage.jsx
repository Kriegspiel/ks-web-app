function money(value) { return `$${value.toFixed(6)}` }

export default function TutorUsage({ session }) {
  const usage = session.usage
  if (!usage) return null
  return <details className="coach-usage">
    <summary>Session usage · {usage.total_tokens.toLocaleString()} tokens · ≈{money(usage.api_equivalent_usd)}</summary>
    <p>Estimated Standard API-equivalent value, not a charge to your ChatGPT subscription.</p>
    <dl>{[
      ["Model requests", usage.requests], ["Input tokens", usage.input_tokens], ["Cached input (included above)", usage.cached_input_tokens],
      ["Cache writes (included in input)", usage.cache_write_tokens], ["Output tokens", usage.output_tokens],
      ["Reasoning (included in output)", usage.reasoning_tokens], ["Usage-unreported requests", usage.unknown_requests],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl>
    {usage.unknown_requests > 0 ? <p className="coach-alert">Some request usage is unknown. These totals may be incomplete; unknown does not mean free.</p> : null}
    {usage.legacy_input_tokens + usage.legacy_output_tokens > 0 ? <p>Earlier token totals are preserved. Their cache and reasoning breakdowns were not recorded; their dollar value assumes uncached input.</p> : null}
    {usage.incomplete_cache_requests > 0 ? <p>Some cache details were not reported. Missing cache counts are treated as uncached input for this estimate.</p> : null}
    {usage.incomplete_reasoning_requests > 0 ? <p>Some reasoning details were not reported. Output totals still include all reported output tokens.</p> : null}
    <p><a href={usage.pricing_source} target="_blank" rel="noreferrer">Pricing reference</a> · {usage.pricing_version}</p>
    <p>Latest 20 requests. Session totals include all recorded requests.</p>
    <ol>{session.usage_events.map((event) => <li key={event.call_id}>
      <strong>{event.status}</strong> · {event.started_at} · {event.duration_ms ?? 0} ms
      {event.reported ? <> · {event.total_tokens.toLocaleString()} tokens · ≈{money(event.api_equivalent_nanodollars / 1_000_000_000)}</> : " · usage unknown"}
      {event.reported ? <span>Input {event.input_tokens.toLocaleString()} · cached {event.cached_input_tokens.toLocaleString()} · cache writes {event.cache_write_tokens.toLocaleString()} · output {event.output_tokens.toLocaleString()} · reasoning {event.reasoning_tokens.toLocaleString()}</span> : null}
    </li>)}</ol>
  </details>
}
