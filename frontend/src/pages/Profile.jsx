import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import EloChart from "../components/EloChart"
import VersionStamp from "../components/VersionStamp"
import { userApi } from "../services/api"
import { formatUtcDate } from "../utils/dateTime"
import "./Profile.css"

function formatDate(value) {
  return formatUtcDate(value) || "Unknown"
}

function statOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
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
        <EloChart historyGames={recentGames} emptyText="No finished games with rating history yet." />
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

      <VersionStamp />
    </main>
  )
}
