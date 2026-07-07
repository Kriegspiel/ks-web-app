import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import EloChart from "../components/EloChart"
import { ELO_TRACKS } from "../components/eloChartConstants"
import TierBadge from "../components/TierBadge"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { userApi } from "../services/api"
import { formatUtcDate } from "../utils/dateTime"
import { formatRuleVariant } from "../utils/rules"
import "./Profile.css"

const BOT_BLOG_URL = "https://kriegspiel.org/blog/bot-registration-flow"
const PROFILE_TIER_DETAILS = {
  guest: {
    code: "T0",
    name: "Guest",
    className: "profile-tier-card--guest",
  },
  tier1: {
    code: "T1",
    name: "Casual",
    className: "profile-tier-card--tier1",
  },
  tier2: {
    code: "T2",
    name: "Club",
    className: "profile-tier-card--tier2",
  },
  tier3: {
    code: "T3",
    name: "Strong",
    className: "profile-tier-card--tier3",
  },
  tier4: {
    code: "T4",
    name: "Expert",
    className: "profile-tier-card--tier4",
  },
  tier5: {
    code: "T5",
    name: "Master",
    className: "profile-tier-card--tier5",
  },
  tier6: {
    code: "T6",
    name: "Elite",
    className: "profile-tier-card--tier6",
  },
}
const BOT_LLM_TIER_DETAILS_BY_USERNAME = {
  llm_gpt45nano: {
    code: "T2",
    model: "GPT-5.4 Nano",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gptnano: {
    code: "T2",
    model: "GPT-5.4 Nano",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_haiku: {
    code: "T2",
    model: "Claude Haiku 4.5",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_deepseekv4_flash: {
    code: "T2",
    model: "DeepSeek V4 Flash",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  openrouter_deepseekv4_flash: {
    code: "T2",
    model: "DeepSeek V4 Flash",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gemini25_lite: {
    code: "T2",
    model: "Gemini 2.5 Flash-Lite",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  openrouter_gemini25_lite: {
    code: "T2",
    model: "Gemini 2.5 Flash-Lite",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gemini31_lite: {
    code: "T2",
    model: "Gemini 3.1 Flash-Lite",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  openrouter_gemini31_lite: {
    code: "T2",
    model: "Gemini 3.1 Flash-Lite",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gptoss120b: {
    code: "T2",
    model: "GPT-OSS 120B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  openrouter_gptoss120b: {
    code: "T2",
    model: "GPT-OSS 120B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_llama31_8b: {
    code: "T2",
    model: "Llama 3.1 8B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  openrouter_llama31_8b: {
    code: "T2",
    model: "Llama 3.1 8B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_llama4_scout: {
    code: "T2",
    model: "Llama 4 Scout",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_llama4_maverick: {
    code: "T2",
    model: "Llama 4 Maverick",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_mistral_nemo: {
    code: "T2",
    model: "Mistral Nemo",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_mistral_small32: {
    code: "T2",
    model: "Mistral Small 3.2",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_mistral_large3: {
    code: "T2",
    model: "Mistral Large 3",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gemma3_4b: {
    code: "T2",
    model: "Gemma 3 4B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gemma3_27b: {
    code: "T2",
    model: "Gemma 3 27B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gemma4_31b: {
    code: "T2",
    model: "Gemma 4 31B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_glm47_flash: {
    code: "T2",
    model: "GLM 4.7 Flash",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_glm45_air: {
    code: "T2",
    model: "GLM 4.5 Air",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_nemotron_nano: {
    code: "T2",
    model: "Nemotron Nano",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_nemotron_super: {
    code: "T2",
    model: "Nemotron Super",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_nemotron_ultra: {
    code: "T2",
    model: "Nemotron Ultra",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_kimi_k25: {
    code: "T2",
    model: "Kimi K2.5",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_hermes4_70b: {
    code: "T2",
    model: "Hermes 4 70B",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_phi4: {
    code: "T2",
    model: "Phi 4",
    tierName: "Club",
    className: "profile-tier-card--tier2",
  },
  llm_gpt55: {
    code: "T3",
    model: "GPT-5.5",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_sonnet5: {
    code: "T3",
    model: "Claude Sonnet 5",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_gemini25_flash: {
    code: "T3",
    model: "Gemini 2.5 Flash",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_qwen36_flash: {
    code: "T3",
    model: "Qwen3.6 Flash",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  openrouter_qwen36_flash: {
    code: "T3",
    model: "Qwen3.6 Flash",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_qwen_plus: {
    code: "T3",
    model: "Qwen Plus",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_kimi_k2_thinking: {
    code: "T3",
    model: "Kimi K2 Thinking",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_hermes3_70b: {
    code: "T3",
    model: "Hermes 3 70B",
    tierName: "Strong",
    className: "profile-tier-card--tier3",
  },
  llm_opus48: {
    code: "T4",
    model: "Claude Opus 4.8",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  bot_deepseekv4_pro: {
    code: "T4",
    model: "DeepSeek V4 Pro",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  openrouter_deepseekv4_pro: {
    code: "T4",
    model: "DeepSeek V4 Pro",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  llm_gemini31_pro_preview: {
    code: "T4",
    model: "Gemini 3.1 Pro Preview",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  llm_glm52: {
    code: "T4",
    model: "GLM 5.2",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  llm_kimi_k27_code: {
    code: "T4",
    model: "Kimi K2.7 Code",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  llm_hermes4_405b: {
    code: "T4",
    model: "Hermes 4 405B",
    tierName: "Expert",
    className: "profile-tier-card--tier4",
  },
  llm_gpt55_pro: {
    code: "T5",
    model: "GPT-5.5 Pro",
    tierName: "Master",
    className: "profile-tier-card--tier5",
  },
  llm_qwen37_max: {
    code: "T5",
    model: "Qwen 3.7 Max",
    tierName: "Master",
    className: "profile-tier-card--tier5",
  },
}

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

function normalizeMetricBucket(bucket) {
  return {
    totalGames: statOrZero(bucket?.total_games),
    wins: statOrZero(bucket?.wins),
    losses: statOrZero(bucket?.losses),
    draws: statOrZero(bucket?.draws),
    winRate: Number.isFinite(Number(bucket?.win_rate)) ? Number(bucket.win_rate) : 0,
  }
}

function normalizeUserMetrics(source) {
  if (!source || typeof source !== "object") return null
  return {
    completedGames: statOrZero(source.completed_games),
    averageDurationSeconds: statOrZero(source.average_duration_seconds),
    averageTurnCount: Number.isFinite(Number(source.average_turn_count)) ? Number(source.average_turn_count) : 0,
    overall: normalizeMetricBucket(source.overall),
    vsHumans: normalizeMetricBucket(source.vs_humans),
    vsBots: normalizeMetricBucket(source.vs_bots),
    asWhite: normalizeMetricBucket(source.as_white),
    asBlack: normalizeMetricBucket(source.as_black),
    opponents: Array.isArray(source.opponents) ? source.opponents.map((row) => ({
      username: typeof row?.username === "string" && row.username.trim() ? row.username.trim() : "unknown",
      role: row?.role || "user",
      ...normalizeMetricBucket(row),
    })) : [],
    rulesets: Array.isArray(source.rulesets) ? source.rulesets.map((row) => ({
      ruleVariant: row?.rule_variant || "unknown",
      ...normalizeMetricBucket(row),
    })) : [],
  }
}

function formatWinRate(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function formatMetricRecord(bucket) {
  return `${bucket.wins}-${bucket.losses}-${bucket.draws}`
}

function formatDuration(seconds) {
  const totalSeconds = statOrZero(seconds)
  if (totalSeconds <= 0) return "0m"
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function regularNameFromGuest(username) {
  return typeof username === "string" && username.startsWith("guest_")
    ? username.slice("guest_".length)
    : username
}

function profilePath(username) {
  return `/user/${encodeURIComponent(username)}`
}

function profileGamesFilterPath(username, key, value) {
  const params = new URLSearchParams({ [key]: value })
  return `${profilePath(username)}/games?${params.toString()}`
}

function opponentFilterValue(row) {
  return row.username
}

function tierDetailsForProfile(profile) {
  if (profile?.role === "bot" || profile?.is_bot) {
    const username = String(profile?.username || "").trim().toLowerCase()
    const tier = BOT_LLM_TIER_DETAILS_BY_USERNAME[username]
    if (!tier) return null
    return {
      code: tier.code,
      name: "LLM bot",
      limit: `${tier.model} model bot for ${tier.code} ${tier.tierName}.`,
      className: `${tier.className} profile-tier-card--bot`,
      ariaLabel: "Bot tier",
    }
  }
  return PROFILE_TIER_DETAILS[profile?.llm_bot_tier] ?? null
}

export default function ProfilePage() {
  const { username = "" } = useParams()
  const navigate = useNavigate()
  const { user, convertGuest, actionLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState(null)
  const [recentGames, setRecentGames] = useState([])
  const [ratingSeries, setRatingSeries] = useState({ game: [], date: [] })
  const [ratingTrack, setRatingTrack] = useState("overall")
  const [conversionForm, setConversionForm] = useState({ email: "", password: "" })
  const [conversionError, setConversionError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const [profileResponse, historyResponse] = await Promise.all([
          userApi.getProfile(username),
          userApi.getGameHistory(username, 1, 20),
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

  useEffect(() => {
    let cancelled = false

    async function loadRatingHistory() {
      try {
        const response = await userApi.getRatingHistory(username, ratingTrack, 100)
        if (!cancelled) {
          setRatingSeries(response?.series ?? { game: [], date: [] })
        }
      } catch {
        if (!cancelled) {
          setRatingSeries({ game: [], date: [] })
        }
      }
    }

    loadRatingHistory()
    return () => {
      cancelled = true
    }
  }, [ratingTrack, username])

  const stats = useMemo(() => {
    const source = profile?.stats ?? {}
    const ratings = normalizeRatings(source)
    return {
      ratings,
      results: normalizeResults(source),
    }
  }, [profile])
  const selectedTrack = ELO_TRACKS.find((track) => track.key === ratingTrack) ?? ELO_TRACKS[0]
  const selectedRating = ratingTrack === "vs_humans" ? stats.ratings.vsHumans : ratingTrack === "vs_bots" ? stats.ratings.vsBots : stats.ratings.overall
  const selectedResults = ratingTrack === "vs_humans" ? stats.results.vsHumans : ratingTrack === "vs_bots" ? stats.results.vsBots : stats.results.overall
  const selectedHistoryStats = useMemo(() => formatResultSummary(selectedResults), [selectedResults])
  const isBotProfile = profile?.role === "bot" || profile?.is_bot
  const userMetrics = useMemo(() => normalizeUserMetrics(profile?.user_metrics ?? profile?.bot_metrics), [profile])
  const userOpponentRows = useMemo(() => (userMetrics?.opponents ?? []).slice(0, 5), [userMetrics])
  const userRulesetRows = useMemo(() => (userMetrics?.rulesets ?? []).slice(0, 4), [userMetrics])
  const profileUsername = profile?.username || username
  const isOwnGuestProfile = user?.is_guest === true && profile?.role === "guest" && user?.username === profile?.username
  const convertedUsername = regularNameFromGuest(profile?.username)
  const profileTier = tierDetailsForProfile(profile)

  async function onConvertGuest(event) {
    event.preventDefault()
    setConversionError("")
    const email = conversionForm.email.trim()
    const password = conversionForm.password
    if (!email || !password) {
      setConversionError("Please enter an email and password.")
      return
    }
    try {
      const converted = await convertGuest({ email, password })
      const nextUsername = converted?.username ?? convertedUsername
      setProfile((current) => current ? { ...current, username: nextUsername, role: "user" } : current)
      navigate(`/user/${encodeURIComponent(nextUsername)}`, { replace: true })
    } catch (apiError) {
      setConversionError(apiError?.message ?? "Unable to convert guest account right now.")
    }
  }

  if (loading) {
    return <main className="page-shell profile-page"><h1>Profile</h1><p>Loading profile…</p></main>
  }

  if (error) {
    return <main className="page-shell profile-page"><h1>Profile</h1><p role="alert" className="auth-error">{error}</p></main>
  }

  return (
    <main className="page-shell profile-page">
      <h1>{profile?.username}</h1>
      <p>Member since {formatDate(profile?.member_since)}.</p>
      {profileTier ? (
        <section className={`profile-card profile-tier-card ${profileTier.className}`} aria-label={profileTier.ariaLabel || "Player tier"}>
          <TierBadge code={profileTier.code} className="profile-tier-card__code" />
          <div className="profile-tier-card__body">
            <h2>Tier {profileTier.code} {profileTier.name}</h2>
            {profileTier.limit ? <p>{profileTier.limit}</p> : null}
          </div>
        </section>
      ) : null}
      {isOwnGuestProfile ? (
        <section className="profile-card profile-card--guest-conversion" aria-label="Convert guest account">
          <h2>Keep this account.</h2>
          <p>
            You are currently playing Kriegspiel as a guest. We want everyone to have easy access,
            so you can keep playing as a guest while this browser session lasts. To make sure you can
            always get back to your games, convert this guest account to a regular account.
          </p>
          <p>Your username will become <strong>{convertedUsername}</strong>.</p>
          <form className="guest-conversion-form" onSubmit={onConvertGuest}>
            <label>
              Email
              <input
                type="email"
                value={conversionForm.email}
                autoComplete="email"
                onChange={(event) => setConversionForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={conversionForm.password}
                autoComplete="new-password"
                onChange={(event) => setConversionForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            {conversionError ? <p role="alert" className="auth-error">{conversionError}</p> : null}
            <button type="submit" className="guest-conversion-button" disabled={actionLoading}>
              {actionLoading ? "Converting…" : "Convert to regular account"}
            </button>
          </form>
        </section>
      ) : null}
      {isBotProfile ? (
        <section className="profile-card profile-card--bot-note" aria-label="Bot information">
          <h2>This user is bot</h2>
          <p>
            On Kriegspiel.org we allow bots. To understand the bots better, read our{" "}
            <a href={BOT_BLOG_URL} target="_blank" rel="noreferrer noopener">
              blog post about bots ↗
            </a>
            .
          </p>
          <p>You also can create your own bot – more bots, more fun.</p>
          <p>Email address of this bot owner is {profile?.owner_email ?? "unknown"}.</p>
        </section>
      ) : null}
      {userMetrics ? (
        <section className="profile-card profile-card--user-metrics profile-card--bot-metrics" aria-label="User metrics">
          <h2>User metrics</h2>
          {userMetrics.completedGames ? (
            <>
              <dl className="profile-stats-grid profile-bot-metrics-summary">
                <div className="profile-metric-tile profile-metric-tile--games"><dt>Completed games</dt><dd>{userMetrics.completedGames}</dd></div>
                <div className="profile-metric-tile profile-metric-tile--bots"><dt>vs Bots win rate</dt><dd>{formatWinRate(userMetrics.vsBots.winRate)}</dd></div>
                <div className="profile-metric-tile profile-metric-tile--humans"><dt>vs Humans win rate</dt><dd>{formatWinRate(userMetrics.vsHumans.winRate)}</dd></div>
                <div className="profile-metric-tile profile-metric-tile--turns"><dt>Average turns count</dt><dd>{userMetrics.averageTurnCount.toFixed(1)}</dd></div>
                <div className="profile-metric-tile profile-metric-tile--duration"><dt>Average duration</dt><dd>{formatDuration(userMetrics.averageDurationSeconds)}</dd></div>
              </dl>
              <div className="profile-bot-metrics-panels">
                <section className="profile-bot-metrics-panel" aria-labelledby="profile-bot-color-heading">
                  <h3 id="profile-bot-color-heading">Color split</h3>
                  <dl className="profile-bot-mini-list">
                    <div>
                      <dt><Link className="profile-bot-row-link profile-bot-color-link" to={profileGamesFilterPath(profileUsername, "color", "white")}>White</Link></dt>
                      <dd>{formatMetricRecord(userMetrics.asWhite)} · {formatWinRate(userMetrics.asWhite.winRate)}</dd>
                    </div>
                    <div>
                      <dt><Link className="profile-bot-row-link profile-bot-color-link" to={profileGamesFilterPath(profileUsername, "color", "black")}>Black</Link></dt>
                      <dd>{formatMetricRecord(userMetrics.asBlack)} · {formatWinRate(userMetrics.asBlack.winRate)}</dd>
                    </div>
                  </dl>
                </section>
                <section className="profile-bot-metrics-panel" aria-labelledby="profile-bot-opponents-heading">
                  <h3 id="profile-bot-opponents-heading">Top opponents</h3>
                  {userOpponentRows.length ? (
                    <ul className="profile-bot-row-list">
                      {userOpponentRows.map((row) => (
                        <li key={`${row.role}-${row.username}`}>
                          <Link className="profile-bot-row-link profile-bot-opponent-link" to={profileGamesFilterPath(profileUsername, "opponent", opponentFilterValue(row))}>
                            {row.username}{row.role === "bot" ? " (bot)" : ""}
                          </Link>
                          <strong>{formatMetricRecord(row)} · {formatWinRate(row.winRate)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p>No opponent rows yet.</p>}
                </section>
                <section className="profile-bot-metrics-panel" aria-labelledby="profile-bot-rulesets-heading">
                  <h3 id="profile-bot-rulesets-heading">Rulesets</h3>
                  {userRulesetRows.length ? (
                    <ul className="profile-bot-row-list">
                      {userRulesetRows.map((row) => (
                        <li key={row.ruleVariant}>
                          <Link className="profile-bot-row-link profile-bot-ruleset-link" to={profileGamesFilterPath(profileUsername, "rule_set", row.ruleVariant)}>
                            {formatRuleVariant(row.ruleVariant)}
                          </Link>
                          <strong>{row.totalGames} · {formatWinRate(row.winRate)}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : <p>No ruleset rows yet.</p>}
                </section>
              </div>
            </>
          ) : <p>No completed games yet.</p>}
        </section>
      ) : null}

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
            <h3 id="profile-ratings-heading">{selectedTrack.label} rating.</h3>
            <dl className="profile-stats-grid">
              <div><dt>{selectedTrack.label} Elo</dt><dd>{selectedRating.elo}</dd></div>
              <div><dt>Peak {selectedTrack.label.toLowerCase()}</dt><dd>{selectedRating.peak}</dd></div>
            </dl>
          </section>
          <section className="stats-group-card" aria-labelledby="profile-results-heading">
            <h3 id="profile-results-heading">{selectedTrack.label} results.</h3>
            <dl className="profile-stats-grid">
              <div><dt>Games played</dt><dd>{selectedHistoryStats.gamesPlayed}</dd></div>
              <div><dt>Wins</dt><dd>{selectedHistoryStats.winsLabel}</dd></div>
              <div><dt>Losses</dt><dd>{selectedHistoryStats.lossesLabel}</dd></div>
              <div><dt>Draws</dt><dd>{selectedHistoryStats.drawsLabel}</dd></div>
            </dl>
          </section>
        </div>
        <EloChart seriesByMode={ratingSeries} emptyText="No finished games with rating history yet." ratingTrack={ratingTrack} showTrackToggle={false} />
      </section>

      <section className="profile-card" aria-label="Recent games">
        <h2>Recent games</h2>
        {recentGames.length === 0 ? <p>No completed games yet.</p> : (
          <ul className="profile-recent-list">
            {recentGames.slice(0, 5).map((game) => (
              <li key={game.game_id}>
                <span>{game.result} vs {game.opponent ?? "unknown"} · {formatRuleVariant(game.rule_variant)}</span>
                <Link to={`/game/${game.game_code ?? game.game_id}/review`}>Review</Link>
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
