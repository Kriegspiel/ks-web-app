import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PromotionModal from "../components/PromotionModal"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"
import { askAny, deleteWaitingGame, getGame, getGameState, resignGame, submitMove } from "../services/api"
import { getAllowedMoveTargets, PIECE_ASSETS } from "../components/chessboard"
import "./GamePage.css"

const POLL_INTERVAL_MS = 500
const DOUBLE_TAP_WINDOW_MS = 320
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
const REFEREE_LOG_FOLLOW_THRESHOLD_PX = 24
const REFEREE_MAIN_ANNOUNCEMENT_TEXT = {
  1: "Illegal move",
  2: "Move complete",
  3: "Capture done",
  4: "Has pawn captures",
  5: "No pawn captures",
  6: "Check on rank",
  7: "Check on file",
  8: "Check on long diagonal",
  9: "Check on short diagonal",
  10: "Check by knight",
  11: "Double check",
  ILLEGAL_MOVE: "Illegal move",
  REGULAR_MOVE: "Move complete",
  CAPTURE_DONE: "Capture done",
  HAS_ANY: "Has pawn captures",
  NO_ANY: "No pawn captures",
  DRAW_TOOMANYREVERSIBLEMOVES: "Draw by too many reversible moves",
  DRAW_STALEMATE: "Draw by stalemate",
  DRAW_INSUFFICIENT: "Draw by insufficient material",
  CHECKMATE_WHITE_WINS: "Checkmate — White wins",
  CHECKMATE_BLACK_WINS: "Checkmate — Black wins",
  CHECK_RANK: "Check on rank",
  CHECK_FILE: "Check on file",
  CHECK_LONG_DIAGONAL: "Check on long diagonal",
  CHECK_SHORT_DIAGONAL: "Check on short diagonal",
  CHECK_KNIGHT: "Check by knight",
  CHECK_DOUBLE: "Double check",
}
const REFEREE_CODE_KEYS = [
  "main",
  "main_announcement",
  "code",
  "status",
  "status_code",
  "announcement_code",
  "result_code",
  "special",
  "special_announcement",
  "special_case",
]
const REFEREE_CAPTURE_SQUARE_KEYS = ["capture_square", "capture_at_square", "captured_square", "target_square", "square"]

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

function formatCaptureSquare(value) {
  if (typeof value !== "string") {
    return ""
  }

  const normalized = value.trim()
  if (!/^[a-h][1-8]$/i.test(normalized)) {
    return ""
  }

  return normalized.toUpperCase()
}

function getEntryCaptureSquare(value) {
  if (!value || typeof value !== "object") {
    return ""
  }

  return REFEREE_CAPTURE_SQUARE_KEYS.map((key) => formatCaptureSquare(value[key])).find(Boolean) ?? ""
}

function getRefereeCode(value) {
  if (typeof value === "number" && REFEREE_MAIN_ANNOUNCEMENT_TEXT[value]) {
    return value
  }

  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (REFEREE_MAIN_ANNOUNCEMENT_TEXT[normalized]) {
    return normalized
  }

  const numeric = Number.parseInt(normalized, 10)
  if (Number.isFinite(numeric) && REFEREE_MAIN_ANNOUNCEMENT_TEXT[numeric]) {
    return numeric
  }

  return null
}

function formatRefereeCode(code, captureSquare) {
  const text = REFEREE_MAIN_ANNOUNCEMENT_TEXT[code]
  if (!text) {
    return ""
  }

  if (code === 3 || code === "CAPTURE_DONE") {
    return captureSquare ? text + " at " + captureSquare : text
  }

  return text
}

function collectLogText(value, output) {
  if (!value) {
    return
  }

  if (typeof value === "string") {
    const code = getRefereeCode(value)
    if (code) {
      output.push(formatRefereeCode(code, ""))
      return
    }

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
    const codes = REFEREE_CODE_KEYS.map((key) => getRefereeCode(value[key])).filter(Boolean)
    const captureSquare = REFEREE_CAPTURE_SQUARE_KEYS.map((key) => formatCaptureSquare(value[key])).find(Boolean)

    codes.forEach((code, index) => {
      output.push(formatRefereeCode(code, index === 0 ? captureSquare : ""))
    })

    Object.entries(value).forEach(([key, item]) => {
      if (REFEREE_CAPTURE_SQUARE_KEYS.includes(key)) {
        return
      }
      if (REFEREE_CODE_KEYS.includes(key) && getRefereeCode(item)) {
        return
      }
      collectLogText(item, output)
    })
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

function getGameScoresheet(gameState, color) {
  if (!gameState || !color) {
    return null
  }

  const directKey = `${color}_scoresheet`
  const engineGameState = gameState.engine_state?.game_state
  return gameState[directKey] ?? engineGameState?.[directKey] ?? null
}

function getScoresheetTurns(value, privateKey, publicKey) {
  if (!value || typeof value !== "object") {
    return []
  }

  const turns = value[publicKey] ?? value[privateKey]
  return Array.isArray(turns) ? turns : []
}

function getScoresheetQuestionType(value) {
  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized ? normalized.toUpperCase() : ""
  }

  if (!value || typeof value !== "object") {
    return ""
  }

  return getScoresheetQuestionType(value.question_type ?? value.type ?? value.question)
}

function getScoresheetMoveUci(value) {
  if (!value || typeof value === "string") {
    return ""
  }

  if (Array.isArray(value)) {
    return getScoresheetMoveUci(value[0])
  }

  const moveUci = value.move_uci ?? value.move
  return typeof moveUci === "string" ? moveUci.trim().toLowerCase() : ""
}

function formatRefereeEntryText({ messages = [], moveUci = "" }) {
  const cleanedMessages = Array.isArray(messages)
    ? messages.flatMap((message) => {
      if (typeof message !== "string") {
        return []
      }

      const parts = splitRefereeTextParts(message)
      return parts.length ? parts : [message.trim()].filter(Boolean)
    })
    : []
  const uniqueMessages = [...new Set(cleanedMessages)]
  const joined = uniqueMessages.join(" · ")
  if (!joined) {
    return ""
  }
  return moveUci ? `[${moveUci}] ${joined}` : joined
}

function splitRefereeTextParts(value) {
  if (typeof value !== "string") {
    return []
  }

  return value
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^(Move attempt|Opponent move|Ask any pawn captures|Opponent asked any pawn captures)\s*[—-]\s*/i, "").trim())
    .filter(Boolean)
}

