import { describe, expect, it } from "vitest"
import { getAllowedMoveTargets, getVisibleMoveTargets, parseFenBoard } from "../components/chessboard"

describe("chessboard move helpers", () => {
  it("pads_invalid_fen_rows_and_normalizes_allowed_move_targets", () => {
    const board = parseFenBoard("7x/8/8/8/8/8/8/8 w - - 0 1")

    expect(board).toHaveLength(8)
    expect(board[0]).toHaveLength(8)
    expect(board[0].every((square) => square === null)).toBe(true)

    expect(getAllowedMoveTargets(["E2E4", "e2e3", " e2e4 ", "bad", "e2zz"], " E2 ")).toEqual(["e4", "e3"])
    expect(getAllowedMoveTargets(null, "e2")).toEqual([])
    expect(getAllowedMoveTargets(["e2e4"], "z9")).toEqual([])
  })

  it("pads_missing_fen_ranks_and_handles_invalid_row_indexes", () => {
    const board = parseFenBoard("4k3/8/8/8")

    expect(board).toHaveLength(8)
    expect(board[0][4]).toBe("k")
    expect(board[7]).toHaveLength(8)
    expect(board[7].every((square) => square === null)).toBe(true)
  })

  it("returns_empty_targets_for_invalid_inputs_or_the_wrong_piece_color", () => {
    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/8/8/4p3/4K3 w - - 0 1",
      fromSquare: "e2",
      color: "white",
    })).toEqual([])

    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      fromSquare: "z9",
      color: "white",
    })).toEqual([])
  })

  it("derives_white_and_black_pawn_targets_with_pushes_and_captures", () => {
    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/8/3p1p2/4P3/8 w - - 0 1",
      fromSquare: "e2",
      color: "white",
    }).sort()).toEqual(["d3", "e3", "e4", "f3"].sort())

    expect(getVisibleMoveTargets({
      fen: "8/3p4/2P1p3/8/8/8/8/8 b - - 0 1",
      fromSquare: "d7",
      color: "black",
    }).sort()).toEqual(["c6", "d5", "d6"].sort())
  })

  it("ignores_off_board_pawn_captures_and_knight_steps", () => {
    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/8/1p6/P7/8 w - - 0 1",
      fromSquare: "a2",
      color: "white",
    }).sort()).toEqual(["a3", "a4", "b3"].sort())

    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/8/8/8/N7 w - - 0 1",
      fromSquare: "a1",
      color: "white",
    }).sort()).toEqual(["b3", "c2"].sort())
  })

  it("derives_knight_bishop_and_rook_targets_with_mixed_blockers", () => {
    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/2N5/8/1p1P4/8 w - - 0 1",
      fromSquare: "c4",
      color: "white",
    }).sort()).toEqual(["a3", "a5", "b2", "b6", "d6", "e3", "e5"].sort())

    expect(getVisibleMoveTargets({
      fen: "8/8/1P3p2/8/3B4/8/8/8 w - - 0 1",
      fromSquare: "d4",
      color: "white",
    }).sort()).toEqual(["a1", "b2", "c3", "c5", "e3", "e5", "f2", "f6", "g1"].sort())

    expect(getVisibleMoveTargets({
      fen: "8/8/3p4/8/3R1P2/8/8/8 w - - 0 1",
      fromSquare: "d4",
      color: "white",
    }).sort()).toEqual(["a4", "b4", "c4", "d1", "d2", "d3", "d5", "d6", "e4"].sort())
  })

  it("derives_queen_and_king_targets", () => {
    expect(getVisibleMoveTargets({
      fen: "8/8/8/8/3Q4/8/8/8 w - - 0 1",
      fromSquare: "d4",
      color: "white",
    })).toEqual(expect.arrayContaining(["a1", "a4", "d8", "h4", "h8"]))

    expect(getVisibleMoveTargets({
      fen: "8/8/8/2p1P3/3K4/8/8/8 w - - 0 1",
      fromSquare: "d4",
      color: "white",
    }).sort()).toEqual(["c3", "c4", "c5", "d3", "d5", "e3", "e4"].sort())
  })
})
