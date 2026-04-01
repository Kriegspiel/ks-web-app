import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { createGame, getBots, getGame, getMyGames, getOpenGames, joinGame } from "../services/api"
import "./Lobby.css"

const WAITING_GAME_POLL_MS = 3000
const OPEN_GAMES_POLL_MS = 5000
const MY_GAMES_POLL_MS = 10000

function formatDate(isoDate) { if (!isoDate) return ""; try { return new Date(isoDate).toLocaleString() } catch { return isoDate } }

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
  const [opponentType, setOpponentType] = useState("human")
  const [bots, setBots] = useState([])
  const [botsError, setBotsError] = useState("")
  const [selectedBotId, setSelectedBotId] = useState("")
  const [openGames, setOpenGames] = useState([])
  const [openGamesError, setOpenGamesError] = useState("")
  const [openGamesLoading, setOpenGamesLoading] = useState(true)
  const [myGames, setMyGames] = useState([])
  const [myGamesError, setMyGamesError] = useState("")
  const [myGamesLoading, setMyGamesLoading] = useState(true)
  const signedInAs = user?.username ?? user?.email ?? "player"

  async function refreshOpenGames({ markLoading = false } = {}) { if (markLoading) setOpenGamesLoading(true); try { const response = await getOpenGames(); setOpenGames(Array.isArray(response?.games) ? response.games : []); setOpenGamesError("") } catch (error) { setOpenGamesError(error?.message ?? "Unable to load open games right now.") } finally { if (markLoading) setOpenGamesLoading(false) } }
  async function refreshMyGames({ markLoading = false } = {}) { if (markLoading) setMyGamesLoading(true); try { const response = await getMyGames(); setMyGames(Array.isArray(response?.games) ? response.games : []); setMyGamesError("") } catch (error) { setMyGamesError(error?.message ?? "Unable to load your games right now.") } finally { if (markLoading) setMyGamesLoading(false) } }
  async function refreshBots() { try { const response = await getBots(); const available = Array.isArray(response?.bots) ? response.bots : []; setBots(available); setBotsError(""); if (!selectedBotId && available[0]?.bot_id) setSelectedBotId(available[0].bot_id) } catch (error) { setBots([]); setBotsError(error?.message ?? "Unable to load bots right now.") } }

  useEffect(() => { refreshOpenGames({ markLoading: true }); const id = window.setInterval(() => refreshOpenGames(), OPEN_GAMES_POLL_MS); return () => window.clearInterval(id) }, [])
  useEffect(() => { refreshMyGames({ markLoading: true }); const id = window.setInterval(() => refreshMyGames(), MY_GAMES_POLL_MS); return () => window.clearInterval(id) }, [])
  useEffect(() => { refreshBots() }, [])
  useEffect(() => { if (!waitingGameId) return undefined; let cancelled = false; async function poll() { try { const game = await getGame(waitingGameId); if (cancelled) return; if (game?.state === 'active') { setWaitingGameId(null); navigate(`/game/${waitingGameId}`); return } if (game?.state && createResult?.state !== game.state) setCreateResult((previous) => ({ ...previous, state: game.state })) } catch { if (!cancelled) setWaitingGameId(null) } } poll(); const id = window.setInterval(poll, WAITING_GAME_POLL_MS); return () => { cancelled = true; window.clearInterval(id) } }, [waitingGameId, createResult?.state, navigate])

  const shareJoinUrl = useMemo(() => { if (!createResult?.game_code) return ""; const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""; return `${origin}/join/${createResult.game_code}` }, [createResult?.game_code])

  async function handleCreateGame(event) {
    event.preventDefault(); setCreatingGame(true); setCreateError("")
    if (opponentType === 'bot' && !selectedBotId) { setCreatingGame(false); setCreateError('Pick a bot before creating the game.'); return }
    try {
      const created = await createGame({ rule_variant: 'berkeley_any', play_as: 'random', time_control: 'rapid', opponent_type: opponentType, bot_id: opponentType === 'bot' ? selectedBotId : undefined })
      setCreateResult(created)
      if (created.state === 'active') { await Promise.all([refreshOpenGames(), refreshMyGames()]); navigate(`/game/${created.game_id}`); return }
      setWaitingGameId(created.game_id)
      await Promise.all([refreshOpenGames(), refreshMyGames()])
    } catch (error) { setCreateResult(null); setWaitingGameId(null); setCreateError(error?.message ?? 'Unable to create game right now.') } finally { setCreatingGame(false) }
  }
  async function handleJoinByCode(event) { event.preventDefault(); const normalizedCode = joinCode.trim().toUpperCase(); if (!normalizedCode) { setJoinError('Enter a game code to join.'); return } setJoiningGame(true); setJoinError(''); try { const joined = await joinGame(normalizedCode); setJoinCode(''); await Promise.all([refreshOpenGames(), refreshMyGames()]); navigate(`/game/${joined.game_id}`) } catch (error) { setJoinError(error?.message ?? 'Unable to join that game right now.') } finally { setJoiningGame(false) } }
  async function handleJoinOpenGame(gameCode) { setJoinCode(gameCode); setJoiningGame(true); setJoinError(''); try { const joined = await joinGame(gameCode); await Promise.all([refreshOpenGames(), refreshMyGames()]); navigate(`/game/${joined.game_id}`) } catch (error) { setJoinError(error?.message ?? 'Unable to join that game right now.') } finally { setJoiningGame(false) } }

  return (<main className="page-shell lobby-page"><h1>Lobby</h1><p>Signed in as {signedInAs}.</p>{actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}
    <section className="lobby-card" aria-labelledby="create-game-heading"><h2 id="create-game-heading">Create game</h2><form onSubmit={handleCreateGame} className="lobby-create-form"><fieldset className="lobby-opponent-picker"><legend>Who is this game against?</legend><div className="lobby-opponent-options"><label className={`lobby-opponent-option${opponentType === 'human' ? ' is-selected' : ''}`}><input type="radio" aria-label="Human" name="opponent-type" checked={opponentType === 'human'} onChange={() => setOpponentType('human')} /><span className="lobby-opponent-copy"><span className="lobby-opponent-title">Human</span><span className="lobby-opponent-description">Create a waiting game to share with another player.</span></span></label><label className={`lobby-opponent-option${opponentType === 'bot' ? ' is-selected' : ''}`}><input type="radio" aria-label="Bot" name="opponent-type" checked={opponentType === 'bot'} onChange={() => setOpponentType('bot')} /><span className="lobby-opponent-copy"><span className="lobby-opponent-title">Bot</span><span className="lobby-opponent-description">Start immediately against an available bot.</span></span></label></div></fieldset>{opponentType === 'bot' ? <div className="lobby-bot-picker"><label htmlFor="bot-picker">Bot opponent</label><select id="bot-picker" value={selectedBotId} onChange={(event) => setSelectedBotId(event.target.value)}><option value="">Select a bot</option>{bots.map((bot) => <option key={bot.bot_id} value={bot.bot_id}>{bot.display_name}</option>)}</select>{selectedBotId ? <p className="lobby-meta">{bots.find((bot) => bot.bot_id === selectedBotId)?.description}</p> : null}{botsError ? <p className="auth-error" role="alert">{botsError}</p> : null}</div> : <p className="lobby-meta">Create a waiting game and share the join code with another human.</p>}<button type="submit" disabled={creatingGame}>{creatingGame ? 'Creating…' : opponentType === 'bot' ? 'Create bot game' : 'Create waiting game'}</button></form>{createError ? <p className="auth-error" role="alert">{createError}</p> : null}{createResult && createResult.state === 'waiting' ? <div className="lobby-created-game" role="status" aria-live="polite"><p><strong>Join code:</strong> <code>{createResult.game_code}</code></p><p><strong>Share link:</strong> <a href={shareJoinUrl}>{shareJoinUrl}</a></p><p><strong>State:</strong> {waitingGameId ? 'Waiting for opponent…' : createResult.state}</p></div> : null}</section>
    <section className="lobby-card" aria-labelledby="join-game-heading"><h2 id="join-game-heading">Join by code</h2><form onSubmit={handleJoinByCode} className="lobby-join-form"><label htmlFor="join-game-code">Game code</label><input id="join-game-code" name="join-game-code" autoComplete="off" maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC123" /><button type="submit" disabled={joiningGame}>{joiningGame ? 'Joining…' : 'Join game'}</button></form>{joinError ? <p className="auth-error" role="alert">{joinError}</p> : null}</section>
    <section className="lobby-card"><h2>Open games</h2>{openGamesError ? <p role="alert">{openGamesError}</p> : null}{openGamesLoading ? <p>Loading…</p> : null}<ul className="lobby-list">{openGames.map((game) => <li key={game.game_code}><div><strong>{game.game_code}</strong><div className="lobby-meta">{game.created_by} · {game.available_color} · {formatDate(game.created_at)}</div></div><button type="button" onClick={() => handleJoinOpenGame(game.game_code)}>Join</button></li>)}</ul></section>
    <section className="lobby-card"><h2>My games</h2>{myGamesError ? <p role="alert">{myGamesError}</p> : null}{myGamesLoading ? <p>Loading…</p> : null}<ul className="lobby-list">{myGames.map((game) => <li key={game.game_id}><div><strong>{game.game_code}</strong><div className="lobby-meta">{game.white?.username} vs {game.black?.username ?? 'Waiting…'} · {game.state} · move {game.move_number}</div></div><button type="button" onClick={() => navigate(`/game/${game.game_id}`)}>Open</button></li>)}</ul></section>
  </main>)
}
