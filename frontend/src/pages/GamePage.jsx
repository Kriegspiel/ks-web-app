import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PromotionModal from "../components/PromotionModal"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"
import { askAny, getGameState, resignGame, submitMove } from "../services/api"
import { PIECE_ASSETS } from "../components/chessboard"
import "./GamePage.css"

const POLL_INTERVAL_MS = 500
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

function normalizeLogColor(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized.startsWith("w")) {
    return "white"
  }
  if (normalized.startsWith("b")) {
    return "black"
  }
  return null
}

function collectLogText(value, output) {
  if (!value) {
    return
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    if (normalized) {
      output.push(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLogText(item, output))
    return
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectLogText(item, output))
  }
}

function getLogEntryTexts(entry) {
  if (!entry || typeof entry !== "object") {
    return []
  }

  const output = []
  const candidates = [
    entry.announcement,
    entry.announcements,
    entry.message,
    entry.messages,
    entry.text,
    entry.response,
    entry.responses,
    entry.referee_response,
    entry.referee_responses,
    entry.description,
    entry.detail,
    entry.details,
    entry.summary,
    entry.answer,
    entry.result,
  ]

  candidates.forEach((candidate) => collectLogText(candidate, output))

  return [...new Set(output)]
}

function getLogEntryColor(entry, fallbackIndex = 0) {
  if (!entry || typeof entry !== "object") {
    return fallbackIndex % 2 === 0 ? "white" : "black"
  }

  const explicitColor = [entry.color, entry.player_color, entry.actor_color, entry.side, entry.turn_color, entry.perspective, entry.recipient, entry.player]
    .map(normalizeLogColor)
    .find(Boolean)
  if (explicitColor) {
    return explicitColor
  }

  const text = getLogEntryTexts(entry).join(" ").toLowerCase()
  if (text.startsWith("white") || text.includes(" white ")) {
    return "white"
  }
  if (text.startsWith("black") || text.includes(" black ")) {
    return "black"
  }

  return fallbackIndex % 2 === 0 ? "white" : "black"
}

