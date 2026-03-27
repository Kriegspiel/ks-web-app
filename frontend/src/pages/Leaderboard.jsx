import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { userApi } from "../services/api"
import "./Leaderboard.css"

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ players: [], pagination: { page: 1, pages: 0, total: 0 } })

  useEffect(() => {
    let cancelled = false
    async function loadLeaderboard() {
      setLoading(true)
      setError("")
      try {
        const payload = await userApi.getLeaderboard(page, 20)
        if (!cancelled) {
          setData({
            players: Array.isArray(payload?.players) ? payload.players : [],
            pagination: payload?.pagination ?? { page, pages: 0, total: 0 },
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load leaderboard.")
          setData({ players: [], pagination: { page, pages: 0, total: 0 } })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLeaderboard()
    return () => { cancelled = true }
  }, [page])

  const pagination = data.pagination ?? { page, pages: 0, total: 0 }

  return (
    <main className="page-shell leaderboard-page">
      <h1>Leaderboard</h1>
      {loading ? <p>Loading leaderboard…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {data.players.length === 0 ? <p>No ranked players found.</p> : (
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead><tr><th>Rank</th><th>Username</th><th>ELO</th><th>Games</th><th>Win rate</th></tr></thead>
                <tbody>
                  {data.players.map((player) => (
                    <tr key={`${player.username}-${player.rank}`}>
                      <td>{player.rank}</td>
                      <td><Link to={`/user/${player.username}`}>{player.username}</Link></td>
                      <td>{player.elo}</td>
                      <td>{player.games_played}</td>
                      <td>{(Number(player.win_rate ?? 0) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination-controls">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1}>Prev</button>
            <span>Page {pagination.page ?? page} of {pagination.pages ?? 0}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={pagination.pages > 0 ? page >= pagination.pages : data.players.length === 0}>Next</button>
          </div>
        </>
      ) : null}
    </main>
  )
}
