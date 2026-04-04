import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { createGame, deleteWaitingGame, getBots, getGame, getLobbyStats, getMyGames, getOpenGames, joinGame } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import "./Lobby.css"

const WAITING_GAME_POLL_MS = 3000
const OPEN_GAMES_POLL_MS = 5000
const MY_GAMES_POLL_MS = 10000
const LOBBY_STATS_POLL_MS = 10000
const RULESET_OPTIONS = [
  { value: "berkeley", label: "Berkeley" },
  { value: "berkeley_any", label: "Berkeley + Any" },
]

function normalizeBotDescription(bot) {
  if (!bot || typeof bot !== "object") {
    return ""
  }

  const username = String(bot.username || "").trim().toLowerCase()
  const displayName = String(bot.display_name || "").trim().toLowerCase()
  const description = String(bot.description || "").trim()

  if (username === "gptnano" || displayName === "gpt nano") {
    return "Model-driven Kriegspiel bot that chooses moves using GPT nano model."
  }

  if (
    username === "randobot" ||
    displayName === "random bot" ||
    description === "Plays random legal-looking moves"
  ) {
    return "Plays random legal-looking moves."
  }

  return description
}

function preferredBotId(bots) {
  if (!Array.isArray(bots) || bots.length === 0) {
    return ""
  }

  const randomBot = bots.find((bot) => {
    const username = String(bot?.username || "").trim().toLowerCase()
    const displayName = String(bot?.display_name || "").trim().toLowerCase()
    return username === "randobot" || displayName === "random bot"
  })

  return randomBot?.bot_id || bots[0]?.bot_id || ""
}

