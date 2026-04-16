import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import PhantomTray from "../components/PhantomTray"

afterEach(() => {
  cleanup()
})

describe("PhantomTray", () => {
  it("renders_counts_and_selection_state", () => {
    const onSelectPiece = vi.fn()

    render(
      <PhantomTray
        selectedPiece="n"
        trayCounts={{ p: 8, r: 2, n: 1, b: 2, q: 1, k: 1 }}
        onSelectPiece={onSelectPiece}
        onClear={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /N × 1/i })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: /Q × 1/i }))
    expect(onSelectPiece).toHaveBeenCalledWith("q")
  })

  it("disables_empty_piece_slots_and_clears", () => {
    const onClear = vi.fn()

    render(
      <PhantomTray
        selectedPiece=""
        trayCounts={{ p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 }}
        onSelectPiece={vi.fn()}
        onClear={onClear}
      />,
    )

    expect(screen.getByRole("button", { name: /P × 0/i })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Clear phantoms/i }))
    expect(onClear).toHaveBeenCalled()
  })

  it("uses_white_piece_styling_and_keeps_the_selected_empty_slot_enabled", () => {
    const onSelectPiece = vi.fn()

    render(
      <PhantomTray
        selectedPiece="p"
        pieceColor="white"
        onSelectPiece={onSelectPiece}
        onClear={vi.fn()}
      />,
    )

    const selectedPawn = screen.getByRole("button", { name: /P × 0/i })
    const emptyQueen = screen.getByRole("button", { name: /Q × 0/i })

    expect(selectedPawn).not.toBeDisabled()
    expect(emptyQueen).toBeDisabled()
    expect(document.querySelector(".phantom-piece__symbol--white")).toBeInTheDocument()

    fireEvent.click(selectedPawn)
    expect(onSelectPiece).toHaveBeenCalledWith("p")
  })
})
