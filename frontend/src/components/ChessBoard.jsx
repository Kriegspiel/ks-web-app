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

function squareCenter(square, orientation) {
  if (typeof square !== "string" || !/^[a-h][1-8]$/.test(square)) {
    return null
  }

  const fileIndex = FILES.indexOf(square[0])
  const rankIndex = RANKS.indexOf(Number.parseInt(square[1], 10))
  if (fileIndex < 0 || rankIndex < 0) {
    return null
  }

  const displayFileIndex = orientation === "black" ? FILES.length - 1 - fileIndex : fileIndex
  const displayRankIndex = orientation === "black" ? RANKS.length - 1 - rankIndex : rankIndex

  return {
    x: (displayFileIndex + 0.5) * 100,
    y: (displayRankIndex + 0.5) * 100,
  }
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
  overlayArrows = [],
  overlayBadges = [],
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
  const renderedArrows = overlayArrows
    .map((arrow, index) => {
      const from = squareCenter(String(arrow?.from ?? "").toLowerCase(), orientation)
      const to = squareCenter(String(arrow?.to ?? "").toLowerCase(), orientation)
      if (!from || !to) {
        return null
      }

      return {
        id: `${arrow?.from}-${arrow?.to}-${index}`,
        from,
        to,
        tone: arrow?.tone === "success" ? "success" : "illegal",
      }
    })
    .filter(Boolean)
  const renderedBadges = overlayBadges
    .map((badge, index) => {
      const center = squareCenter(String(badge?.square ?? "").toLowerCase(), orientation)
      if (!center) {
        return null
      }

      return {
        id: `${badge?.square}-${badge?.label}-${index}`,
        center,
        label: String(badge?.label ?? ""),
        tone: badge?.tone === "success" ? "success" : "illegal",
      }
    })
    .filter(Boolean)

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
      {renderedArrows.length || renderedBadges.length ? (
        <svg className="board-overlay" viewBox="0 0 800 800" aria-hidden="true">
          <defs>
            <marker id="board-overlay-arrow-illegal" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
              <path d="M0 0 L5 2.5 L0 5 z" className="board-overlay__marker board-overlay__marker--illegal" />
            </marker>
            <marker id="board-overlay-arrow-success" markerWidth="5" markerHeight="5" refX="4.4" refY="2.5" orient="auto">
              <path d="M0 0 L5 2.5 L0 5 z" className="board-overlay__marker board-overlay__marker--success" />
            </marker>
          </defs>
          {renderedArrows.map((arrow) => (
            <line
              key={arrow.id}
              x1={arrow.from.x}
              y1={arrow.from.y}
              x2={arrow.to.x}
              y2={arrow.to.y}
              className={`board-overlay__arrow board-overlay__arrow--${arrow.tone}`}
              markerEnd={`url(#board-overlay-arrow-${arrow.tone})`}
            />
          ))}
          {renderedBadges.map((badge) => (
            <g key={badge.id} transform={`translate(${badge.center.x}, ${badge.center.y})`}>
              <circle className={`board-overlay__badge board-overlay__badge--${badge.tone}`} r="18" />
              <text className="board-overlay__badge-label" textAnchor="middle" dominantBaseline="central">
                {badge.label}
              </text>
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  )
}

export default ChessBoard
