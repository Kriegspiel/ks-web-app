import React from "react"
import "./ChessBoard.css"
import { FILES, PIECE_ASSETS, PIECE_LABELS, RANKS, parseFenBoard } from "./chessboard"

function getPhantomDisplayPiece(piece, orientation) {
  if (typeof piece !== "string") {
    return ""
  }

  const normalized = piece.toLowerCase()
  return orientation === "black" ? normalized.toUpperCase() : normalized
}

function ChessBoard({
  boardFen,
  orientation = "white",
  highlightedSquares = [],
  lastMoveSquares = [],
  captureSquares = [],
  illegalSquares = [],
  suggestedSquares = [],
  phantomSquares = [],
  phantomPlacements = {},
  disabled = false,
  onSquareClick,
  onSquareRightClick,
  onSquarePointerDown,
  onSquarePointerEnter,
  onSquarePointerMove,
  onSquarePointerUp,
  onSquarePointerCancel,
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
            const phantomPiece = phantomPlacements[square]
            const isLight = (fileIndex + rankIndex) % 2 === 0
            const highlighted = highlightedSquares.includes(square)
            const lastMove = lastMoveSquares.includes(square)
            const capture = captureSquares.includes(square)
            const illegal = illegalSquares.includes(square)
            const suggested = suggestedSquares.includes(square)
            const phantom = phantomSquares.includes(square)
            const phantomDisplayPiece = getPhantomDisplayPiece(phantomPiece, orientation)

            return (
              <button
                type="button"
                key={square}
                className={[
                  "square",
                  isLight ? "light" : "dark",
                  highlighted ? "square--highlighted" : "",
                  lastMove ? "square--last-move" : "",
                  capture ? "square--capture" : "",
                  illegal ? "square--illegal" : "",
                  suggested ? "square--suggested" : "",
                  phantom ? "square--phantom" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-square={square}
                disabled={disabled}
                onMouseDown={(event) => {
                  if (!disabled) {
                    // Keep pointer interaction from moving focus back to a square button,
                    // which causes the viewport to jump when the board rerenders.
                    event.preventDefault()
                  }
                }}
                onClick={() => {
                  if (!disabled) {
                    onSquareClick?.(square)
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onSquareRightClick?.(square, event)
                }}
                onPointerDown={(event) => {
                  if (!disabled) {
                    onSquarePointerDown?.(square, event)
                  }
                }}
                onPointerEnter={(event) => {
                  if (!disabled) {
                    onSquarePointerEnter?.(square, event)
                  }
                }}
                onPointerMove={(event) => {
                  if (!disabled) {
                    onSquarePointerMove?.(square, event)
                  }
                }}
                onPointerUp={(event) => {
                  if (!disabled) {
                    onSquarePointerUp?.(square, event)
                  }
                }}
                onPointerCancel={(event) => {
                  if (!disabled) {
                    onSquarePointerCancel?.(square, event)
                  }
                }}
                aria-label={`Square ${square}`}
              >
                {showFileLabelOnSquare(file, rank) && <span className="coord file">{file}</span>}
                {showRankLabelOnSquare(file) && <span className="coord rank">{rank}</span>}
                {suggested && !piece && !phantomPiece ? <span className="square__move-dot" aria-hidden="true" /> : null}
                {phantomPiece && !piece ? (
                  <span className="phantom-piece-on-board" aria-label={`Phantom ${PIECE_LABELS[phantomDisplayPiece]}`}>
                    <img className="phantom-piece-on-board__image" src={PIECE_ASSETS[phantomDisplayPiece]} alt="" draggable="false" />
                  </span>
                ) : null}
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
