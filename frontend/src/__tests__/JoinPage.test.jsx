import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import JoinPage from "../pages/JoinPage"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockApi = vi.hoisted(() => ({
  joinGame: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../services/api", () => mockApi)

function renderJoin(path = "/join/ABC123") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:gameCode" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockApi.joinGame.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("JoinPage", () => {
  it("joins_once_and_redirects_to_game", async () => {
    mockApi.joinGame.mockResolvedValue({ game_id: "game-1" })

    renderJoin()

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledTimes(1)
      expect(mockApi.joinGame).toHaveBeenCalledWith("ABC123")
      expect(mockNavigate).toHaveBeenCalledWith("/game/game-1", { replace: true })
    })
  })

  it("redirects_unauthenticated_users_to_login_with_return_path", async () => {
    mockApi.joinGame.mockRejectedValue({ status: 401 })

    renderJoin("/join/abc123?from=share#now")

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login", {
        replace: true,
        state: {
          from: {
            pathname: "/join/abc123",
            search: "?from=share",
            hash: "#now",
          },
        },
      })
    })
  })

  it("shows_not_found_error_and_lobby_link", async () => {
    mockApi.joinGame.mockRejectedValue({ status: 404 })

    renderJoin("/join/MISSING")

    expect(await screen.findByText("That join code was not found. Double-check the link and try again.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to lobby" })).toHaveAttribute("href", "/lobby")
  })

  it("shows_full_game_error", async () => {
    mockApi.joinGame.mockRejectedValue({ status: 409, code: "GAME_FULL" })

    renderJoin("/join/FULL99")

    expect(await screen.findByText("That game is already full. Start a new game from the lobby.")).toBeInTheDocument()
  })

  it("shows_generic_error_without_backend_details", async () => {
    mockApi.joinGame.mockRejectedValue({ status: 500, message: "backend stack trace" })

    renderJoin("/join/OOPS99")

    expect(await screen.findByText("We could not join that game right now. Please try again from the lobby.")).toBeInTheDocument()
    expect(screen.queryByText("backend stack trace")).not.toBeInTheDocument()
  })

  it("handles_missing_or_blank_join_code", async () => {
    renderJoin("/join/%20")

    expect(await screen.findByText("That join code is missing. Please use a valid join link.")).toBeInTheDocument()
    expect(mockApi.joinGame).not.toHaveBeenCalled()
  })
})
