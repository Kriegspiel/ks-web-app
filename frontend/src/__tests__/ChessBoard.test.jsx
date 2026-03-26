import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import ChessBoard from "../components/ChessBoard"
import { parseFenBoard } from "../components/chessboard"

afterEach(() => {
  cleanup()
})

describe("parseFenBoard", () => {
  it("parses_piece_positions_deterministically", () => {
    const board = parseFenBoard("8/8/8/3k4/8/8/8/4K3 w - - 0 1")

    expect(board[3][3]).toBe("k")
    expect(board[7][4]).toBe("K")
    expect(board[0]).toHaveLength(8)
    expect(board[7]).toHaveLength(8)
  })
})

describe("ChessBoard", () => {
  it("renders_pieces_from_fen", () => {
    render(<ChessBoard boardFen="8/8/8/3k4/8/8/8/4K3 w - - 0 1" />)

    expect(screen.getByLabelText("Square d5")).toHaveTextContent("♚")
    expect(screen.getByLabelText("Square e1")).toHaveTextContent("♔")
  })

  it("emits_square_name_when_clicked", () => {
    const onSquareClick = vi.fn()
    render(<ChessBoard boardFen="8/8/8/8/8/8/8/8" onSquareClick={onSquareClick} />)

    fireEvent.click(screen.getByLabelText("Square e4"))

    expect(onSquareClick).toHaveBeenCalledWith("e4")
  })

  it("respects_disabled_click_guard", () => {
    const onSquareClick = vi.fn()
    render(<ChessBoard boardFen="8/8/8/8/8/8/8/8" disabled onSquareClick={onSquareClick} />)

    fireEvent.click(screen.getByLabelText("Square e4"))

    expect(onSquareClick).not.toHaveBeenCalled()
  })

  it("flips_coordinates_for_black_orientation", () => {
    const { container } = render(<ChessBoard boardFen="8/8/8/8/8/8/8/8" orientation="black" />)

    expect(container.querySelector(".square")?.getAttribute("data-square")).toBe("h1")

    const corners = container.querySelectorAll(".square")
    expect(corners[63].getAttribute("data-square")).toBe("a8")
  })

  it("renders_highlight_and_phantom_overlays_as_distinct_classes", () => {
    render(
      <ChessBoard
        boardFen="8/8/8/8/8/8/8/8"
        highlightedSquares={["e4"]}
        phantomSquares={["d5"]}
      />,
    )

    expect(screen.getByLabelText("Square e4")).toHaveClass("square--highlighted")
    expect(screen.getByLabelText("Square d5")).toHaveClass("square--phantom")
  })
})