function botSupportsRuleVariant(bot, ruleVariant) {
  const supported = Array.isArray(bot?.supported_rule_variants) ? bot.supported_rule_variants : ["berkeley", "berkeley_any"]
  return supported.includes(ruleVariant)
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

function renderCreatorLink(game, botUsernames) {
  const username = String(game?.created_by || "").trim()
  if (!username) {
    return "Unknown"
  }

  const isBot = game?.created_by_role === "bot" || botUsernames.has(username.toLowerCase())

  return (
    <Link to={`/user/${username}`}>
      {username}
      {isBot ? " (bot)" : ""}
    </Link>
  )
}

function isOwnOpenGame(game, username) {
  return String(game?.created_by || "").trim().toLowerCase() === String(username || "").trim().toLowerCase()
}

export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, actionError } = useAuth()
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joiningGame, setJoiningGame] = useState(false)
  const [createResult, setCreateResult] = useState(null)
  const [createError, setCreateError] = useState("")
  const [creatingGame, setCreatingGame] = useState(false)
  const [closingWaitingGame, setClosingWaitingGame] = useState(false)
  const [waitingGameId, setWaitingGameId] = useState(null)
  const [opponentType, setOpponentType] = useState("human")
  const [ruleVariant, setRuleVariant] = useState("berkeley_any")
  const [bots, setBots] = useState([])
  const [botsError, setBotsError] = useState("")
  const [selectedBotId, setSelectedBotId] = useState("")
  const [openGames, setOpenGames] = useState([])
  const [openGamesError, setOpenGamesError] = useState("")
  const [openGamesLoading, setOpenGamesLoading] = useState(true)
  const [myGames, setMyGames] = useState([])
  const [myGamesError, setMyGamesError] = useState("")
  const [myGamesLoading, setMyGamesLoading] = useState(true)
  const [lobbyStats, setLobbyStats] = useState(null)
  const [lobbyStatsError, setLobbyStatsError] = useState("")
  const [lobbyStatsLoading, setLobbyStatsLoading] = useState(true)
  const signedInAs = user?.username ?? user?.email ?? "player"
  const supportedBots = useMemo(() => bots.filter((bot) => botSupportsRuleVariant(bot, ruleVariant)), [bots, ruleVariant])
  const selectedBot = supportedBots.find((bot) => bot.bot_id === selectedBotId) ?? null
  const botUsernames = useMemo(
    () =>
      new Set(
        bots
          .map((bot) => String(bot?.username || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    [bots],
  )

  async function refreshOpenGames({ markLoading = false } = {}) {
    if (markLoading) {
      setOpenGamesLoading(true)
    }

    try {
      const response = await getOpenGames()
      setOpenGames(Array.isArray(response?.games) ? response.games : [])
      setOpenGamesError("")
    } catch (error) {
      setOpenGamesError(error?.message ?? "Unable to load open games right now.")
    } finally {
      if (markLoading) {
        setOpenGamesLoading(false)
      }
    }
  }

  async function refreshMyGames({ markLoading = false } = {}) {
    if (markLoading) {
      setMyGamesLoading(true)
    }

    try {
      const response = await getMyGames()
      setMyGames(Array.isArray(response?.games) ? response.games : [])
      setMyGamesError("")
    } catch (error) {
      setMyGamesError(error?.message ?? "Unable to load your games right now.")
    } finally {
      if (markLoading) {
        setMyGamesLoading(false)
      }
    }
  }

  async function refreshLobbyStats({ markLoading = false } = {}) {
    if (markLoading) {
      setLobbyStatsLoading(true)
    }

    try {
      const response = await getLobbyStats()
      setLobbyStats(response ?? null)
      setLobbyStatsError("")
    } catch (error) {
      setLobbyStatsError(error?.message ?? "Unable to load lobby stats right now.")
    } finally {
      if (markLoading) {
        setLobbyStatsLoading(false)
      }
    }
  }

  async function refreshBots() {
    try {
      const response = await getBots()
      const available = Array.isArray(response?.bots) ? response.bots : []
      setBots(available)
      setBotsError("")
      if (!selectedBotId) {
        setSelectedBotId(preferredBotId(available))
      }
    } catch (error) {
      setBots([])
      setBotsError(error?.message ?? "Unable to load bots right now.")
    }
  }

  useEffect(() => {
    refreshOpenGames({ markLoading: true })
    const id = window.setInterval(() => refreshOpenGames(), OPEN_GAMES_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshMyGames({ markLoading: true })
    const id = window.setInterval(() => refreshMyGames(), MY_GAMES_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshLobbyStats({ markLoading: true })
    const id = window.setInterval(() => refreshLobbyStats(), LOBBY_STATS_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshBots()
  }, [])

  useEffect(() => {
    if (opponentType !== "bot") {
      return
    }
    if (selectedBotId && supportedBots.some((bot) => bot.bot_id === selectedBotId)) {
      return
    }
    setSelectedBotId(preferredBotId(supportedBots))
  }, [opponentType, selectedBotId, supportedBots])

  useEffect(() => {
    if (!waitingGameId) {
      return undefined
    }

    let cancelled = false

    async function poll() {
      try {
        const game = await getGame(waitingGameId)
        if (cancelled) {
          return
        }

        if (game?.state === "active") {
          setWaitingGameId(null)
          navigate(`/game/${waitingGameId}`)
          return
        }

        if (game?.state && createResult?.state !== game.state) {
          setCreateResult((previous) => ({ ...previous, state: game.state }))
        }
      } catch {
        if (!cancelled) {
          setWaitingGameId(null)
        }
      }
    }

    poll()
    const id = window.setInterval(poll, WAITING_GAME_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [waitingGameId, createResult?.state, navigate])

  const shareJoinUrl = useMemo(() => {
    if (!createResult?.game_code) {
      return ""
    }

    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
    return `${origin}/join/${createResult.game_code}`
  }, [createResult?.game_code])

  async function handleCreateGame(event) {
    event.preventDefault()
    setCreatingGame(true)
    setCreateError("")

    if (opponentType === "bot" && !selectedBotId) {
      setCreatingGame(false)
      setCreateError("Pick a bot before creating the game.")
      return
    }

    try {
      const created = await createGame({
        rule_variant: ruleVariant,
        play_as: "random",
        time_control: "rapid",
        opponent_type: opponentType,
        bot_id: opponentType === "bot" ? selectedBotId : undefined,
      })
      setCreateResult(created)

      if (created.state === "active") {
        await Promise.all([refreshOpenGames(), refreshMyGames()])
        navigate(`/game/${created.game_id}`)
        return
      }

      setWaitingGameId(created.game_id)
      await Promise.all([refreshOpenGames(), refreshMyGames()])
    } catch (error) {
      setCreateResult(null)
      setWaitingGameId(null)
      setCreateError(error?.message ?? "Unable to create game right now.")
    } finally {
      setCreatingGame(false)
    }
  }

  async function handleJoinByCode(event) {
    event.preventDefault()
    const normalizedCode = joinCode.trim().toUpperCase()
    if (!normalizedCode) {
      setJoinError("Enter a game code to join.")
      return
    }

    setJoiningGame(true)
    setJoinError("")

    try {
      const joined = await joinGame(normalizedCode)
      setJoinCode("")
      await Promise.all([refreshOpenGames(), refreshMyGames()])
      navigate(`/game/${joined.game_id}`)
    } catch (error) {
      setJoinError(error?.message ?? "Unable to join that game right now.")
    } finally {
      setJoiningGame(false)
    }
  }

  async function handleJoinOpenGame(gameCode) {
    setJoinCode(gameCode)
    setJoiningGame(true)
    setJoinError("")

    try {
      const joined = await joinGame(gameCode)
      await Promise.all([refreshOpenGames(), refreshMyGames()])
      navigate(`/game/${joined.game_id}`)
    } catch (error) {
      setJoinError(error?.message ?? "Unable to join that game right now.")
    } finally {
      setJoiningGame(false)
    }
  }

  async function handleCloseWaitingGame(gameId) {
    if (!gameId) {
      return
    }

    setClosingWaitingGame(true)
    setCreateError("")
    setJoinError("")

    try {
      await deleteWaitingGame(gameId)
      if (waitingGameId === gameId) {
        setWaitingGameId(null)
      }
      if (createResult?.game_id === gameId) {
        setCreateResult(null)
      }
      await Promise.all([refreshOpenGames(), refreshMyGames()])
    } catch (error) {
      setCreateError(error?.message ?? "Unable to close this waiting game right now.")
    } finally {
      setClosingWaitingGame(false)
    }
  }

  return (
    <main className="page-shell lobby-page">
      <div className="lobby-page__header">
        <div className="lobby-page__title-block">
          <h1>Lobby</h1>
        </div>
        <p>Signed in as {signedInAs}.</p>
      </div>

      {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

      <section className="lobby-card" aria-labelledby="create-game-heading">
        <h2 id="create-game-heading">Create game</h2>
        <form onSubmit={handleCreateGame} className="lobby-create-form">
          <div className="lobby-create-grid">
            <div className="lobby-create-field">
              <label htmlFor="ruleset-picker">Ruleset</label>
              <select id="ruleset-picker" value={ruleVariant} onChange={(event) => setRuleVariant(event.target.value)}>
                {RULESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lobby-create-field">
            <span className="lobby-create-field__label">Who is this game against?</span>
            <div className="lobby-opponent-options">
              <div className={`lobby-opponent-option${opponentType === "human" ? " is-selected" : ""}`}>
                <label className="lobby-opponent-option__radio">
                  <input type="radio" aria-label="Human" name="opponent-type" checked={opponentType === "human"} onChange={() => setOpponentType("human")} />
                  <span className="lobby-opponent-copy">
                    <span className="lobby-opponent-title">Human</span>
                    <span className="lobby-opponent-description">Play another human.</span>
                  </span>
                </label>
              </div>

              <div className={`lobby-opponent-option${opponentType === "bot" ? " is-selected" : ""}`}>
                <label className="lobby-opponent-option__radio">
                  <input type="radio" aria-label="Bot" name="opponent-type" checked={opponentType === "bot"} onChange={() => setOpponentType("bot")} />
                  <span className="lobby-opponent-copy">
                    <span className="lobby-opponent-title">Bot</span>
                    <span className="lobby-opponent-description">Start immediately against an available bot.</span>
                  </span>
                </label>

                {opponentType === "bot" ? (
                  <div className="lobby-bot-picker">
                    <label htmlFor="bot-picker">Bot opponent</label>
                    <select id="bot-picker" value={selectedBotId} onChange={(event) => setSelectedBotId(event.target.value)}>
                      <option value="">Select a bot</option>
                      {supportedBots.map((bot) => (
                        <option key={bot.bot_id} value={bot.bot_id}>{`${bot.display_name} (${bot.elo ?? 1200})`}</option>
                      ))}
                    </select>
                    {!supportedBots.length ? <p className="lobby-meta">No bots support this ruleset.</p> : null}
                    {selectedBot ? <p className="lobby-meta">{normalizeBotDescription(selectedBot)}</p> : null}
                    {botsError ? <p className="auth-error" role="alert">{botsError}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button type="submit" disabled={creatingGame}>
            {creatingGame ? "Creating…" : opponentType === "bot" ? "Create bot game" : "Create waiting game"}
          </button>
        </form>

        {createError ? <p className="auth-error" role="alert">{createError}</p> : null}

        {createResult && createResult.state === "waiting" ? (
          <div className="lobby-created-game" role="status" aria-live="polite">
            <p><strong>Join code:</strong> <code>{createResult.game_code}</code></p>
            <p><strong>Share link:</strong> <a href={shareJoinUrl}>{shareJoinUrl}</a></p>
            <p><strong>State:</strong> {waitingGameId ? "Waiting for opponent…" : createResult.state}</p>
            <button type="button" className="game-danger-button" onClick={() => handleCloseWaitingGame(createResult.game_id)} disabled={closingWaitingGame}>
              {closingWaitingGame ? "Closing…" : "Close"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="lobby-card" aria-labelledby="open-games-heading">
        <h2 id="open-games-heading">Open games</h2>
        {openGamesError ? <p role="alert">{openGamesError}</p> : null}
        {openGamesLoading ? <p>Loading…</p> : null}
        <ul className="lobby-list">
          {openGames.map((game) => (
            <li key={game.game_code}>
              <div>
                <strong>{game.game_code}</strong>
                <div className="lobby-meta">
                    {renderCreatorLink(game, botUsernames)}
                  {" · "}
                  {game.available_color}
                  {" · "}
                  {formatUtcDateTime(game.created_at)}
                </div>
              </div>
              <div className="lobby-list__actions">
                {isOwnOpenGame(game, user?.username) ? (
                  <button type="button" className="game-danger-button" onClick={() => handleCloseWaitingGame(game.game_id)} disabled={closingWaitingGame}>
                    {closingWaitingGame ? "Closing…" : "Close"}
                  </button>
                ) : (
                  <button type="button" onClick={() => handleJoinOpenGame(game.game_code)}>Join</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="lobby-card" aria-labelledby="join-game-heading">
        <h2 id="join-game-heading">Join by code</h2>
        <form onSubmit={handleJoinByCode} className="lobby-join-form">
          <label htmlFor="join-game-code">Game code</label>
          <input
            id="join-game-code"
            name="join-game-code"
            autoComplete="off"
            maxLength={6}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
          <button type="submit" disabled={joiningGame}>{joiningGame ? "Joining…" : "Join game"}</button>
        </form>
        {joinError ? <p className="auth-error" role="alert">{joinError}</p> : null}
      </section>

      <section className="lobby-card" aria-labelledby="lobby-stats-heading">
        <h2 id="lobby-stats-heading">Lobby stats</h2>
        {lobbyStatsError ? <p role="alert">{lobbyStatsError}</p> : null}
        {lobbyStatsLoading ? <p>Loading…</p> : null}
        {lobbyStats ? (
          <div className="lobby-stats-grid">
            <div className="lobby-stats-tile">
              <strong>{lobbyStats.active_games_now ?? 0}</strong>
              <span>Active games now</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{lobbyStats.completed_last_hour ?? 0}</strong>
              <span>Completed last hour</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{lobbyStats.completed_last_24_hours ?? 0}</strong>
              <span>Completed last 24 hours</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{lobbyStats.completed_total ?? 0}</strong>
              <span>Completed total</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="lobby-card">
        <h2>My games</h2>
        {myGamesError ? <p role="alert">{myGamesError}</p> : null}
        {myGamesLoading ? <p>Loading…</p> : null}
        <ul className="lobby-list">
          {myGames.map((game) => (
            <li key={game.game_id}>
              <div>
                <strong>{game.game_code}</strong>
                <div className="lobby-meta">
                  {renderPlayerLink(game.white, "Waiting…")}
                  {" vs "}
                  {renderPlayerLink(game.black, "Waiting…")}
                  {" · "}
                  {game.state}
                  {" · move "}
                  {game.move_number}
                </div>
              </div>
              <div className="lobby-list__actions">
                <button type="button" onClick={() => navigate(`/game/${game.game_id}`)}>Open</button>
                {game.state === "waiting" ? (
                  <button type="button" className="game-danger-button" onClick={() => handleCloseWaitingGame(game.game_id)} disabled={closingWaitingGame}>
                    {closingWaitingGame ? "Closing…" : "Close"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <VersionStamp className="lobby-page__footer-version" />
    </main>
  )
}
