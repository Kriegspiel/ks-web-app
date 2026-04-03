import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { userApi } from "../services/api"
import { formatUtcDate } from "../utils/dateTime"
import "./Profile.css"

function formatDate(value) {
  return formatUtcDate(value) || "Unknown"
}

function statOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function buildEloSeries(historyGames) {
  if (!Array.isArray(historyGames)) {
    return []
  }

  return [...historyGames]
    .filter((game) => Number.isFinite(Number(game?.elo_after)))
    .sort((left, right) => Date.parse(left?.played_at ?? "") - Date.parse(right?.played_at ?? ""))
    .map((game, index) => ({
      index,
      label: game?.played_at ? formatUtcDate(game.played_at) : `Game ${index + 1}`,
      elo: Number(game.elo_after),
      delta: Number(game?.elo_delta ?? 0),
    }))
}

function buildChartPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { polyline: "", circles: [] }
  }

  const width = 320
  const height = 112
  const paddingX = 12
  const paddingY = 12
  const minElo = Math.min(...points.map((point) => point.elo))
  const maxElo = Math.max(...points.map((point) => point.elo))
  const eloRange = Math.max(1, maxElo - minElo)
  const xStep = points.length === 1 ? 0 : (width - paddingX * 2) / (points.length - 1)

  const circles = points.map((point, index) => {
    const x = paddingX + (xStep * index)
    const y = height - paddingY - (((point.elo - minElo) / eloRange) * (height - paddingY * 2))
    return { ...point, x, y }
  })

  return {
    polyline: circles.map((point) => `${point.x},${point.y}`).join(" "),
    circles,
  }
}

export default function ProfilePage() {
  const { username = "" } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState(null)
  const [recentGames, setRecentGames] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const [profileResponse, historyResponse] = await Promise.all([
          userApi.getProfile(username),
          userApi.getGameHistory(username, 1, 5),
        ])
        if (cancelled) return

        setProfile(profileResponse)
        setRecentGames(Array.isArray(historyResponse?.games) ? historyResponse.games : [])
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.status === 404 ? "Profile not found." : (apiError?.message ?? "Unable to load profile."))
          setProfile(null)
          setRecentGames([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username])

  const stats = useMemo(() => {
    const source = profile?.stats ?? {}
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
  }, [profile])
  const eloSeries = useMemo(() => buildEloSeries(recentGames), [recentGames])
  const eloChart = useMemo(() => buildChartPoints(eloSeries), [eloSeries])

  if (loading) {
    return <main className="page-shell profile-page"><h1>Profile</h1><p>Loading profile…</p></main>
  }

  if (error) {
    return <main className="page-shell profile-page"><h1>Profile</h1><p role="alert" className="auth-error">{error}</p></main>
  }

  return (
    <main className="page-shell profile-page">
      <h1>{profile?.username}</h1>
      <p>Member since {formatDate(profile?.member_since)}</p>

      <section className="profile-card" aria-label="User stats">
        <h2>Stats</h2>
        <dl className="profile-stats-grid">
          <div><dt>Games played</dt><dd>{stats.gamesPlayed}</dd></div>
          <div><dt>Wins</dt><dd>{stats.winsLabel}</dd></div>
          <div><dt>Losses</dt><dd>{stats.lossesLabel}</dd></div>
          <div><dt>Draws</dt><dd>{stats.drawsLabel}</dd></div>
          <div><dt>ELO</dt><dd>{stats.elo}</dd></div>
          <div><dt>Peak</dt><dd>{stats.eloPeak}</dd></div>
        </dl>
      </section>

      <section className="profile-card" aria-labelledby="profile-elo-heading">
        <h2 id="profile-elo-heading">Elo rating</h2>
        {eloSeries.length > 0 ? (
          <div className="profile-elo-chart">
            <svg viewBox="0 0 320 112" role="img" aria-label="Elo rating over time">
              <polyline className="profile-elo-chart__line" fill="none" points={eloChart.polyline} />
              {eloChart.circles.map((point) => (
                <circle key={`${point.label}-${point.index}`} className="profile-elo-chart__point" cx={point.x} cy={point.y} r="3.5">
                  <title>{`${point.label}: ${point.elo}${point.delta ? ` (${point.delta > 0 ? "+" : ""}${point.delta})` : ""}`}</title>
                </circle>
              ))}
            </svg>
            <div className="profile-elo-chart__summary">
              <span>Start {eloSeries[0].elo}</span>
              <span>Latest {eloSeries[eloSeries.length - 1].elo}</span>
            </div>
          </div>
        ) : (
          <p>No finished games with rating history yet.</p>
        )}
      </section>

      <section className="profile-card" aria-label="Recent games">
        <h2>Recent games</h2>
        {recentGames.length === 0 ? <p>No completed games yet.</p> : (
          <ul className="profile-recent-list">
            {recentGames.map((game) => (
              <li key={game.game_id}>
                <span>{game.result} vs {game.opponent ?? "unknown"}</span>
                <Link to={`/game/${game.game_id}/review`}>Review</Link>
              </li>
            ))}
          </ul>
        )}
        <Link to={`/user/${profile?.username}/games`} className="profile-all-games-link">View all games</Link>
      </section>
    </main>
  )
}
