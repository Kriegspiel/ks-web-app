
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
})