function getCaptureSquareFromTexts(messages = []) {
  if (!Array.isArray(messages)) {
    return ""
  }

  return messages.map((message) => {
    if (typeof message !== "string") {
      return ""
    }
    const match = message.match(/capture done at ([a-h][1-8])/i)
    return match ? formatCaptureSquare(match[1]) : ""
  }).find(Boolean) ?? ""
}

function normalizeAnnouncementItem(entry) {
  if (!entry) {
    return null
  }

  if (typeof entry === "string") {
    const parts = splitRefereeTextParts(entry)
    if (!parts.length) {
      return null
    }

    const captureSquare = getCaptureSquareFromTexts(parts)

    return { text: formatRefereeEntryText({ messages: parts }), messages: parts, captureSquare }
  }

  const texts = getLogEntryTexts(entry)
  if (!texts.length) {
    return null
  }

  const prompt = typeof entry.prompt === "string" && entry.prompt.trim() ? entry.prompt.trim() : ""
  const message = typeof entry.message === "string" && entry.message.trim() ? entry.message.trim() : ""
  const moveUci = typeof entry.move_uci === "string" ? entry.move_uci.trim().toLowerCase() : ""
  const captureSquare = getEntryCaptureSquare(entry) || getCaptureSquareFromTexts(texts)
  const text = formatRefereeEntryText({ messages: texts, moveUci })

  if (message) {
    return { text, messages: texts, prompt, moveUci, captureSquare }
  }

  if (prompt) {
    return { text, messages: texts, prompt, moveUci, captureSquare }
  }

  return { text, messages: texts, moveUci, captureSquare }
}

function normalizeScoresheetTurnEntry(pair, perspective) {
  if (!pair) {
    return null
  }

  if (!Array.isArray(pair) && typeof pair === "object" && (pair.message || pair.messages || pair.prompt)) {
    return normalizeAnnouncementItem(pair)
  }

  const tuple = Array.isArray(pair)
    ? pair
    : [pair.move ?? pair.question ?? pair.prompt ?? pair[0], pair.answer ?? pair.response ?? pair.result ?? pair[1]]
  const [questionValue, answerValue] = tuple
  const moveUci = perspective === "own" ? getScoresheetMoveUci(questionValue) : ""
  const answerTexts = getLogEntryTexts({ answer: answerValue })
  const captureSquare = getEntryCaptureSquare(answerValue) || getCaptureSquareFromTexts(answerTexts)

  if (!answerTexts.length) {
    return null
  }

  return { text: formatRefereeEntryText({ messages: answerTexts, moveUci }), messages: answerTexts, moveUci, captureSquare }
}

function normalizeCaptureTrackingEntry(entry) {
  if (!entry) {
    return null
  }

  if (Array.isArray(entry)) {
    return normalizeScoresheetTurnEntry(entry, "opponent")
  }

  if (typeof entry === "object") {
    if (entry.message || entry.messages || entry.prompt) {
      return normalizeAnnouncementItem(entry)
    }

    if (entry.answer || entry.response || entry.result || entry.move || entry.question || entry.prompt) {
      return normalizeScoresheetTurnEntry(entry, "opponent")
    }

    return normalizeAnnouncementItem(entry)
  }

  return normalizeAnnouncementItem(entry)
}

function normalizeTurnSideEntries(entries, normalizer) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.map(normalizer).filter(Boolean)
}

