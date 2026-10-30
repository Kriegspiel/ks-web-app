import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import TutorMessage, { AttemptReference } from "../components/TutorMessage"
import TutorHistory from "../components/TutorHistory"
import TutorUsage from "../components/TutorUsage"
import { attemptOverlays, tutorReplayPositions } from "../components/tutorBoard"
import { overlaysForPlyGroup } from "../utils/replayOverlays"

const api = vi.hoisted(() => ({ getTutorAttempt: vi.fn(), getTutorHistory: vi.fn() }))
vi.mock("../services/api", () => api)
const fen = "8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"
function event(ply = 1, overrides = {}) { return { ply, turn: 1, color: "white", attempt: "e2e4", before_fen: fen, after_fen: fen,
  answer: { announcement: "ILLEGAL_MOVE" }, messages: ["Move attempt — Illegal move"], ...overrides } }
function mount(children) { return render(<MemoryRouter>{children}</MemoryRouter>) }
function toggle(details, open) { details.open = open; fireEvent(details, new Event("toggle")) }
beforeEach(() => { vi.resetAllMocks(); api.getTutorAttempt.mockResolvedValue({ color: "white", event: event() }); api.getTutorHistory.mockResolvedValue({ events: [event(), event(2, { color: "black", attempt: null })], next_start: null }) })
afterEach(() => { cleanup(); vi.useRealTimers() })

