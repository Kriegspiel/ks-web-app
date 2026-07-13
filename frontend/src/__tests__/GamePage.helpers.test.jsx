import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { __gamePageInternals as h } from "../pages/GamePage.jsx"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GamePage helper functions", () => {
  it("normalizes referee messages and current-message summaries", () => {
    expect(h.normalizeLogColor(null)).toBeNull()
    expect(h.normalizeLogColor(" white ")).toBe("white")
    expect(h.normalizeLogColor("Black")).toBe("black")
    expect(h.hasAuthoritativeStateAdvancedSinceSubmit(null, {}, "g")).toBe(false)
    expect(h.hasAuthoritativeStateAdvancedSinceSubmit({ gameRef: "g", state: "active", turn: "white", moveNumber: 1 }, { __gameRef: "g", state: "completed", turn: "white", move_number: 1 }, "g")).toBe(true)
    expect(h.hasAuthoritativeStateAdvancedSinceSubmit({ gameRef: "g", turn: "white", moveNumber: 1 }, { __gameRef: "g", turn: "black", move_number: 1 }, "g")).toBe(true)
    expect(h.hasAuthoritativeStateAdvancedSinceSubmit({ gameRef: "g", turn: "white", moveNumber: 1 }, { __gameRef: "g", turn: "white", move_number: 2 }, "g")).toBe(true)
    expect(h.hasAuthoritativeStateAdvancedSinceSubmit({ gameRef: "g", turn: null, moveNumber: null }, { __gameRef: "g", turn: null, move_number: null }, "g")).toBe(false)

    expect(h.allowedBoardMoveForBase(null, "e2e4")).toBe("")
    expect(h.allowedBoardMoveForBase(["e2e4", "e7e8q", 7], "")).toBe("")
    expect(h.allowedBoardMoveForBase(["e2e4", "e7e8q", 7], "a2a4")).toBe("")
    expect(h.allowedBoardMoveForBase(["e2e4", "e7e8q", 7], "e7e8")).toBe("e7e8q")
    expect(h.formatCaptureSquare(" z9 ")).toBe("")
    expect(h.formatCaptureSquare(" c3 ")).toBe("C3")
    expect(h.getRefereeCode("")).toBeNull()
    expect(h.getRefereeCode("3")).toBe("3")
    expect(h.getRefereeCode("03")).toBe(3)
    expect(h.getRefereeCode("99")).toBeNull()
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTrySquares: ["bad"] })).toBe("No pawn captures")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTrySquares: ["a2"] })).toBe("Pawn try from A2")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTrySquares: ["a2", "b3"] })).toBe("Pawn tries from A2, B3")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTries: 0 })).toBe("No pawn captures")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTries: 1 })).toBe("1 pawn try")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnPawnTries: 2 })).toBe("2 pawn tries")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnHasPawnCapture: true })).toBe("Has pawn capture")
    expect(h.formatNextTurnPawnAnnouncementData({ nextTurnHasPawnCapture: false })).toBe("No pawn captures")
    expect(h.formatNextTurnPawnAnnouncementData({})).toBe("")
    expect(h.formatRefereeCode("missing", "")).toBe("")
    expect(h.formatRefereeCode(3, "E5", "knight")).toBe("Knight captured at E5")
    expect(h.formatRefereeCode(3, "E5", 7)).toBe("Capture at E5")
    expect(h.formatRefereeCode(3, "", "", true)).toBe("En passant capture")
    expect(h.formatDroppedPieceAnnouncement(null)).toBe("")
    expect(h.formatDroppedPieceAnnouncement("x")).toBe("")
    expect(h.formatDroppedPieceAnnouncement("q")).toBe("Queen dropped")

    expect(h.getLogEntryTexts(null)).toEqual([])
    expect(h.getLogEntryTexts({
      announcement: {
        main: "CAPTURE_DONE",
        capture_square: "d5",
        captured_piece_announcement: "pawn",
        next_turn_pawn_try_squares: ["e4", "bad"],
        dropped_piece_announcement: "n",
        promotion_announced: true,
        nested: ["CHECK_FILE"],
      },
      next_turn_pawn_try_squares: ["e4"],
    })).toEqual(["Pawn captured at D5", "Pawn try from E4", "Knight dropped", "Promotion", "Check on file"])
    expect(h.getLogEntryTexts({ next_turn_pawn_tries: 1 })).toEqual(["1 pawn try"])
    expect(h.getLogEntryTexts({ answer: { main: "REGULAR_MOVE", next_turn_has_pawn_capture: null } })).toEqual(["Move complete"])
    expect(h.getLogEntryColor(null, 0)).toBe("white")
    expect(h.getLogEntryColor(null, 1)).toBe("black")
    expect(h.getLogEntryColor({ text: "white moved" }, 1)).toBe("white")
    expect(h.getLogEntryColor({ text: "black moved" }, 0)).toBe("black")
    expect(h.getLogEntryColor({ text: "neutral" }, 1)).toBe("black")
    expect(h.getLogEntryTurn(null, 9)).toBe(9)
    expect(h.getLogEntryTurn({ ply: 3 }, 1)).toBe(2)

    expect(h.splitRefereeTextParts(null)).toEqual([])
    expect(h.splitRefereeTextParts("Move attempt — Capture done at e4 · Knight captured at f6")).toEqual(["Capture at e4", "Knight captured at f6"])
    expect(h.splitCurrentMessageParts(null)).toEqual([])
    expect(h.normalizeCurrentMessagePart(null)).toBeNull()
    expect(h.normalizeCurrentMessagePart("")).toBeNull()
    expect(h.normalizeCurrentMessagePart("White to move")).toBeNull()
    expect(h.normalizeCurrentMessagePart("nonsense")).toBeNull()
    expect(h.normalizeCurrentMessagePart("2 pawn tries")).toMatchObject({ text: "2 pawn tries" })
    expect(h.normalizeCurrentMessagePart("Pawn tries from A2, B3")).toMatchObject({ text: "pawn tries from a2, b3" })
    expect(h.normalizeCurrentMessagePart("Queen captured at h8")).toMatchObject({ text: "capture h8" })
    expect(h.normalizeCurrentMessagePart("Pawn captured")).toMatchObject({ text: "capture" })
    expect(h.normalizeCurrentMessagePart("Capture")).toMatchObject({ text: "capture" })
    expect(h.normalizeCurrentMessagePart("Bishop dropped")).toMatchObject({ text: "bishop dropped" })
    expect(h.normalizeCurrentMessagePart("Promotion")).toMatchObject({ text: "promotion" })
    expect(h.normalizeCurrentMessagePart("long-diagonal check")).toMatchObject({ text: "check on long diagonal" })
    expect(h.normalizeCurrentMessagePart("custom note")).toMatchObject({ text: "custom note" })
    expect(h.summarizeCurrentMessageParts("bad")).toEqual([])
    expect(h.summarizeCurrentMessageParts(["custom note", "custom note"])).toEqual(["custom note"])
    expect(h.summarizeCurrentMessageSideEntries([{}])).toEqual([])
    expect(h.summarizeCurrentMessageSideEntries(["Illegal move"])).toEqual(["illegal move"])
    expect(h.summarizeCurrentMessageSideEntries(["Move complete", "check on file", "custom note"])).toEqual(["move complete", "check on file", "custom note"])
    expect(h.summarizeCurrentMessageSideEntries([{ text: "Has pawn captures" }, "Move complete", { messages: ["Queen captured at h8"] }])).toEqual(["move complete", "capture h8"])
    expect(h.buildCurrentMessageHistorySegments(null)).toEqual([])
    expect(h.buildCurrentMessageHistorySegments([{ white: ["Move complete"], black: ["Illegal move"] }])).toHaveLength(2)
    expect(h.buildCurrentMessageSegments({
      turns: [{ turn: 1, white: [{ text: "Has pawn captures" }], black: [] }],
      turnColor: "white",
      yourColor: "white",
      canMove: true,
      waitingForOpponent: false,
    }).at(-1).text).toBe("has pawn captures, your move")
    expect(h.buildCurrentMessageSegments({
      turns: [],
      turnColor: "black",
      yourColor: "white",
      canMove: false,
      waitingForOpponent: true,
      actionError: "Illegal move. Try again.",
    }).at(-1).text).toBe("illegal move")
    expect(h.formatCurrentMessageAccessibleText(null)).toBe("")
    expect(h.formatCurrentMessageAccessibleText([{ color: "black", text: "move complete" }])).toBe("Black: move complete")
  })

  it("normalizes referee-log structures and capture tracking", () => {
    expect(h.flattenGroupedRefereeEntries(null)).toEqual([])
    expect(h.flattenGroupedRefereeEntries([{ turn: 1, white: "bad" }])).toEqual([])
    expect(h.flattenGroupedRefereeEntries([{ turn: 2, white: ["Move complete"], black: [{ messages: ["Capture at D5"] }] }])).toHaveLength(2)
    expect(h.flattenGroupedRefereeEntries([{ turn: Number.NaN, white: [{ text: "" }], black: ["Move complete"] }]).at(-1)).toMatchObject({
      color: "black",
      messages: ["Move complete"],
    })
    expect(h.refereeEntryCompletesTurn({ messages: ["Move complete"] })).toBe(true)
    expect(h.refereeEntryCompletesTurn({ messages: ["Illegal move"] })).toBe(false)
    expect(h.refereeEntryCompletesTurn({})).toBe(false)
    expect(h.formatRefereeEntryText({ messages: [null], moveUci: "e2e4" })).toBe("")
    expect(h.formatRefereeEntryText({ messages: "Move complete", moveUci: "e2e4" })).toBe("")
    expect(h.formatRefereeEntryText({ messages: ["Move attempt — Move complete"], moveUci: "e2e4" })).toBe("[e2e4] Move complete")
    expect(h.formatRefereeEntryText({ messages: ["Move complete"], moveUci: "" })).toBe("Move complete")
    expect(h.formatRefereeEntryText({ messages: ["Plain note"], moveUci: "" })).toBe("Plain note")
    expect(h.getCaptureSquareFromTexts(null)).toBe("")
    expect(h.getCaptureSquareFromTexts([null, "Move complete"])).toBe("")
    expect(h.getCaptureSquareFromTexts(["Pawn captured at e4"])).toBe("E4")
    expect(h.getEntryCaptureSquare({ capture_square: "a1" })).toBe("A1")
    expect(h.normalizeAnnouncementItem(null)).toBeNull()
    expect(h.normalizeAnnouncementItem("   ")).toBeNull()
    expect(h.normalizeAnnouncementItem({ text: "" })).toBeNull()
    expect(h.normalizeAnnouncementItem("Move attempt — Capture done at e4")).toMatchObject({ captureSquare: "E4" })
    expect(h.normalizeAnnouncementItem({ message: "raw", main: "REGULAR_MOVE" })).toMatchObject({ text: "raw" })
    expect(h.normalizeAnnouncementItem({ prompt: "Ask any pawn captures", messages: ["Has pawn captures"] })).toMatchObject({ prompt: "Ask any pawn captures" })
    expect(h.normalizeScoresheetTurnEntry(null)).toBeNull()
    expect(h.normalizeScoresheetTurnEntry({ message: "Move complete" })).toMatchObject({ text: "Move complete" })
    expect(h.normalizeScoresheetTurnEntry({ move: { move: "E2E4" }, answer: { main: "REGULAR_MOVE" } }, "own")).toMatchObject({ moveUci: "e2e4" })
    expect(h.normalizeScoresheetTurnEntry({ question: { move: "E2E4" }, response: { main: "REGULAR_MOVE" } }, "own")).toMatchObject({ moveUci: "e2e4" })
    expect(h.normalizeScoresheetTurnEntry({ prompt: "Ask any pawn captures", result: { main: "REGULAR_MOVE" } }, "own")).toMatchObject({ prompt: "Ask any pawn captures" })
    expect(h.normalizeScoresheetTurnEntry({ 0: { move: "E2E4" }, 1: { main: "REGULAR_MOVE" } }, "own")).toMatchObject({ moveUci: "e2e4" })
    expect(h.normalizeScoresheetTurnEntry([{ move_uci: "e2e4" }, { main: "REGULAR_MOVE" }], "own")).toMatchObject({ moveUci: "e2e4" })
    expect(h.normalizeScoresheetTurnEntry(["e2e4", {}], "own")).toBeNull()
    expect(h.normalizeCaptureTrackingEntry(null)).toBeNull()
    expect(h.normalizeCaptureTrackingEntry(["", { main: "CAPTURE_DONE", capture_square: "c6" }])).toMatchObject({ captureSquare: "C6" })
    expect(h.normalizeCaptureTrackingEntry({ answer: { main: "CAPTURE_DONE", capture_square: "e4" } })).toMatchObject({ captureSquare: "E4" })

    const gameState = {
      your_color: "white",
      scoresheet: {
        turns: [{ turn: 2, white: [{ text: "Capture done at a1" }], black: [] }],
      },
      referee_turns: [{ turn: 1, white: [{ text: "Capture done at a1" }], black: [] }],
      referee_log: [{ turn: 3, color: "black", main: "CAPTURE_DONE", capture_square: "h8" }],
    }
    expect(h.buildVisibleRefereeLog(gameState)).toHaveLength(1)
    expect(h.getRecentCaptureSquares(gameState)).toEqual(["a1"])
    expect(h.buildScoresheetRefereeLog({
      your_color: "black",
      engine_state: { game_state: { black_scoresheet: { moves_own: [[["a7a6", { main: "REGULAR_MOVE" }]]], moves_opponent: [] } } },
    })).toHaveLength(1)
    expect(h.buildScoresheetRefereeLog({ your_color: "white", white_scoresheet: { moves_own: "bad", moves_opponent: "bad" } })).toEqual([])
    expect(h.getScoresheetTurns(null, "private_turns", "public_turns")).toEqual([])
    expect(h.getScoresheetTurns({ private_turns: [1] }, "private_turns", "public_turns")).toEqual([1])
    expect(h.getScoresheetTurns({ public_turns: [2], private_turns: [1] }, "private_turns", "public_turns")).toEqual([2])
    expect(h.getScoresheetMoveUci([{ move: "E2E4" }])).toBe("e2e4")
    expect(h.getScoresheetMoveUci({ move: "E2E4" })).toBe("e2e4")
    expect(h.getScoresheetMoveUci({ move: 7 })).toBe("")
    expect(h.normalizeTurnSideEntries("bad", () => ({ text: "Move complete" }))).toEqual([])
    expect(h.buildVisibleRefereeLog({ referee_log: [{ main: "NONSENSE" }, { color: "black", text: "Capture done at h8" }] })).toEqual([{ turn: 1, white: [], black: [{ captureSquare: "", messages: ["Capture done at h8"], text: "Capture done at h8" }] }])
    expect(h.getRecentCaptureSquaresFromTurns(null)).toEqual([])
    expect(h.getRecentCaptureSquaresFromTurns([{}])).toEqual([])
    expect(h.getRecentCaptureSquaresFromTurns([{ white: [null], black: [] }])).toEqual([])
    expect(h.getRecentCaptureSquaresFromTurns([{ white: [{ text: "Move complete" }], black: [] }])).toEqual([])
    expect(h.getRecentCaptureSquaresFromTurns([{ white: [{ text: "Capture" }], black: [] }])).toEqual([])
    expect(h.getRecentCaptureSquares({ referee_log: [null, { text: "Move complete" }] })).toEqual([])
    expect(h.getRecentCaptureSquares({ referee_log: [null, { text: "Capture" }] })).toEqual([])
    expect(h.getRecentCaptureSquares({ referee_log: [null] })).toEqual([])
    expect(h.rawEntryMessages({ answer: { main: "CAPTURE_DONE" } })).toEqual(["Capture"])
    expect(h.countRefereeTurnEntries({})).toBe(0)
    expect(h.countRefereeTurnEntries({ white: [1], black: [1, 2] })).toBe(3)
    expect(h.formatRefereeLogSummary([{ white: [] }], 0)).toBe("1 turn · 0 responses")
    expect(h.refereeLogTurnKey({}, 2)).toBe("turn-3-2")
    expect(h.summarizeCurrentMessageParts(["z note", "a note"])).toEqual(["a note", "z note"])
    expect(h.summarizeCurrentMessageSideEntries()).toEqual([])
    expect(h.summarizeCurrentMessageSideEntries("bad")).toEqual([])
  })

  it("formats game summary, move, reserve, material, and phantom helper values", () => {
    expect(h.formatUtcDateTime("")).toBe("—")
    expect(h.formatUtcDateTime("not-a-date")).toBe("—")
    expect(h.formatUtcDateTime("2026-01-02T03:04:05Z")).toBe("2026-01-02 03:04:05 UTC")
    expect(h.formatDuration("bad", "later")).toBe("—")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-01T00:00:05Z")).toBe("5s")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")).toBe("1h 0m 0s")
    expect(h.formatDuration("2026-01-01T00:00:00Z", "2026-01-02T01:02:03Z")).toBe("1d 1h 2m 3s")
    expect(h.formatResultReason(null)).toBe("")
    expect(h.formatResultReason("too_many_reversible_moves")).toBe("too many reversible moves")
    expect(h.formatResultReason("custom_reason")).toBe("custom reason")
    expect(h.formatCompletedResult(null)).toBe("Result unavailable")
    expect(h.formatCompletedResult({ winner: null, reason: "stalemate" })).toBe("Draw by stalemate")
    expect(h.formatCompletedResult({ winner: "black", reason: "" })).toBe("Black wins")
    expect(h.resultFromMoveResponse(null)).toBeNull()
    expect(h.resultFromMoveResponse({ game_over: false })).toBeNull()
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "CHECKMATE_WHITE_WINS" })).toEqual({ winner: "white", reason: "checkmate" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "CHECKMATE_BLACK_WINS" })).toEqual({ winner: "black", reason: "checkmate" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "STALEMATE_WHITE_WINS" })).toEqual({ winner: "white", reason: "stalemate" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "STALEMATE_BLACK_WINS" })).toEqual({ winner: "black", reason: "stalemate" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "DRAW_STALEMATE" })).toEqual({ winner: null, reason: "stalemate" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "DRAW_INSUFFICIENT" })).toEqual({ winner: null, reason: "insufficient" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "DRAW_TOOMANYREVERSIBLEMOVES" })).toEqual({ winner: null, reason: "too_many_reversible_moves" })
    expect(h.resultFromMoveResponse({ game_over: true, special_announcement: "UNKNOWN" })).toBeNull()
    expect(h.formatViewerOutcome(null, "white")).toBe("Game finished")
    expect(h.formatViewerOutcome({ winner: null, reason: "" }, "white")).toBe("Draw")
    expect(h.formatViewerOutcome({ winner: null, reason: "stalemate" }, "white")).toBe("Draw by stalemate")
    expect(h.formatViewerOutcome({ winner: "white", reason: "checkmate" }, "white")).toBe("You won by checkmate")
    expect(h.formatViewerOutcome({ winner: "white", reason: "" }, "white")).toBe("You won")
    expect(h.formatViewerOutcome({ winner: "black", reason: "timeout" }, "white")).toBe("You lost by timeout")
    expect(h.formatViewerOutcome({ winner: "black", reason: "" }, "white")).toBe("You lost")
    expect(h.formatRatingTransition(null, null)).toBe("—")
    expect(h.formatRatingTransition(null, 1200)).toBe("1200")
    expect(h.formatRatingTransition(1200, 1190)).toBe("1200 → 1190 (-10)")

    const fen = "8/4P3/8/8/8/8/4p3/4K3 w - - 0 1"
    expect(h.pieceAtSquare("", "e7")).toBe("")
    expect(h.pieceAtSquare("bad", "e7")).toBe("")
    expect(h.pieceAtSquare(fen, "z9")).toBe("")
    expect(h.pieceAtSquare(fen, "e7")).toBe("P")
    expect(h.isPromotionCandidate({ fen, fromSquare: "", toSquare: "e8", color: "white" })).toBe(false)
    expect(h.isPromotionCandidate({ fen, fromSquare: "a1", toSquare: "a8", color: "white" })).toBe(false)
    expect(h.isPromotionCandidate({ fen: "8/8/8/8/8/8/8/4K3 w - - 0 1", fromSquare: "e1", toSquare: "e8", color: "white" })).toBe(false)
    expect(h.isPromotionCandidate({ fen, fromSquare: "e7", toSquare: "e8", color: "white" })).toBe(true)
    expect(h.isPromotionCandidate({ fen, fromSquare: "e2", toSquare: "e1", color: "black" })).toBe(true)
    expect(h.isTouchLikePointer({ pointerType: "pen" })).toBe(true)
    expect(h.isPrimaryPointerButton({ pointerType: "touch", button: -1 })).toBe(true)
    expect(h.squareHasOwnPiece(fen, "e7", "white")).toBe(true)
    expect(h.getAllowedMoveSources(null)).toEqual([])
    expect(h.getAllowedMoveSources(["e2e4", "bad", 3, "e2e3"])).toEqual(["e2"])
    expect(h.normalizeDropMove(null)).toBeNull()
    expect(h.normalizeDropMove("q@h8")).toEqual({ piece: "Q", square: "h8" })
    expect(h.getMoveHighlightSquares(null)).toEqual([])
    expect(h.getMoveHighlightSquares("q@h8")).toEqual(["h8"])
    expect(h.getMoveHighlightSquares("e2e4q")).toEqual(["e2", "e4"])
    expect(h.getDropTargetsByPiece(null).Q).toEqual([])
    expect(h.getDropTargetsByPiece(["q@h8", "q@h8", "n@a1"]).Q).toEqual(["h8"])
    expect(h.normalizeReserveSideSummary(null)).toEqual({ pawns: 0, knights: 0, bishops: 0, rooks: 0, queens: 0 })
    expect(h.getReserveStatus({ reserve_summary: { white: { pawns: "2" }, black: { queens: "-1" } } }).white.pawns).toBe(2)
    expect(h.reserveCountForPiece({}, "X")).toBe(0)
    expect(h.normalizeAllowedMoves(null)).toEqual([])
    expect(h.getOpponentPhantomPiece(null, "white")).toBe("")
    expect(h.getOpponentPhantomPiece("q", "black")).toBe("Q")
    expect(h.countRemainingPieces(null)).toEqual({ white: 16, black: 16 })
    expect(h.countRemainingPieces([{}])).toEqual({ white: 16, black: 16 })
    expect(h.countRemainingPieces([{ white: [{ text: "Capture at e4" }], black: [{ text: "Pawn captured at d5" }] }])).toEqual({ white: 15, black: 15 })
    expect(h.normalizeRatings({ elo: "1201", ratings: { vs_humans: { elo: "1302" }, vs_bots: { elo: "bad" } } }).overall).toBe(1201)
    expect(Number.isNaN(h.normalizeRatings({ ratings: { vs_bots: { elo: "bad" } } }).vsBots)).toBe(true)
    expect(h.ratingNumber(null)).toBeNull()
    expect(h.ratingNumber("bad")).toBeNull()
    expect(h.ratingValue(Number.NaN)).toBe("—")
    expect(h.ratingValue(1200)).toBe("1200")
    expect(h.playerLabel(null)).toBe("—")
    expect(h.playerLabel({ username: "gptnano", role: "bot" })).toBe("gptnano (bot)")
    expect(h.snapshotRatingsForColor({}, "white", "before")).toEqual({ overall: null, vsHumans: null, vsBots: null })
    expect(h.snapshotRatingsForColor({ white: { elo: 1500 } }, "white", "after")).toEqual({ overall: 1500, vsHumans: null, vsBots: null })
    expect(h.snapshotRatingsForColor({
      black: { ratings: { vs_bots: { elo: 1333 }, vs_humans: { elo: 1222 } } },
      rating_snapshot: { overall: { black_after: "1444" }, specific: { black_after: "1555" }, black_track: "vs_bots" },
    }, "black", "after")).toEqual({ overall: 1444, vsHumans: 1222, vsBots: 1555 })
    expect(h.snapshotRatingsForColor({
      black: { ratings: { overall: { elo: 1400 }, vs_humans: { elo: 1200 }, vs_bots: { elo: 1100 } } },
      rating_snapshot: { overall: { black_after: "1500" }, specific: {}, black_track: "vs_bots" },
    }, "black", "after")).toEqual({ overall: 1500, vsHumans: 1200, vsBots: 1100 })
    expect(h.snapshotRatingsForColor({
      white: { ratings: { overall: { elo: 1300 }, vs_humans: { elo: 1200 }, vs_bots: { elo: 1100 } } },
      rating_snapshot: { overall: {}, specific: {}, white_track: "vs_humans" },
    }, "white", "after")).toEqual({ overall: 1300, vsHumans: 1200, vsBots: 1100 })
    expect(h.normalizeMaterialSideSummary(null)).toBeNull()
    expect(h.normalizeMaterialSideSummary({ pieces_remaining: "bad" })).toBeNull()
    expect(h.getRemainingPieceStatus({ material_summary: { white: { pieces_remaining: 12, pawns_captured: 2 }, black: { pieces_remaining: 11, pawns_captured: null } } }, [], "wild16").white.pawnsCaptured).toBe(2)
    expect(h.getRemainingPieceStatus({ material_summary: { white: { pieces_remaining: 12, pawns_captured: 2 }, black: { pieces_remaining: 11, pawns_captured: 1 } } }, [], "crazykrieg").white.pawnsCaptured).toBeNull()
    expect(h.opponentStartingPhantoms("")).toEqual({})
    expect(Object.keys(h.opponentStartingPhantoms("white"))).toContain("a7")
    expect(h.placementsEqual({ a1: "q" }, { a1: "q" })).toBe(true)
    expect(h.placementsEqual({ a1: "q" }, { a1: "n" })).toBe(false)
    expect(h.placementsEqual(null, null)).toBe(true)
    expect(h.getTurnEntryMessages({ text: "" })).toEqual([])
    expect(h.getTurnEntryMessages({ messages: [null, " Move complete "] })).toEqual([" Move complete "])
    expect(h.getTurnEntryMessages("Move attempt — Capture at e4")).toEqual(["Capture at e4"])
    expect(h.getTurnEntryMessages("Plain note")).toEqual(["Plain note"])
    expect(h.getTurnEntryMessages("Move complete")).toEqual(["Move complete"])
    expect(h.isPlayerMoveAttemptEntry({ kind: "move" })).toBe(true)
    expect(h.isPlayerMoveAttemptEntry({ kind: "capture" })).toBe(true)
    expect(h.isPlayerMoveAttemptEntry({ kind: "illegal_move" })).toBe(true)
    expect(h.isPlayerMoveAttemptEntry({ kind: "status" })).toBe(false)
    expect(h.isPlayerMoveAttemptEntry({ kind: "ask_any" })).toBe(false)
    expect(h.isPlayerMoveAttemptEntry({ question_type: "ASK_ANY" })).toBe(false)
    expect(h.isPlayerMoveAttemptEntry({ prompt: "Ask any pawn captures" })).toBe(false)
    expect(h.isPlayerMoveAttemptEntry("Opponent asked any pawn captures — status")).toBe(false)
    expect(h.isPlayerMoveAttemptEntry("No pawn captures")).toBe(false)
    expect(h.isPlayerMoveAttemptEntry({ text: "Capture at e4" })).toBe(true)
    expect(h.isPlayerMoveAttemptEntry({})).toBe(false)
    expect(h.isPlayerMoveAttemptEntry("White to move")).toBe(false)
    expect(h.hasPlayerTakenFirstTurn(null, "white")).toBe(false)
    expect(h.hasPlayerTakenFirstTurn([{ black: "bad" }], "black")).toBe(false)
    expect(h.hasPlayerTakenFirstTurn([{ white: [], black: ["Move complete"] }], "black")).toBe(true)
    expect(h.hasPlayerTakenFirstTurn([{ white: ["Move complete"], black: [] }], "white")).toBe(true)
  })

  it("handles positioning and small rendered helper components", () => {
    const squareElement = {
      getBoundingClientRect: () => ({ left: 170, right: 200, top: 30 }),
    }
    const boardRoot = {
      querySelector: (selector) => (selector === '[data-square="h8"]' ? squareElement : null),
      getBoundingClientRect: () => ({ left: 0, top: 10, width: 220, height: 220 }),
    }
    expect(h.getSquareAnchorPosition("", boardRoot)).toBeNull()
    expect(h.getSquareAnchorPosition("a1", boardRoot)).toBeNull()
    expect(h.getSquareAnchorPosition("h8", boardRoot)).toEqual({ x: 0, y: 16 })
    expect(h.buildMenuState("h8", boardRoot, true, ["q"])).toMatchObject({ square: "h8", mode: "phantom-actions", availablePieces: ["q"] })
    expect(h.buildMenuState("a1", boardRoot, false, [])).toMatchObject({ x: null, y: null, mode: "root" })

    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => { throw new Error("object scroll unsupported") })
    h.restoreViewportPosition(null)
    h.restoreViewportPosition({ x: Number.NaN, y: 5 })
    expect(document.documentElement.scrollTop).toBe(5)
    h.restoreViewportPosition({ x: 7, y: Number.NaN })
    expect(document.documentElement.scrollLeft).toBe(7)
    scrollTo.mockRestore()

    h.blurActiveInteractiveElement()
    const activeButton = document.createElement("button")
    document.body.append(activeButton)
    activeButton.focus()
    expect(document.activeElement).toBe(activeButton)
    h.blurActiveInteractiveElement()
    expect(document.activeElement).not.toBe(activeButton)
    activeButton.remove()

    const onSelectDropPiece = vi.fn()
    render(
      <h.ReservePieces
        color="black"
        reserve={{ pawns: 1, knights: 0, bishops: 0, rooks: 0, queens: 1 }}
        canDrop
        dropTargetsByPiece={{ P: ["a1"], Q: ["h8", "a1"] }}
        selectedDropPiece="P"
        onSelectDropPiece={onSelectDropPiece}
      />,
    )
    const pawnButton = screen.getByRole("button", { name: /Pawn reserve piece/ })
    expect(pawnButton).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(pawnButton)
    expect(onSelectDropPiece).toHaveBeenCalledWith("P")
    expect(screen.getByRole("button", { name: /Queen reserve piece/ })).toHaveAccessibleName(/2 legal drop squares/)
  })
})
