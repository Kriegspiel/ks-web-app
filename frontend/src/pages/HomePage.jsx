import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import EloChart from "../components/EloChart"
import { ELO_TRACKS } from "../components/eloChartConstants"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { getMyGames, userApi } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import { formatRuleVariant } from "../utils/rules"

const ACTIVE_STATES = new Set(["active"])
const RULES_URL = "https://kriegspiel.org/rules"

function statOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function normalizeRatings(source) {
  const ratings = source?.ratings ?? {}
  const track = (key, fallbackElo, fallbackPeak) => ({
    elo: statOrZero(ratings?.[key]?.elo ?? fallbackElo),
    peak: statOrZero(ratings?.[key]?.peak ?? fallbackPeak),
  })

  const overall = track("overall", source?.elo, source?.elo_peak)
  return {
    overall,
    vsHumans: track("vs_humans"),
    vsBots: track("vs_bots"),
  }
}

function normalizeResults(source) {
  const results = source?.results ?? {}
  const track = (key, fallback) => {
    const current = results?.[key] ?? fallback
    return {
      gamesPlayed: statOrZero(current?.games_played),
      gamesWon: statOrZero(current?.games_won),
      gamesLost: statOrZero(current?.games_lost),
      gamesDrawn: statOrZero(current?.games_drawn),
    }
  }
  return {
    overall: track("overall", source),
    vsHumans: track("vs_humans"),
    vsBots: track("vs_bots"),
  }
}