it("renders_safe_markdown_headings_bold_lists_moves_squares_and_attempt_ranges", async () => {
  const view = mount(<TutorMessage gameCode="ABC234" text={'# Evidence\n\n**Important**: f6, e7, Bg5–d8, e2e4, Nf3, O-O, P@e4.\n\n- Compare ABC234:10–13 and attempts 11-12.\n\n`e4`\n\n```text\nABC234:99\n```\n\n[Rules](https://kriegspiel.org/rules) [Unsafe](javascript:alert) ![image](https://bad.test/a)\n\n<script>window.pwned=true</script>'} />)
  expect(await screen.findByRole("heading", { name: "Evidence", level: 3 })).toBeInTheDocument()
  expect(screen.getByText("Important").tagName).toBe("STRONG")
  for (const square of ["f6", "e7", "Bg5–d8", "e2e4", "Nf3", "O-O", "P@e4", "e4"]) expect(screen.getByText(square).tagName).toBe("CODE")
  expect(screen.getByRole("link", { name: "attempt 10" })).toHaveAttribute("href", "/game/ABC234/review")
  expect(screen.getByRole("link", { name: "attempt 13" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Rules" })).toHaveAttribute("href", "https://kriegspiel.org/rules")
  expect(screen.getByText("Unsafe")).not.toHaveAttribute("href", expect.stringContaining("javascript:"))
  expect(view.container.querySelector("img, script")).toBeNull()
  view.rerender(<MemoryRouter><TutorMessage text="attempt 3 with **nothing** else." /></MemoryRouter>)
  expect(screen.getByText(/attempt 3 with/)).toBeInTheDocument()
  view.rerender(<MemoryRouter><TutorMessage text="[whole](https://example.com)\n\n[unsafe](javascript:alert)" /></MemoryRouter>)
  expect(screen.getByRole("link", { name: "whole" })).toBeInTheDocument()
  view.rerender(<MemoryRouter><TutorMessage text="e4" /></MemoryRouter>)
  expect(screen.getByText("e4").tagName).toBe("CODE")
})

it("previews_the_player_board_on_hover_and_keyboard_focus_without_repeated_requests", async () => {
  let resolve
  api.getTutorAttempt.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  mount(<AttemptReference gameCode="ABC234" attempt={10}>Attempt 10</AttemptReference>)
  const link = screen.getByRole("link")
  fireEvent.mouseEnter(link)
  expect(screen.getByRole("tooltip")).toHaveTextContent("Loading your view")
  await act(async () => resolve({ color: "black", event: event() }))
  expect(within(screen.getByRole("tooltip")).getByRole("grid", { name: "Chess board" })).toBeInTheDocument()
  expect(document.querySelector('line[marker-end="url(#board-overlay-arrow-illegal)"]')).not.toBeNull()
  fireEvent.mouseLeave(link)
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.focus(link)
  expect(screen.getByRole("tooltip")).toHaveTextContent("e2e4")
  fireEvent.keyDown(link, { key: "Tab" })
  fireEvent.keyDown(link, { key: "Escape" })
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  fireEvent.focus(link)
  fireEvent.blur(link)
  expect(api.getTutorAttempt).toHaveBeenCalledTimes(1)
  const rect = vi.spyOn(link, "getBoundingClientRect").mockReturnValue({ left: 1500, bottom: 900, top: 880 })
  fireEvent.focus(link)
  expect(screen.getByRole("tooltip")).toHaveStyle({ top: "442px" })
  rect.mockRestore()
})

it("shortens_only_current_game_attempt_references_and_preserves_cross_game_links_ranges_and_previews", async () => {
  const text = "Compare ABC234:53–54, attempts 55-56, and BCD234:7–8. [My explanation](/game/ABC234/review?attempt=9). `ABC234:99`."
  const view = mount(<TutorMessage gameCode="ABC234" text={text} />)
  const same = await screen.findByRole("link", { name: "attempt 53" })
  expect(same).toHaveTextContent("attempt 53")
  expect(same).not.toHaveTextContent("ABC234")
  expect(same).toHaveAttribute("href", "/game/ABC234/review")
  expect(screen.getByRole("link", { name: "attempt 54" })).toHaveTextContent("54")
  expect(screen.getByRole("link", { name: "attempt 55" })).toHaveTextContent("attempt 55")
  expect(screen.getByRole("link", { name: "BCD234 · attempt 7" })).toHaveTextContent("BCD234 · attempt 7")
  expect(screen.getByRole("link", { name: "BCD234 · attempt 8" })).toHaveAttribute("href", "/game/BCD234/review")
  expect(screen.getByRole("link", { name: "attempt 9" })).toHaveTextContent("My explanation")
  expect(screen.getByText("ABC234:99").tagName).toBe("CODE")
  fireEvent.mouseEnter(same)
  expect(screen.getByRole("tooltip")).toHaveTextContent("attempt 53")
  expect(screen.getByRole("tooltip")).not.toHaveTextContent("ABC234")
  await within(screen.getByRole("tooltip")).findByRole("grid")
  expect(api.getTutorAttempt).toHaveBeenLastCalledWith("ABC234", 53)
  fireEvent.mouseLeave(same)
  fireEvent.focus(screen.getByRole("link", { name: "BCD234 · attempt 7" }))
  await within(screen.getByRole("tooltip")).findByRole("grid")
  expect(screen.getByRole("tooltip")).toHaveTextContent("BCD234 · attempt 7")
  expect(api.getTutorAttempt).toHaveBeenLastCalledWith("BCD234", 7)
  view.rerender(<MemoryRouter><TutorMessage text="ABC234:53" /></MemoryRouter>)
  expect(await screen.findByRole("link", { name: "ABC234 · attempt 53" })).toHaveTextContent("ABC234 · attempt 53")
  view.rerender(<MemoryRouter><TutorMessage gameCode="BCD234" text="ABC234:53" /></MemoryRouter>)
  expect(await screen.findByRole("link", { name: "ABC234 · attempt 53" })).toBeInTheDocument()
})

it("handles_unavailable_previews_and_hidden_opponent_and_Any_attempts", async () => {
  api.getTutorAttempt.mockRejectedValueOnce(new Error("Unavailable"))
  mount(<AttemptReference gameCode="ABC234" attempt={1}>ref</AttemptReference>)
  fireEvent.focus(screen.getByRole("link"))
  await screen.findByText(/Attempt preview unavailable/)
  cleanup()
  for (const question of [null, "ASK_ANY"]) {
    api.getTutorAttempt.mockResolvedValueOnce({ color: "white", event: event(2, { attempt: null, question }) })
    mount(<AttemptReference gameCode="ABC234" attempt={2}>ref</AttemptReference>)
    fireEvent.focus(screen.getByRole("link"))
    await screen.findByText(question ? "Any pawn captures?" : "Opponent turn — move coordinates hidden")
    expect(document.querySelector(".board-overlay-arrow")).toBeNull()
    cleanup()
  }
  expect(attemptOverlays(event(1, { attempt: "N@e4" })).badges).toEqual([{ square: "e4", label: "N", tone: "illegal" }])
  expect(attemptOverlays(event(1, { attempt: null })).arrows).toEqual([])
})

function history(props = {}) {
  const onSelect = vi.fn(), onReturn = vi.fn()
  const view = render(<TutorHistory exercise={{ exercise_id: "e1", ply: 4, color: "white" }} selectedPly={null} onSelect={onSelect} onReturn={onReturn} {...props} />)
  const details = view.container.querySelector("details")
  toggle(details, true)
  return { ...view, onSelect, onReturn, details }
}

it("groups_referee_turn_boxes_and_supports_first_previous_next_last_and_return", async () => {
  const view = history()
  await screen.findByRole("heading", { name: "Turn 1" })
  expect(screen.getByText("White")).toBeInTheDocument()
  expect(screen.getByText("Black")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "First" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 0, after_fen: fen, attempt: null }))
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 1 }))
  fireEvent.click(screen.getByRole("button", { name: "Last" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 2 }))
  fireEvent.click(screen.getByRole("button", { name: /Attempt 1/ }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 1 }))
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4 }} selectedPly={2} onSelect={view.onSelect} onReturn={view.onReturn} />)
  fireEvent.click(screen.getByRole("button", { name: "Prev" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 1 }))
  expect(screen.getByText(/Viewing attempt 2/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Return to practice" }))
  expect(view.onReturn).toHaveBeenCalled()
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4 }} selectedPly={0} onSelect={view.onSelect} onReturn={view.onReturn} />)
  expect(screen.getByText(/Starting position/)).toBeInTheDocument()
  toggle(view.details, false)
  toggle(view.details, true)
  expect(api.getTutorHistory).toHaveBeenCalledTimes(1)
})

