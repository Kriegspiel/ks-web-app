import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import PromotionModal from "../components/PromotionModal"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"
import { announcementSoundCategories, createGameSoundPlayer } from "../gameSounds"
import { askAny, deleteWaitingGame, getGame, getGameState, resignGame, submitMove } from "../services/api"
import { getAllowedMoveTargets, PIECE_ASSETS } from "../components/chessboard"
import { formatClock, projectClock, reconcileClockSnapshot } from "./gameClock"
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
const GAME_SOUND_MUTE_STORAGE_KEY = "game_page_sounds_muted"
const CLOCK_TICK_INTERVAL_MS = 250
const OPPONENT_STARTING_PHANTOMS = {
  white: {
    a1: "r",
    b1: "n",
    c1: "b",
    d1: "q",
    e1: "k",
    f1: "b",
    g1: "n",
    h1: "r",
    a2: "p",
    b2: "p",
    c2: "p",
    d2: "p",
    e2: "p",
    f2: "p",
    g2: "p",
    h2: "p",
  },
  black: {
    a7: "p",
    b7: "p",
    c7: "p",
    d7: "p",
    e7: "p",
    f7: "p",
    g7: "p",
    h7: "p",
    a8: "r",
    b8: "n",
    c8: "b",
    d8: "q",
    e8: "k",
    f8: "b",
    g8: "n",
    h8: "r",
  },
}
const REFEREE_MAIN_ANNOUNCEMENT_TEXT = {
  1: "Illegal move",
  2: "Move complete",
  3: "Capture",
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
  CAPTURE_DONE: "Capture",
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
const CURRENT_MESSAGE_PART_PRIORITY = {
  has_any: 10,
  no_any: 10,
  illegal_move: 20,
  move_complete: 30,
  capture: 40,
  check: 50,
  other: 60,
}

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

function flattenGroupedRefereeEntries(turns) {
  if (!Array.isArray(turns)) {
    return []
  }

  const entries = []
  turns.forEach((turn) => {
    const turnNumber = Number.isFinite(turn?.turn) ? turn.turn : entries.length + 1
    ;["white", "black"].forEach((color) => {
      const sideEntries = Array.isArray(turn?.[color]) ? turn[color] : []
      sideEntries.forEach((entry, index) => {
        const text = typeof entry?.text === "string" ? entry.text : typeof entry === "string" ? entry : ""
        const messages = Array.isArray(entry?.messages)
          ? entry.messages.filter((message) => typeof message === "string" && message.trim())
          : text
            ? [text]
            : []
        entries.push({
          key: `${turnNumber}-${color}-${index}-${messages.join("|")}`,
          color,
          messages,
        })
      })
    })
  })

  return entries
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
    .map((part) => part.replace(/^Capture done at\s+/i, "Capture at "))
    .map((part) => part.replace(/^Capture done$/i, "Capture"))
    .filter(Boolean)
}

function normalizeCurrentMessagePart(message) {
  if (typeof message !== "string") {
    return null
  }

  const trimmed = message.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.toLowerCase()
  if (/^(white|black)('s)? move$/.test(normalized) || normalized === "white to move" || normalized === "black to move") {
    return null
  }

  if (normalized.startsWith("illegal move")) {
    return { key: "illegal_move", text: "illegal move", priority: CURRENT_MESSAGE_PART_PRIORITY.illegal_move }
  }

  if (normalized === "move complete") {
    return { key: "move_complete", text: "move complete", priority: CURRENT_MESSAGE_PART_PRIORITY.move_complete }
  }

  if (normalized === "has pawn captures") {
    return { key: "has_any", text: "has pawn captures", priority: CURRENT_MESSAGE_PART_PRIORITY.has_any }
  }

  if (normalized === "no pawn captures") {
    return { key: "no_any", text: "no pawn captures", priority: CURRENT_MESSAGE_PART_PRIORITY.no_any }
  }

  const captureMatch = normalized.match(/^capture(?: done)?(?: at)? ([a-h][1-8])$/i)
  if (captureMatch) {
    return {
      key: `capture-${captureMatch[1].toLowerCase()}`,
      text: `capture ${captureMatch[1].toLowerCase()}`,
      priority: CURRENT_MESSAGE_PART_PRIORITY.capture,
    }
  }

  if (normalized === "capture" || normalized === "capture done") {
    return { key: "capture", text: "capture", priority: CURRENT_MESSAGE_PART_PRIORITY.capture }
  }

  const checkMap = [
    [/^(check on rank|rank check)$/i, "rank check", "check-rank"],
    [/^(check on file|file check)$/i, "file check", "check-file"],
    [/^(check on long diagonal|check long diagonal|long-diagonal check)$/i, "long-diagonal check", "check-long-diagonal"],
    [/^(check on short diagonal|check short diagonal|short-diagonal check)$/i, "short-diagonal check", "check-short-diagonal"],
    [/^(check by knight|knight check)$/i, "knight check", "check-knight"],
    [/^double check$/i, "double check", "check-double"],
  ]
  for (const [pattern, text, key] of checkMap) {
    if (pattern.test(trimmed)) {
      return { key, text, priority: CURRENT_MESSAGE_PART_PRIORITY.check }
    }
  }

  return {
    key: normalized,
    text: normalized,
    priority: CURRENT_MESSAGE_PART_PRIORITY.other,
  }
}

function summarizeCurrentMessageParts(messages = []) {
  const uniqueParts = new Map()
  ;(Array.isArray(messages) ? messages : []).forEach((message) => {
    const part = normalizeCurrentMessagePart(message)
    if (!part || uniqueParts.has(part.key)) {
      return
    }
    uniqueParts.set(part.key, part)
  })

  return [...uniqueParts.values()]
    .sort((left, right) => left.priority - right.priority || left.text.localeCompare(right.text))
    .map((part) => part.text)
}

function summarizeCurrentMessageSideEntries(entries = []) {
  const messages = (Array.isArray(entries) ? entries : []).flatMap((entry) => {
    if (Array.isArray(entry?.messages)) {
      return entry.messages
    }
    if (typeof entry?.text === "string" && entry.text.trim()) {
      return [entry.text]
    }
    if (typeof entry === "string" && entry.trim()) {
      return [entry]
    }
    return []
  })

  return summarizeCurrentMessageParts(messages)
}

function buildCurrentMessageHistorySegments(turns) {
  if (!Array.isArray(turns)) {
    return []
  }

  const segments = []
  turns.forEach((turn) => {
    const turnNumber = Number.isFinite(turn?.turn) ? turn.turn : segments.length + 1
    ;["white", "black"].forEach((color) => {
      const parts = summarizeCurrentMessageSideEntries(turn?.[color])
      if (!parts.length) {
        return
      }

      segments.push({
        key: `${turnNumber}-${color}-${parts.join("|")}`,
        color,
        parts,
        text: parts.join(", "),
      })
    })
  })

  return segments
}

function formatCurrentMessageActor(color) {
  return color === "black" ? "Black" : "White"
}

function currentTurnStatusText({ turnColor, yourColor, canMove, waitingForOpponent }) {
  const normalizedTurn = normalizeLogColor(turnColor)
  const normalizedPlayer = normalizeLogColor(yourColor)
  if (!normalizedTurn) {
    return ""
  }

  if (canMove && normalizedPlayer && normalizedTurn === normalizedPlayer) {
    return "your move"
  }

  if (waitingForOpponent && normalizedPlayer && normalizedTurn !== normalizedPlayer) {
    return "opponent's move"
  }

  return ""
}

function buildCurrentMessageSegments({ turns, turnColor, yourColor, canMove, waitingForOpponent, actionError }) {
  const historySegments = buildCurrentMessageHistorySegments(turns)
  const currentColor = normalizeLogColor(turnColor)
  const illegalMoveActive = typeof actionError === "string" && actionError.toLowerCase().startsWith("illegal move")
  const liveText = illegalMoveActive
    ? "illegal move"
    : currentTurnStatusText({ turnColor: currentColor, yourColor, canMove, waitingForOpponent })

  if (!liveText || !currentColor) {
    return historySegments.slice(-3)
  }

  const nextSegments = [...historySegments]
  const lastSegment = nextSegments.at(-1) ?? null

  if (lastSegment && lastSegment.color === currentColor) {
    if (!illegalMoveActive) {
      return nextSegments.slice(-3)
    }

    const parts = summarizeCurrentMessageParts([...lastSegment.parts, liveText])
    nextSegments[nextSegments.length - 1] = {
      ...lastSegment,
      parts,
      text: parts.join(", "),
    }
    return nextSegments.slice(-3)
  }

  nextSegments.push({
    key: `live-${currentColor}-${liveText}`,
    color: currentColor,
    parts: [liveText],
    text: liveText,
  })
  return nextSegments.slice(-3)
}

function formatCurrentMessageAccessibleText(segments) {
  if (!Array.isArray(segments) || !segments.length) {
    return ""
  }

  return segments
    .map((segment) => `${formatCurrentMessageActor(segment.color)}: ${segment.text}`)
    .join(" \u2192 ")
}

function getCaptureSquareFromTexts(messages = []) {
  if (!Array.isArray(messages)) {
    return ""
  }

  return messages.map((message) => {
    if (typeof message !== "string") {
      return ""
    }
    const match = message.match(/capture(?: done)? at ([a-h][1-8])/i)
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
  return rawEntryMessages(entry).some(
    (message) => typeof message === "string" && /^(Capture|Capture done)( at\b|$)/.test(message),
  )
}

function isMoveResolutionEntry(entry) {
  return rawEntryMessages(entry).some(
    (message) => typeof message === "string" && (
      /^(Capture|Capture done)( at\b|$)/.test(message) ||
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

function formatRuleVariant(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "—"
  }

  const normalized = value.trim().replace(/[_-]+/g, " ")
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeRatings(source) {
  const ratings = source?.ratings ?? {}
  const overall = ratings?.overall?.elo ?? source?.elo ?? null
  const vsHumans = ratings?.vs_humans?.elo ?? null
  const vsBots = ratings?.vs_bots?.elo ?? null
  return {
    overall: overall == null ? null : Number(overall),
    vsHumans: vsHumans == null ? null : Number(vsHumans),
    vsBots: vsBots == null ? null : Number(vsBots),
  }
}

function ratingValue(value) {
  return Number.isFinite(value) ? String(value) : "—"
}

function formatUtcDateTime(value) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const seconds = String(date.getUTCSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
}

function formatDuration(startValue, endValue) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "—"
  }

  let remaining = Math.floor((end.getTime() - start.getTime()) / 1000)
  const days = Math.floor(remaining / 86400)
  remaining -= days * 86400
  const hours = Math.floor(remaining / 3600)
  remaining -= hours * 3600
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining - minutes * 60

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  if (minutes || hours || days) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

function formatResultReason(value) {
  if (typeof value !== "string" || !value.trim()) {
    return ""
  }

  const normalized = value.trim().toLowerCase()
  const known = {
    checkmate: "checkmate",
    resignation: "resignation",
    timeout: "timeout",
    time: "timeout",
    stalemate: "stalemate",
    insufficient: "insufficient material",
    too_many_reversible_moves: "too many reversible moves",
  }
  if (known[normalized]) {
    return known[normalized]
  }

  return normalized.replace(/[_-]+/g, " ")
}

function formatCompletedResult(result) {
  if (!result || typeof result !== "object") {
    return "Result unavailable"
  }

  const winner = result.winner
    ? `${String(result.winner).charAt(0).toUpperCase()}${String(result.winner).slice(1)} wins`
    : "Draw"
  const reason = formatResultReason(result.reason)
  return reason ? `${winner} by ${reason}` : winner
}

function formatViewerOutcome(result, yourColor) {
  if (!result || typeof result !== "object") {
    return "Game finished"
  }

  const reason = formatResultReason(result.reason)
  if (!result.winner) {
    return reason ? `Draw by ${reason}` : "Draw"
  }

  if (yourColor && result.winner === yourColor) {
    return reason ? `You won by ${reason}` : "You won"
  }

  return reason ? `You lost by ${reason}` : "You lost"
}

function playerLabel(player) {
  if (!player?.username) {
    return "—"
  }

  return player.role === "bot" ? `${player.username} (bot)` : player.username
}

function historicalRatingsForColor(game, color) {
  const player = color === "black" ? game?.black : game?.white
  const current = normalizeRatings(player)
  const snapshot = game?.rating_snapshot
  if (!snapshot || typeof snapshot !== "object") {
    return {
      overall: null,
      vsHumans: null,
      vsBots: null,
    }
  }

  const overall = snapshot?.overall?.[`${color}_before`]
  const specific = snapshot?.specific?.[`${color}_before`]
  const track = snapshot?.[`${color}_track`]
  return {
    overall: overall == null ? null : Number(overall),
    vsHumans: track === "vs_humans" ? Number(specific) : current.vsHumans,
    vsBots: track === "vs_bots" ? Number(specific) : current.vsBots,
  }
}

function formatRatingTransition(before, after) {
  if (!Number.isFinite(after)) {
    return "—"
  }

  if (!Number.isFinite(before)) {
    return String(after)
  }

  const delta = after - before
  const deltaLabel = delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta}`
  return `${before} → ${after} (${deltaLabel})`
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

function countRemainingPieces(turns) {
  const counts = {
    white: 16,
    black: 16,
  }

  if (!Array.isArray(turns)) {
    return counts
  }

  turns.forEach((turn) => {
    const whiteEntries = Array.isArray(turn?.white) ? turn.white : []
    const blackEntries = Array.isArray(turn?.black) ? turn.black : []

    whiteEntries.forEach((entry) => {
      if (isCaptureAnnouncementEntry(entry)) {
        counts.black = Math.max(0, counts.black - 1)
      }
    })

    blackEntries.forEach((entry) => {
      if (isCaptureAnnouncementEntry(entry)) {
        counts.white = Math.max(0, counts.white - 1)
      }
    })
  })

  return counts
}

function opponentStartingPhantoms(playerColor) {
  const normalized = normalizeLogColor(playerColor)
  if (!normalized) {
    return {}
  }

  return OPPONENT_STARTING_PHANTOMS[normalized === "white" ? "black" : "white"] ?? {}
}

function isOpeningPromptText(text) {
  return /^(white|black) to move$/i.test(String(text || "").trim())
}

function hasPlayerTakenFirstTurn(turns, playerColor) {
  const normalizedColor = normalizeLogColor(playerColor)
  if (!Array.isArray(turns) || !normalizedColor) {
    return false
  }

  const sideKey = normalizedColor === "black" ? "black" : "white"
  return turns.some((turnEntry) =>
    (Array.isArray(turnEntry?.[sideKey]) ? turnEntry[sideKey] : []).some((entry) => !isOpeningPromptText(entry?.text ?? entry)),
  )
}

export default function GamePage() {
  const navigate = useNavigate()
  const { gameCode, gameId } = useParams()
  const gameRef = gameCode ?? gameId ?? ""
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
  const [clockSnapshotAtMs, setClockSnapshotAtMs] = useState(() => Date.now())
  const [clockNowMs, setClockNowMs] = useState(() => Date.now())
  const [desktopRefereeHeight, setDesktopRefereeHeight] = useState(null)
  const [soundsMuted, setSoundsMuted] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.localStorage.getItem(GAME_SOUND_MUTE_STORAGE_KEY) === "1"
  })

  const lastTapRef = useRef({ square: "", time: 0 })
  const boardCardRef = useRef(null)
  const boardShellRef = useRef(null)
  const dragPointerIdRef = useRef(null)
  const draggingPhantomFromRef = useRef("")
  const moveDragPointerIdRef = useRef(null)
  const draggingMoveFromRef = useRef("")
  const suppressClickRef = useRef(false)
  const suppressContextMenuRef = useRef(false)
  const logScrollRef = useRef(null)
  const viewportRestoreRef = useRef(null)
  const stateRequestIdRef = useRef(0)
  const metadataRequestIdRef = useRef(0)
  const clockSnapshotAtMsRef = useRef(Date.now())
  const soundPlayerRef = useRef(null)
  const lastSoundEntryKeysRef = useRef([])
  const finishDragPhantomRef = useRef(null)
  const finishMoveDragRef = useRef(null)

  if (!soundPlayerRef.current) {
    soundPlayerRef.current = createGameSoundPlayer()
  }

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
    replaceAll,
    availablePiecesForSquare,
  } = usePhantoms({ gameId: gameRef, occupiedSquares })

  const pollState = useCallback(async ({ silent = false, preserveViewport = false } = {}) => {
    if (!gameRef) {
      return
    }

    const requestedAtMs = Date.now()
    const requestId = stateRequestIdRef.current + 1
    stateRequestIdRef.current = requestId

    if (preserveViewport) {
      captureViewport()
    }

    if (!silent) {
      setLoading(true)
    }

    try {
      const state = await getGameState(gameRef)
      if (requestId !== stateRequestIdRef.current) {
        return
      }
      const receivedAtMs = Date.now()
      const syncedAtMs = requestedAtMs + ((receivedAtMs - requestedAtMs) / 2)
      setGameState((previousState) => ({
        ...state,
        clock: reconcileClockSnapshot(previousState, state, {
          previousSyncedAtMs: clockSnapshotAtMsRef.current,
          nextSyncedAtMs: syncedAtMs,
        }),
      }))
      clockSnapshotAtMsRef.current = syncedAtMs
      setClockSnapshotAtMs(syncedAtMs)
      setClockNowMs(receivedAtMs)
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
  }, [captureViewport, gameRef])

  const pollMetadata = useCallback(async () => {
    if (!gameRef) {
      return
    }

    const requestId = metadataRequestIdRef.current + 1
    metadataRequestIdRef.current = requestId

    try {
      const metadata = await getGame(gameRef)
      if (requestId !== metadataRequestIdRef.current) {
        return
      }
      setGameMeta(metadata)
    } catch {
      // Keep the board usable even if metadata fails.
    }
  }, [gameRef])

  useEffect(() => {
    pollState({ silent: false })
    pollMetadata()
  }, [pollMetadata, pollState])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(GAME_SOUND_MUTE_STORAGE_KEY, soundsMuted ? "1" : "0")
  }, [soundsMuted])

  useEffect(() => {
    const primeAudio = () => {
      soundPlayerRef.current?.prime()
    }

    window.addEventListener("pointerdown", primeAudio, { passive: true })
    window.addEventListener("keydown", primeAudio)
    return () => {
      window.removeEventListener("pointerdown", primeAudio)
      window.removeEventListener("keydown", primeAudio)
    }
  }, [])

  useEffect(() => {
    if (!gameRef) {
      return
    }

    if (gameState?.state === "completed" && gameMeta?.state !== "completed") {
      pollMetadata()
    }
  }, [gameMeta?.state, gameRef, gameState?.state, pollMetadata])

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
    if (!gameRef || gameState?.state === "completed") {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      pollState({ silent: true, preserveViewport: false })
    }, POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [gameRef, gameState?.state, pollState])

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    if (gameState?.state !== "active" || !gameState?.clock?.active_color) {
      return undefined
    }

    const tick = () => {
      setClockNowMs(Date.now())
    }

    tick()
    const intervalId = window.setInterval(tick, CLOCK_TICK_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [clockSnapshotAtMs, gameState?.clock?.active_color, gameState?.state])

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
  const isCompleted = gameState?.state === "completed" || gameMeta?.state === "completed"
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

  const highlightedSquares = [fromSquare, toSquare, movingPhantomFrom, dragHoverSquare, draggingMoveFrom, moveDragHoverSquare].filter(Boolean)
  const groupedRefereeLog = useMemo(() => buildVisibleRefereeLog(gameState), [gameState])
  const canSeedOpponentPhantoms =
    gameState?.state === "active" &&
    !hasPlayerTakenFirstTurn(groupedRefereeLog, gameState?.your_color)
  const flattenedRefereeEntries = useMemo(() => flattenGroupedRefereeEntries(groupedRefereeLog), [groupedRefereeLog])
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
  const soundSettingEnabled = user?.settings?.sound_enabled !== false
  const soundsEnabled = soundSettingEnabled && !soundsMuted
  const remainingPieceStatus = useMemo(() => countRemainingPieces(groupedRefereeLog), [groupedRefereeLog])
  const displayClock = useMemo(
    () => projectClock(gameState?.clock, { gameState: gameState?.state, syncedAtMs: clockSnapshotAtMs, nowMs: clockNowMs }),
    [clockNowMs, clockSnapshotAtMs, gameState?.clock, gameState?.state]
  )
  const activeClockColor = displayClock?.active_color ?? gameState?.turn
  const opponent = useMemo(() => {
    if (!gameMeta || !gameState?.your_color) {
      return null
    }

    return gameState.your_color === "white" ? gameMeta.black : gameMeta.white
  }, [gameMeta, gameState?.your_color])

  const opponentLabel = useMemo(() => {
    if (!opponent) {
      return gameMeta?.opponent_type === "bot" ? "Bot" : "Waiting…"
    }

    if (!opponent?.username) {
      return gameMeta?.opponent_type === "bot" ? "Bot" : "Waiting…"
    }

    return `${opponent.username}${opponent.role === "bot" ? " (bot)" : ""}`
  }, [gameMeta?.opponent_type, opponent])
  const opponentProfilePath = opponent?.username ? `/user/${opponent.username}` : ""

  const opponentRatings = useMemo(() => normalizeRatings(opponent), [opponent])
  const opponentRating = opponentRatings.overall
  const completedResult = gameMeta?.result ?? gameState?.result
  const whiteCurrentRatings = useMemo(() => normalizeRatings(gameMeta?.white), [gameMeta?.white])
  const blackCurrentRatings = useMemo(() => normalizeRatings(gameMeta?.black), [gameMeta?.black])
  const whiteHistoricalRatings = useMemo(() => historicalRatingsForColor(gameMeta, "white"), [gameMeta])
  const blackHistoricalRatings = useMemo(() => historicalRatingsForColor(gameMeta, "black"), [gameMeta])
  const completedFinishedAt = formatUtcDateTime(gameMeta?.updated_at)
  const completedDuration = formatDuration(gameMeta?.created_at, gameMeta?.updated_at)
  const completedHeading = formatViewerOutcome(completedResult, gameState?.your_color)
  const completedSummary = formatCompletedResult(completedResult)
  const currentMessageSegments = useMemo(
    () => buildCurrentMessageSegments({
      turns: groupedRefereeLog,
      turnColor: gameState?.turn,
      yourColor: gameState?.your_color,
      canMove,
      waitingForOpponent,
      actionError,
    }),
    [actionError, canMove, gameState?.turn, gameState?.your_color, groupedRefereeLog, waitingForOpponent]
  )
  const currentMessageAccessibleText = useMemo(
    () => formatCurrentMessageAccessibleText(currentMessageSegments),
    [currentMessageSegments]
  )
  const refereePanelStyle = desktopRefereeHeight ? { height: `${desktopRefereeHeight}px`, maxHeight: `${desktopRefereeHeight}px` } : undefined

  useEffect(() => {
    const logNode = logScrollRef.current
    if (!logNode) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      logNode.scrollTop = logNode.scrollHeight
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [groupedRefereeLog])

  useEffect(() => {
    const previousKeys = lastSoundEntryKeysRef.current
    const nextKeys = flattenedRefereeEntries.map((entry) => entry.key)
    const hasPreviousEntries = previousKeys.length > 0
    const isAppendOnly =
      previousKeys.length <= nextKeys.length &&
      previousKeys.every((key, index) => key === nextKeys[index])

    if (soundsEnabled && hasPreviousEntries && isAppendOnly && nextKeys.length > previousKeys.length) {
      const appendedEntries = flattenedRefereeEntries.slice(previousKeys.length)
      const categories = appendedEntries.flatMap((entry) => announcementSoundCategories(entry.messages))
      soundPlayerRef.current?.playCategories(categories)
    }

    lastSoundEntryKeysRef.current = nextKeys
  }, [flattenedRefereeEntries, soundsEnabled])

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const boardNode = boardCardRef.current
    if (!boardNode) {
      return undefined
    }

    const syncHeight = () => {
      if (window.innerWidth <= 760) {
        setDesktopRefereeHeight(null)
        return
      }

      const nextHeight = Math.round(boardNode.getBoundingClientRect().height)
      setDesktopRefereeHeight(nextHeight > 0 ? nextHeight : null)
    }

    syncHeight()
    const frameId = window.requestAnimationFrame(syncHeight)
    window.addEventListener("resize", syncHeight)

    let resizeObserver = null
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(syncHeight)
      resizeObserver.observe(boardNode)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("resize", syncHeight)
      resizeObserver?.disconnect()
    }
  }, [canSeedOpponentPhantoms, gameState?.state])

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
    if (!from || !to || !gameRef || !canMove) {
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

  finishDragPhantomRef.current = finishDragPhantom
  finishMoveDragRef.current = finishMoveDrag

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

    if (movingPhantomFrom) {
      return
    }

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
        finishMoveDragRef.current?.(hoveredSquare)
        return
      }

      if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
        const hoveredSquare = findSquareFromPointerEvent(event)
        finishDragPhantomRef.current?.(hoveredSquare)
      }
    }

    function handleGlobalPointerCancel(event) {
      if (draggingMoveFromRef.current && moveDragPointerIdRef.current === event.pointerId) {
        finishMoveDragRef.current?.(moveDragHoverSquare)
      }

      if (draggingPhantomFromRef.current && dragPointerIdRef.current === event.pointerId) {
        finishDragPhantomRef.current?.(dragHoverSquare)
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
      const result = await submitMove(gameRef, uci)
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
    if (!gameRef || !canAskAny) {
      return
    }

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    setIllegalMoveSquares([])
    resetPendingMove()
    captureViewport()

    try {
      await askAny(gameRef)
      await pollState({ silent: true, preserveViewport: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to ask the referee right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleResign() {
    if (!gameRef || !canResign) {
      return
    }

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    setIllegalMoveSquares([])
    captureViewport()

    try {
      await resignGame(gameRef)
      await pollState({ silent: true, preserveViewport: true })
    } catch (requestError) {
      setActionError(requestError?.message ?? "Unable to resign right now.")
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleCloseWaitingGame() {
    if (!gameRef || !canCloseWaitingGame) {
      return
    }

    blurActiveInteractiveElement()
    setSubmittingAction(true)
    setActionError("")
    captureViewport()

    try {
      await deleteWaitingGame(gameRef)
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

  function handleSeedOpponentPhantoms() {
    replaceAll(opponentStartingPhantoms(gameState?.your_color))
    setActionError("")
  }

  const phantomMenuSquare = phantomMenu?.square ?? ""
  const phantomOnMenuSquare = phantomMenuSquare ? placements[phantomMenuSquare] : ""
  const nonNarrativeActionError = actionError && !actionError.toLowerCase().startsWith("illegal move") ? actionError : ""
  const transientGameMessage = loading
    ? "Loading game state…"
    : submittingAction
      ? "Submitting action…"
      : nonNarrativeActionError
        ? nonNarrativeActionError
        : isCompleted
          ? completedSummary
          : ""
  const currentMessageText = transientGameMessage || currentMessageAccessibleText || "No referee responses yet."

  return (
    <main className="page-shell game-page" onClick={() => phantomMenu && closePhantomMenu()}>
      <div className="game-page__header">
        <div className="game-page__title-block">
          <h1>Game</h1>
        </div>
        <p className="game-page__signed-in">Signed in as {signedInAs}.</p>
      </div>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {gameState ? (
        <>
          {isCompleted ? (
            <section
              className={`game-card game-complete-summary ${completedResult?.winner === gameState?.your_color ? "game-complete-summary--won" : completedResult?.winner ? "game-complete-summary--lost" : "game-complete-summary--draw"}`.trim()}
              aria-label="Completed game summary"
            >
              <div className="game-complete-summary__topline">Game finished</div>
              <div className="game-complete-summary__hero">
                <div className="game-complete-summary__copy">
                  <h2>{completedHeading}</h2>
                  <p>{completedSummary}</p>
                </div>
                <button
                  type="button"
                  className="button-link button-link--primary game-complete-summary__review-button"
                  onClick={() => navigate(`/game/${gameMeta?.game_code ?? gameRef}/review`)}
                >
                  Watch review
                </button>
              </div>

              <div className="game-complete-summary__meta">
                <div><span>Finished</span><strong>{completedFinishedAt}</strong></div>
                <div><span>Duration</span><strong>{completedDuration}</strong></div>
                <div><span>Rules</span><strong>{formatRuleVariant(gameMeta?.rule_variant)}</strong></div>
                <div><span>Game code</span><strong>{gameMeta?.game_code ?? gameRef}</strong></div>
              </div>

              <div className="game-complete-summary__ratings">
                {[
                  ["white", gameMeta?.white, whiteHistoricalRatings, whiteCurrentRatings],
                  ["black", gameMeta?.black, blackHistoricalRatings, blackCurrentRatings],
                ].map(([color, player, historicalRatings, currentRatings]) => (
                  <article key={color} className="game-complete-summary__player-card">
                    <h3>
                      {color === "white" ? "White" : "Black"}:{" "}
                      {player?.username ? (
                        <a className="game-complete-summary__player-link" href={`/user/${player.username}`}>
                          {playerLabel(player)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </h3>
                    <ul className="game-complete-summary__rating-list">
                      <li><span>Overall</span><strong>{formatRatingTransition(historicalRatings?.overall, currentRatings?.overall)}</strong></li>
                      <li><span>vs Humans</span><strong>{formatRatingTransition(historicalRatings?.vsHumans, currentRatings?.vsHumans)}</strong></li>
                      <li><span>vs Bots</span><strong>{formatRatingTransition(historicalRatings?.vsBots, currentRatings?.vsBots)}</strong></li>
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="game-layout">
            <section className="game-card game-card--board" aria-label="Board" ref={boardCardRef}>
              <div className="game-clocks" aria-label="Game clocks">
                <div className={`game-clock ${activeClockColor === "white" ? "game-clock--active" : ""}`.trim()}>
                  <span className="game-clock__label">White</span>
                  <strong className="game-clock__time">{formatClock(displayClock?.white_remaining)}</strong>
                </div>
                <div className={`game-clock ${activeClockColor === "black" ? "game-clock--active" : ""}`.trim()}>
                  <span className="game-clock__label">Black</span>
                  <strong className="game-clock__time">{formatClock(displayClock?.black_remaining)}</strong>
                </div>
              </div>

              <div
                className={`game-board-shell ${canMove ? "game-board-shell--your-turn" : ""}`.trim()}
                ref={boardShellRef}
              >
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
                <section className="game-piece-status" aria-label="Remaining piece status">
                  <p className="game-piece-status__line">
                    <span className="game-piece-status__label">White pieces remain:</span> {remainingPieceStatus.white}
                  </p>
                  <p className="game-piece-status__line">
                    <span className="game-piece-status__label">Black pieces remain:</span> {remainingPieceStatus.black}
                  </p>
                </section>
                {canSeedOpponentPhantoms ? (
                  <button
                    type="button"
                    className="game-opening-callout"
                    aria-label="Opening setup. Seed the opponent's starting pieces as phantoms in one click."
                    onClick={handleSeedOpponentPhantoms}
                  >
                    <span className="game-opening-callout__eyebrow">Opening setup</span>
                    <span className="game-opening-callout__body">Seed the opponent&apos;s starting pieces as phantoms in one click.</span>
                  </button>
                ) : null}
                <p className="game-page__meta">Phantoms: left-drag to move, right-click to remove, double-click or right-click empty squares to add.</p>
              </div>
            </section>

            <section className="game-card game-card--referee" aria-label="Referee panel" style={refereePanelStyle}>
              {gameState.state === "active" ? (
                <div className="game-actions" aria-label="Game actions">
                  <button type="button" onClick={handleAskAny} disabled={!canAskAny}>
                    Any pawn captures?
                  </button>
                </div>
              ) : null}
              <section className="game-referee-latest" aria-label="Current message" aria-live={actionError ? "assertive" : "polite"}>
                <div className="game-referee-latest__label">Current message</div>
                {transientGameMessage ? (
                  <p className="game-referee-latest__value" role={actionError ? "alert" : undefined}>{currentMessageText}</p>
                ) : currentMessageSegments.length ? (
                  <p
                    className="game-referee-latest__value game-referee-latest__value--timeline"
                    role={actionError ? "alert" : undefined}
                    aria-label={currentMessageText}
                  >
                    {currentMessageSegments.map((segment, index) => (
                      <span key={segment.key} className="game-referee-latest__timeline-piece">
                        {index > 0 ? (
                          <span className="game-referee-latest__separator" aria-hidden="true">
                            {" "}
                            →{" "}
                            </span>
                        ) : null}
                        <span className="game-referee-latest__segment">
                          <span className={`game-referee-latest__actor game-referee-latest__actor--${segment.color}`.trim()}>
                            {formatCurrentMessageActor(segment.color)}
                          </span>
                          <span className="game-referee-latest__segment-text">{segment.text}</span>
                        </span>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="game-referee-latest__value" role={actionError ? "alert" : undefined}>{currentMessageText}</p>
                )}
              </section>

              <div className="game-referee-log">
                <div className="game-referee-log__header">
                  <h3>Referee log</h3>
                </div>

                {groupedRefereeLog.length ? (
                  <div className="game-referee-log__scroll" role="log" aria-label="Referee log by turn" ref={logScrollRef}>
                    {groupedRefereeLog.map((turnEntry) => (
                      <section key={`turn-${turnEntry.turn}`} className="game-referee-turn">
                        <div className="game-referee-turn__title">Turn {turnEntry.turn}</div>
                        <div className="game-referee-turn__grid">
                          <div className="game-referee-column">
                            <div className="game-referee-column__label">White</div>
                            {turnEntry.white.length ? (
                              <ul className="game-referee-column__list">
                                {turnEntry.white.map((entry, index) => (
                                  <li key={`turn-${turnEntry.turn}-white-${index}`} className="game-referee-entry">
                                    <span className="game-referee-entry__badge">{index + 1}</span>
                                    <span className="game-referee-entry__text">{entry.text ?? entry}</span>
                                  </li>
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
                                  <li key={`turn-${turnEntry.turn}-black-${index}`} className="game-referee-entry">
                                    <span className="game-referee-entry__badge">{index + 1}</span>
                                    <span className="game-referee-entry__text">{entry.text ?? entry}</span>
                                  </li>
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
            </section>

            <section className="game-status-grid" aria-label="Game details">
              <article className="game-card game-status-card">
                <h2 className="game-status-card__title">Game</h2>
                <ul className="game-status-card__list">
                  <li><strong>Game code:</strong> <code>{gameMeta?.game_code ?? gameRef}</code></li>
                  <li><strong>State:</strong> {gameState.state}</li>
                  <li><strong>Rules:</strong> {formatRuleVariant(gameMeta?.rule_variant)}</li>
                </ul>
              </article>

              <article className="game-card game-status-card">
                <h2 className="game-status-card__title">Opponent</h2>
                <ul className="game-status-card__list">
                  <li>
                    <strong>Against:</strong>{" "}
                    {opponentProfilePath ? (
                      <a className="game-status-card__link" href={opponentProfilePath}>
                        {opponentLabel}
                      </a>
                    ) : (
                      opponentLabel
                    )}
                  </li>
                  <li><strong>Opponent rating:</strong> {ratingValue(opponentRating)}</li>
                  <li><strong>vs Humans:</strong> {ratingValue(opponentRatings.vsHumans)}</li>
                  <li><strong>vs Bots:</strong> {ratingValue(opponentRatings.vsBots)}</li>
                </ul>
              </article>

              <article className="game-card game-status-card">
                <h2 className="game-status-card__title">Status</h2>
                <ul className="game-status-card__list">
                  <li><strong>Your color:</strong> {gameState.your_color}</li>
                  <li className={canMove ? "game-status-card__turn game-status-card__turn--active" : "game-status-card__turn"}><strong>Turn:</strong> {gameState.turn ?? "—"}</li>
                  <li><strong>Move number:</strong> {gameState.move_number}</li>
                </ul>
              </article>

              <article className="game-card game-status-card">
                <h2 className="game-status-card__title">Actions</h2>
                <div className="game-status-card__actions">
                  <button
                    type="button"
                    className="game-sound-toggle"
                    onClick={() => setSoundsMuted((value) => !value)}
                    aria-pressed={soundsMuted}
                  >
                    {soundsMuted ? "Sounds off" : "Mute sounds"}
                  </button>

                  {isCompleted ? (
                    <button type="button" className="button-link button-link--primary" onClick={() => navigate(`/game/${gameMeta?.game_code ?? gameRef}/review`)}>
                      Watch review
                    </button>
                  ) : canCloseWaitingGame ? (
                    <button type="button" className="game-danger-button" onClick={handleCloseWaitingGame} disabled={!canCloseWaitingGame}>
                      Close
                    </button>
                  ) : (
                    <button type="button" className="game-danger-button" onClick={handleResign} disabled={!canResign}>
                      Resign
                    </button>
                  )}
                </div>
              </article>
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
