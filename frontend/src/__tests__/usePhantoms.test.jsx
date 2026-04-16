import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import usePhantoms, { occupiedSquaresFromFen } from "../hooks/usePhantoms"

beforeEach(() => {
  window.localStorage.clear()
})

describe("usePhantoms", () => {
  it("initializes_full_tray_and_supports_set_move_remove", () => {
    const { result } = renderHook(() => usePhantoms({ gameId: "g-530", occupiedSquares: [] }))

    expect(result.current.trayCounts).toEqual({ p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 })

    act(() => {
      result.current.setPieceAt("d5", "q")
    })
    expect(result.current.placements).toEqual({ d5: "q" })
    expect(result.current.trayCounts.q).toBe(0)

    act(() => {
      result.current.move("d5", "e4")
    })
    expect(result.current.placements).toEqual({ e4: "q" })

    act(() => {
      result.current.removeAt("e4")
    })
    expect(result.current.placements).toEqual({})
    expect(result.current.trayCounts.q).toBe(1)
  })

  it("displaces_existing_phantom_and_preserves_piece_totals", () => {
    const { result } = renderHook(() => usePhantoms({ gameId: "g-531", occupiedSquares: [] }))

    act(() => {
      result.current.setPieceAt("c4", "p")
    })
    act(() => {
      result.current.setPieceAt("c4", "n")
    })

    expect(result.current.placements).toEqual({ c4: "n" })
    expect(result.current.trayCounts.p).toBe(8)
    expect(result.current.trayCounts.n).toBe(1)
  })

  it("restores_persisted_state_by_game_id_and_reconciles_occupied_squares", () => {
    window.localStorage.setItem("phantoms_g-532", JSON.stringify({ placements: { d4: "q", e5: "r", bad: "x" } }))

    const { result, rerender } = renderHook(
      ({ occupiedSquares }) => usePhantoms({ gameId: "g-532", occupiedSquares }),
      { initialProps: { occupiedSquares: [] } },
    )

    expect(result.current.placements).toEqual({ d4: "q", e5: "r" })

    rerender({ occupiedSquares: ["e5"] })
    expect(result.current.placements).toEqual({ d4: "q" })

    rerender({ occupiedSquares: [] })
    expect(JSON.parse(window.localStorage.getItem("phantoms_g-532"))).toEqual({ placements: { d4: "q" } })
  })

  it("blocks_add_or_move_onto_real_piece_squares", () => {
    const { result } = renderHook(() => usePhantoms({ gameId: "g-533", occupiedSquares: ["e4"] }))

    act(() => {
      result.current.setPieceAt("e4", "q")
    })
    expect(result.current.placements).toEqual({})

    act(() => {
      result.current.setPieceAt("d5", "q")
    })
    act(() => {
      result.current.move("d5", "e4")
    })
    expect(result.current.placements).toEqual({ d5: "q" })
  })

  it("returns_false_for_invalid_operations_and_supports_replace_and_clear", () => {
    const { result } = renderHook(() => usePhantoms({ gameId: "g-534", occupiedSquares: "not-an-array" }))

    expect(result.current.availablePiecesForSquare()).toEqual(["p", "r", "n", "b", "q", "k"])

    act(() => {
      expect(result.current.setPieceAt("z9", "q")).toBe(false)
      expect(result.current.setPieceAt("d4", "x")).toBe(false)
      expect(result.current.setPieceAt("d4", "q")).toBe(true)
    })

    act(() => {
      expect(result.current.setPieceAt("d4", "q")).toBe(false)
      expect(result.current.move("d4", "d4")).toBe(false)
      expect(result.current.move("e4", "e5")).toBe(false)
      expect(result.current.removeAt("e4")).toBe(false)
    })

    expect(result.current.placements).toEqual({ d4: "q" })

    act(() => {
      result.current.replaceAll({ a1: "R", e4: "q", h8: "n", bad: "x" })
    })
    expect(result.current.placements).toEqual({ a1: "r", e4: "q", h8: "n" })

    act(() => {
      result.current.clearAll()
    })
    expect(result.current.placements).toEqual({})
  })

  it("ignores_invalid_persisted_state", () => {
    window.localStorage.setItem("phantoms_g-535", "{oops")

    const { result } = renderHook(() => usePhantoms({ gameId: "g-535", occupiedSquares: [] }))

    expect(result.current.placements).toEqual({})
  })
})

describe("occupiedSquaresFromFen", () => {
  it("extracts_occupied_squares", () => {
    expect(occupiedSquaresFromFen("8/8/8/3k4/8/8/8/4K3 w - - 0 1")).toEqual(["d5", "e1"])
  })

  it("returns_an_empty_list_for_an_empty_board", () => {
    expect(occupiedSquaresFromFen("8/8/8/8/8/8/8/8 w - - 0 1")).toEqual([])
  })
})
