import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { getMyGames } from "../services/api"

const ACTIVE_STATES = new Set(["active"])

function formatUpdatedAt(isoDate) {
  if (!isoDate) {
    return ""
  }

  try {
    return new Date(isoDate).toLocaleString()
  } catch {
    return isoDate
  }
}

function sortRecentGames(games) {
  if (!Array.isArray(games)) {
    return []
  }

  return [...games]
    .sort((left, right) => {
      const leftTime = Date.parse(left?.updated_at ?? left?.created_at ?? "")
      const rightTime = Date.parse(right?.updated_at ?? right?.created_at ?? "")
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
    })
    .slice(0, 5)
}

function getActiveGame(games) {
  return games.find((game) => ACTIVE_STATES.has(String(game?.state ?? "").toLowerCase())) ?? null
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth()
  const [myGames, setMyGames] = useState([])
  const [myGamesLoading, setMyGamesLoading] = useState(false)
  const [myGamesError, setMyGamesError] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      setMyGames([])
      setMyGamesLoading(false)
      setMyGamesError("")
      return
    }

    let cancelled = false

    async function loadMyGames() {
      setMyGamesLoading(true)
      try {
        const response = await getMyGames()
        if (cancelled) {
          return
        }
        setMyGames(Array.isArray(response?.games) ? response.games : [])
        setMyGamesError("")
      } catch (error) {
        if (!cancelled) {
          setMyGamesError(error?.message ?? "Unable to load your games right now.")
        }
      } finally {
        if (!cancelled) {
          setMyGamesLoading(false)
        }
      }
    }

    loadMyGames()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const recentGames = useMemo(() => sortRecentGames(myGames), [myGames])
  const activeGame = useMemo(() => getActiveGame(myGames), [myGames])
  const playNowPath = isAuthenticated
    ? (activeGame?.game_id ? `/game/${activeGame.game_id}` : "/lobby")
    : "/auth/login"

  return (
    <main className="page-shell home-page">
      <h1>Home</h1>
      {isAuthenticated ? (
        <>
          <p>Welcome back, {user?.username ?? "player"}.</p>
          <nav className="inline-links" aria-label="Home quick actions">
            <Link to={playNowPath}>{activeGame ? "Resume active game" : "Play now"}</Link>
            <Link to="/lobby">Browse lobby</Link>
            <Link to="/rules">Read rules</Link>
          </nav>

          <section className="home-card" aria-labelledby="home-recent-games-heading">
            <h2 id="home-recent-games-heading">Recent games</h2>
            {myGamesLoading ? <p>Loading your recent games…</p> : null}
            {myGamesError ? <p className="auth-error" role="alert">{myGamesError}</p> : null}
            {!myGamesLoading && !myGamesError && recentGames.length === 0 ? <p>No games yet. Start one from the lobby.</p> : null}
            {recentGames.length > 0 ? (
              <ul className="lobby-list">
                {recentGames.map((game) => {
                  const isActive = ACTIVE_STATES.has(String(game?.state ?? "").toLowerCase())
                  return (
                    <li key={`home-${game.game_id ?? game.game_code}`}>
                      <div>
                        <strong>{game.game_code ?? game.game_id}</strong> · {game.state}
                        {isActive ? <span className="status-pill">Active</span> : null}
                        <div className="lobby-meta">Updated {formatUpdatedAt(game.updated_at ?? game.created_at)}</div>
                      </div>
                      <Link to={`/game/${game.game_id}`}>Open</Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <p>Please login or create an account.</p>
          <nav className="inline-links" aria-label="Home quick actions">
            <Link to={playNowPath}>Play now</Link>
            <Link to="/rules">Read rules</Link>
            <Link to="/auth/register">Create account</Link>
          </nav>
        </>
      )}
      <VersionStamp />
    </main>
  )
}
