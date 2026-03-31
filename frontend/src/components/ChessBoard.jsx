
import React from "react"
import "./ChessBoard.css"
import { FILES, PIECE_ASSETS, PIECE_LABELS, RANKS, parseFenBoard } from "./chessboard"

function ChessBoard({
  boardFen,
  orientation = "white",
  highlightedSquares = [],
  lastMoveSquares = [],
  phantomSquares = [],
  disabled = false,
  onSquareClick,
  onSquareRightClick,
}) {
  const board = parseFenBoard(boardFen)
  const files = orientation === "black" ? [...FILES].reverse() : FILES
  const ranks = orientation === "black" ? [...RANKS].reverse() : RANKS

  const showFileLabelOnSquare = (file, rank) => rank === ranks[ranks.length - 1]
  const showRankLabelOnSquare = (file) => file === files[0]

  return (
    <div className="chess-board" data-orientation={orientation}>
      <div className="board-grid" role="grid" aria-label="Chess board">
        {ranks.flatMap((rank) =>
          files.map((file) => {
            const fileIndex = FILES.indexOf(file)
            const rankIndex = RANKS.indexOf(rank)
            const square = `${file}${rank}`
            const piece = board[rankIndex]?.[fileIndex]
            const isLight = (fileIndex + rankIndex) % 2 === 0
            const highlighted = highlightedSquares.includes(square)
            const lastMove = lastMoveSquares.includes(square)
            const phantom = phantomSquares.includes(square)

            return (
              <button
                type="button"
                key={square}
                className={[
                  "square",
                  isLight ? "light" : "dark",
                  highlighted ? "square--highlighted" : "",
                  lastMove ? "square--last-move" : "",
                  phantom ? "square--phantom" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-square={square}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    onSquareClick?.(square)
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onSquareRightClick?.(square)
                }}
                aria-label={`Square ${square}`}
              >
                {showFileLabelOnSquare(file, rank) && <span className="coord file">{file}</span>}
                {showRankLabelOnSquare(file) && <span className="coord rank">{rank}</span>}
                {piece && (
                  <span className={`piece ${piece === piece.toUpperCase() ? "white" : "black"}`}>
                    <img className="piece__image" src={PIECE_ASSETS[piece]} alt={PIECE_LABELS[piece]} draggable="false" />
                  </span>
                )}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}

export default ChessBoard