function buildScoresheetRefereeLog(gameState) {
  const playerColor = normalizeLogColor(gameState?.your_color)
  const scoresheet = getGameScoresheet(gameState, playerColor)
  if (!scoresheet) {
    return []
  }

  const ownTurns = getScoresheetTurns(scoresheet, "_KriegspielScoresheet__moves_own", "moves_own")
  const opponentTurns = getScoresheetTurns(scoresheet, "_KriegspielScoresheet__moves_opponent", "moves_opponent")
  const turnCount = Math.max(ownTurns.length, opponentTurns.length)

  return Array.from({ length: turnCount }, (_, index) => ({
    turn: index + 1,
    white: normalizeTurnSideEntries(
      (playerColor === "white" ? ownTurns[index] : opponentTurns[index]) ?? [],
      (entry) => normalizeScoresheetTurnEntry(entry, playerColor === "white" ? "own" : "opponent")
    ),
    black: normalizeTurnSideEntries(
      (playerColor === "black" ? ownTurns[index] : opponentTurns[index]) ?? [],
      (entry) => normalizeScoresheetTurnEntry(entry, playerColor === "black" ? "own" : "opponent")
    ),
  })).filter((turn) => turn.white.length || turn.black.length)
}

function normalizeExplicitTurns(turns) {
  if (!Array.isArray(turns)) {
    return []
  }

  return turns
    .map((turn) => ({
      turn: Number.parseInt(turn?.turn, 10),
      white: normalizeTurnSideEntries(turn?.white, normalizeAnnouncementItem),
      black: normalizeTurnSideEntries(turn?.black, normalizeAnnouncementItem),
    }))
    .filter((turn) => Number.isFinite(turn.turn) && turn.turn > 0 && (turn.white.length || turn.black.length))
    .sort((left, right) => left.turn - right.turn)
}

function buildVisibleRefereeLog(gameState) {
  const explicitScoresheetTurns = normalizeExplicitTurns(gameState?.scoresheet?.turns)
  if (explicitScoresheetTurns.length) {
    return explicitScoresheetTurns
  }

  const explicitTurns = normalizeExplicitTurns(gameState?.referee_turns)
  if (explicitTurns.length) {
    return explicitTurns
  }

  const scoresheetTurns = buildScoresheetRefereeLog(gameState)
  if (scoresheetTurns.length) {
    return scoresheetTurns
  }

  const groupedRefereeEntries = new Map()
  ;(Array.isArray(gameState?.referee_log) ? gameState.referee_log : []).forEach((entry, index) => {
    const turn = getLogEntryTurn(entry, Math.floor(index / 2) + 1)
    const color = getLogEntryColor(entry, index)
    const texts = getLogEntryTexts(entry)
    if (!texts.length) {
      return
    }
    const captureSquare = getEntryCaptureSquare(entry)

    if (!groupedRefereeEntries.has(turn)) {
      groupedRefereeEntries.set(turn, { turn, white: [], black: [] })
    }

    texts.forEach((text, textIndex) => {
      groupedRefereeEntries.get(turn)[color].push({
        text,
        messages: [text],
        captureSquare: textIndex === 0 ? captureSquare : "",
      })
    })
  })

  return Array.from(groupedRefereeEntries.values()).sort((left, right) => left.turn - right.turn)
}

function rawEntryMessages(entry) {
  return Array.isArray(getLogEntryTexts(entry)) ? getLogEntryTexts(entry) : []
}

function isCaptureAnnouncementEntry(entry) {
  return rawEntryMessages(entry).some((message) => typeof message === "string" && message.startsWith("Capture done"))
}

function isMoveResolutionEntry(entry) {
  return rawEntryMessages(entry).some(
    (message) => typeof message === "string" && (
      message.startsWith("Capture done") ||
      message.startsWith("Move complete") ||
      message.startsWith("Illegal move")
    ),
  )
}

function getRecentCaptureSquaresFromTurns(turns) {
  if (!Array.isArray(turns)) {
    return []
  }

  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const turn = turns[turnIndex]
    const orderedEntries = [...(Array.isArray(turn?.white) ? turn.white : []), ...(Array.isArray(turn?.black) ? turn.black : [])]
    for (let entryIndex = orderedEntries.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const entry = normalizeCaptureTrackingEntry(orderedEntries[entryIndex])
      if (!entry) {
        continue
      }
      if (isCaptureAnnouncementEntry(entry)) {
        const captureSquare =
          getEntryCaptureSquare(entry) ||
          getEntryCaptureSquare(entry?.answer) ||
          getEntryCaptureSquare(entry?.response) ||
          getEntryCaptureSquare(entry?.result) ||
          getCaptureSquareFromTexts(rawEntryMessages(entry))
        return captureSquare ? [captureSquare.toLowerCase()] : []
      }
      if (isMoveResolutionEntry(entry)) {
        return []
      }
    }
  }

  return []
}

