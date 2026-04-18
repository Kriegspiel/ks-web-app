import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ReviewPage from "../pages/Review"

const mockApi = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameTranscript: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    Link: ({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useParams: () => ({ gameId: "g-620" }),
  }
})

vi.mock("../services/api", () => ({
  default: { get: vi.fn() },
  ...mockApi,
}))
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "notifil" },
  }),
}))
vi.mock("../components/ChessBoard", () => ({
  default: ({ orientation }) => <div className="chess-board" data-orientation={orientation} />,
}))
vi.mock("../components/VersionStamp", () => ({
  default: () => null,
}))

const game = {
  created_at: "2026-04-05T12:00:00Z",
  updated_at: "2026-04-05T12:03:12Z",
  result: { winner: "white", reason: "checkmate" },
  white: {
    username: "notifil",
    connected: true,
    role: "user",
    ratings: {
      overall: { elo: 1500 },
      vs_humans: { elo: 1480 },
      vs_bots: { elo: 1510 },
    },
  },
  black: {
    username: "haiku",
    connected: true,
    role: "bot",
    ratings: {
      overall: { elo: 1450 },
      vs_humans: { elo: 1440 },
      vs_bots: { elo: 1460 },
    },
  },
  rating_snapshot: {
    overall: { white_before: 1484, black_before: 1466 },
    specific: { white_before: 1494, black_before: 1450 },
    white_track: "vs_bots",
    black_track: "vs_humans",
  },
}

const transcript = {
  game_id: "g-620",
  rule_variant: "berkeley_any",
  moves: [
    {
      ply: 1,
      color: "white",
      question_type: "COMMON",
      uci: "e2e4",
      answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
      move_done: true,
      timestamp: "2026-04-05T12:00:11Z",
      replay_fen: {
        full: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 b - - 0 1",
        black: "8/8/8/8/8/8/pppppppp/rnbqkbnr b - - 0 1",
      },
    },
  ],
}

function renderReviewPage() {
  return render(
    <MemoryRouter>
      <ReviewPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockApi.getGame.mockReset()
  mockApi.getGameTranscript.mockReset()
  mockApi.getGame.mockResolvedValue(game)
})

afterEach(() => {
  cleanup()
})

describe("ReviewPage board orientation defaults", () => {
  it("shows the viewer color at the bottom for a player's own replay", async () => {
    mockApi.getGameTranscript.mockResolvedValue({
      ...transcript,
      viewer_color: "black",
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(document.querySelector(".chess-board")?.getAttribute("data-orientation")).toBe("black")
  })

  it("falls back to white-bottom for spectators", async () => {
    mockApi.getGameTranscript.mockResolvedValue({
      ...transcript,
      viewer_color: null,
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(document.querySelector(".chess-board")?.getAttribute("data-orientation")).toBe("white")
  })
})
