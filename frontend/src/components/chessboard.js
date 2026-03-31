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
