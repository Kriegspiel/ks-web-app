import { useEffect, useState } from "react"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import "./Leaderboard.css"

export default function BotsReportPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState({ bots: [], rows: [], timezone: "America/New_York" })

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      setError("")
      try {
        const payload = await techApi.getBotsReport(10)
        if (!cancelled) {
          setData({
            bots: Array.isArray(payload?.bots) ? payload.bots : [],
            rows: Array.isArray(payload?.rows) ? payload.rows : [],
            timezone: payload?.timezone || "America/New_York",
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load bots report.")
          setData({ bots: [], rows: [], timezone: "America/New_York" })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReport()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="page-shell leaderboard-page">
      <h1>Bots report</h1>
      <p className="page-meta-stamp">Listed bots only. Daily game counts for the last 10 days in {data.timezone}.</p>
      {loading ? <p>Loading bots report…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {data.bots.map((bot) => <th key={bot}>{bot}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    {data.bots.map((bot) => <td key={`${row.date}-${bot}`}>{Number(row?.counts?.[bot] ?? 0).toLocaleString("en-US")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
