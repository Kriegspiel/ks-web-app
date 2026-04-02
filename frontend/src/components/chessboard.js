import wK from "../assets/chess/cburnett/wK.svg"
import wQ from "../assets/chess/cburnett/wQ.svg"
import wR from "../assets/chess/cburnett/wR.svg"
import wB from "../assets/chess/cburnett/wB.svg"
import wN from "../assets/chess/cburnett/wN.svg"
import wP from "../assets/chess/cburnett/wP.svg"
import bK from "../assets/chess/cburnett/bK.svg"
import bQ from "../assets/chess/cburnett/bQ.svg"
import bR from "../assets/chess/cburnett/bR.svg"
import bB from "../assets/chess/cburnett/bB.svg"
import bN from "../assets/chess/cburnett/bN.svg"
import bP from "../assets/chess/cburnett/bP.svg"

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]

export const PIECE_LABELS = {
  K: "White king",
  Q: "White queen",
  R: "White rook",
  B: "White bishop",
  N: "White knight",
  P: "White pawn",
  k: "Black king",
  q: "Black queen",
  r: "Black rook",
  b: "Black bishop",
  n: "Black knight",
  p: "Black pawn",
}

export const PIECE_ASSETS = {
  K: wK,
  Q: wQ,
  R: wR,
  B: wB,
  N: wN,
  P: wP,
  k: bK,
  q: bQ,
  r: bR,
  b: bB,
  n: bN,
  p: bP,
}

function pieceColor(piece) {
  if (!piece) {
    return ""
  }

  return piece === piece.toUpperCase() ? "white" : "black"
}

function squareToCoords(square) {
  if (typeof square !== "string" || !/^[a-h][1-8]$/.test(square)) {
    return null
  }

  return {
    fileIndex: FILES.indexOf(square[0]),
    rankIndex: RANKS.indexOf(Number.parseInt(square[1], 10)),
  }
}

function coordsToSquare(fileIndex, rankIndex) {
  const file = FILES[fileIndex]
  const rank = RANKS[rankIndex]
  if (!file || !rank) {
    return ""
  }

  return `${file}${rank}`
}

function isInsideBoard(fileIndex, rankIndex) {
  return fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8
}

function collectRayMoves(board, fromPiece, fileIndex, rankIndex, deltas, output) {
  for (const [fileDelta, rankDelta] of deltas) {
    let nextFile = fileIndex + fileDelta
    let nextRank = rankIndex + rankDelta

    while (isInsideBoard(nextFile, nextRank)) {
      const targetPiece = board[nextRank]?.[nextFile]
      if (!targetPiece) {
        output.push(coordsToSquare(nextFile, nextRank))
      } else {
        if (pieceColor(targetPiece) !== pieceColor(fromPiece)) {
          output.push(coordsToSquare(nextFile, nextRank))
        }
        break
      }

      nextFile += fileDelta
      nextRank += rankDelta
    }
  }
}

function collectStepMoves(board, fromPiece, fileIndex, rankIndex, deltas, output) {
  for (const [fileDelta, rankDelta] of deltas) {
    const nextFile = fileIndex + fileDelta
    const nextRank = rankIndex + rankDelta
    if (!isInsideBoard(nextFile, nextRank)) {
      continue
    }

    const targetPiece = board[nextRank]?.[nextFile]
    if (!targetPiece || pieceColor(targetPiece) !== pieceColor(fromPiece)) {
      output.push(coordsToSquare(nextFile, nextRank))
    }
  }
}

export function parseFenBoard(fen) {
  const placement = (fen || "8/8/8/8/8/8/8/8").trim().split(" ")[0]
  const fenRanks = placement.split("/")

  return RANKS.map((_, rankIndex) => {
    const tokens = (fenRanks[rankIndex] || "8").split("")
    const row = []

    for (const token of tokens) {
      if (token >= "1" && token <= "8") {
        row.push(...Array(Number(token)).fill(null))
      } else if (/^[prnbqkPRNBQK]$/.test(token)) {
        row.push(token)
      }
    }

    while (row.length < 8) row.push(null)
    return row.slice(0, 8)
  })
}

export function getVisibleMoveTargets({ fen, fromSquare, color }) {
  const board = parseFenBoard(fen)
  const coords = squareToCoords(fromSquare)
  if (!coords || !color) {
    return []
  }

  const fromPiece = board[coords.rankIndex]?.[coords.fileIndex]
  if (!fromPiece || pieceColor(fromPiece) !== color) {
    return []
  }

  const pieceType = fromPiece.toLowerCase()
  const targets = []

  if (pieceType === "p") {
    const direction = color === "white" ? -1 : 1
    const startRankIndex = color === "white" ? 6 : 1
    const oneForwardRank = coords.rankIndex + direction

    if (isInsideBoard(coords.fileIndex, oneForwardRank) && !board[oneForwardRank]?.[coords.fileIndex]) {
      targets.push(coordsToSquare(coords.fileIndex, oneForwardRank))

      const twoForwardRank = coords.rankIndex + direction * 2
      if (
        coords.rankIndex === startRankIndex &&
        isInsideBoard(coords.fileIndex, twoForwardRank) &&
        !board[twoForwardRank]?.[coords.fileIndex]
      ) {
        targets.push(coordsToSquare(coords.fileIndex, twoForwardRank))
      }
    }

    for (const fileDelta of [-1, 1]) {
      const targetFile = coords.fileIndex + fileDelta
      const targetRank = coords.rankIndex + direction
      if (!isInsideBoard(targetFile, targetRank)) {
        continue
      }

      const targetPiece = board[targetRank]?.[targetFile]
      if (targetPiece && pieceColor(targetPiece) !== color) {
        targets.push(coordsToSquare(targetFile, targetRank))
      }
    }
  }

  if (pieceType === "n") {
    collectStepMoves(
      board,
      fromPiece,
      coords.fileIndex,
      coords.rankIndex,
      [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ],
      targets,
    )
  }

  if (pieceType === "b") {
    collectRayMoves(board, fromPiece, coords.fileIndex, coords.rankIndex, [[-1, -1], [-1, 1], [1, -1], [1, 1]], targets)
  }

  if (pieceType === "r") {
    collectRayMoves(board, fromPiece, coords.fileIndex, coords.rankIndex, [[-1, 0], [1, 0], [0, -1], [0, 1]], targets)
  }

  if (pieceType === "q") {
    collectRayMoves(
      board,
      fromPiece,
      coords.fileIndex,
      coords.rankIndex,
      [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
      targets,
    )
  }

  if (pieceType === "k") {
    collectStepMoves(
      board,
      fromPiece,
      coords.fileIndex,
      coords.rankIndex,
      [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
      targets,
    )
  }

  return [...new Set(targets)]
}

export function getAllowedMoveTargets(allowedMoves, fromSquare) {
  if (!Array.isArray(allowedMoves) || !fromSquare) {
    return []
  }

  const normalizedFromSquare = String(fromSquare).trim().toLowerCase()
  if (!/^[a-h][1-8]$/.test(normalizedFromSquare)) {
    return []
  }

  const targets = allowedMoves
    .filter((uci) => typeof uci === "string" && uci.trim().toLowerCase().startsWith(normalizedFromSquare))
    .map((uci) => uci.trim().toLowerCase().slice(2, 4))
    .filter((square) => /^[a-h][1-8]$/.test(square))

  return [...new Set(targets)]
}
