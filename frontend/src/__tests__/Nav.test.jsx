import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import AppHeader from "../components/AppHeader"
import { ThemeProvider } from "../context/ThemeContext"

const mockAuth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null,
  actionLoading: false,
  logout: vi.fn(),
}))

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

beforeEach(() => {
  cleanup()
  mockAuth.isAuthenticated = false
  mockAuth.user = null
  mockAuth.actionLoading = false
  mockAuth.logout.mockReset()
  window.localStorage.clear()
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("Nav", () => {
  it("keeps_the_table_offset_in_sync_with_the_rendered_header_height", () => {
    let height = 65.8
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height }))
    let notifyResize
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback) {
        notifyResize = callback
      }
      observe = observe
      disconnect = disconnect
    })

    const { container, unmount } = render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(container.style.getPropertyValue("--app-header-height")).toBe("65.8px")
    expect(observe).toHaveBeenCalledWith(screen.getByRole("banner"), { box: "border-box" })

    // Wrapping, font changes and sign-in can resize navigation without a window resize.
    height = 118.5
    notifyResize()
    expect(container.style.getPropertyValue("--app-header-height")).toBe("118.5px")
    height = 65.8
    notifyResize()
    expect(container.style.getPropertyValue("--app-header-height")).toBe("65.8px")

    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(container.style.getPropertyValue("--app-header-height")).toBe("")
    fireEvent(window, new Event("resize"))
    expect(container.style.getPropertyValue("--app-header-height")).toBe("")
  })

  it("measures_on_window_resize_when_resize_observer_is_unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined)
    let height = 65
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ height }))
    const { container, unmount } = render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(container.style.getPropertyValue("--app-header-height")).toBe("65px")
    height = 120
    fireEvent(window, new Event("resize"))
    expect(container.style.getPropertyValue("--app-header-height")).toBe("120px")
    unmount()
    expect(container.style.getPropertyValue("--app-header-height")).toBe("")
  })

  it("shows_guest_nav_links", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("link", { name: "Kriegspiel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /toggle color theme/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Lobby" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument()
    expect(screen.queryByText("Profile")).not.toBeInTheDocument()
  })

  it("shows_authenticated_lobby_and_profile_menu_without_header_clutter", () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("link", { name: "Lobby" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Profile"))

    expect(screen.getByRole("link", { name: "User" })).toHaveAttribute("href", "/user/fil")
    expect(screen.getByRole("link", { name: "Subscription" })).toHaveAttribute("href", "/subscription")
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument()
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/active game/i)).not.toBeInTheDocument()
  })

  it("dismisses_the_profile_menu_after_outside_and_menu_clicks", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const trigger = screen.getByText("Profile")
    const menu = trigger.closest("details")
    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    expect(screen.getByRole("link", { name: "User" })).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByRole("link", { name: "User" }))
    fireEvent.keyDown(document, { key: "Enter" })
    expect(menu).toHaveAttribute("open")

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    const userLink = screen.getByRole("link", { name: "User" })
    fireEvent.click(userLink)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    const reopenedUserLink = screen.getByRole("link", { name: "User" })
    const panel = reopenedUserLink.parentElement
    fireEvent.click(panel)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    fireEvent.click(screen.getByRole("button", { name: "Logout" }))
    expect(mockAuth.logout).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))
  })

  it("closes_the_profile_menu_even_when_logout_fails", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }
    mockAuth.logout.mockRejectedValueOnce(new Error("network"))

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const trigger = screen.getByText("Profile")
    const menu = trigger.closest("details")
    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))

    fireEvent.click(screen.getByRole("button", { name: "Logout" }))
    await waitFor(() => expect(mockAuth.logout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))
  })
})

describe("theme toggle", () => {
  it("defaults_to_light_even_if_system_prefers_dark", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("button", { name: /toggle color theme/i })).toHaveAttribute("aria-pressed", "false")
    expect(window.localStorage.getItem("kriegspiel-theme")).toBe("light")
  })

  it("toggles_aria_label_when_pressed", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const toggle = screen.getByRole("button", { name: /toggle color theme/i })
    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: /toggle color theme/i })).toHaveAttribute("aria-pressed", "true")
  })
})
