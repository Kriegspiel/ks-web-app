import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import SettingsPage from "../pages/Settings"

const mockApi = vi.hoisted(() => ({
  me: vi.fn(),
  userApi: {
    updateSettings: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

function deferredRequest() {
  let resolve
  let reject
  const promise = new Promise((resolveRequest, rejectRequest) => {
    resolve = resolveRequest
    reject = rejectRequest
  })
  return { promise, resolve, reject }
}

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.me.mockReset()
  mockApi.userApi.updateSettings.mockReset()
})

describe("SettingsPage", () => {
  it("loads_current_settings_and_saves_changes", async () => {
    mockApi.me.mockResolvedValueOnce({ settings: { board_theme: "default", piece_set: "cburnett", sound_enabled: true, auto_ask_any: false } })
    mockApi.userApi.updateSettings.mockResolvedValueOnce({ board_theme: "wood", piece_set: "alpha", sound_enabled: false, auto_ask_any: true })

    render(<SettingsPage />)

    await screen.findByLabelText("Board theme")
    fireEvent.change(screen.getByLabelText("Board theme"), { target: { value: "wood" } })
    fireEvent.change(screen.getByLabelText("Piece set"), { target: { value: "alpha" } })
    fireEvent.click(screen.getByLabelText("Enable sound"))
    fireEvent.click(screen.getByLabelText("Auto ask-any prompts"))
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))

    await waitFor(() => {
      expect(mockApi.userApi.updateSettings).toHaveBeenCalledWith({
        board_theme: "wood",
        piece_set: "alpha",
        sound_enabled: false,
        auto_ask_any: true,
      })
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.")
  })

  it("shows_error_when_save_fails", async () => {
    mockApi.me.mockResolvedValueOnce({ settings: {} })
    mockApi.userApi.updateSettings.mockRejectedValueOnce({ message: "Nope" })

    render(<SettingsPage />)

    await screen.findByLabelText("Board theme")
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Nope")
    })
  })

  it("shows_the_default_error_message_when_settings_loading_fails_without_details", async () => {
    mockApi.me.mockRejectedValueOnce({})

    render(<SettingsPage />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load your settings.")
    })
  })

  it("falls_back_to_default_settings_when_the_server_returns_no_saved_payload", async () => {
    mockApi.me.mockResolvedValueOnce({})
    mockApi.userApi.updateSettings.mockResolvedValueOnce(null)

    render(<SettingsPage />)

    const boardTheme = await screen.findByLabelText("Board theme")
    fireEvent.change(boardTheme, { target: { value: "wood" } })
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))

    expect(await screen.findByRole("status")).toHaveTextContent("Settings saved.")
    expect(screen.getByLabelText("Board theme")).toHaveValue("default")
    expect(screen.getByLabelText("Piece set")).toHaveValue("cburnett")
  })

  it("shows_the_default_error_message_when_saving_fails_without_details", async () => {
    mockApi.me.mockResolvedValueOnce({ settings: {} })
    mockApi.userApi.updateSettings.mockRejectedValueOnce({})

    render(<SettingsPage />)

    await screen.findByLabelText("Board theme")
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to save settings.")
    })
  })

  it.each(["resolve", "reject"])("ignores_a_late_load_%s_after_unmount", async (outcome) => {
    const request = deferredRequest()
    mockApi.me.mockReturnValueOnce(request.promise)
    const { unmount } = render(<SettingsPage />)

    unmount()
    await act(async () => {
      if (outcome === "resolve") request.resolve({ settings: {} })
      else request.reject(new Error("offline"))
      await request.promise.catch(() => undefined)
    })

    expect(mockApi.me).toHaveBeenCalledTimes(1)
  })
})
