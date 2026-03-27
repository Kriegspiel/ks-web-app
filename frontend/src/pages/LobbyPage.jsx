import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { createGame, getGame, getMyGames, getOpenGames, joinGame } from "../services/api"
import "./Lobby.css"

const WAITING_GAME_POLL_MS = 3000
const OPEN_GAMES_POLL_MS = 5000
const MY_GAMES_POLL_MS = 10000

function formatDate(isoDate) {
  if (!isoDate) {
    return ""
  }

  try {
    return new Date(isoDate).toLocaleString()
  } catch {
    return isoDate
  }
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
  const [waitingGameId, setWaitingGameId] = useState(null)

  const [openGames, setOpenGames] = useState([])
  const [openGamesError, setOpenGamesError] = useState("")
  const [openGamesLoading, setOpenGamesLoading] = useState(true)

  const [myGames, setMyGames] = useState([])
  const [myGamesError, setMyGamesError] = useState("")
  const [myGamesLoading, setMyGamesLoading] = useState(true)

  const signedInAs = user?.username ?? user?.email ?? "player"

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

  useEffect(() => {
    refreshOpenGames({ markLoading: true })

    const intervalId = window.setInterval(() => {
      refreshOpenGames({ markLoading: false })
    }, OPEN_GAMES_POLL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    refreshMyGames({ markLoading: true })

    const intervalId = window.setInterval(() => {
      refreshMyGames({ markLoading: false })
    }, MY_GAMES_POLL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!waitingGameId) {
      return undefined
    }

    let cancelled = false

    async function pollGameStatus() {
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

    pollGameStatus()
    const intervalId = window.setInterval(pollGameStatus, WAITING_GAME_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [waitingGameId, createResult?.state, navigate])

  const shareJoinUrl = useMemo(() => {
    if (!createResult?.game_code) {
      return ""
    }

    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
    return `${origin}/join/${createResult.game_code}`
  }, [createResult?.game_code])

  const openGamesByCode = useMemo(() => {
    const map = new Map()
    for (const game of openGames) {
      if (game?.game_code) {
        map.set(game.game_code, game)
      }
    }
    return map
  }, [openGames])

  async function handleCreateGame(event) {
    event.preventDefault()
    setCreatingGame(true)
    setCreateError("")

    try {
      const created = await createGame({ rule_variant: "berkeley_any", play_as: "random", time_control: "rapid" })
      setCreateResult(created)
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

  return (
    <main className="page-shell lobby-page">
      <h1>Lobby</h1>
      <p>Signed in as {signedInAs}.</p>
      {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

      <section className="lobby-card" aria-labelledby="create-game-heading">
        <h2 id="create-game-heading">Create game</h2>
        <form onSubmit={handleCreateGame}>
          <button type="submit" disabled={creatingGame}>
            {creatingGame ? "Creating…" : "Create waiting game"}
          </button>
        </form>
        {createError ? <p className="auth-error" role="alert">{createError}</p> : null}
        {createResult ? (
          <div className="lobby-created-game" role="status" aria-live="polite">
            <p><strong>Join code:</strong> <code>{createResult.game_code}</code></p>
            <p><strong>Share link:</strong> <a href={shareJoinUrl}>{shareJoinUrl}</a></p>
            <p><strong>State:</strong> {waitingGameId ? "Waiting for opponent…" : createResult.state}</p>
          </div>
        ) : null}
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

      <section className="lobby-card" aria-labelledby="open-games-heading">
        <h2 id="open-games-heading">Open games</h2>
        {openGamesLoading ? <p>Loading open games…</p> : null}
        {openGamesError ? <p className="auth-error" role="alert">{openGamesError}</p> : null}
        {!openGamesLoading && !openGamesError && openGames.length === 0 ? <p>No open games right now.</p> : null}
        <ul className="lobby-list">
          {openGames.map((game) => (
            <li key={`open-${game.game_code}`}>
              <div>
                <strong>{game.game_code}</strong> · {game.created_by} · {game.available_color}
                <div className="lobby-meta">Created {formatDate(game.created_at)}</div>
              </div>
              <button
                type="button"
                onClick={() => handleJoinOpenGame(game.game_code)}
                disabled={joiningGame}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="lobby-card" aria-labelledby="my-games-heading">
        <h2 id="my-games-heading">My games</h2>
        {myGamesLoading ? <p>Loading your games…</p> : null}
        {myGamesError ? <p className="auth-error" role="alert">{myGamesError}</p> : null}
        {!myGamesLoading && !myGamesError && myGames.length === 0 ? <p>You have no games yet.</p> : null}
        <ul className="lobby-list">
          {myGames.map((game) => (
            <li key={`mine-${game.game_id}`}>
              <div>
                <strong>{game.game_code}</strong> · {game.state} · move {game.move_number}
                <div className="lobby-meta">
                  White: {game.white?.username ?? "?"} · Black: {game.black?.username ?? "(open)"}
                </div>
              </div>
              <button type="button" onClick={() => navigate(`/game/${game.game_id}`)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      </section>

      {openGamesByCode.size > 0 ? <p className="lobby-hint">Tip: click Join in Open games to auto-fill and join instantly.</p> : null}
    </main>
  )
}
