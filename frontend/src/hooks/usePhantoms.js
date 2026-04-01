import { useEffect, useMemo, useState } from "react"
import { FILES, RANKS, parseFenBoard } from "../components/chessboard"

const STARTING_TRAY = {
  p: 8,
  r: 2,
  n: 2,
  b: 2,
  q: 1,
  k: 1,
}

function keyForGame(gameId) {
  return `phantoms_${gameId}`
}

function isValidSquare(square) {
  return /^[a-h][1-8]$/.test(square)
}

function normalizePiece(piece) {
  if (typeof piece !== "string") {
    return null
  }

  const normalized = piece.toLowerCase()
  return Object.prototype.hasOwnProperty.call(STARTING_TRAY, normalized) ? normalized : null
}

function sanitizePlacements(rawPlacements) {
  if (!rawPlacements || typeof rawPlacements !== "object") {
    return {}
  }

  return Object.entries(rawPlacements).reduce((acc, [square, piece]) => {
    const normalized = normalizePiece(piece)
    if (isValidSquare(square) && normalized) {
      acc[square] = normalized
    }
    return acc
  }, {})
}

function readPersistedPlacements(gameId) {
  if (!gameId || typeof window === "undefined") {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(keyForGame(gameId))
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return sanitizePlacements(parsed?.placements ?? parsed)
  } catch {
    return {}
  }
}

function computeTrayCounts(placements) {
  const counts = { ...STARTING_TRAY }

  for (const piece of Object.values(placements)) {
    if (Object.prototype.hasOwnProperty.call(counts, piece)) {
      counts[piece] -= 1
    }
  }

  return counts
}

function normalizeOccupiedSquares(occupiedSquares) {
  if (!Array.isArray(occupiedSquares)) {
    return new Set()
  }

  return new Set(occupiedSquares.filter((square) => isValidSquare(square)))
}

export function occupiedSquaresFromFen(fen) {
  const board = parseFenBoard(fen)

  return RANKS.flatMap((rank, rankIndex) =>
    FILES.flatMap((file, fileIndex) => (board[rankIndex]?.[fileIndex] ? `${file}${rank}` : [])),
  )
}

export default function usePhantoms({ gameId, occupiedSquares = [] }) {
  const [placements, setPlacements] = useState({})

  useEffect(() => {
    setPlacements(readPersistedPlacements(gameId))
  }, [gameId])

  useEffect(() => {
    if (!gameId || typeof window === "undefined") {
      return
    }

    window.localStorage.setItem(
      keyForGame(gameId),
      JSON.stringify({
        placements,
      }),
    )
  }, [gameId, placements])

  const occupiedSet = useMemo(() => normalizeOccupiedSquares(occupiedSquares), [occupiedSquares])

  useEffect(() => {
    if (!occupiedSet.size) {
      return
    }

    setPlacements((previous) => {
      let changed = false
      const next = { ...previous }

      for (const square of Object.keys(next)) {
        if (occupiedSet.has(square)) {
          delete next[square]
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [occupiedSet])

  const trayCounts = useMemo(() => computeTrayCounts(placements), [placements])

  function setPieceAt(square, piece) {
    const normalizedSquare = isValidSquare(square) ? square : null
    const normalizedPiece = normalizePiece(piece)

    if (!normalizedSquare || !normalizedPiece || occupiedSet.has(normalizedSquare)) {
      return false
    }

    const existingPiece = placements[normalizedSquare]
    if (existingPiece === normalizedPiece) {
      return false
    }

    setPlacements((previous) => ({
      ...previous,
      [normalizedSquare]: normalizedPiece,
    }))

    return true
  }

  function move(fromSquare, toSquare) {
    if (!isValidSquare(fromSquare) || !isValidSquare(toSquare) || fromSquare === toSquare || occupiedSet.has(toSquare)) {
      return false
    }

    if (!placements[fromSquare]) {
      return false
    }

    setPlacements((previous) => {
      const next = { ...previous }
      next[toSquare] = previous[fromSquare]
      delete next[fromSquare]
      return next
    })

    return true
  }

  function removeAt(square) {
    if (!isValidSquare(square) || !placements[square]) {
      return false
    }

    setPlacements((previous) => {
      const next = { ...previous }
      delete next[square]
      return next
    })

    return true
  }

  function clearAll() {
    setPlacements({})
  }

  function availablePiecesForSquare(_square) {
    return Object.keys(STARTING_TRAY)
  }

  return {
    placements,
    phantomSquares: Object.keys(placements),
    trayCounts,
    setPieceAt,
    move,
    removeAt,
    clearAll,
    availablePiecesForSquare,
  }
}
