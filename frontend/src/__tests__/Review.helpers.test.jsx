import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { __reviewPageInternals as h } from "../pages/Review.jsx"

describe("ReviewPage helper functions", () => {
  it("formats announcements, groups, rows, results, dates, and ratings", () => {
    expect(h.formatAnnouncement("")).toBe("")
    expect(h.formatAnnouncement("CHECK_FILE")).toBe("Check on file")
    expect(h.formatAnnouncement("CUSTOM")).toBe("CUSTOM")
    expect(h.isCaptureAnnouncement(null)).toBe(false)
    expect(h.isCaptureAnnouncement("3")).toBe(true)
    expect(h.formatCaptureAnnouncement({ main: "REGULAR_MOVE" })).toBe("Move complete")
    expect(h.formatCaptureAnnouncement({ main: "CAPTURE_DONE", en_passant_announced: true })).toBe("En passant capture")
    expect(h.formatCaptureAnnouncement({ main: "CAPTURE_DONE", capture_square: "e4", en_passant_announced: true })).toBe("En passant capture at E4")
    expect(h.formatCaptureAnnouncement({ main: "CAPTURE_DONE", captured_piece_announcement: "pawn" })).toBe("Pawn captured")
    expect(h.formatCaptureAnnouncement({ main: "CAPTURE_DONE", capture_square: "e4", captured_piece_announcement: "rook" })).toBe("Rook captured at E4")
    expect(h.moveAnnouncements(null)).toEqual([])
    expect(h.moveAnnouncements({ uci: "e2e4", answer: { main: "NONSENSE" } })).toEqual([])
    expect(h.moveAnnouncements({ uci: "e2e4", answer: {} })).toEqual(["[e2e4]"])
    expect(h.moveAnnouncements({ uci: "", answer: { main: "REGULAR_MOVE", special: "CHECK_DOUBLE", checks: ["CHECK_FILE", "CHECK_RANK"] } })).toEqual(["Move complete", "Double check", "Check on file", "Check on rank"])
    expect(h.moveAnnouncements({ uci: "e2e4", answer: { main: "REGULAR_MOVE" } })).toEqual(["[e2e4] Move complete"])
    expect(h.moveAnnouncements({ question_type: "ASK_ANY", answer: { main: "HAS_ANY" } })).toEqual(["Has pawn captures"])
    expect(h.moveTurnStartAnnouncement({ move_done: false })).toBe("")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_try_squares: [] } })).toBe("No pawn captures")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_try_squares: ["a2", "bad"] } })).toBe("Pawn try from A2")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_try_squares: ["a2", "b3"] } })).toBe("Pawn tries from A2, B3")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_tries: 0 } })).toBe("No pawn captures")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_tries: 1 } })).toBe("1 pawn try")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_pawn_tries: 2 } })).toBe("2 pawn tries")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_has_pawn_capture: true } })).toBe("Has pawn capture")
    expect(h.moveTurnStartAnnouncement({ move_done: true, answer: { next_turn_has_pawn_capture: false } })).toBe("No pawn captures")

    const groups = h.buildPlyGroups([
      { color: "white", ply: 1, uci: "e2e4", answer: { main: "REGULAR_MOVE", next_turn_pawn_tries: 1 }, move_done: true },
      { color: "white", ply: 2, uci: "e4e5", answer: { main: "ILLEGAL_MOVE" } },
      { color: "black", ply: 3, uci: "e7e5", answer: { main: "CAPTURE_DONE", capture_square: "e4" } },
    ])
    expect(groups).toHaveLength(2)
    expect(h.buildPlyGroups([{}, { color: "white" }]).at(0)).toMatchObject({ id: "white-1", firstPly: 0, lastPly: 0 })
    expect(h.buildMoveRows([])).toEqual([])
    expect(h.groupAnnouncements(null)).toEqual([])
    expect(h.formatPlySummary(null)).toBe("")
    expect(h.formatPlySummary(groups[1])).toContain("1 pawn try")
    expect(h.buildMoveRows([{ color: "black", ply: 1, answer: { main: "REGULAR_MOVE" } }])[0].black).toBeTruthy()
    expect(h.finalTimestampForGroup(null)).toBeNull()
    expect(h.finalTimestampForGroup({ moves: [{ timestamp: "bad" }] })).toBeNull()
    expect(h.finalTimestampForGroup({ moves: [{ timestamp: "2026-01-01T00:00:00Z" }] })).toBeInstanceOf(Date)

    expect(h.formatElapsedBetween("bad", "date")).toBe("—")
    expect(h.formatElapsedBetween(null, null)).toBe("—")
    expect(h.formatElapsedBetween("2026-01-01T00:00:00Z", "2026-01-01T00:01:04Z")).toBe("1m 4s")
    expect(h.fenForPerspective(null, "white")).toBe("")
    expect(h.fenForPerspective({ full: null }, "referee")).toBe("")
    expect(h.fenForPerspective({ full: "full", white: "white" }, "referee")).toBe("full")
    expect(h.fenForPerspective({ white: "white" }, "white")).toBe("white")
    expect(h.fenForPerspective({}, "white")).toBe("")
    expect(h.formatResult(null)).toBe("Result unavailable")
    expect(h.formatResult({ winner: "black", reason: "too_many_reversible_moves" })).toBe("Black wins by too many reversible moves")
    expect(h.formatResult({ winner: null, reason: "" })).toBe("Draw")
    expect(h.formatResultReason(null)).toBe("")
    expect(h.formatResultReason("custom_reason")).toBe("custom reason")
    expect(h.formatPerspectiveLabel(null)).toBe("Start")
    expect(h.formatPerspectiveLabel({ turnNumber: 2, color: "black" })).toBe("2B")
    expect(h.formatTurnNumber(null)).toBe("0")
    expect(h.formatUtcDateTime("")).toBe("—")
    expect(h.formatUtcDateTime("bad")).toBe("—")
    expect(h.formatDuration("bad", "date")).toBe("—")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:05Z")).toBe("5s")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")).toBe("1h 0m 0s")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-02T01:02:03Z")).toBe("1d 1h 2m 3s")
    expect(h.secondsBetween(null, null)).toBe(0)
    expect(h.secondsBetween("bad", "date")).toBe(0)
    expect(h.secondsBetween("2026-01-01T00:00:00Z", "2026-01-01T00:00:05Z")).toBe(5)
    expect(h.normalizeRatings(null)).toEqual({ overall: null, vsHumans: null, vsBots: null })
    expect(h.normalizeRatings({ ratings: { overall: { elo: 1400 }, vs_humans: { elo: 1300 }, vs_bots: { elo: 1500 } } })).toEqual({ overall: 1400, vsHumans: 1300, vsBots: 1500 })
    expect(h.historicalRatingsForColor({ white: { elo: 1200 } }, "white")).toEqual({ overall: null, vsHumans: null, vsBots: null })
    expect(h.historicalRatingsForColor({ rating_snapshot: { overall: {}, specific: {} } }, "white")).toEqual({ overall: null, vsHumans: null, vsBots: null })
    expect(h.historicalRatingsForColor({
      white: { ratings: { vs_humans: { elo: 1210 }, vs_bots: { elo: 1220 } } },
      rating_snapshot: { overall: { white_before: "1300" }, specific: { white_before: "1310" }, white_track: "vs_humans" },
    }, "white")).toEqual({ overall: 1300, vsHumans: 1310, vsBots: 1220 })
    expect(h.ratingValue(Number.NaN)).toBe("—")
    expect(h.ratingValue(1500)).toBe("1500")
  })

  it("computes replay board overlays, reserves, material, clocks, and labels", () => {
    expect(h.movesUpToPly(null, null)).toEqual([])
    expect(h.movesUpToPly([{ ply: 1 }], { lastPly: "bad" })).toEqual([])
    expect(h.movesUpToPly([{ ply: 1 }, { ply: 3 }], { lastPly: 2 })).toEqual([{ ply: 1 }])
    expect(h.emptyReserveSummary()).toEqual({ pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 })
    expect(h.reserveKeyForPiece("q")).toBe("queens")
    expect(h.reserveKeyForPiece(null)).toBe("")
    expect(h.reserveKeyForPiece("x")).toBe("")
    expect(h.reservePieceFromAnnouncement("bishop")).toBe("B")
    expect(h.reservePieceFromAnnouncement(null)).toBe("")
    expect(h.reservePieceFromAnnouncement("dragon")).toBe("")
    expect(h.normalizeDropMove("q@h8")).toEqual({ piece: "Q", square: "h8" })
    expect(h.normalizeDropMove("bad")).toBeNull()
    expect(h.reserveCountForPiece({ queens: 2 }, "Q")).toBe(2)
    expect(h.reserveCountForPiece({}, "Q")).toBe(0)
    expect(h.reserveCountForPiece({}, "X")).toBe(0)
    expect(h.replayReserveStatus({ moves: [], selectedPlyGroup: null, ruleVariant: "berkeley" })).toEqual({ white: h.emptyReserveSummary(), black: h.emptyReserveSummary() })
    expect(h.replayReserveStatus({
      ruleVariant: "crazykrieg",
      selectedPlyGroup: { lastPly: 3 },
      moves: [
        { ply: 0, color: "black", move_done: false, answer: { main: "CAPTURE_DONE", captured_piece_announcement: "rook" } },
        { ply: 1, color: "white", move_done: true, answer: { main: "CAPTURE_DONE", captured_piece_announcement: "queen" } },
        { ply: 2, color: "white", move_done: true, uci: "q@h8" },
        { ply: 3, color: "black", move_done: true, answer: { main: "3", captured_piece_announcement: "dragon" } },
        { ply: 3, color: "black", move_done: true, answer: {} },
      ],
    }).white.queens).toBe(0)

    expect(h.countPiecesInFen(null)).toBeNull()
    expect(h.countPiecesInFen("[] w - - 0 1")).toBeNull()
    expect(h.countPiecesInFen("8/8/8/8/8/8/8/K6k w - - 0 1")).toEqual({ white: 1, black: 1 })
    expect(h.replayMaterialStatus({ moves: [], selectedPlyGroup: null, ruleVariant: "wild16", fullFen: "8/8/8/8/8/8/8/K6k w - - 0 1" })).toEqual({
      white: { piecesRemaining: 1, pawnsCaptured: 0 },
      black: { piecesRemaining: 1, pawnsCaptured: 0 },
    })
    expect(h.replayMaterialStatus({
      moves: [{ ply: 1, color: "white", move_done: true, answer: { main: "CAPTURE_DONE" } }],
      selectedPlyGroup: { lastPly: 1 },
      ruleVariant: "berkeley",
      fullFen: "",
    })).toEqual({
      white: { piecesRemaining: 16, pawnsCaptured: null },
      black: { piecesRemaining: 15, pawnsCaptured: null },
    })
    expect(h.replayClockSettings(null)).toEqual({ base: 1500, increment: 10 })
    expect(h.replayClockSettings({ base: 60, increment: 2 })).toEqual({ base: 60, increment: 2 })
    expect(h.replayClockRemaining({
      gameCreatedAt: "2026-01-01T00:00:00Z",
      selectedPlyGroup: { lastPly: 1 },
      timeControl: { base: 60, increment: 2 },
      moves: [{ ply: 1, color: "white", timestamp: "2026-01-01T00:00:05Z", move_done: true }],
    })).toEqual({ white: 62, black: 60 })
    expect(h.playerLabel({ username: "bot", role: "bot" })).toBe("bot (bot)")
    expect(h.playerLabel(null)).toBe("—")
    expect(h.fenForPly([{ ply: 1, replay_fen: { white: "w", full: "f" } }], 1, "white")).toBe("w")
    expect(h.fenForPly([{ replay_fen: {} }], 1, "white")).toContain("PPPPPPPP")
    expect(h.fenForPly([], 0, "black")).toContain("pppppppp")
    expect(h.isCastlingUci(null)).toBe(false)
    expect(h.isCastlingUci("e1g1")).toBe(true)
    expect(h.pieceAtFenSquare("8/8/8/8/8/8/8/4K3 w - - 0 1", null)).toBe("")
    expect(h.pieceAtFenSquare("bad", "e4")).toBe("")
    expect(h.pieceAtFenSquare("8/8/8/8/8/8/8/4K3 w - - 0 1", "z9")).toBe("")
    expect(h.pieceAtFenSquare("8/8/8/8/8/8/8/4K3 w - - 0 1", "e1")).toBe("K")
    expect(h.castlingArrowsForUci("e1c1")).toHaveLength(2)
    expect(h.castlingArrowsForUci("e8g8")).toHaveLength(2)
    expect(h.castlingArrowsForUci("e8c8")).toHaveLength(2)
    expect(h.isCastlingMove("e2e4", "8/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(false)
    expect(h.isCastlingMove("e1g1", "8/8/8/8/8/8/8/4K3 w - - 0 1")).toBe(true)
    expect(h.arrowsForMove({ uci: "bad" })).toEqual([])
    expect(h.arrowsForMove({ uci: "e1g1", move_done: true }, "8/8/8/8/8/8/8/4K3 w - - 0 1")).toHaveLength(2)
    expect(h.arrowsForMove({ uci: "q@h8" })).toEqual([])
    expect(h.summarizePlyGroup(null)).toEqual([])
    expect(h.overlaysForPlyGroup(null)).toEqual({ arrows: [], badges: [], captureSquares: [] })
    expect(h.overlaysForPlyGroup({ moves: [{ move_done: false }] })).toEqual({ arrows: [], badges: [], captureSquares: [] })
    expect(h.overlaysForPlyGroup({ moves: [{ uci: "q@h8" }, { uci: "e2e4", move_done: false }] })).toMatchObject({ badges: [{ square: "e4" }], arrows: [{ from: "e2", to: "e4" }] })
  })

  it("handles DOM measurement helpers and rendered helper components", () => {
    expect(h.cssPixelValue({ getPropertyValue: () => "12px" }, "--gap", "gap")).toBe(12)
    expect(h.cssPixelValue({ getPropertyValue: () => "bad", gap: "8px" }, "--gap", "gap")).toBe(0)
    const child = document.createElement("div")
    child.getBoundingClientRect = () => ({ bottom: 180 })
    const boardCard = document.createElement("section")
    boardCard.getBoundingClientRect = () => ({ top: 20, height: 300 })
    boardCard.append(child)
    const stylesSpy = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "10px",
      gap: "10px",
      paddingTop: "12px",
      paddingBottom: "14px",
      borderBottomWidth: "2px",
      marginBottom: "4px",
    })
    expect(h.measureReviewBoardCardHeight(boardCard)).toBeGreaterThan(0)
    const originalGetComputedStyle = window.getComputedStyle
    const fakeBoardCard = {
      getBoundingClientRect: () => ({ top: 0, height: 24 }),
      children: [{}],
    }
    expect(h.measureReviewBoardCardHeight(fakeBoardCard)).toBeGreaterThan(0)
    Object.defineProperty(window, "getComputedStyle", { value: undefined, configurable: true })
    expect(h.measureReviewBoardCardHeight(boardCard)).toBeGreaterThan(0)
    Object.defineProperty(window, "getComputedStyle", { value: originalGetComputedStyle, configurable: true })
    stylesSpy.mockRestore()
    expect(h.isMobileReviewViewport()).toBe(window.innerWidth <= 768)
    const element = { scrollTop: 0, scrollHeight: 200, clientHeight: 50, scrollTo: vi.fn() }
    h.scrollReviewLogElement(element, { behavior: "smooth" })
    expect(element.scrollTo).toHaveBeenCalled()
    const plainElement = { scrollTop: 0 }
    h.scrollReviewLogElement(plainElement, { top: 44 })
    expect(plainElement.scrollTop).toBe(44)
    h.scrollReviewLogElement(null, { top: 44 })
    expect(h.formatReviewLogSummary(null)).toBe("0 turns · 0 entries")
    expect(h.formatReviewLogSummary([])).toBe("0 turns · 0 entries")
    expect(h.formatReviewLogSummary([{ white: { moves: [1] }, black: null }])).toBe("1 turn · 1 entry")

    render(<h.ReviewReservePieces color="white" reserve={{ pawns: 1, knights: 0, bishops: 0, rooks: 0, queens: 0 }} />)
    expect(screen.getByLabelText("White reserve")).toBeInTheDocument()

    const onSelectMove = vi.fn()
    const moveRowsRef = { current: new Map() }
    render(
      <h.ReviewMoveRows
        gameCreatedAt="2026-01-01T00:00:00Z"
        moveRows={[{
          moveNumber: 1,
          white: { id: "w1", index: 0, color: "white", turnNumber: 1, moves: [{ timestamp: "2026-01-01T00:00:01Z" }] },
          black: null,
        }]}
        moveRowsRef={moveRowsRef}
        onSelectMove={onSelectMove}
        selectedPlyGroup={null}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "White" }))
    expect(onSelectMove).toHaveBeenCalled()
  })
})
