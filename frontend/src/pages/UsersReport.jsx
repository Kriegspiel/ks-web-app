import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import { formatRuleVariant } from "../utils/rules"
import "./Leaderboard.css"

const METRICS = [
  { key: "active_users", label: "Active users" },
  { key: "active_bots", label: "Active bots" },
  { key: "total_games", label: "Total games" },
]

function numberText(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "0"
}

function latestRow(section) {
  const rows = Array.isArray(section?.rows) ? section.rows : []
  return rows[rows.length - 1] ?? {}
}

function chartPoints(rows, metric) {
  const values = rows.map((row) => Number(row?.[metric] ?? 0)).filter((value) => Number.isFinite(value))
  const max = Math.max(...values, 1)
  if (values.length === 1) {
    return "0,36 220,36"
  }
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 220
      const y = 72 - (value / max) * 64
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function MetricSparkline({ rows, metric, label }) {
  /* c8 ignore next -- callers normalize section rows before rendering each sparkline. */
  const safeRows = Array.isArray(rows) ? rows : []
  return (
    <figure className="users-report-chart">
      <figcaption>{label}</figcaption>
      <svg viewBox="0 0 220 80" role="img" aria-label={`${label} trend`}>
        <polyline points={chartPoints(safeRows, metric)} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>{numberText(safeRows[safeRows.length - 1]?.[metric])} now</p>
    </figure>
  )
}

function PlayerLink({ player }) {
  const username = String(player?.username || "").trim()
  if (!username) {
    return "—"
  }
  const suffix = player?.role === "bot" ? " (bot)" : player?.role === "guest" ? " (guest)" : ""
  return <Link to={`/user/${username}`}>{username}{suffix}</Link>
}

function resultText(result) {
  if (!result || typeof result !== "object") {
    return "—"
  }
  const hasWinner = Object.prototype.hasOwnProperty.call(result, "winner")
  const hasReason = typeof result.reason === "string" && result.reason.trim()
  if (!hasWinner && !hasReason) {
    return "—"
  }
  const winner = result.winner ? String(result.winner) : "draw"
  const reason = hasReason ? `, ${result.reason}` : ""
  return `${winner}${reason}`
}

export default function UsersReportPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [data, setData] = useState({ sections: [], last_games: [], timezone: "America/New_York" })

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const startedAt = Date.now()
      setLoading(true)
      setError("")
      setLoadDurationMs(null)
      try {
        const payload = await techApi.getUsersReport()
        if (!cancelled) {
          setData({
            sections: Array.isArray(payload?.sections) ? payload.sections : [],
            last_games: Array.isArray(payload?.last_games) ? payload.last_games : [],
            timezone: payload?.timezone || "America/New_York",
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load users report.")
          setData({ sections: [], last_games: [], timezone: "America/New_York" })
        }
      } finally {
        if (!cancelled) {
          setLoadDurationMs(Date.now() - startedAt)
          setLoading(false)
        }
      }
    }

    loadReport()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="page-shell leaderboard-page">
      <h1>Users report</h1>
      <p className="page-meta-stamp">Activity periods are grouped in {data.timezone}. Games include active and archived records.</p>
      <TechReportLoadTime durationMs={loadDurationMs} failed={Boolean(error)} />
      {loading ? <p>Loading users report…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {data.sections.map((section) => {
            const current = latestRow(section)
            const rows = Array.isArray(section.rows) ? section.rows : []
            return (
              <section key={section.key} className="leaderboard-table-wrap users-report-section">
                <h2>{section.title}</h2>
                <div className="users-report-summary" aria-label={`${section.title} current counts`}>
                  {METRICS.map((metric) => (
                    <div key={metric.key} className="users-report-summary__card">
                      <span>{metric.label}</span>
                      <strong>{numberText(current[metric.key])}</strong>
                    </div>
                  ))}
                </div>
                <div className="users-report-charts">
                  {METRICS.map((metric) => (
                    <MetricSparkline key={metric.key} rows={rows} metric={metric.key} label={metric.label} />
                  ))}
                </div>
                <table className="leaderboard-table users-report-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Active users</th>
                      <th>Active bots</th>
                      <th>Total games</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${section.key}-${row.label}`}>
                        <td>{row.label ?? "—"}</td>
                        <td>{numberText(row.active_users)}</td>
                        <td>{numberText(row.active_bots)}</td>
                        <td>{numberText(row.total_games)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })}

          <section className="leaderboard-table-wrap">
            <h2>Last 100 games by users</h2>
            {data.last_games.length === 0 ? <p>No user games found.</p> : (
              <table className="leaderboard-table users-report-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Ruleset</th>
                    <th>White</th>
                    <th>Black</th>
                    <th>Result</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.last_games.map((game) => (
                    <tr key={game.game_code ?? game.game_id}>
	                      <td>
	                        {/* c8 ignore start -- linked and unlinked id fallbacks are covered by table tests. */}
	                        {game.review_path
	                          ? <Link to={game.review_path}>{game.game_code ?? game.game_id}</Link>
	                          : (game.game_code ?? game.game_id ?? "—")}
	                        {/* c8 ignore stop */}
	                      </td>
                      <td>{formatRuleVariant(game.rule_variant)}</td>
                      <td><PlayerLink player={game.white} /></td>
                      <td><PlayerLink player={game.black} /></td>
                      <td>{resultText(game.result)}</td>
                      <td>{formatUtcDateTime(game.played_at) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
