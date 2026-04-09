import { useEffect, useState } from "react"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import "./Leaderboard.css"

export default function BotsReportPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState({ bots: [], timezone: "America/New_York" })

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
            timezone: payload?.timezone || "America/New_York",
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load bots report.")
          setData({ bots: [], timezone: "America/New_York" })
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
      <p className="page-meta-stamp">Listed bots only. Completed-game stats for the last 10 days in {data.timezone}.</p>
      {loading ? <p>Loading bots report…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {data.bots.map((bot) => (
            <section key={bot.username} className="leaderboard-table-wrap">
              <h2>{bot.username}</h2>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Date</th>
                    <th colSpan="2">Overall</th>
                    <th colSpan="2">vs. humans</th>
                    <th colSpan="2">vs. bots</th>
                  </tr>
                  <tr>
                    <th>Total games</th>
                    <th>Win rate</th>
                    <th>Total games</th>
                    <th>Win rate</th>
                    <th>Total games</th>
                    <th>Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(bot.rows) ? bot.rows : []).map((row) => (
                    <tr key={`${bot.username}-${row.date}`}>
                      <td>{row.date}</td>
                      <td>{Number(row?.stats?.overall?.total_games ?? 0).toLocaleString("en-US")}</td>
                      <td>{(Number(row?.stats?.overall?.win_rate ?? 0) * 100).toFixed(1)}%</td>
                      <td>{Number(row?.stats?.vs_humans?.total_games ?? 0).toLocaleString("en-US")}</td>
                      <td>{(Number(row?.stats?.vs_humans?.win_rate ?? 0) * 100).toFixed(1)}%</td>
                      <td>{Number(row?.stats?.vs_bots?.total_games ?? 0).toLocaleString("en-US")}</td>
                      <td>{(Number(row?.stats?.vs_bots?.win_rate ?? 0) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