function getLogEntryTurn(entry, fallbackTurn = 1) {
  if (!entry || typeof entry !== "object") {
    return fallbackTurn
  }

  const numericCandidates = [entry.turn, entry.move_number, entry.fullmove_number, entry.fullmove, entry.turn_number]
  for (const candidate of numericCandidates) {
    const value = Number.parseInt(candidate, 10)
    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  const ply = Number.parseInt(entry.ply, 10)
  if (Number.isFinite(ply) && ply > 0) {
    return Math.ceil(ply / 2)
  }

  return fallbackTurn
}

function groupRefereeLog(entries = []) {
  const turns = new Map()

  entries.forEach((entry, index) => {
    const turn = getLogEntryTurn(entry, Math.floor(index / 2) + 1)
    const color = getLogEntryColor(entry, index)
    const texts = getLogEntryTexts(entry)
    if (!texts.length) {
      return
    }

    if (!turns.has(turn)) {
      turns.set(turn, { turn, white: [], black: [] })
    }

    turns.get(turn)[color].push(...texts)
  })

  return Array.from(turns.values()).sort((left, right) => left.turn - right.turn)
}

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

function squareHasOwnPiece(fen, square, color) {
  const piece = pieceAtSquare(fen, square)
  if (!piece || !color) {
    return false
  }

  return color === "white" ? piece === piece.toUpperCase() : piece === piece.toLowerCase()
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
  const [, setDraggingPhantomFrom] = useState("")
  const [dragHoverSquare, setDragHoverSquare] = useState("")
  const [draggingMoveFrom, setDraggingMoveFrom] = useState("")
  const [moveDragHoverSquare, setMoveDragHoverSquare] = useState("")
  const [dragPreview, setDragPreview] = useState(null)

  const longPressTimerRef = useRef(null)
  const longPressPointerRef = useRef(null)
  const boardShellRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const draggingPhantomFromRef = useRef("")
  const moveDragPointerIdRef = useRef(null)
  const draggingMoveFromRef = useRef("")
  const suppressClickRef = useRef(false)
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

  const highlightedSquares = [fromSquare, toSquare, movingPhantomFrom, dragHoverSquare, draggingMoveFrom, moveDragHoverSquare].filter(Boolean)
  const waitingForOpponent = gameState?.state === "active" && !possibleActions.includes("move")
  const activeClockColor = gameState?.clock?.active_color ?? gameState?.turn
  const groupedRefereeLog = useMemo(() => groupRefereeLog(gameState?.referee_log ?? []), [gameState?.referee_log])

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

  function updateDragPreview(event, piece) {
    if (!piece) {
      setDragPreview(null)
      return
    }

    setDragPreview({ piece, x: event.clientX, y: event.clientY })
  }

  function clearDragPreview() {
    setDragPreview(null)
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
    if (!moved && destination !== sourceSquare) {
      setActionError("That square cannot take the phantom piece.")
    }
    setDraggingPhantomFrom("")
    draggingPhantomFromRef.current = ""
    setDragHoverSquare("")
    dragPointerIdRef.current = null
    clearDragPreview()
  }

  async function commitMove(from, to) {
    if (!from || !to || !gameId || !canMove) {
      return
    }

    setFromSquare(from)
    setToSquare(to)
    setShowPromotionModal(false)

    if (isPromotionCandidate({ fen: gameState?.your_fen, fromSquare: from, toSquare: to, color: gameState?.your_color })) {
      setShowPromotionModal(true)
      return
    }

    await submitMoveWithUci(`${from}${to}`)
  }

  async function finishMoveDrag(targetSquare) {
    const sourceSquare = draggingMoveFromRef.current
    if (!sourceSquare) {
      return
    }

    const destination = targetSquare || sourceSquare
    setDraggingMoveFrom("")
    draggingMoveFromRef.current = ""
    moveDragPointerIdRef.current = null
    setMoveDragHoverSquare("")
    suppressClickRef.current = true
    clearDragPreview()

    if (destination === sourceSquare) {
      setFromSquare(sourceSquare)
      setToSquare("")
      setShowPromotionModal(false)
      return
    }

    void commitMove(sourceSquare, destination)
  }

  async function handleSquareClick(square) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

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
      if (!squareHasOwnPiece(gameState?.your_fen, square, gameState?.your_color)) {
        return
      }
      setFromSquare(square)
      return
    }

    if (square === fromSquare) {
      resetPendingMove()
      return
    }

    if (squareHasOwnPiece(gameState?.your_fen, square, gameState?.your_color)) {
      setFromSquare(square)
      setToSquare("")
      setShowPromotionModal(false)
      return
    }

    await commitMove(fromSquare, square)
  }

  function handleSquareRightClick(square) {
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false
      return
    }

    if (placements[square]) {
      setActionError("")
      removeAt(square)
      if (movingPhantomFrom === square) {
        setMovingPhantomFrom("")
      }
      clearDragPreview()
      closePhantomMenu()
      return
    }

    openPhantomMenu(square)
  }

  function handleSquarePointerDown(square, event) {
    if (event.button === 0 && placements[square] && !isTouchLikePointer(event)) {
      setActionError("")
      setDraggingPhantomFrom(square)
      draggingPhantomFromRef.current = square
      setDragHoverSquare(square)
      dragPointerIdRef.current = event.pointerId
      updateDragPreview(event, placements[square])
      event.currentTarget.setPointerCapture?.(event.pointerId)
      closePhantomMenu()
      return
    }

    if (event.button === 0 && !isTouchLikePointer(event) && canMove && squareHasOwnPiece(gameState?.your_fen, square, gameState?.your_color)) {
      const piece = pieceAtSquare(gameState?.your_fen, square)
      setActionError("")
      setShowPromotionModal(false)
      setDraggingMoveFrom(square)
      draggingMoveFromRef.current = square
      moveDragPointerIdRef.current = event.pointerId
      setMoveDragHoverSquare(square)
      setFromSquare(square)
      setToSquare("")
      updateDragPreview(event, piece)
      event.currentTarget.setPointerCapture?.(event.pointerId)
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
    if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId && (event.buttons & 1) === 1) {
      setMoveDragHoverSquare(square)
    }

    if (draggingPhantomFromRef.current && (event.buttons & 2) === 2) {
      setDragHoverSquare(square)
    }
  }

  function handleSquarePointerMove(square, event) {
    if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
      const hoveredSquare = findSquareFromPointerEvent(event) || square
      if (hoveredSquare) {
        setMoveDragHoverSquare(hoveredSquare)
      }
      updateDragPreview(event, pieceAtSquare(gameState?.your_fen, draggingMoveFromRef.current))
    }

    if (!draggingPhantomFromRef.current || dragPointerIdRef.current !== event.pointerId) {
      return
    }

    const hoveredSquare = findSquareFromPointerEvent(event)
    if (hoveredSquare) {
      setDragHoverSquare(hoveredSquare)
    }
    updateDragPreview(event, placements[draggingPhantomFromRef.current])
  }

  function handleSquarePointerUp(square, event) {
    if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
      const hoveredSquare = findSquareFromPointerEvent(event)
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      finishMoveDrag(hoveredSquare || square)
      return
    }

    if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
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
    if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
      finishMoveDrag(moveDragHoverSquare)
    }

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
    <main className="page-shell game-page" onClick={() => phantomMenu && closePhantomMenu()}>
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
                      <div className="phantom-menu__intro">
                        <strong>{phantomMenu.square}</strong>
                        <span>Add a phantom piece.</span>
                      </div>
                      <button type="button" className="phantom-menu__close" onClick={closePhantomMenu} aria-label="Close phantom menu">×</button>
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
                        <button type="button" className="phantom-menu__secondary" onClick={() => beginMovePhantom(phantomMenu.square)}>Tap destination</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {dragPreview ? (
                <div className="game-drag-preview" style={{ left: dragPreview.x, top: dragPreview.y }} aria-hidden="true">
                  <img src={PIECE_ASSETS[dragPreview.piece]} alt="" draggable="false" />
                </div>
              ) : null}

              <div className="game-board-meta">
                <p className="game-page__meta">Selected move: <code>{selectedMove || "—"}</code></p>
                <p className="game-page__meta">Moves commit immediately when you click or left-drag a real piece. Phantoms: left-drag to move, right-click to remove, long-press or right-click empty squares to add.</p>
              </div>
            </section>

            <section className="game-card game-card--status" aria-label="Game status">
              <div className="game-actions" aria-label="Game actions">
                <button type="button" onClick={handleAskAny} disabled={!canAskAny}>
                  Any pawn captures?
                </button>
              </div>

              <h2>Status</h2>
              <ul className="game-status-list">
                <li><strong>State:</strong> {gameState.state}</li>
                <li><strong>Your color:</strong> {gameState.your_color}</li>
                <li className={canMove ? "game-status-list__turn game-status-list__turn--active" : "game-status-list__turn"}><strong>Turn:</strong> {gameState.turn ?? "—"}</li>
                <li><strong>Move number:</strong> {gameState.move_number}</li>
              </ul>

              {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

              <div className="game-referee-log">
                <div className="game-referee-log__header">
                  <h3>Referee log</h3>
                </div>

                {groupedRefereeLog.length ? (
                  <div className="game-referee-log__scroll" role="log" aria-label="Referee log by turn">
                    {groupedRefereeLog.map((turnEntry) => (
                      <section key={`turn-${turnEntry.turn}`} className="game-referee-turn">
                        <div className="game-referee-turn__title">Turn {turnEntry.turn}</div>
                        <div className="game-referee-turn__grid">
                          <div className="game-referee-column">
                            <div className="game-referee-column__label">White</div>
                            {turnEntry.white.length ? (
                              <ul className="game-referee-column__list">
                                {turnEntry.white.map((entry, index) => (
                                  <li key={`turn-${turnEntry.turn}-white-${index}`}>{entry}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="game-referee-column__empty">—</p>
                            )}
                          </div>
                          <div className="game-referee-column">
                            <div className="game-referee-column__label">Black</div>
                            {turnEntry.black.length ? (
                              <ul className="game-referee-column__list">
                                {turnEntry.black.map((entry, index) => (
                                  <li key={`turn-${turnEntry.turn}-black-${index}`}>{entry}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="game-referee-column__empty">—</p>
                            )}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <p className="game-referee-column__empty">No referee responses yet.</p>
                )}
              </div>

              <button type="button" className="game-danger-button" onClick={handleResign} disabled={!canResign}>
                Resign
              </button>
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
