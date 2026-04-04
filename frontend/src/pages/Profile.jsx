import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import EloChart, { ELO_TRACKS } from "../components/EloChart"
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

export default function ProfilePage() {
  const { username = "" } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState(null)
  const [recentGames, setRecentGames] = useState([])
  const [ratingTrack, setRatingTrack] = useState("overall")

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
    const ratings = normalizeRatings(source)
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
      ratings,
      winsLabel: `${gamesWon} (${formatRate(gamesWon)})`,
      lossesLabel: `${gamesLost} (${formatRate(gamesLost)})`,
      drawsLabel: `${gamesDrawn} (${formatRate(gamesDrawn)})`,
    }
  }, [profile])
  const selectedTrack = ELO_TRACKS.find((track) => track.key === ratingTrack) ?? ELO_TRACKS[0]
  const selectedRating = ratingTrack === "vs_humans" ? stats.ratings.vsHumans : ratingTrack === "vs_bots" ? stats.ratings.vsBots : stats.ratings.overall
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
          <section className="stats-group-card" aria-labelledby="profile-ratings-heading">
            <h3 id="profile-ratings-heading">{selectedTrack.label} rating</h3>
            <dl className="profile-stats-grid">
              <div><dt>{selectedTrack.label} Elo</dt><dd>{selectedRating.elo}</dd></div>
              <div><dt>Peak {selectedTrack.label.toLowerCase()}</dt><dd>{selectedRating.peak}</dd></div>
            </dl>
          </section>
          <section className="stats-group-card" aria-labelledby="profile-results-heading">
            <h3 id="profile-results-heading">Results</h3>
            <dl className="profile-stats-grid">
              <div><dt>Games played</dt><dd>{stats.gamesPlayed}</dd></div>
              <div><dt>Wins</dt><dd>{stats.winsLabel}</dd></div>
              <div><dt>Losses</dt><dd>{stats.lossesLabel}</dd></div>
              <div><dt>Draws</dt><dd>{stats.drawsLabel}</dd></div>
                </dl>
              </section>
            </div>
        <EloChart historyGames={recentGames} emptyText="No finished games with rating history yet." ratingTrack={ratingTrack} showTrackToggle={false} />
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
