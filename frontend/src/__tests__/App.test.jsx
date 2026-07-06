import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppProviders, AppRoutes } from "../App"
import { TEST_VERSION_STAMP } from "../version"

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  playAsGuest: vi.fn(),
  convertGuest: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  createGame: vi.fn(),
  joinGame: vi.fn(),
  getOpenGames: vi.fn(),
  getMyActiveGames: vi.fn(),
  getMyArchivedGames: vi.fn(),
  getGame: vi.fn(),
  getGameState: vi.fn(),
  deleteWaitingGame: vi.fn(),
  submitMove: vi.fn(),
  askAny: vi.fn(),
  resignGame: vi.fn(),
  createGameEventsSource: vi.fn(() => null),
  recordCampaignVisit: vi.fn(),
  userApi: {
    getGameHistory: vi.fn(),
  },
  techApi: {
    getAcquisitionReport: vi.fn(),
    getBotMatrixReport: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  Object.entries(mockApi).forEach(([, value]) => {
    if (typeof value?.mockReset === "function") {
      value.mockReset()
    }
  })
  mockApi.getOpenGames.mockResolvedValue({ games: [] })
  mockApi.getMyActiveGames.mockResolvedValue({ games: [] })
  mockApi.getMyArchivedGames.mockResolvedValue({ games: [] })
  mockApi.recordCampaignVisit.mockResolvedValue({ attribution_id: "attr" })
  window.sessionStorage.clear()
  mockApi.getGame.mockResolvedValue({ state: "waiting" })
  mockApi.userApi.getGameHistory.mockReset()
  mockApi.userApi.getGameHistory.mockResolvedValue({ games: [] })
  mockApi.techApi.getAcquisitionReport.mockReset()
  mockApi.techApi.getAcquisitionReport.mockResolvedValue({ rows: [] })
  mockApi.techApi.getBotMatrixReport.mockReset()
  mockApi.techApi.getBotMatrixReport.mockResolvedValue({
    players: [{ username: "llm_haiku", name: "LLM Haiku (bot)" }],
    matrix_rows: [
      {
        player: { username: "llm_haiku", name: "LLM Haiku (bot)" },
        cells: [{ opponent: { username: "llm_haiku", name: "LLM Haiku (bot)" }, summary: null }],
        average: { games: 0, record: "0-0-0", average_plies: null },
      },
    ],
    end_condition_rows: [],
    total_rows: { all: [], humans: [], bots: [] },
    unique_game_count: 27350,
    row_record_count: 54700,
  })
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
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Login" }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("link", { name: "Register" }).length).toBeGreaterThan(0)
  })

  it("captures_utm_params_from_the_initial_route", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/login?utm_source=reddit&utm_medium=post&utm_campaign=ruleset-default")

    await screen.findByRole("heading", { name: "Login" })
    await waitFor(() => {
      expect(mockApi.recordCampaignVisit).toHaveBeenCalledWith({
        landing_path: "/auth/login?utm_source=reddit&utm_medium=post&utm_campaign=ruleset-default",
        referrer_host: null,
        utm: {
          source: "reddit",
          medium: "post",
          campaign: "ruleset-default",
        },
      })
    })
  })

  it("redirects_protected_lobby_route_to_login_when_unauthenticated", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/lobby")

    await screen.findByRole("heading", { name: "Login" })
  })

  it("redirects_tech_route_to_login_when_unauthenticated", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/tech")

    await screen.findByRole("heading", { name: "Login" })
  })

  it("hides_tech_route_for_authenticated_non_operator", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "playerone", can_view_tech_reports: false })

    renderRoute("/tech")

    await screen.findByText("Tech reports are private.")
    expect(screen.queryByRole("link", { name: "Bots report" })).not.toBeInTheDocument()
  })

  it("renders_tech_route_for_authorized_operator", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil", can_view_tech_reports: true })

    renderRoute("/tech")

    await screen.findByRole("heading", { name: "Tech" })
    expect(screen.getByRole("link", { name: /Bots report/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Bots' matrix/ })).toBeInTheDocument()
  })

  it("renders_bot_matrix_report_for_authorized_operator", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil", can_view_tech_reports: true })

    renderRoute("/tech/bot-matrix")

    await screen.findByRole("heading", { name: "Bots' matrix" })
    const haikuLinks = await screen.findAllByRole("link", { name: "LLM Haiku (bot)" })
    expect(haikuLinks[0]).toHaveAttribute("href", "/user/llm_haiku")
  })

  it("redirects_authenticated_user_away_from_login", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Lobby" })
    expect(screen.getAllByText(/signed in as fil/i).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText("Profile"))
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()
  })

  it("uses_the_lobby_as_the_authenticated_app_home", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })

    renderRoute("/")

    await screen.findByRole("heading", { name: "Lobby" })
    expect(screen.getByRole("link", { name: "Lobby" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument()
  })

  it("shows_inline_validation_message_for_empty_register_form", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/register")

    expect(await screen.findByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Register" }))
    await screen.findByText("Username is required.")
    expect(mockApi.register).not.toHaveBeenCalled()
  })

  it("register_requires_username_email_password_and_redirects_to_lobby", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
    mockApi.register.mockResolvedValueOnce({ user_id: "u-1" })
    mockApi.me.mockResolvedValueOnce({ username: "new_user", email: "new@example.com" })

    renderRoute("/auth/register")

    const username = await screen.findByLabelText("Username")
    const email = screen.getByLabelText("Email")
    const password = screen.getByLabelText("Password")

    fireEvent.change(username, { target: { value: "new_user" } })
    fireEvent.change(email, { target: { value: "new@example.com" } })
    fireEvent.change(password, { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    await waitFor(() => {
      expect(mockApi.register).toHaveBeenCalledWith({
        username: "new_user",
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
    expect(screen.getByText(/Signed in as fil\./i)).toBeInTheDocument()
  })

  it("starts_guest_play_from_login_and_enters_the_lobby", async () => {
    mockApi.me
      .mockRejectedValueOnce({ status: 401, message: "Unauthorized" })
      .mockResolvedValueOnce({ username: "guest_adolf_adams", is_guest: true })
    mockApi.playAsGuest.mockResolvedValueOnce({ username: "guest_adolf_adams" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Login" })
    fireEvent.click(screen.getByRole("button", { name: "Play as guest" }))

    await screen.findByRole("heading", { name: "Lobby" })
    expect(mockApi.playAsGuest).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/signed in as guest_adolf_adams/i).length).toBeGreaterThan(0)
  })

  it("logs_out_from_header_and_returns_to_login", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })
    mockApi.logout.mockResolvedValueOnce({})

    renderRoute("/lobby")

    await screen.findByRole("heading", { name: "Lobby" })
    fireEvent.click(screen.getByText("Profile"))
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


  it("renders_shared_footer_links_on_auth_pages", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Login" })
    expect(screen.getByRole("heading", { name: "Game" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Rules" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Communication" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Policy" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Development" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Social" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Cincinnati" })).toHaveAttribute("href", "https://kriegspiel.org/rules/cincinnati")
    const randLink = screen.queryByRole("link", { name: "RAND" })
    if (randLink) {
      expect(randLink).toHaveAttribute("href", "https://kriegspiel.org/rules/rand")
    }
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "https://kriegspiel.org/rules/english")
    expect(screen.getByRole("link", { name: "CrazyKrieg" })).toHaveAttribute("href", "https://kriegspiel.org/rules/crazykrieg")
    expect(screen.getByRole("link", { name: "any@kriegspiel.org" })).toHaveAttribute("href", "mailto:any@kriegspiel.org")
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
