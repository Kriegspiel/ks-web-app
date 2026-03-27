import { useEffect } from "react"
import "./PromotionModal.css"

const PROMOTION_CHOICES = [
  { suffix: "q", label: "Queen" },
  { suffix: "r", label: "Rook" },
  { suffix: "b", label: "Bishop" },
  { suffix: "n", label: "Knight" },
]

export default function PromotionModal({ open, onSelect, onCancel }) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        onCancel?.()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open, onCancel])

  if (!open) {
    return null
  }

  return (
    <div className="promotion-modal__backdrop" role="presentation" onClick={() => onCancel?.()}>
      <div
        className="promotion-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose promotion piece"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Choose promotion piece</h2>
        <div className="promotion-modal__choices">
          {PROMOTION_CHOICES.map((choice) => (
            <button
              key={choice.suffix}
              type="button"
              onClick={() => onSelect?.(choice.suffix)}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <button type="button" className="promotion-modal__cancel" onClick={() => onCancel?.()}>
          Cancel
        </button>
      </div>
    </div>
  )
}
