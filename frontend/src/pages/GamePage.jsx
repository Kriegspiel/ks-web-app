import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PhantomTray from "../components/PhantomTray"
import PromotionModal from "../components/PromotionModal"
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

function pieceAtSquare(fen, square) {
  if (!fen || !square) {
    return ""
  }

  const [placement = ""] = fen.split(" ")
  const ranks = placement.split("/")
  if (ranks.length !== 8) {
    return ""
  }

  const file = square[0]
  const rank = Number.parseInt(square[1], 10)
  const fileIndex = file.charCodeAt(0) - 97
  if (fileIndex < 0 || fileIndex > 7 || Number.isNaN(rank) || rank < 1 || rank > 8) {
    return ""
  }

  const row = ranks[8 - rank]
  let cursor = 0
  for (const token of row) {
    if (/\d/.test(token)) {
      cursor += Number.parseInt(token, 10)
      continue
    }

    if (cursor === fileIndex) {
      return token
    }

    cursor += 1
  }

  return ""
}

function isPromotionCandidate({ fen, fromSquare, toSquare, color }) {
  if (!fen || !fromSquare || !toSquare || !color) {
    return false
  }

  const piece = pieceAtSquare(fen, fromSquare)
  if (!piece) {
    return false
  }

  const isPawn = color === "white" ? piece === "P" : piece === "p"
  if (!isPawn) {
    return false
  }

  const targetRank = toSquare[1]
  return color === "white" ? targetRank === "8" : targetRank === "1"
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
  const [lastMoveSquares, setLastMoveSquares] = useState([])
  const [showPromotionModal, setShowPromotionModal] = useState(false)

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

  const selectedMoveBase = useMemo(() => {
    if (!fromSquare || !toSquare) {
      return ""
    }
    return `${fromSquare}${toSquare}`
  }, [fromSquare, toSquare])

  const pendingPromotion = useMemo(() => {
    if (!selectedMoveBase || !gameState?.your_fen || !gameState?.your_color) {
      return false
    }

    return isPromotionCandidate({
      fen: gameState.your_fen,
      fromSquare,
      toSquare,
      color: gameState.your_color,
    })
  }, [fromSquare, gameState?.your_color, gameState?.your_fen, selectedMoveBase, toSquare])

  function resetPendingMove() {
    setFromSquare("")
    setToSquare("")
    setShowPromotionModal(false)
  }

  function handleSquareClick(square) {
    setActionError("")
    setShowPromotionModal(false)

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
      resetPendingMove()
      return
    }

    if (!toSquare) {
      setToSquare(square)
      return
    }

    if (square === toSquare) {
      setToSquare("")
      setShowPromotionModal(false)
      return
    }

    setFromSquare(square)
    setToSquare("")
    setShowPromotionModal(false)
  }

  function handleSquareRightClick(square) {
    const removed = removeAt(square)
    if (removed && (square === fromSquare || square === toSquare)) {
      resetPendingMove()
    }
  }

  async function submitMoveWithUci(uci) {
    setSubmittingAction(true)
    setActionError("")

    try {
      const result = await submitMove(gameId, uci)
      if (result?.move_done === false) {
        setActionError("Illegal move. Try a different move.")
        setToSquare("")
        return
      }

      setLastMoveSquares([uci.slice(0, 2), uci.slice(2, 4)])
      resetPendingMove()
      await pollState({ silent: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to submit move right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleMoveSubmit() {
    if (!selectedMoveBase || !gameId || !canMove) {
      return
    }

    if (pendingPromotion) {
      setShowPromotionModal(true)
      return
    }

    await submitMoveWithUci(selectedMoveBase)
  }

  async function handlePromotionSelect(suffix) {
    if (!selectedMoveBase) {
      return
    }

    setShowPromotionModal(false)
    await submitMoveWithUci(`${selectedMoveBase}${suffix}`)
  }

  function handlePromotionCancel() {
    setActionError("Promotion canceled. Select a move again.")
    resetPendingMove()
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

  const selectedMove = useMemo(() => {
    if (!selectedMoveBase) {
      return ""
    }

    if (pendingPromotion) {
      return `${selectedMoveBase}?`
    }

    return selectedMoveBase
  }, [pendingPromotion, selectedMoveBase])

  const highlightedSquares = [fromSquare, toSquare].filter(Boolean)
  const opponentColor = gameState?.your_color === "black" ? "white" : "black"
  const waitingForOpponent = gameState?.state === "active" && !possibleActions.includes("move")

  return (
    <main className="page-shell game-page" aria-live="polite">
      <div className="game-page__header">
        <h1>Game</h1>
        <button type="button" onClick={() => navigate("/lobby")}>Back to lobby</button>
      </div>

      <p className="game-page__meta">Game ID: <code>{gameId}</code></p>
      {loading ? <p className="game-page__notice">Loading game state…</p> : null}
      {submittingAction ? <p className="game-page__notice">Submitting action…</p> : null}
      {waitingForOpponent ? <p className="game-page__notice">Waiting for opponent move…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {gameState ? (
        <>
          <div className="game-layout">
            <section className="game-card" aria-label="Board">
              <ChessBoard
                boardFen={gameState.your_fen}
                orientation={gameState.your_color}
                highlightedSquares={highlightedSquares}
                lastMoveSquares={lastMoveSquares}
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
                <li className={canMove ? "game-status-list__turn game-status-list__turn--active" : "game-status-list__turn"}>
                  <strong>Turn:</strong> {gameState.turn ?? "—"}
                </li>
                <li><strong>Move number:</strong> {gameState.move_number}</li>
                <li><strong>White clock:</strong> {formatClock(gameState.clock?.white_remaining)}</li>
                <li><strong>Black clock:</strong> {formatClock(gameState.clock?.black_remaining)}</li>
              </ul>

              <div className="game-actions" aria-label="Game actions">
                <button type="button" onClick={handleMoveSubmit} disabled={!canMove || !selectedMoveBase}>
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

              {gameState.referee_log?.length ? (
                <div>
                  <h3>Referee log</h3>
                  <ul className="game-log-list">
                    {gameState.referee_log.map((entry, index) => (
                      <li key={`${entry.announcement ?? "entry"}-${index}`}>{entry.announcement}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>

          <PromotionModal
            open={showPromotionModal}
            onSelect={handlePromotionSelect}
            onCancel={handlePromotionCancel}
          />
        </>
      ) : null}
    </main>
  )
}
