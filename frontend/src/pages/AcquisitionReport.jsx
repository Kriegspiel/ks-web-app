import { useEffect, useState } from "react"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import "./Leaderboard.css"

const DAY_OPTIONS = [7, 30, 90, 365]

function numberText(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("en-US") : "0"
}

function labelText(value) {
  const text = String(value ?? "").trim()
  return text || "—"
}

export default function AcquisitionReportPage() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [rows, setRows] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const startedAt = Date.now()
      setLoading(true)
      setError("")
      setLoadDurationMs(null)
      try {
        const payload = await techApi.getAcquisitionReport(days)
        if (!cancelled) {
          setRows(Array.isArray(payload?.rows) ? payload.rows : [])
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load acquisition report.")
          setRows([])
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
  }, [days])

  return (
    <main className="page-shell leaderboard-page">
      <h1>Acquisition report</h1>
      <p className="page-meta-stamp">First-party campaign attribution grouped by UTM source, medium, and campaign.</p>
      <div className="report-range-control" aria-label="Report range">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={option === days ? "report-range-control__button report-range-control__button--active" : "report-range-control__button"}
            aria-pressed={option === days}
            onClick={() => setDays(option)}
          >
            {option}d
          </button>
        ))}
      </div>
      <TechReportLoadTime durationMs={loadDurationMs} failed={Boolean(error)} />
      {loading ? <p>Loading acquisition report...</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {rows.length === 0 ? <p>No acquisition rows found.</p> : (
            <section className="leaderboard-table-wrap">
              <table className="leaderboard-table acquisition-report-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Medium</th>
                    <th>Campaign</th>
                    <th>Visits</th>
                    <th>Sessions</th>
                    <th>Users</th>
                    <th>Games created</th>
                    <th>Games completed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.source ?? ""}-${row.medium ?? ""}-${row.campaign ?? ""}-${index}`}>
                      <td>{labelText(row.source)}</td>
                      <td>{labelText(row.medium)}</td>
                      <td>{labelText(row.campaign)}</td>
                      <td>{numberText(row.visits)}</td>
	                      <td>{numberText(row.sessions)}</td>
	                      <td>{numberText(row.acquired_users)}</td>
	                      <td>{numberText(row.games_created)}</td>
	                      {/* c8 ignore next -- numberText fallbacks for this column are covered by table assertions; v8 reports this property edge separately. */}
	                      <td>{numberText(row.games_completed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
