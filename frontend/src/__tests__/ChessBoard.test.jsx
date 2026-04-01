import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ChessBoard from "../components/ChessBoard"
import { parseFenBoard } from "../components/chessboard"

describe("ChessBoard", () => {
  it("parses_piece_positions_deterministically", () => {
    const board = parseFenBoard("8/3k4/8/8/8/8/4P3/4K3 w - - 0 1")

    expect(board[1][3]).toBe("k")
    expect(board[6][4]).toBe("P")
    expect(board[7][4]).toBe("K")
  })

  it("renders_pieces_from_fen", () => {
    render(<ChessBoard boardFen="8/3k4/8/8/8/8/8/4K3 w - - 0 1" />)

    expect(screen.getByRole("img", { name: "Black king" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "White king" })).toBeInTheDocument()
    expect(screen.getByLabelText("Square d7")).toBeInTheDocument()
    expect(screen.getByLabelText("Square e1")).toBeInTheDocument()
  })

  it("supports_secondary_actions_and_renders_phantom_piece_images", () => {
    const onSquareRightClick = vi.fn()

    render(
      <ChessBoard
        boardFen="8/8/8/8/8/8/8/4K3 w - - 0 1"
        phantomSquares={["d5"]}
        phantomPlacements={{ d5: "q" }}
        onSquareRightClick={onSquareRightClick}
      />,
    )

    const d5Buttons = screen.getAllByRole("button", { name: "Square d5" })
    fireEvent.contextMenu(d5Buttons[d5Buttons.length - 1])
    expect(onSquareRightClick).toHaveBeenCalled()
    expect(screen.getByLabelText("Phantom Black queen")).toBeInTheDocument()
  })

  it("wires_primary_and_pointer_handlers_and_respects_disabled", () => {
    const onSquareClick = vi.fn()
    const onSquareRightClick = vi.fn()
    const onSquarePointerDown = vi.fn()
    const onSquarePointerEnter = vi.fn()
    const onSquarePointerMove = vi.fn()
    const onSquarePointerUp = vi.fn()
    const onSquarePointerCancel = vi.fn()

    const { rerender } = render(
      <ChessBoard
        boardFen="8/8/8/8/8/8/8/4K3 w - - 0 1"
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        onSquarePointerDown={onSquarePointerDown}
        onSquarePointerEnter={onSquarePointerEnter}
        onSquarePointerMove={onSquarePointerMove}
        onSquarePointerUp={onSquarePointerUp}
        onSquarePointerCancel={onSquarePointerCancel}
      />,
    )

    const squareButtons = screen.getAllByRole("button", { name: "Square e4" })
    const square = squareButtons[squareButtons.length - 1]
    fireEvent.click(square)
    fireEvent.contextMenu(square)
    fireEvent.pointerDown(square)
    fireEvent.pointerEnter(square)
    fireEvent.pointerMove(square)
    fireEvent.pointerUp(square)
    fireEvent.pointerCancel(square)

    expect(onSquareClick).toHaveBeenCalledWith("e4")
    expect(onSquareRightClick).toHaveBeenCalled()
    expect(onSquarePointerDown).toHaveBeenCalledWith("e4", expect.any(Object))
    expect(onSquarePointerEnter).toHaveBeenCalledWith("e4", expect.any(Object))
    expect(onSquarePointerMove).toHaveBeenCalledWith("e4", expect.any(Object))
    expect(onSquarePointerUp).toHaveBeenCalledWith("e4", expect.any(Object))
    expect(onSquarePointerCancel).toHaveBeenCalledWith("e4", expect.any(Object))

    rerender(
      <ChessBoard
        boardFen="8/8/8/8/8/8/8/4K3 w - - 0 1"
        disabled
        onSquareClick={onSquareClick}
        onSquareRightClick={onSquareRightClick}
        onSquarePointerDown={onSquarePointerDown}
        onSquarePointerEnter={onSquarePointerEnter}
        onSquarePointerMove={onSquarePointerMove}
        onSquarePointerUp={onSquarePointerUp}
        onSquarePointerCancel={onSquarePointerCancel}
      />,
    )

    const disabledButtons = screen.getAllByRole("button", { name: "Square e4" })
    const disabledSquare = disabledButtons[disabledButtons.length - 1]
    fireEvent.click(disabledSquare)
    fireEvent.contextMenu(disabledSquare)
    fireEvent.pointerDown(disabledSquare)
    fireEvent.pointerEnter(disabledSquare)
    fireEvent.pointerMove(disabledSquare)
    fireEvent.pointerUp(disabledSquare)
    fireEvent.pointerCancel(disabledSquare)

    expect(onSquareClick).toHaveBeenCalledTimes(1)
    expect(onSquareRightClick).toHaveBeenCalledTimes(2)
    expect(onSquarePointerDown).toHaveBeenCalledTimes(1)
    expect(onSquarePointerEnter).toHaveBeenCalledTimes(1)
    expect(onSquarePointerMove).toHaveBeenCalledTimes(1)
    expect(onSquarePointerUp).toHaveBeenCalledTimes(1)
    expect(onSquarePointerCancel).toHaveBeenCalledTimes(1)
  })
})
