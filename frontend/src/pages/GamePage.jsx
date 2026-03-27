import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PhantomTray from "../components/PhantomTray"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"
import { askAny, getGameState, resignGame, submitMove } from "../services/api"
import "./GamePage.css"

const POLL_INTERVAL_MS = 2000

function formatClock(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--"
  }

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remain = safeSeconds % 60
  return `${minutes}:${String(remain).padStart(2, "0")}`
}

export default function GamePage() {
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [gameState, setGameState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [submittingAction, setSubmittingAction] = useState(false)
  const [fromSquare, setFromSquare] = useState("")
  const [toSquare, setToSquare] = useState("")

  const occupiedSquares = useMemo(() => occupiedSquaresFromFen(gameState?.your_fen), [gameState?.your_fen])

  const {
    phantomSquares,
    trayCounts,
    selectedPiece,
    selectPiece,
    placeAt,
    removeAt,
    clearAll,
  } = usePhantoms({ gameId, occupiedSquares })

  const pollState = useCallback(async ({ silent = false } = {}) => {
    if (!gameId) {
      return
    }

    if (!silent) {
      setLoading(true)
    }

    try {
      const state = await getGameState(gameId)
      setGameState(state)
      setError("")
    } catch (requestError) {
      setError(requestError?.message ?? "Unable to load this game right now.")
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [gameId])

  useEffect(() => {
    pollState({ silent: false })
  }, [pollState])

  useEffect(() => {
    if (!gameId || gameState?.state === "completed") {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      pollState({ silent: true })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [gameId, gameState?.state, pollState])

  const possibleActions = gameState?.possible_actions ?? []
  const canMove = gameState?.state === "active" && possibleActions.includes("move") && !submittingAction
  const canAskAny = gameState?.state === "active" && possibleActions.includes("ask_any") && !submittingAction
  const canResign = gameState?.state === "active" && !submittingAction

  const selectedMove = useMemo(() => {
    if (!fromSquare || !toSquare) {
      return ""
    }
    return `${fromSquare}${toSquare}`
  }, [fromSquare, toSquare])

  function handleSquareClick(square) {
    setActionError("")

    if (selectedPiece) {
      placeAt(square)
      return
    }

    if (!canMove) {
      return
    }

    if (!fromSquare) {
      setFromSquare(square)
      return
    }

    if (square === fromSquare) {
      setFromSquare("")
      setToSquare("")
      return
    }

    if (!toSquare) {
      setToSquare(square)
      return
    }

    if (square === toSquare) {
      setToSquare("")
      return
    }

    setFromSquare(square)
    setToSquare("")
  }

  function handleSquareRightClick(square) {
    const removed = removeAt(square)
    if (removed && (square === fromSquare || square === toSquare)) {
      setFromSquare("")
      setToSquare("")
    }
  }

  async function handleMoveSubmit() {
    if (!selectedMove || !gameId || !canMove) {
      return
    }

    setSubmittingAction(true)
    setActionError("")

    try {
      await submitMove(gameId, selectedMove)
      setFromSquare("")
      setToSquare("")
      await pollState({ silent: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to submit move right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleAskAny() {
    if (!gameId || !canAskAny) {
      return
    }

    setSubmittingAction(true)
    setActionError("")

    try {
      await askAny(gameId)
      await pollState({ silent: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to ask the referee right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleResign() {
    if (!gameId || !canResign) {
      return
    }

    setSubmittingAction(true)
    setActionError("")

    try {
      await resignGame(gameId)
      await pollState({ silent: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to resign right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  const highlightedSquares = [fromSquare, toSquare].filter(Boolean)
  const opponentColor = gameState?.your_color === "black" ? "white" : "black"

  return (
    <main className="page-shell game-page" aria-live="polite">
      <div className="game-page__header">
        <h1>Game</h1>
        <button type="button" onClick={() => navigate("/lobby")}>Back to lobby</button>
      </div>

      <p className="game-page__meta">Game ID: <code>{gameId}</code></p>

      {loading ? <p>Loading game state…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {gameState ? (
        <div className="game-layout">
          <section className="game-card" aria-label="Board">
            <ChessBoard
              boardFen={gameState.your_fen}
              orientation={gameState.your_color}
              highlightedSquares={highlightedSquares}
              phantomSquares={phantomSquares}
              disabled={false}
              onSquareClick={handleSquareClick}
              onSquareRightClick={handleSquareRightClick}
            />
            <p className="game-page__meta">Selected move: <code>{selectedMove || "—"}</code></p>
          </section>

          <section className="game-card" aria-label="Phantom controls">
            <PhantomTray
              selectedPiece={selectedPiece}
              trayCounts={trayCounts}
              pieceColor={opponentColor}
              onSelectPiece={selectPiece}
              onClear={clearAll}
            />
          </section>

          <section className="game-card" aria-label="Game status">
            <h2>Status</h2>
            <ul className="game-status-list">
              <li><strong>State:</strong> {gameState.state}</li>
              <li><strong>Your color:</strong> {gameState.your_color}</li>
              <li><strong>Turn:</strong> {gameState.turn ?? "—"}</li>
              <li><strong>Move number:</strong> {gameState.move_number}</li>
              <li><strong>White clock:</strong> {formatClock(gameState.clock?.white_remaining)}</li>
              <li><strong>Black clock:</strong> {formatClock(gameState.clock?.black_remaining)}</li>
            </ul>

            <div className="game-actions" aria-label="Game actions">
              <button type="button" onClick={handleMoveSubmit} disabled={!canMove || !selectedMove}>
                Submit move
              </button>
              <button type="button" onClick={handleAskAny} disabled={!canAskAny}>
                Ask any captures?
              </button>
              <button type="button" onClick={handleResign} disabled={!canResign}>
                Resign
              </button>
            </div>

            {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}
            {gameState.result ? <p><strong>Result:</strong> {JSON.stringify(gameState.result)}</p> : null}
          </section>

          <section className="game-card" aria-label="Referee log">
            <h2>Referee log</h2>
            {gameState.referee_log?.length ? (
              <ol className="game-log-list">
                {gameState.referee_log.map((entry, index) => (
                  <li key={`ref-log-${index}`}>
                    <span>{entry.announcement}</span>
                    {entry.capture_square ? <span> · capture {entry.capture_square}</span> : null}
                    {entry.special_announcement ? <span> · {entry.special_announcement}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No announcements yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}
