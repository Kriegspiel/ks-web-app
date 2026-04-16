import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  mockNavigate.mockReset()
  mockAuth.register.mockReset()
  mockAuth.clearActionError.mockReset()
  mockAuth.actionError = ""
  mockAuth.actionLoading = false
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

  it("shows_username_max_length_validation_before_submit", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "x".repeat(34) } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Username must be at most 33 characters.")).toBeInTheDocument()
    expect(mockAuth.register).not.toHaveBeenCalled()
  })

  it("shows_required_password_validation_before_submit", async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new_user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Password is required.")).toBeInTheDocument()
    expect(mockAuth.register).not.toHaveBeenCalled()
  })

  it("shows_username_taken_next_to_username_field", async () => {
    mockAuth.register.mockRejectedValue({ status: 409, code: "USERNAME_TAKEN", message: "Username already exists" })
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "taken_user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Username already exists")).toBeInTheDocument()
    expect(screen.queryByText("Email already registered")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it("shows_email_taken_next_to_email_field", async () => {
    mockAuth.register.mockRejectedValue({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" })
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new_user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "used@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Email already registered")).toBeInTheDocument()
    expect(screen.queryByText("Username already exists")).not.toBeInTheDocument()
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it("shows_generic_submission_errors_in_the_form_and_hides_context_action_errors", async () => {
    mockAuth.actionError = "Context boom"
    mockAuth.register.mockRejectedValue({ message: "Server exploded" })

    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new_user" } })
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Register" }))

    expect(await screen.findByText("Server exploded")).toBeInTheDocument()
    expect(screen.queryByText("Context boom")).not.toBeInTheDocument()
  })

  it("shows_context_action_errors_when_there_is_no_submission_error", () => {
    mockAuth.actionError = "Context boom"

    render(<MemoryRouter><RegisterPage /></MemoryRouter>)

    expect(screen.getByRole("alert")).toHaveTextContent("Context boom")
  })
})
