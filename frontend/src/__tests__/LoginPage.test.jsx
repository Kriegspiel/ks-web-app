import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import LoginPage from "../pages/LoginPage"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockAuth = vi.hoisted(() => ({
  login: vi.fn(),
  actionLoading: false,
  actionError: "",
  clearActionError: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

afterEach(() => {
  cleanup()
  mockNavigate.mockReset()
  mockAuth.login.mockReset()
  mockAuth.clearActionError.mockReset()
  mockAuth.actionError = ""
  mockAuth.actionLoading = false
})

function renderPage(entry = "/auth/login") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  it("shows_username_validation_before_submit", async () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    expect(await screen.findByText("Username is required.")).toBeInTheDocument()
    expect(mockAuth.login).not.toHaveBeenCalled()
  })

  it("shows_password_validation_when_a_username_is_present", async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "fil" } })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    expect(await screen.findByText("Password is required.")).toBeInTheDocument()
    expect(mockAuth.login).not.toHaveBeenCalled()
  })

  it("renders_context_action_errors_and_clears_them_on_change", () => {
    mockAuth.actionError = "Bad login"

    renderPage()

    expect(screen.getByRole("alert")).toHaveTextContent("Bad login")

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "fil" } })
    expect(mockAuth.clearActionError).toHaveBeenCalled()
  })

  it("redirects_auth_route_return_paths_back_to_the_lobby", async () => {
    mockAuth.login.mockResolvedValue({ username: "fil" })

    renderPage({
      pathname: "/auth/login",
      state: {
        from: {
          pathname: "/auth/register",
          search: "?source=cta",
          hash: "#start",
        },
      },
    })

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: " fil " } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Login" }))

    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith({ username: "fil", password: "secret123" })
      expect(mockNavigate).toHaveBeenCalledWith("/lobby", { replace: true })
    })
  })
})
