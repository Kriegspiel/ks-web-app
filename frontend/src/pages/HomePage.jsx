import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import EloChart from "../components/EloChart"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { getMyGames, userApi } from "../services/api"
import { formatUtcDate, formatUtcDateTime } from "../utils/dateTime"

const ACTIVE_STATES = new Set(["active"])
const RULES_URL = "https://kriegspiel.org/rules"

function statOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function formatUpdatedAt(isoDate) {
  return formatUtcDateTime(isoDate)
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

function renderPlayerLink(player, fallback) {
  const username = String(player?.username || "").trim()
  if (!username) {
    return fallback
  }

  return (
    <Link to={`/user/${username}`}>
      {username}
      {player?.role === "bot" ? " (bot)" : ""}
    </Link>
  )
}

function renderExternalRulesLink() {
  return (
    <a href={RULES_URL} target="_blank" rel="noreferrer noopener" aria-label="Read rules (opens external page)">
      Read rules ↗
    </a>
  )
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth()
  const [myGames, setMyGames] = useState([])
  const [historyGames, setHistoryGames] = useState([])
  const [myGamesLoading, setMyGamesLoading] = useState(false)
  const [myGamesError, setMyGamesError] = useState("")

  useEffect(() => {
    if (!isAuthenticated) {
      setMyGames([])
      setHistoryGames([])
      setMyGamesLoading(false)
      setMyGamesError("")
      return
    }

    let cancelled = false

    async function loadMyGames() {
      setMyGamesLoading(true)
      try {
        const [gamesResponse, historyResponse] = await Promise.all([
          getMyGames(),
          user?.username ? userApi.getGameHistory(user.username, 1, 20) : Promise.resolve({ games: [] }),
        ])
        if (cancelled) {
          return
        }
        setMyGames(Array.isArray(gamesResponse?.games) ? gamesResponse.games : [])
        setHistoryGames(Array.isArray(historyResponse?.games) ? historyResponse.games : [])
        setMyGamesError("")
      } catch (error) {
        if (!cancelled) {
          setMyGamesError(error?.message ?? "Unable to load your games right now.")
          setHistoryGames([])
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
  }, [isAuthenticated, user?.username])

  const recentGames = useMemo(() => sortRecentGames(myGames), [myGames])
  const activeGame = useMemo(() => getActiveGame(myGames), [myGames])
  const stats = useMemo(() => {
    const source = user?.stats ?? {}
    const gamesPlayed = statOrZero(source.games_played)
    const gamesWon = statOrZero(source.games_won)
    const gamesLost = statOrZero(source.games_lost)
    const gamesDrawn = statOrZero(source.games_drawn)
    const formatRate = (value) => `${gamesPlayed > 0 ? ((value / gamesPlayed) * 100).toFixed(1) : "0.0"}%`
    return {
      gamesPlayed,
      gamesWon,
      gamesLost,
      gamesDrawn,
      elo: statOrZero(source.elo),
      eloPeak: statOrZero(source.elo_peak),
      winsLabel: `${gamesWon} (${formatRate(gamesWon)})`,
      lossesLabel: `${gamesLost} (${formatRate(gamesLost)})`,
      drawsLabel: `${gamesDrawn} (${formatRate(gamesDrawn)})`,
    }
  }, [user?.stats])
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
            <Link to="/leaderboard">Leaderboard</Link>
            {renderExternalRulesLink()}
          </nav>

          <section className="home-card" aria-labelledby="home-stats-heading">
            <h2 id="home-stats-heading">Your stats</h2>
            <dl className="home-stats-grid">
              <div><dt>Elo</dt><dd>{stats.elo}</dd></div>
              <div><dt>Peak Elo</dt><dd>{stats.eloPeak}</dd></div>
              <div><dt>Games</dt><dd>{stats.gamesPlayed}</dd></div>
              <div><dt>Wins</dt><dd>{stats.winsLabel}</dd></div>
              <div><dt>Losses</dt><dd>{stats.lossesLabel}</dd></div>
              <div><dt>Draws</dt><dd>{stats.drawsLabel}</dd></div>
            </dl>
          </section>

          <section className="home-card" aria-labelledby="home-elo-heading">
            <h2 id="home-elo-heading">Elo rating</h2>
            <EloChart historyGames={historyGames} emptyText="No finished games with rating history yet." />
          </section>

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
                        <div className="lobby-meta">
                          {renderPlayerLink(game.white, "Waiting…")}
                          {" vs "}
                          {renderPlayerLink(game.black, "Waiting…")}
                        </div>
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
            {renderExternalRulesLink()}
            <Link to="/auth/register">Create account</Link>
          </nav>
        </>
      )}
      <VersionStamp />
    </main>
  )
}
