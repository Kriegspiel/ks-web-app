import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppProviders, AppRoutes } from "../App"

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  createGame: vi.fn(),
  joinGame: vi.fn(),
  getOpenGames: vi.fn(),
  getMyGames: vi.fn(),
  getGame: vi.fn(),
  getGameState: vi.fn(),
  submitMove: vi.fn(),
  askAny: vi.fn(),
  resignGame: vi.fn(),
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getOpenGames.mockResolvedValue({ games: [] })
  mockApi.getMyGames.mockResolvedValue({ games: [] })
  mockApi.getGame.mockResolvedValue({ state: "waiting" })
  mockApi.getGameState.mockResolvedValue({
    game_id: "abc-123",
    state: "active",
    turn: "white",
    move_number: 1,
    your_color: "white",
    your_fen: "8/8/8/8/8/8/8/8",
    referee_log: [],
    possible_actions: ["move", "ask_any"],
    clock: { white_remaining: 600, black_remaining: 600, active_color: "white" },
  })
})

function renderRoute(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}

describe("App routes", () => {
  it("shows_guest_header_links_on_login", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Login" })
    expect(screen.getAllByRole("link", { name: "Login" }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: "Register" }).length).toBeGreaterThan(0)
  })

  it("redirects_protected_lobby_route_to_login_when_unauthenticated", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/lobby")

    await screen.findByRole("heading", { name: "Login" })
  })

  it("redirects_authenticated_user_away_from_login", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Lobby" })
    expect(screen.getAllByText(/signed in as fil/i).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()
  })

  it("shows_inline_validation_message_for_empty_register_form", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/register")

    fireEvent.click(await screen.findByRole("button", { name: "Register" }))
    await screen.findByText("Username is required.")
    expect(mockApi.register).not.toHaveBeenCalled()
  })

  it("register_requires_username_email_password_and_redirects_to_lobby", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
    mockApi.register.mockResolvedValueOnce({ user_id: "u-1" })
    mockApi.me.mockResolvedValueOnce({ username: "new-user", email: "new@example.com" })

    renderRoute("/auth/register")

    const username = await screen.findByLabelText("Username")
    const email = screen.getByLabelText("Email")
    const password = screen.getByLabelText("Password")

    fireEvent.change(username, { target: { value: "new-user" } })
    fireEvent.change(email, { target: { value: "new@example.com" } })
    fireEvent.change(password, { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    await waitFor(() => {
      expect(mockApi.register).toHaveBeenCalledWith({
        username: "new-user",
        email: "new@example.com",
        password: "secret123",
      })
    })

    await screen.findByRole("heading", { name: "Lobby" })
  })

  it("shows_actionable_error_message_on_login_failure", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
    mockApi.login.mockRejectedValueOnce({ status: 401, message: "Invalid username or password" })

    renderRoute("/auth/login")

    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "fil" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    await screen.findByText("Invalid username or password")
  })

  it("redirects_back_to_requested_game_after_login", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
    mockApi.login.mockResolvedValueOnce({ ok: true })
    mockApi.me.mockResolvedValueOnce({ username: "fil" })

    renderRoute("/game/abc-123")

    await screen.findByRole("heading", { name: "Login" })
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "fil" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    await screen.findByRole("heading", { name: "Game", level: 1 })
    expect(screen.getByText(/Game ID:/i)).toBeInTheDocument()
  })

  it("logs_out_from_header_and_returns_to_login", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })
    mockApi.logout.mockResolvedValueOnce({})

    renderRoute("/lobby")

    await screen.findByRole("heading", { name: "Lobby" })
    fireEvent.click(screen.getByRole("button", { name: "Logout" }))

    await screen.findByRole("heading", { name: "Login" })
    expect(mockApi.logout).toHaveBeenCalledTimes(1)
  })

  it("join_route_redirects_to_login_when_unauthenticated", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
    mockApi.joinGame.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/join/ABCD23")

    await screen.findByRole("heading", { name: "Login" })
  })


  it("renders_shared_footer_links", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/")

    await screen.findByRole("heading", { name: "Home" })
    expect(screen.getByRole("heading", { name: "Game" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Communication" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Policy" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Development" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Social" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "https://kriegspiel.org/leaderboard")
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "https://kriegspiel.org/about")
    expect(screen.getByRole("link", { name: "Play online" })).toHaveAttribute("href", "https://app.kriegspiel.org/")
    expect(screen.getByRole("link", { name: "hi@kriegspiel.org" })).toHaveAttribute("href", "mailto:hi@kriegspiel.org")
  })

  it("join_route_auto_joins_after_login", async () => {
    mockApi.me
      .mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
      .mockResolvedValueOnce({ username: "fil" })
    mockApi.login.mockResolvedValueOnce({ ok: true })
    mockApi.joinGame.mockResolvedValueOnce({ game_id: "join-1" })
    mockApi.getGameState.mockResolvedValue({
      game_id: "join-1",
      state: "active",
      turn: "white",
      move_number: 1,
      your_color: "white",
      your_fen: "8/8/8/8/8/8/8/8",
      referee_log: [],
      possible_actions: ["move", "ask_any"],
      clock: { white_remaining: 600, black_remaining: 600, active_color: "white" },
    })

    renderRoute("/join/ABCD23")

    await screen.findByRole("heading", { name: "Login" })
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "fil" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    await screen.findByRole("heading", { name: "Game", level: 1 })
    expect(mockApi.joinGame).toHaveBeenCalledWith("ABCD23")
  })
})
