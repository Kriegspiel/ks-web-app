export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]

export const PIECE_SYMBOLS = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
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