it("handles_history_loading_errors_retry_empty_and_paginated_deduplication", async () => {
  api.getTutorHistory.mockRejectedValueOnce(new Error("History unavailable"))
  history()
  await screen.findByRole("alert")
  api.getTutorHistory.mockResolvedValueOnce({ events: [], next_start: null })
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }))
  await screen.findByText("No recorded attempts before this practice position.")
  cleanup()
  api.getTutorHistory.mockResolvedValueOnce({ events: [event()], next_start: 61 }).mockRejectedValueOnce(new Error("More unavailable"))
  history()
  await screen.findByRole("alert")
  api.getTutorHistory.mockResolvedValueOnce({ events: [event(), event(61, { turn: 31 })], next_start: null })
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }))
  await screen.findByRole("heading", { name: "Turn 31" })
  expect(screen.getAllByRole("button", { name: /Attempt 1 ·/ })).toHaveLength(1)
  expect(api.getTutorHistory).toHaveBeenLastCalledWith("e1", 61)
})

it("plays_and_pauses_history_without_model_calls_and_stops_at_the_end", async () => {
  vi.useFakeTimers()
  const view = history()
  await act(async () => {})
  fireEvent.click(screen.getByRole("button", { name: "Play replay" }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 1 }))
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4 }} selectedPly={1} onSelect={view.onSelect} onReturn={view.onReturn} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 2 }))
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4 }} selectedPly={2} onSelect={view.onSelect} onReturn={view.onReturn} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  fireEvent.click(screen.getByRole("button", { name: "Play replay" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 1 }))
  fireEvent.click(screen.getByRole("button", { name: "Pause replay" }))
  toggle(view.details, false)
})

it("uses_identical_review_overlays_and_groups_only_the_same_player_turn", () => {
  const attempts = [event(1), event(2, { attempt: "e2f4" }), event(3, { answer: { move_done: true, capture_square: "D5" } })]
  const positions = tutorReplayPositions([...attempts,
    event(4, { color: "black", attempt: "a7a5", answer: { move_done: true, capture_square: "e4" } }),
    event(5, { turn: 2, answer: { move_done: true } }), event(7, { turn: 3, answer: { move_done: true } })], "white")
  expect(positions).toHaveLength(4)
  expect(positions[0]).toMatchObject({ first_ply: 1, ply: 3, before_fen: fen, after_fen: fen })
  expect(positions[0].overlays).toEqual(overlaysForPlyGroup({ moves: attempts.map((item) => ({ uci: item.attempt, move_done: item.answer.move_done, answer: item.answer })) }, fen))
  expect(positions[0].overlays.badges.map((badge) => badge.label)).toEqual(["1", "2"])
  expect(positions[0].overlays.arrows.map((arrow) => arrow.tone)).toEqual(["illegal", "illegal", "success"])
  expect(positions[1].overlays).toEqual({ arrows: [], badges: [], captureSquares: ["e4"] })
  const black = tutorReplayPositions([event(1, { color: "black", attempt: "e8g8", before_fen: "4k2r/8/8/8/8/8/8/8 b k - 0 1", answer: { move_done: true } })], "black")
  expect(black[0].overlays.arrows).toHaveLength(2)
  expect(tutorReplayPositions([], "white")).toEqual([])
})