function getRecentCaptureSquares(gameState) {
  const explicitScoresheetTurns = Array.isArray(gameState?.scoresheet?.turns) ? gameState.scoresheet.turns : []
  if (explicitScoresheetTurns.length) {
    return getRecentCaptureSquaresFromTurns(explicitScoresheetTurns)
  }

  const explicitTurns = Array.isArray(gameState?.referee_turns) ? gameState.referee_turns : []
  if (explicitTurns.length) {
    return getRecentCaptureSquaresFromTurns(explicitTurns)
  }

  const playerColor = normalizeLogColor(gameState?.your_color)
  const scoresheet = getGameScoresheet(gameState, playerColor)
  if (scoresheet) {
    const ownTurns = getScoresheetTurns(scoresheet, "_KriegspielScoresheet__moves_own", "moves_own")
    const opponentTurns = getScoresheetTurns(scoresheet, "_KriegspielScoresheet__moves_opponent", "moves_opponent")
    const turnCount = Math.max(ownTurns.length, opponentTurns.length)
    const turns = Array.from({ length: turnCount }, (_, index) => ({
      white: playerColor === "white" ? ownTurns[index] ?? [] : opponentTurns[index] ?? [],
      black: playerColor === "black" ? ownTurns[index] ?? [] : opponentTurns[index] ?? [],
    }))
    return getRecentCaptureSquaresFromTurns(turns)
  }

  const refereeLog = Array.isArray(gameState?.referee_log) ? gameState.referee_log : []
  for (let index = refereeLog.length - 1; index >= 0; index -= 1) {
    const entry = refereeLog[index]
    if (!entry) {
      continue
    }
    if (isCaptureAnnouncementEntry(entry)) {
      const captureSquare =
        getEntryCaptureSquare(entry) ||
        getEntryCaptureSquare(entry?.answer) ||
        getEntryCaptureSquare(entry?.response) ||
        getEntryCaptureSquare(entry?.result) ||
        getCaptureSquareFromTexts(rawEntryMessages(entry))
      return captureSquare ? [captureSquare.toLowerCase()] : []
    }
    if (isMoveResolutionEntry(entry)) {
      return []
    }
  }

  return []
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

function formatRuleVariant(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "—"
  }

  const normalized = value.trim().replace(/[_-]+/g, " ")
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
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

function getAllowedMoveSources(allowedMoves) {
  if (!Array.isArray(allowedMoves)) {
    return []
  }

  const sources = allowedMoves
    .filter((uci) => typeof uci === "string")
    .map((uci) => uci.trim().toLowerCase().slice(0, 2))
    .filter((square) => /^[a-h][1-8]$/.test(square))

  return [...new Set(sources)]
}

function squareRankNumber(square) {
  const rank = Number.parseInt(String(square || "")[1], 10)
  return Number.isFinite(rank) ? rank : null
}

function squareFileNumber(square) {
  const file = String(square || "")[0]
  const fileNumber = file.charCodeAt(0) - 97
  return fileNumber >= 0 && fileNumber < 8 ? fileNumber : null
}

function getPawnMoveKind(uci, color, fen) {
  if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci.trim())) {
    return ""
  }

  const normalized = uci.trim().toLowerCase()
  const fromSquare = normalized.slice(0, 2)
  const toSquare = normalized.slice(2, 4)
  const fromPiece = pieceAtSquare(fen, fromSquare)
  if (fromPiece) {
    const isPawn = color === "white" ? fromPiece === "P" : fromPiece === "p"
    if (!isPawn) {
      return ""
    }
  }

  const fromRank = squareRankNumber(fromSquare)
  const toRank = squareRankNumber(toSquare)
  const fromFile = squareFileNumber(fromSquare)
  const toFile = squareFileNumber(toSquare)
  if (fromRank == null || toRank == null || fromFile == null || toFile == null) {
    return ""
  }

  const fileDelta = toFile - fromFile
  const rankDelta = toRank - fromRank
  const forward = color === "black" ? -1 : 1
  const startRank = color === "black" ? 7 : 2

  if (Math.abs(fileDelta) === 1 && rankDelta === forward) {
    return "capture"
  }

  if (fileDelta === 0 && rankDelta === forward) {
    return "advance"
  }

  if (fileDelta === 0 && fromRank === startRank && rankDelta === forward * 2) {
    return "advance"
  }

  return ""
}

function getLatestAskAnyConstraint(turns, playerColor) {
  if (!Array.isArray(turns) || !playerColor) {
    return { type: "", turn: null }
  }

  const sideKey = playerColor === "black" ? "black" : "white"
  for (let turnIndex = turns.length - 1; turnIndex >= 0; turnIndex -= 1) {
    const sideEntries = Array.isArray(turns[turnIndex]?.[sideKey]) ? turns[turnIndex][sideKey] : []
    for (let entryIndex = sideEntries.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const entry = sideEntries[entryIndex]
      const messages = Array.isArray(entry.messages) ? entry.messages : []
      if (messages.includes("Has pawn captures")) {
        return { type: "has_any", turn: Number.isFinite(turns[turnIndex]?.turn) ? turns[turnIndex].turn : null }
      }
      if (messages.includes("No pawn captures")) {
        return { type: "no_any", turn: Number.isFinite(turns[turnIndex]?.turn) ? turns[turnIndex].turn : null }
      }
    }
  }

  return { type: "", turn: null }
}

function getActivePlayerTurnNumber({ moveNumber, turn, yourColor }) {
  const normalizedTurn = normalizeLogColor(turn)
  const normalizedColor = normalizeLogColor(yourColor)
  const numericMoveNumber = Number.parseInt(moveNumber, 10)
  if (!Number.isFinite(numericMoveNumber) || numericMoveNumber < 1) {
    return null
  }
  if (!normalizedTurn || !normalizedColor || normalizedTurn !== normalizedColor) {
    return null
  }

  return Math.ceil(numericMoveNumber / 2)
}

