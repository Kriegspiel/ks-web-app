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
})

describe("occupiedSquaresFromFen", () => {
  it("extracts_occupied_squares", () => {
    expect(occupiedSquaresFromFen("8/8/8/3k4/8/8/8/4K3 w - - 0 1")).toEqual(["d5", "e1"])
  })
})
