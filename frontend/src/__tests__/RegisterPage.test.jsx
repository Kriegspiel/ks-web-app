import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import RegisterPage from "../pages/RegisterPage"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockAuth = vi.hoisted(() => ({
  register: vi.fn(),
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
})

describe("RegisterPage", () => {
  it("shows_username_pattern_validation_before_submit", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new-user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Username can contain only letters, digits, and underscores.")).toBeInTheDocument()
    expect(mockAuth.register).not.toHaveBeenCalled()
  })
  it("shows_email_validation_before_submit", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newuser" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad-email" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Invalid email format.")).toBeInTheDocument()
    expect(mockAuth.register).not.toHaveBeenCalled()
  })
  it("shows_password_max_length_validation_before_submit", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new_user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x".repeat(513) } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Password must be at most 512 characters.")).toBeInTheDocument()
    expect(mockAuth.register).not.toHaveBeenCalled()
  })
})