function filterAllowedMovesByAskAny(allowedMoves, { askAnyConstraint, color, fen }) {
  if (!Array.isArray(allowedMoves) || !askAnyConstraint || !color) {
    return Array.isArray(allowedMoves) ? allowedMoves : []
  }

  return allowedMoves.filter((uci) => {
    const pawnMoveKind = getPawnMoveKind(uci, color, fen)
    if (!pawnMoveKind) {
      return askAnyConstraint !== "has_any"
    }
    if (askAnyConstraint === "has_any") {
      return pawnMoveKind === "capture"
    }
    if (askAnyConstraint === "no_any") {
      return pawnMoveKind !== "capture"
    }
    return true
  })
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

function restoreViewportPosition(viewport) {
  if (!viewport) {
    return
  }

  const x = Number.isFinite(viewport.x) ? viewport.x : 0
  const y = Number.isFinite(viewport.y) ? viewport.y : 0
  const scrollRoot = document.scrollingElement ?? document.documentElement ?? document.body

  if (scrollRoot) {
    scrollRoot.scrollLeft = x
    scrollRoot.scrollTop = y
  }

  document.documentElement.scrollLeft = x
  document.documentElement.scrollTop = y
  document.body.scrollLeft = x
  document.body.scrollTop = y

  if (typeof window.scrollTo === "function") {
    try {
      window.scrollTo({ left: x, top: y, behavior: "auto" })
    } catch {
      try {
        window.scrollTo(x, y)
      } catch {
        // JSDOM does not implement window scrolling.
      }
    }
  }
}

function blurActiveInteractiveElement() {
  const activeElement = document.activeElement
  if (!activeElement || activeElement === document.body) {
    return
  }

  if (typeof activeElement.blur === "function") {
    activeElement.blur()
  }
}

function getOpponentPhantomPiece(piece, playerColor) {
  if (typeof piece !== "string") {
    return ""
  }

  const normalized = piece.toLowerCase()
  return playerColor === "black" ? normalized.toUpperCase() : normalized
}

export default function GamePage() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const { user } = useAuth()

  const [gameState, setGameState] = useState(null)
  const [gameMeta, setGameMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [submittingAction, setSubmittingAction] = useState(false)
  const [fromSquare, setFromSquare] = useState("")
  const [toSquare, setToSquare] = useState("")
  const [lastMoveSquares, setLastMoveSquares] = useState([])
  const [illegalMoveSquares, setIllegalMoveSquares] = useState([])
  const [showPromotionModal, setShowPromotionModal] = useState(false)
  const [phantomMenu, setPhantomMenu] = useState(null)
  const [movingPhantomFrom, setMovingPhantomFrom] = useState("")
  const [, setDraggingPhantomFrom] = useState("")
  const [dragHoverSquare, setDragHoverSquare] = useState("")
  const [draggingMoveFrom, setDraggingMoveFrom] = useState("")
  const [moveDragHoverSquare, setMoveDragHoverSquare] = useState("")
  const [dragPreview, setDragPreview] = useState(null)

  const lastTapRef = useRef({ square: "", time: 0 })
  const boardShellRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const draggingPhantomFromRef = useRef("")
  const moveDragPointerIdRef = useRef(null)
  const draggingMoveFromRef = useRef("")
  const suppressClickRef = useRef(false)
  const suppressContextMenuRef = useRef(false)
  const logScrollRef = useRef(null)
  const shouldFollowLogRef = useRef(true)
  const lastRefereeEntryCountRef = useRef(0)
  const viewportRestoreRef = useRef(null)
  const stateRequestIdRef = useRef(0)

  const captureViewport = useCallback(() => {
    viewportRestoreRef.current = { x: window.scrollX, y: window.scrollY }
  }, [])

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

  const pollState = useCallback(async ({ silent = false, preserveViewport = false } = {}) => {
    if (!gameId) {
      return
    }

    const requestId = stateRequestIdRef.current + 1
    stateRequestIdRef.current = requestId

    if (preserveViewport) {
      captureViewport()
    }

    if (!silent) {
      setLoading(true)
    }

    try {
      const state = await getGameState(gameId)
      if (requestId !== stateRequestIdRef.current) {
        return
      }
      setGameState(state)
      setError("")
    } catch (requestError) {
      if (requestId !== stateRequestIdRef.current) {
        return
      }
      setError(requestError?.message ?? "Unable to load this game right now.")
    } finally {
      if (!silent && requestId === stateRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [captureViewport, gameId])

  const pollMetadata = useCallback(async () => {
    if (!gameId) {
      return
    }

    try {
      const metadata = await getGame(gameId)
      setGameMeta(metadata)
    } catch {
      // Keep the board usable even if metadata fails.
    }
  }, [gameId])

  useEffect(() => {
    pollState({ silent: false })
    pollMetadata()
  }, [pollMetadata, pollState])

  useEffect(() => {
    const rootStyle = document.documentElement.style
    const bodyStyle = document.body.style
    const previousRootScrollBehavior = rootStyle.scrollBehavior
    const previousBodyScrollBehavior = bodyStyle.scrollBehavior
    const previousRootOverflowAnchor = rootStyle.overflowAnchor
    const previousBodyOverflowAnchor = bodyStyle.overflowAnchor

    rootStyle.scrollBehavior = "auto"
    bodyStyle.scrollBehavior = "auto"
    rootStyle.overflowAnchor = "none"
    bodyStyle.overflowAnchor = "none"

    return () => {
      rootStyle.scrollBehavior = previousRootScrollBehavior
      bodyStyle.scrollBehavior = previousBodyScrollBehavior
      rootStyle.overflowAnchor = previousRootOverflowAnchor
      bodyStyle.overflowAnchor = previousBodyOverflowAnchor
    }
  }, [])

  useEffect(() => {
    if (!gameId || gameState?.state === "completed") {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      pollState({ silent: true, preserveViewport: false })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [gameId, gameState?.state, pollState])

  useLayoutEffect(() => {
    const viewport = viewportRestoreRef.current
    if (!viewport) {
      return
    }

    restoreViewportPosition(viewport)
    window.requestAnimationFrame(() => restoreViewportPosition(viewport))
    viewportRestoreRef.current = null
  }, [gameState, loading, submittingAction, actionError])

  const possibleActions = gameState?.possible_actions ?? []
  const signedInAs = user?.username ?? user?.email ?? "player"
  const canMove = gameState?.state === "active" && possibleActions.includes("move") && !submittingAction
  const canAskAny = gameState?.state === "active" && possibleActions.includes("ask_any") && !submittingAction
  const canResign = gameState?.state === "active" && !submittingAction
  const canCloseWaitingGame = gameState?.state === "waiting" && !submittingAction

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
  const groupedRefereeLog = useMemo(() => buildVisibleRefereeLog(gameState), [gameState])
  const captureSquares = useMemo(() => getRecentCaptureSquares(gameState), [gameState])
  const latestAskAnyConstraint = useMemo(
    () => getLatestAskAnyConstraint(groupedRefereeLog, gameState?.your_color),
    [groupedRefereeLog, gameState?.your_color]
  )
  const askAnyConstraint = useMemo(() => {
    const currentTurn = getActivePlayerTurnNumber({
      moveNumber: gameState?.move_number,
      turn: gameState?.turn,
      yourColor: gameState?.your_color,
    })
    if (!Number.isFinite(currentTurn) || latestAskAnyConstraint.turn !== currentTurn) {
      return ""
    }
    return latestAskAnyConstraint.type
  }, [gameState?.move_number, gameState?.turn, gameState?.your_color, latestAskAnyConstraint])
  const effectiveAllowedMoves = useMemo(
    () => filterAllowedMovesByAskAny(gameState?.allowed_moves, { askAnyConstraint, color: gameState?.your_color, fen: gameState?.your_fen }),
    [askAnyConstraint, gameState?.allowed_moves, gameState?.your_color, gameState?.your_fen]
  )
  const moveSuggestionSquares = useMemo(() => {
    const activeSourceSquare = draggingMoveFrom || fromSquare
    if (!activeSourceSquare) {
      return []
    }

    return getAllowedMoveTargets(effectiveAllowedMoves, activeSourceSquare)
  }, [draggingMoveFrom, effectiveAllowedMoves, fromSquare])
  const allowedMoveSourceSquares = useMemo(() => getAllowedMoveSources(effectiveAllowedMoves), [effectiveAllowedMoves])
  const waitingForOpponent = gameState?.state === "active" && !possibleActions.includes("move")
  const activeClockColor = gameState?.clock?.active_color ?? gameState?.turn
  const opponentLabel = useMemo(() => {
    if (!gameMeta || !gameState?.your_color) {
      return "—"
    }

    const opponent = gameState.your_color === "white" ? gameMeta.black : gameMeta.white
    if (!opponent?.username) {
      return gameMeta.opponent_type === "bot" ? "Bot" : "Waiting…"
    }

    return `${opponent.username}${opponent.role === "bot" ? " (bot)" : ""}`
  }, [gameMeta, gameState?.your_color])

  const opponentRating = useMemo(() => {
    if (!gameMeta || !gameState?.your_color) {
      return null
    }

    const opponent = gameState.your_color === "white" ? gameMeta.black : gameMeta.white
    if (!opponent) {
      return null
    }

    return Number.isFinite(opponent.elo) ? opponent.elo : null
  }, [gameMeta, gameState?.your_color])

  const handleLogScroll = useCallback(() => {
    const logNode = logScrollRef.current
    if (!logNode) {
      return
    }

    const distanceFromBottom = logNode.scrollHeight - logNode.clientHeight - logNode.scrollTop
    shouldFollowLogRef.current = distanceFromBottom <= REFEREE_LOG_FOLLOW_THRESHOLD_PX
  }, [])

  useEffect(() => {
    const logNode = logScrollRef.current
    if (!logNode) {
      return
    }

    const nextEntryCount = groupedRefereeLog.reduce((total, turnEntry) => total + turnEntry.white.length + turnEntry.black.length, 0)
    const hadPreviousEntries = lastRefereeEntryCountRef.current > 0
    const hasNewEntries = nextEntryCount > lastRefereeEntryCountRef.current

    if (!hadPreviousEntries || (hasNewEntries && shouldFollowLogRef.current)) {
      logNode.scrollTop = logNode.scrollHeight
      shouldFollowLogRef.current = true
    }

    lastRefereeEntryCountRef.current = nextEntryCount
  }, [groupedRefereeLog])

  useEffect(() => {
    if (!fromSquare) {
      return
    }

    if (allowedMoveSourceSquares.includes(fromSquare)) {
      return
    }

    resetPendingMove()
  }, [allowedMoveSourceSquares, fromSquare])

  function closePhantomMenu() {
    setPhantomMenu(null)
  }

  function resetTapState() {
    lastTapRef.current = { square: "", time: 0 }
  }

  function resetPendingMove() {
    setFromSquare("")
    setToSquare("")
    setShowPromotionModal(false)
    setIllegalMoveSquares([])
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

  function displayedPhantomPiece(piece) {
    return getOpponentPhantomPiece(piece, gameState?.your_color)
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

    if (!targetSquare) {
      removeAt(sourceSquare)
      setDraggingPhantomFrom("")
      draggingPhantomFromRef.current = ""
      setDragHoverSquare("")
      dragPointerIdRef.current = null
      clearDragPreview()
      return
    }

    const moved = move(sourceSquare, targetSquare)
    if (!moved && targetSquare !== sourceSquare) {
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
    blurActiveInteractiveElement()

    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    const legalMoveSource = allowedMoveSourceSquares.includes(square)
    const ownPiece = squareHasOwnPiece(gameState?.your_fen, square, gameState?.your_color) || legalMoveSource
    const eligibleForDoubleTapPhantom = !fromSquare && (!ownPiece || Boolean(placements[square]))
    const now = Date.now()
    const previousTap = lastTapRef.current

    if (eligibleForDoubleTapPhantom && previousTap.square === square && now - previousTap.time <= DOUBLE_TAP_WINDOW_MS) {
      openPhantomMenu(square)
      resetTapState()
      return
    }

    if (eligibleForDoubleTapPhantom) {
      lastTapRef.current = { square, time: now }
    } else {
      resetTapState()
    }

    setActionError("")
    setShowPromotionModal(false)
    setIllegalMoveSquares([])

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
      if (!allowedMoveSourceSquares.includes(square)) {
        return
      }
      setFromSquare(square)
      return
    }

    if (square === fromSquare) {
      resetPendingMove()
      return
    }

    if (allowedMoveSourceSquares.includes(square)) {
      setFromSquare(square)
      setToSquare("")
      setShowPromotionModal(false)
      return
    }

    await commitMove(fromSquare, square)
  }

  function handleSquareRightClick(square) {
    resetTapState()

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
    blurActiveInteractiveElement()

    if (event.button === 0 && placements[square] && !isTouchLikePointer(event)) {
      setActionError("")
      setDraggingPhantomFrom(square)
      draggingPhantomFromRef.current = square
      setDragHoverSquare(square)
      dragPointerIdRef.current = event.pointerId
      updateDragPreview(event, displayedPhantomPiece(placements[square]))
      event.currentTarget.setPointerCapture?.(event.pointerId)
      closePhantomMenu()
      return
    }

    if (event.button === 0 && !isTouchLikePointer(event) && canMove && allowedMoveSourceSquares.includes(square)) {
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
    updateDragPreview(event, displayedPhantomPiece(placements[draggingPhantomFromRef.current]))
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
      finishDragPhantom(hoveredSquare)
      return
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

    if (isTouchLikePointer(event)) {
      resetTapState()
    }
  }

  useEffect(() => {
    function handleGlobalPointerUp(event) {
      if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
        const hoveredSquare = findSquareFromPointerEvent(event)
        finishMoveDrag(hoveredSquare)
        return
      }

      if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
        const hoveredSquare = findSquareFromPointerEvent(event)
        finishDragPhantom(hoveredSquare)
      }
    }

    function handleGlobalPointerCancel(event) {
      if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
        finishMoveDrag(moveDragHoverSquare)
      }

      if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
        finishDragPhantom(dragHoverSquare)
      }
    }

    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerCancel)

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerCancel)
    }
  }, [dragHoverSquare, moveDragHoverSquare])

  async function submitMoveWithUci(uci) {
    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    captureViewport()

    try {
      const result = await submitMove(gameId, uci)
      if (result?.move_done === false) {
        setActionError("Illegal move. Try a different move.")
        setIllegalMoveSquares([uci.slice(0, 2), uci.slice(2, 4)])
        setToSquare("")
        return
      }

      setLastMoveSquares([uci.slice(0, 2), uci.slice(2, 4)])
      setIllegalMoveSquares([])
      resetPendingMove()
      await pollState({ silent: true, preserveViewport: true })
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

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    setIllegalMoveSquares([])
    resetPendingMove()
    captureViewport()

    try {
      await askAny(gameId)
      await pollState({ silent: true, preserveViewport: true })
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

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    setIllegalMoveSquares([])
    captureViewport()

    try {
      await resignGame(gameId)
      await pollState({ silent: true, preserveViewport: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to resign right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleCloseWaitingGame() {
    if (!gameId || !canCloseWaitingGame) {
      return
    }

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    captureViewport()

    try {
      await deleteWaitingGame(gameId)
      navigate("/lobby")
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to close this waiting game right now.")
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
  const pageNotice = loading
    ? "Loading game state…"
    : submittingAction
      ? "Submitting action…"
      : waitingForOpponent
        ? "Waiting for opponent move…"
        : ""

  return (
    <main className="page-shell game-page" onClick={() => phantomMenu && closePhantomMenu()}>
      <div className="game-page__header">
        <div className="game-page__title-block">
          <h1>Game</h1>
        </div>
        <p className="game-page__signed-in">Signed in as {signedInAs}.</p>
      </div>
      <div className="game-page__notices" aria-live="polite">
        <p className={`game-page__notice ${pageNotice ? "" : "game-page__notice--hidden"}`.trim()}>
          {pageNotice || "\u00A0"}
        </p>
      </div>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {gameState ? (
        <>
          <div className="game-layout">
            <div className="game-layout__board-column">
              <section className="game-card game-card--board" aria-label="Board">
                <div className="game-clocks" aria-label="Game clocks">
                  <div className={`game-clock ${activeClockColor === "white" ? "game-clock--active" : ""}`.trim()}>
                    <span className="game-clock__label">White</span>
                    <strong className="game-clock__time">{formatClock(gameState.clock?.white_remaining)}</strong>
                  </div>
                  <div className={`game-clock ${activeClockColor === "black" ? "game-clock--active" : ""}`.trim()}>
                    <span className="game-clock__label">Black</span>
                    <strong className="game-clock__time">{formatClock(gameState.clock?.black_remaining)}</strong>
                  </div>
                </div>

                <div className="game-board-shell" ref={boardShellRef}>
                  <ChessBoard
                    boardFen={gameState.your_fen}
                    orientation={gameState.your_color}
                    highlightedSquares={highlightedSquares}
                    lastMoveSquares={lastMoveSquares}
                    captureSquares={captureSquares}
                    illegalSquares={illegalMoveSquares}
                    suggestedSquares={moveSuggestionSquares}
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
                          const pieceKey = getOpponentPhantomPiece(piece, gameState?.your_color)
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
                  <p className="game-page__meta">Phantoms: left-drag to move, right-click to remove, double-click or right-click empty squares to add.</p>
                </div>
              </section>

              <p className="game-page__meta game-page__meta--below-board">Game ID: <code>{gameId}</code></p>
            </div>

            <section className="game-card game-card--status" aria-label="Game status">
              <div className="game-actions" aria-label="Game actions">
                <button type="button" onClick={handleAskAny} disabled={!canAskAny}>
                  Any pawn captures?
                </button>
              </div>

              <div className="game-action-error-slot" aria-live="assertive">
                {actionError ? <p className="auth-error" role="alert">{actionError}</p> : <p className="game-action-error-slot__placeholder" aria-hidden="true">{"\u00A0"}</p>}
              </div>

              <div className="game-referee-log">
                <div className="game-referee-log__header">
                  <h3>Referee log</h3>
                </div>

                {groupedRefereeLog.length ? (
                  <div className="game-referee-log__scroll" role="log" aria-label="Referee log by turn" ref={logScrollRef} onScroll={handleLogScroll}>
                    {groupedRefereeLog.map((turnEntry) => (
                      <section key={`turn-${turnEntry.turn}`} className="game-referee-turn">
                        <div className="game-referee-turn__title">Turn {turnEntry.turn}</div>
                        <div className="game-referee-turn__grid">
                          <div className="game-referee-column">
                            <div className="game-referee-column__label">White</div>
                            {turnEntry.white.length ? (
                              <ul className="game-referee-column__list">
                                {turnEntry.white.map((entry, index) => (
                                  <li key={`turn-${turnEntry.turn}-white-${index}`}>{entry.text ?? entry}</li>
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
                                  <li key={`turn-${turnEntry.turn}-black-${index}`}>{entry.text ?? entry}</li>
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

              <div className="game-status-section">
                <h2>Status</h2>
                <ul className="game-status-list">
                  <li><strong>State:</strong> {gameState.state}</li>
                  <li><strong>Rules:</strong> {formatRuleVariant(gameMeta?.rule_variant)}</li>
                  <li><strong>Against:</strong> {opponentLabel}</li>
                  <li><strong>Opponent rating:</strong> {opponentRating ?? "—"}</li>
                  <li><strong>Your color:</strong> {gameState.your_color}</li>
                  <li className={canMove ? "game-status-list__turn game-status-list__turn--active" : "game-status-list__turn"}><strong>Turn:</strong> {gameState.turn ?? "—"}</li>
                  <li><strong>Move number:</strong> {gameState.move_number}</li>
                </ul>
              </div>

              {canCloseWaitingGame ? (
                <button type="button" className="game-danger-button" onClick={handleCloseWaitingGame} disabled={!canCloseWaitingGame}>
                  Close
                </button>
              ) : (
                <button type="button" className="game-danger-button" onClick={handleResign} disabled={!canResign}>
                  Resign
                </button>
              )}
            </section>
          </div>

          <PromotionModal
            open={showPromotionModal}
            onSelect={handlePromotionSelect}
            onCancel={handlePromotionCancel}
          />
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
