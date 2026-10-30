import { parseFenBoard } from "../components/chessboard"

export function isCastlingUci(uci) {
  return ["e1g1", "e1c1", "e8g8", "e8c8"].includes(String(uci ?? "").toLowerCase())
}

export function pieceAtFenSquare(fen, square) {
  const normalizedSquare = String(square ?? "").trim().toLowerCase()
  if (!/^[a-h][1-8]$/.test(normalizedSquare)) return ""
  const board = parseFenBoard(fen)
  const fileIndex = normalizedSquare.charCodeAt(0) - "a".charCodeAt(0)
  const rankIndex = 8 - Number.parseInt(normalizedSquare[1], 10)
  /* v8 ignore next -- @preserve invalid squares return earlier; this fallback protects malformed FEN rows. */
  return board[rankIndex]?.[fileIndex] ?? ""
}

export function castlingArrowsForUci(uci) {
  if (uci === "e1g1") return [{ from: "e1", to: "g1", tone: "success" }, { from: "h1", to: "f1", tone: "success" }]
  if (uci === "e1c1") return [{ from: "e1", to: "c1", tone: "success" }, { from: "a1", to: "d1", tone: "success" }]
  if (uci === "e8g8") return [{ from: "e8", to: "g8", tone: "success" }, { from: "h8", to: "f8", tone: "success" }]
  return [{ from: "e8", to: "c8", tone: "success" }, { from: "a8", to: "d8", tone: "success" }]
}

export function isCastlingMove(uci, previousBoardFen) {
  if (!isCastlingUci(uci)) return false
  const source = uci.slice(0, 2)
  const expectedKing = source === "e1" ? "K" : "k"
  return pieceAtFenSquare(previousBoardFen, source) === expectedKing
}

function dropSquareForMove(move) {
  const uci = String(move?.uci ?? "").trim().toLowerCase()
  const match = uci.match(/^[pnbrq]@([a-h][1-8])$/i)
  return match?.[1] ?? ""
}

export function arrowsForMove(move, previousBoardFen) {
  const uci = String(move?.uci ?? "").trim().toLowerCase()
  if (dropSquareForMove(move)) return []
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return []
  if (!move?.move_done) return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "illegal" }]
  if (isCastlingMove(uci, previousBoardFen)) return castlingArrowsForUci(uci)
  return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "success" }]
}

// Shared by ordinary game review and player-projected Tutor replay.
export function overlaysForPlyGroup(group, previousBoardFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
  if (!group) return { arrows: [], badges: [], captureSquares: [] }
  const arrows = [], badges = [], captureSquares = []
  group.moves.forEach((move, index) => {
    arrows.push(...arrowsForMove(move, previousBoardFen))
    const dropSquare = move?.move_done ? dropSquareForMove(move) : ""
    if (dropSquare) badges.push({ square: dropSquare, label: "", tone: "success" })
    const captureSquare = typeof move?.answer?.capture_square === "string" ? move.answer.capture_square.trim().toLowerCase() : ""
    if (captureSquare && /^[a-h][1-8]$/.test(captureSquare)) captureSquares.push(captureSquare)
    if (!move?.move_done) {
      const uci = String(move?.uci ?? "").trim().toLowerCase()
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) badges.push({ square: uci.slice(2, 4), label: String(index + 1), tone: "illegal" })
    }
  })
  return { arrows, badges, captureSquares: [...new Set(captureSquares)] }
}
