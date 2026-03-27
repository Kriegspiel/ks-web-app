import { PIECE_SYMBOLS } from "./chessboard"
import "./PhantomTray.css"

const PIECE_ORDER = ["q", "r", "b", "n", "p", "k"]

export default function PhantomTray({
  selectedPiece,
  trayCounts,
  pieceColor = "black",
  onSelectPiece,
  onClear,
}) {
  return (
    <section className="phantom-tray" aria-label="Phantom tray">
      <div className="phantom-tray__header">
        <h2>Phantom tray</h2>
        <button type="button" onClick={onClear}>Clear phantoms</button>
      </div>

      <p className="phantom-tray__hint">Select a piece, then click a board square to place it. Right-click a square to remove.</p>

      <div className="phantom-tray__pieces" role="list">
        {PIECE_ORDER.map((piece) => {
          const symbolKey = pieceColor === "white" ? piece.toUpperCase() : piece
          const count = trayCounts?.[piece] ?? 0
          return (
            <button
              type="button"
              key={piece}
              className={`phantom-piece ${selectedPiece === piece ? "phantom-piece--selected" : ""}`.trim()}
              aria-pressed={selectedPiece === piece}
              onClick={() => onSelectPiece?.(piece)}
              disabled={count <= 0 && selectedPiece !== piece}
            >
              <span className="phantom-piece__symbol" aria-hidden="true">{PIECE_SYMBOLS[symbolKey]}</span>
              <span className="phantom-piece__label">{piece.toUpperCase()} × {count}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
