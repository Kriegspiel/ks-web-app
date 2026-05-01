import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import { formatUtcDate, formatUtcDateTime } from "../utils/dateTime"
import "./Leaderboard.css"

function formatStartedDay(value) {
  return formatUtcDate(value) || value || "—"
}

function formatLastGame(value) {
  return formatUtcDateTime(value) || "—"
}

function formatGameCount(value) {
  const count = Number(value)
  return Number.isFinite(count) ? count.toLocaleString("en-US") : "0"
}

export default function GuestsReportPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState({ guests: [], total: 0, available_guest_accounts: 0 })

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      setLoading(true)
      setError("")
      try {
        const payload = await techApi.getGuestsReport()
        if (!cancelled) {
          const guests = Array.isArray(payload?.guests) ? payload.guests : []
          setData({
            guests,
            total: Number(payload?.total ?? guests.length),
            available_guest_accounts: Number(payload?.available_guest_accounts ?? 0),
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load guests report.")
          setData({ guests: [], total: 0, available_guest_accounts: 0 })
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
      <h1>Guests report</h1>
      <p className="page-meta-stamp">All guest accounts, with archived and currently active games counted.</p>
      {loading ? <p>Loading guests report…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {data.guests.length === 0 ? <p>No guests found.</p> : (
            <section className="leaderboard-table-wrap">
              <p className="page-meta-stamp">
                {data.total.toLocaleString("en-US")} guests listed.{" "}
                {data.available_guest_accounts.toLocaleString("en-US")} guest accounts still available.
              </p>
              <table className="leaderboard-table guests-report-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Day started</th>
                    <th>Last game</th>
                    <th>Number of games</th>
                  </tr>
                </thead>
                <tbody>
                  {data.guests.map((guest) => (
                    <tr key={guest.username ?? guest.name}>
                      <td>
                        {guest.username
                          ? <Link to={`/user/${guest.username}`}>{guest.name ?? guest.username}</Link>
                          : (guest.name ?? "—")}
                      </td>
                      <td>{formatStartedDay(guest.day_started)}</td>
                      <td>{formatLastGame(guest.last_game)}</td>
                      <td>{formatGameCount(guest.number_of_games)}</td>
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
