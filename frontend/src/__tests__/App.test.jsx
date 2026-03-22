import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppRoutes } from "../App"

function renderRoute(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe("App routes", () => {
  it("renders_home_route", () => {
    renderRoute("/")
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument()
  })

  it("renders_login_route", () => {
    renderRoute("/auth/login")
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument()
  })

  it("renders_register_route", () => {
    renderRoute("/auth/register")
    expect(screen.getByRole("heading", { name: "Register" })).toBeInTheDocument()
  })

  it("renders_lobby_route", () => {
    renderRoute("/lobby")
    expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument()
  })

  it("renders_game_route_with_param", () => {
    renderRoute("/game/test-game-id")
    expect(screen.getByRole("heading", { name: "Game" })).toBeInTheDocument()
    expect(screen.getByText(/gameId: test-game-id/i)).toBeInTheDocument()
  })
})
