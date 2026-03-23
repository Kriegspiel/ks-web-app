import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppProviders, AppRoutes } from "../App"

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  mockApi.me.mockReset()
  mockApi.login.mockReset()
  mockApi.logout.mockReset()
  mockApi.register.mockReset()
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
  it("renders_login_for_unauthenticated_user", async () => {
    mockApi.me.mockRejectedValueOnce({ status: 401, message: "Unauthorized" })

    renderRoute("/auth/login")

    await screen.findByRole("heading", { name: "Login" })
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
    expect(screen.getByText(/signed in as fil/i)).toBeInTheDocument()
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

  it("logs_out_from_lobby_and_returns_to_login", async () => {
    mockApi.me.mockResolvedValueOnce({ username: "fil" })
    mockApi.logout.mockResolvedValueOnce({})

    renderRoute("/lobby")

    await screen.findByRole("heading", { name: "Lobby" })
    fireEvent.click(screen.getByRole("button", { name: "Logout" }))

    await screen.findByRole("heading", { name: "Login" })
    expect(mockApi.logout).toHaveBeenCalledTimes(1)
  })
})