function formatResultSummary(resultTrack) {
  const gamesPlayed = statOrZero(resultTrack?.gamesPlayed)
  const gamesWon = statOrZero(resultTrack?.gamesWon)
  const gamesLost = statOrZero(resultTrack?.gamesLost)
  const gamesDrawn = statOrZero(resultTrack?.gamesDrawn)
  const formatRate = (value) => `${gamesPlayed > 0 ? ((value / gamesPlayed) * 100).toFixed(1) : "0.0"}%`
  return {
    gamesPlayed,
    winsLabel: `${gamesWon} (${formatRate(gamesWon)})`,
    lossesLabel: `${gamesLost} (${formatRate(gamesLost)})`,
    drawsLabel: `${gamesDrawn} (${formatRate(gamesDrawn)})`,
  }
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
  const [profile, setProfile] = useState(null)
  const [ratingSeries, setRatingSeries] = useState({ game: [], date: [] })
  const [myGamesLoading, setMyGamesLoading] = useState(false)
  const [myGamesError, setMyGamesError] = useState("")
  const [ratingTrack, setRatingTrack] = useState("overall")

  useEffect(() => {
    if (!isAuthenticated) {
      setMyGames([])
      setProfile(null)
      setRatingSeries({ game: [], date: [] })
      setMyGamesLoading(false)
      setMyGamesError("")
      return
    }

    let cancelled = false

    async function loadMyGames() {
      setMyGamesLoading(true)
      try {
        const [gamesResponse, profileResponse, historyResponse] = await Promise.all([
          getMyGames(),
          user?.username ? userApi.getProfile(user.username) : Promise.resolve(null),
          user?.username ? userApi.getRatingHistory(user.username, ratingTrack, 100) : Promise.resolve({ series: { game: [], date: [] } }),
        ])
        if (cancelled) {
          return
        }
        setMyGames(Array.isArray(gamesResponse?.games) ? gamesResponse.games : [])
        setProfile(profileResponse)
        setRatingSeries(historyResponse?.series ?? { game: [], date: [] })
        setMyGamesError("")
      } catch (error) {
        if (!cancelled) {
          setMyGamesError(error?.message ?? "Unable to load your games right now.")
          setProfile(null)
          setRatingSeries({ game: [], date: [] })
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
  }, [isAuthenticated, ratingTrack, user?.username])

  const recentGames = useMemo(() => sortRecentGames(myGames), [myGames])
  const activeGame = useMemo(() => getActiveGame(myGames), [myGames])
  const stats = useMemo(() => {
    const source = profile?.stats ?? user?.stats ?? {}
    const ratings = normalizeRatings(source)
    const results = normalizeResults(source)
    return {
      ratings,
      results,
    }
  }, [profile?.stats, user?.stats])
  const selectedTrack = ELO_TRACKS.find((track) => track.key === ratingTrack) ?? ELO_TRACKS[0]
  const selectedRating = ratingTrack === "vs_humans" ? stats.ratings.vsHumans : ratingTrack === "vs_bots" ? stats.ratings.vsBots : stats.ratings.overall
  const selectedResults = ratingTrack === "vs_humans" ? stats.results.vsHumans : ratingTrack === "vs_bots" ? stats.results.vsBots : stats.results.overall
  const selectedHistoryStats = useMemo(() => formatResultSummary(selectedResults), [selectedResults])
  const playNowPath = isAuthenticated
    ? (activeGame?.game_code || activeGame?.game_id ? `/game/${activeGame?.game_code ?? activeGame?.game_id}` : "/lobby")
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
            <div className="elo-chart__track-toggle" role="tablist" aria-label="Elo track">
              {ELO_TRACKS.map((track) => (
                <button
                  key={track.key}
                  type="button"
                  role="tab"
                  aria-selected={ratingTrack === track.key}
                  className={`elo-chart__track-pill${ratingTrack === track.key ? " is-active" : ""}`}
                  onClick={() => setRatingTrack(track.key)}
                >
                  {track.label}
                </button>
              ))}
            </div>
            <div className="stats-group-grid">
              <section className="stats-group-card" aria-labelledby="home-ratings-heading">
                <h3 id="home-ratings-heading">{selectedTrack.label} rating</h3>
                <dl className="home-stats-grid">
                  <div><dt>{selectedTrack.label} Elo</dt><dd>{selectedRating.elo}</dd></div>
                  <div><dt>Peak {selectedTrack.label.toLowerCase()}</dt><dd>{selectedRating.peak}</dd></div>
                </dl>
              </section>
              <section className="stats-group-card" aria-labelledby="home-results-heading">
                <h3 id="home-results-heading">{selectedTrack.label} results</h3>
                <dl className="home-stats-grid">
                  <div><dt>Games</dt><dd>{selectedHistoryStats.gamesPlayed}</dd></div>
                  <div><dt>Wins</dt><dd>{selectedHistoryStats.winsLabel}</dd></div>
                  <div><dt>Losses</dt><dd>{selectedHistoryStats.lossesLabel}</dd></div>
                  <div><dt>Draws</dt><dd>{selectedHistoryStats.drawsLabel}</dd></div>
                </dl>
              </section>
            </div>
            <EloChart seriesByMode={ratingSeries} emptyText="No finished games with rating history yet." ratingTrack={ratingTrack} showTrackToggle={false} />
          </section>

          <section className="home-card" aria-labelledby="home-recent-games-heading">
            <h2 id="home-recent-games-heading">Recent games</h2>
            {myGamesLoading ? <p>Loading your recent games…</p> : null}
            {myGamesError ? <p className="auth-error" role="alert">{myGamesError}</p> : null}
            {!myGamesLoading && !myGamesError && recentGames.length === 0 ? <p>No games yet. Start one from the lobby.</p> : null}
            {recentGames.length > 0 ? (
              <>
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
                          <div className="lobby-meta">Rules: {formatRuleVariant(game.rule_variant)}</div>
                          <div className="lobby-meta">Updated {formatUpdatedAt(game.updated_at ?? game.created_at)}</div>
                        </div>
                        <Link to={`/game/${game.game_code ?? game.game_id}`}>Open</Link>
                      </li>
                    )
                  })}
                </ul>
                {user?.username ? (
                  <div className="home-recent-games-footer">
                    <Link to={`/user/${user.username}/games`} className="home-all-games-link">View all games</Link>
                  </div>
                ) : null}
              </>
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