it("loads_all_pages_before_replay_and_selects_the_whole_turn_even_across_page_boundaries", async () => {
  api.getTutorHistory.mockResolvedValueOnce({ events: [event(1)], next_start: 2 })
    .mockResolvedValueOnce({ events: [event(1), event(2, { answer: { move_done: true } })], next_start: null })
  const view = history()
  const firstAttempt = await screen.findByRole("button", { name: /Attempt 1/ })
  expect(api.getTutorHistory).toHaveBeenCalledTimes(2)
  expect(api.getTutorHistory).toHaveBeenLastCalledWith("e1", 2)
  fireEvent.click(firstAttempt)
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ first_ply: 1, ply: 2 }))
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4, color: "white" }} selectedPly={2} onSelect={view.onSelect} onReturn={view.onReturn} />)
  expect(screen.getByText(/Viewing attempts 1–2/)).toBeInTheDocument()
  for (const button of screen.getAllByRole("button", { name: /Attempt [12]/ })) expect(button).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: "First" }))
  expect(view.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ ply: 0, overlays: { arrows: [], badges: [], captureSquares: [] } }))
  view.rerender(<TutorHistory exercise={{ exercise_id: "e1", ply: 4, color: "white" }} selectedPly={99} onSelect={view.onSelect} onReturn={view.onReturn} />)
  expect(screen.getByText(/Viewing attempt 99/)).toBeInTheDocument()
})

it.each(["resolve", "reject"])("stops_history_loading_after_unmount_with_late_%s", async (outcome) => {
  let finish
  api.getTutorHistory.mockReturnValueOnce(new Promise((resolve, reject) => { finish = outcome === "resolve" ? resolve : reject }))
  const view = history()
  expect(screen.getByRole("status")).toHaveTextContent("Loading referee history")
  view.unmount()
  await act(async () => finish(outcome === "resolve" ? { events: [event()], next_start: 61 } : new Error("Late failure")))
  expect(api.getTutorHistory).toHaveBeenCalledTimes(1)
})

it("shows_session_and_request_usage_with_honest_unknown_and_legacy_warnings", () => {
  const usage = { total_tokens: 1100, api_equivalent_usd: .003, requests: 2, input_tokens: 1000, output_tokens: 100,
    cached_input_tokens: 500, cache_write_tokens: 0, reasoning_tokens: 50, unknown_requests: 1, legacy_input_tokens: 20,
    legacy_output_tokens: 10, incomplete_cache_requests: 1, incomplete_reasoning_requests: 1, pricing_source: "https://developers.openai.com/api/docs/pricing", pricing_version: "snapshot" }
  const view = render(<TutorUsage session={{ usage, usage_events: [{ ...usage, call_id: "c1", status: "completed", reported: true, started_at: "today", duration_ms: 100,
    api_equivalent_nanodollars: 3000000 }, { call_id: "c2", status: "interrupted", reported: false }] }} />)
  expect(screen.getByText(/Session usage/)).toHaveTextContent("1,100 tokens · ≈$0.003000")
  expect(screen.getByText(/unknown does not mean free/)).toBeInTheDocument()
  expect(screen.getByText(/Earlier token totals/)).toBeInTheDocument()
  expect(screen.getByText(/Some cache details/)).toBeInTheDocument()
  expect(screen.getByText(/Some reasoning details/)).toBeInTheDocument()
  expect(screen.getByText(/Input 1,000 · cached 500/)).toBeInTheDocument()
  view.rerender(<TutorUsage session={{ usage: { ...usage, unknown_requests: 0, legacy_input_tokens: 0, legacy_output_tokens: 0, incomplete_cache_requests: 0, incomplete_reasoning_requests: 0 }, usage_events: [] }} />)
  expect(screen.queryByText(/unknown does not mean free/)).not.toBeInTheDocument()
  view.rerender(<TutorUsage session={{}} />)
  expect(view.container).toBeEmptyDOMElement()
})
