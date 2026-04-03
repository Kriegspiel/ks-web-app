import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { userApi } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import "./GameHistory.css"

function formatDate(value) {
  return formatUtcDateTime(value) || "—"
}

export default function GameHistoryPage() {
  const { username = "" } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState({ games: [], pagination: { page: 1, pages: 0, total: 0 } })

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      setLoading(true)
      setError("")
      try {
        const payload = await userApi.getGameHistory(username, page, 20)
        if (!cancelled) {
          setHistory({
            games: Array.isArray(payload?.games) ? payload.games : [],
            pagination: payload?.pagination ?? { page, pages: 0, total: 0 },
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.status === 404 ? "User not found." : (apiError?.message ?? "Unable to load game history."))
          setHistory({ games: [], pagination: { page, pages: 0, total: 0 } })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [username, page])

  const pagination = history.pagination ?? { page, pages: 0, total: 0 }

  return (
    <main className="page-shell history-page">
      <h1>{username}&apos;s game history</h1>
      {loading ? <p>Loading history…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {history.games.length === 0 ? <p>No games found on this page.</p> : (
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Opponent</th><th>Color</th><th>Result</th><th>Reason</th><th>Moves</th><th>Date</th><th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {history.games.map((game) => (
                    <tr key={game.game_id}>
                      <td>{game.opponent ?? "—"}</td>
                      <td>{game.play_as}</td>
                      <td>{game.result}</td>
                      <td>{game.reason ?? "—"}</td>
                      <td>{game.move_count ?? 0}</td>
                      <td>{formatDate(game.played_at)}</td>
                      <td><Link to={`/game/${game.game_id}/review`}>Open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pagination-controls">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1}>Prev</button>
            <span>Page {pagination.page ?? page} of {pagination.pages ?? 0}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={pagination.pages > 0 ? page >= pagination.pages : history.games.length === 0}>Next</button>
          </div>
        </>
      ) : null}
    </main>
  )
}
