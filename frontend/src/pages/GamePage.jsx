import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PromotionModal from "../components/PromotionModal"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"
import { askAny, getGameState, resignGame, submitMove } from "../services/api"
import { PIECE_ASSETS } from "../components/chessboard"
import "./GamePage.css"

const POLL_INTERVAL_MS = 2000
const LONG_PRESS_MS = 450
const PHANTOM_PIECES = ["q", "r", "b", "n", "p", "k"]
const PHANTOM_LABELS = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
  k: "King",
}
const PHANTOM_MENU_WIDTH = 164
const PHANTOM_MENU_GAP = 6

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

function isTouchLikePointer(event) {
  return event?.pointerType === "touch" || event?.pointerType === "pen"
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function getSquareAnchorPosition(square, boardRoot) {
  if (!square || !boardRoot) {
    return null
  }

  const squareElement = boardRoot.querySelector(`[data-square="${square}"]`)
  if (!squareElement) {
    return null
  }

  const boardRect = boardRoot.getBoundingClientRect()
  const squareRect = squareElement.getBoundingClientRect()
  const maxLeft = Math.max(0, boardRect.width - PHANTOM_MENU_WIDTH)
  const preferredLeft = squareRect.right - boardRect.left + PHANTOM_MENU_GAP
  const fallbackLeft = squareRect.left - boardRect.left - PHANTOM_MENU_WIDTH - PHANTOM_MENU_GAP

  let left = preferredLeft
  if (left > maxLeft) {
    left = fallbackLeft >= 0 ? fallbackLeft : maxLeft
  }

  return {
    x: clamp(left, 0, maxLeft),
    y: clamp(squareRect.top - boardRect.top - 4, 0, Math.max(0, boardRect.height - 32)),
  }
}

function buildMenuState(square, boardRoot, squareHasPhantom, availablePieces) {
  const anchoredPosition = getSquareAnchorPosition(square, boardRoot)

  return {
    square,
    x: anchoredPosition?.x ?? null,
    y: anchoredPosition?.y ?? null,
    mode: squareHasPhantom ? "phantom-actions" : "root",
    availablePieces,
  }
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
  const [phantomMenu, setPhantomMenu] = useState(null)
  const [movingPhantomFrom, setMovingPhantomFrom] = useState("")
  const [draggingPhantomFrom, setDraggingPhantomFrom] = useState("")
  const [dragHoverSquare, setDragHoverSquare] = useState("")

  const longPressTimerRef = useRef(null)
  const longPressPointerRef = useRef(null)
  const boardShellRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const draggingPhantomFromRef = useRef("")
  const suppressContextMenuRef = useRef(false)

  const occupiedSquares = useMemo(() => occupiedSquaresFromFen(gameState?.your_fen), [gameState?.your_fen])

  const {
    placements,
    phantomSquares,
    trayCounts,
    setPieceAt,
    move,
    removeAt,
    availablePiecesForSquare,
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

  useEffect(() => () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
    }
  }, [])

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

  const selectedMove = useMemo(() => {
    if (!selectedMoveBase) {
      return ""
    }

    if (pendingPromotion) {
      return `${selectedMoveBase}?`
    }

    return selectedMoveBase
  }, [pendingPromotion, selectedMoveBase])

  const highlightedSquares = [fromSquare, toSquare, movingPhantomFrom, dragHoverSquare].filter(Boolean)
  const waitingForOpponent = gameState?.state === "active" && !possibleActions.includes("move")
  const activeClockColor = gameState?.clock?.active_color ?? gameState?.turn

  function closePhantomMenu() {
    setPhantomMenu(null)
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    longPressPointerRef.current = null
  }

  function resetPendingMove() {
    setFromSquare("")
    setToSquare("")
    setShowPromotionModal(false)
  }

  function openPhantomMenu(square) {
    setActionError("")
    const squareHasPhantom = Boolean(placements[square])
    setPhantomMenu(buildMenuState(square, boardShellRef.current, squareHasPhantom, availablePiecesForSquare(square)))
  }

  function beginMovePhantom(square) {
    setMovingPhantomFrom(square)
    setDragHoverSquare("")
    closePhantomMenu()
  }

  function completeMovePhantom(targetSquare) {
    if (!movingPhantomFrom) {
      return false
    }

    if (targetSquare === movingPhantomFrom) {
      setMovingPhantomFrom("")
      setDragHoverSquare("")
      return true
    }

    const moved = move(movingPhantomFrom, targetSquare)
    setMovingPhantomFrom("")
    setDragHoverSquare("")
    if (!moved) {
      setActionError("That square cannot take the phantom piece.")
    }
    return moved
  }

  function findSquareFromPointerEvent(event) {
    const target = document.elementFromPoint(event.clientX, event.clientY)
    return target?.closest?.("[data-square]")?.dataset?.square ?? ""
  }

  function finishDragPhantom(targetSquare) {
    const sourceSquare = draggingPhantomFromRef.current
    if (!sourceSquare) {
      return
    }

    const destination = targetSquare || sourceSquare
    const moved = move(sourceSquare, destination)
    if (!moved && destination !== draggingPhantomFrom) {
      setActionError("That square cannot take the phantom piece.")
    }
    setDraggingPhantomFrom("")
    draggingPhantomFromRef.current = ""
    setDragHoverSquare("")
    dragPointerIdRef.current = null
  }

  function handleSquareClick(square) {
    setActionError("")
    setShowPromotionModal(false)

    if (phantomMenu) {
      closePhantomMenu()
    }

    if (movingPhantomFrom) {
      completeMovePhantom(square)
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
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false
      return
    }

    openPhantomMenu(square)
  }

  function handleSquarePointerDown(square, event) {
    if (event.button === 2 && placements[square] && !isTouchLikePointer(event)) {
      setActionError("")
      setDraggingPhantomFrom(square)
      draggingPhantomFromRef.current = square
      setDragHoverSquare(square)
      dragPointerIdRef.current = event.pointerId
      suppressContextMenuRef.current = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
      closePhantomMenu()
      return
    }

    if (!isTouchLikePointer(event)) {
      return
    }

    clearLongPressTimer()
    longPressPointerRef.current = event.pointerId
    longPressTimerRef.current = window.setTimeout(() => {
      openPhantomMenu(square)
      clearLongPressTimer()
    }, LONG_PRESS_MS)
  }

  function handleSquarePointerEnter(square, event) {
    if (draggingPhantomFromRef.current && (event.buttons & 2) === 2) {
      setDragHoverSquare(square)
    }
  }

  function handleSquarePointerMove(square, event) {
    if (!draggingPhantomFromRef.current || dragPointerIdRef.current !== event.pointerId) {
      return
    }

    const hoveredSquare = findSquareFromPointerEvent(event)
    if (hoveredSquare) {
      setDragHoverSquare(hoveredSquare)
    }
  }

  function handleSquarePointerUp(square, event) {
    if (draggingPhantomFromRef.current && event.button === 2) {
      const hoveredSquare = findSquareFromPointerEvent(event)
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      finishDragPhantom(hoveredSquare || square)
      return
    }

    if (isTouchLikePointer(event) && longPressPointerRef.current === event.pointerId) {
      clearLongPressTimer()
    }
  }

  function handleSquarePointerCancel(_square, event) {
    if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      finishDragPhantom(dragHoverSquare)
    }

    if (longPressPointerRef.current === event.pointerId) {
      clearLongPressTimer()
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

  function handleMenuChoosePiece(piece) {
    if (!phantomMenu?.square) {
      return
    }

    setPieceAt(phantomMenu.square, piece)
    closePhantomMenu()
  }

  function handleMenuDeletePhantom() {
    if (!phantomMenu?.square) {
      return
    }

    removeAt(phantomMenu.square)
    if (phantomMenu.square === movingPhantomFrom) {
      setMovingPhantomFrom("")
    }
    closePhantomMenu()
  }

  const phantomMenuSquare = phantomMenu?.square ?? ""
  const phantomOnMenuSquare = phantomMenuSquare ? placements[phantomMenuSquare] : ""

  return (
    <main className="page-shell game-page" aria-live="polite" onClick={() => phantomMenu && closePhantomMenu()}>
      <div className="game-page__header">
        <h1>Game</h1>
        <button type="button" onClick={() => navigate("/lobby")}>Back to lobby</button>
      </div>

      <p className="game-page__meta">Game ID: <code>{gameId}</code></p>
      {loading ? <p className="game-page__notice">Loading game state…</p> : null}
      {submittingAction ? <p className="game-page__notice">Submitting action…</p> : null}
      {waitingForOpponent ? <p className="game-page__notice">Waiting for opponent move…</p> : null}
      {movingPhantomFrom ? <p className="game-page__notice">Moving phantom from <code>{movingPhantomFrom}</code>. Tap or right-click a destination square.</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {gameState ? (
        <>
          <div className="game-layout">
            <section className="game-card game-card--board" aria-label="Board">
              <div className="game-clocks" aria-label="Game clocks">
                <div className={`game-clock ${activeClockColor === "white" ? "game-clock--active" : ""}`.trim()}>
                  <span className="game-clock__label">White</span>
                  <strong>{formatClock(gameState.clock?.white_remaining)}</strong>
                </div>
                <div className={`game-clock ${activeClockColor === "black" ? "game-clock--active" : ""}`.trim()}>
                  <span className="game-clock__label">Black</span>
                  <strong>{formatClock(gameState.clock?.black_remaining)}</strong>
                </div>
              </div>

              <div className="game-board-shell" ref={boardShellRef}>
                <ChessBoard
                  boardFen={gameState.your_fen}
                  orientation={gameState.your_color}
                  highlightedSquares={highlightedSquares}
                  lastMoveSquares={lastMoveSquares}
                  phantomSquares={phantomSquares}
                  phantomPlacements={placements}
                  disabled={false}
                  onSquareClick={handleSquareClick}
                  onSquareRightClick={handleSquareRightClick}
                  onSquarePointerDown={handleSquarePointerDown}
                  onSquarePointerEnter={handleSquarePointerEnter}
                  onSquarePointerMove={handleSquarePointerMove}
                  onSquarePointerUp={handleSquarePointerUp}
                  onSquarePointerCancel={handleSquarePointerCancel}
                />

                {phantomMenu ? (
                  <div
                    className={`phantom-menu ${phantomMenu.x == null ? "phantom-menu--sheet" : ""}`.trim()}
                    style={phantomMenu.x == null ? undefined : { left: phantomMenu.x, top: phantomMenu.y }}
                    role="dialog"
                    aria-label={`Phantom options for ${phantomMenu.square}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="phantom-menu__header">
                      <strong>{phantomMenu.square}</strong>
                      <button type="button" className="phantom-menu__close" onClick={closePhantomMenu} aria-label="Close phantom menu">×</button>
                    </div>

                    <div className="phantom-menu__intro">
                      <strong>{phantomMenu.square}</strong>
                      <span>Add a phantom piece.</span>
                    </div>

                    <div className="phantom-menu__piece-grid">
                      {PHANTOM_PIECES.map((piece) => {
                        const disabled = !phantomMenu.availablePieces.includes(piece)
                        const pieceKey = piece
                        return (
                          <button
                            type="button"
                            key={piece}
                            className="phantom-menu__piece-button"
                            disabled={disabled}
                            onClick={() => handleMenuChoosePiece(piece)}
                            aria-label={`${PHANTOM_LABELS[piece]} (${trayCounts[piece]} left)`}
                            title={`${PHANTOM_LABELS[piece]} · ${trayCounts[piece]} left`}
                          >
                            <span className="phantom-menu__piece-symbol" aria-hidden="true">
                              <img src={PIECE_ASSETS[pieceKey]} alt="" draggable="false" />
                            </span>
                            <small>{trayCounts[piece]}</small>
                          </button>
                        )
                      })}
                    </div>

                    {phantomOnMenuSquare ? (
                      <div className="phantom-menu__footer">
                        <button type="button" className="phantom-menu__secondary phantom-menu__danger" onClick={handleMenuDeletePhantom}>Remove</button>
                        <button type="button" className="phantom-menu__secondary" onClick={() => beginMovePhantom(phantomMenu.square)}>Right-drag to move</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="game-board-meta">
                <p className="game-page__meta">Selected move: <code>{selectedMove || "—"}</code></p>
                <p className="game-page__meta">Phantoms: right-click or right-drag on desktop, or long-press on mobile.</p>
              </div>
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
