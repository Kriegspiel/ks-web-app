import { afterEach, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { AppRoutes } from "../App"

const lobbyLoad = vi.hoisted(() => {
  let release
  const promise = new Promise((resolve) => { release = resolve })
  return { promise, release }
})
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({
  isAuthenticated: true, bootstrapping: false,
  user: { username: "player", can_view_tech_reports: true, can_use_tutor: true },
}) }))
vi.mock("../components/AppHeader", () => ({ default: () => <header>Persistent header</header> }))
vi.mock("../components/AppFooter", () => ({ default: () => <footer>Persistent footer</footer> }))
vi.mock("../components/AttributionCapture", () => ({ default: () => null }))
vi.mock("../pages/LobbyPage", async () => {
  await lobbyLoad.promise
  return { default: () => "Lobby view" }
})
vi.mock("../pages/GamePage", () => ({ default: () => "Game view" }))
vi.mock("../pages/Review", () => ({ default: () => "Review view" }))
vi.mock("../pages/TutorReview", () => ({ default: () => "Tutor view" }))
vi.mock("../pages/Profile", () => ({ default: () => "Profile view" }))
vi.mock("../pages/GameHistory", () => ({ default: () => "History view" }))
vi.mock("../pages/Leaderboard", () => ({ default: () => "Leaderboard view" }))
vi.mock("../pages/AcquisitionReport", () => ({ default: () => "Acquisition view" }))
vi.mock("../pages/BotMatrixReport", () => ({ default: () => "Matrix view" }))
vi.mock("../pages/BotsReport", () => ({ default: () => "Bots view" }))
vi.mock("../pages/GuestsReport", () => ({ default: () => "Guests view" }))
vi.mock("../pages/TechIndex", () => ({ default: () => "Tech view" }))
vi.mock("../pages/UsersReport", () => ({ default: () => "Users view" }))
vi.mock("../pages/Settings", () => ({ default: () => "Settings view" }))
vi.mock("../pages/Subscription", () => ({ default: () => "Subscription view" }))

afterEach(cleanup)
function open(path) {
  render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)
}

it("keeps the shell visible while a route chunk is loading", async () => {
  open("/lobby")
  expect(screen.getByRole("status")).toHaveTextContent("Loading page…")
  expect(screen.getByText("Persistent header")).toBeVisible()
  expect(screen.getByText("Persistent footer")).toBeVisible()
  await act(async () => { lobbyLoad.release() })
  expect(await screen.findByText("Lobby view")).toBeVisible()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it.each([
  ["/", "Lobby view"],
  ["/game/ABC123", "Game view"],
  ["/game/ABC123/review", "Review view"],
  ["/game/ABC123/review/tutor", "Tutor view"],
  ["/user/player", "Profile view"],
  ["/user/player/games", "History view"],
  ["/leaderboard", "Leaderboard view"],
  ["/tech/acquisition-report", "Acquisition view"],
  ["/tech/bot-matrix", "Matrix view"],
  ["/tech/bots-report", "Bots view"],
  ["/tech/guests-report", "Guests view"],
  ["/tech", "Tech view"],
  ["/tech/users-report", "Users view"],
  ["/settings", "Settings view"],
  ["/subscription", "Subscription view"],
  ["/subcription", "Subscription view"],
])("opens the correct lazy view at %s", async (path, text) => {
  open(path)
  expect(await screen.findByText(text)).toBeVisible()
})
