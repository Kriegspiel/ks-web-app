import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AuthProvider } from "../context/AuthContext"
import { useAuth } from "../hooks/useAuth"

const mockLoginRequest = vi.hoisted(() => vi.fn())
const mockLogoutRequest = vi.hoisted(() => vi.fn())
const mockMeRequest = vi.hoisted(() => vi.fn())
const mockRegisterRequest = vi.hoisted(() => vi.fn())

vi.mock("../services/api", () => ({
  login: mockLoginRequest,
  logout: mockLogoutRequest,
  me: mockMeRequest,
  register: mockRegisterRequest,
}))

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  mockLoginRequest.mockReset()
  mockLogoutRequest.mockReset()
  mockMeRequest.mockReset()
  mockRegisterRequest.mockReset()
})

describe("AuthProvider", () => {
  it("throws_when_use_auth_is_called_outside_the_provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used inside AuthProvider")
  })

  it("bootstraps_an_existing_authenticated_session", async () => {
    mockMeRequest.mockResolvedValueOnce({ username: "fil" })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })
    expect(result.current.user).toEqual({ username: "fil" })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.actionError).toBe("")
  })

  it("treats_a_401_bootstrap_response_as_logged_out", async () => {
    mockMeRequest.mockRejectedValueOnce({ status: 401 })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })
    expect(result.current.user).toBe(null)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.actionError).toBe("")
  })

  it("surfaces_unexpected_bootstrap_errors", async () => {
    mockMeRequest.mockRejectedValueOnce({ message: "network down" })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })
    expect(result.current.user).toBe(null)
    expect(result.current.actionError).toBe("network down")
  })

  it("uses_the_default_bootstrap_message_when_bootstrap_fails_without_details", async () => {
    mockMeRequest.mockRejectedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })
    expect(result.current.user).toBe(null)
    expect(result.current.actionError).toBe("Unable to load auth state.")
  })

  it("logs_in_and_refreshes_the_session", async () => {
    mockMeRequest
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "captain" })
    mockLoginRequest.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let returnedUser = null
    await act(async () => {
      returnedUser = await result.current.login({ username: "captain", password: "secret" })
    })

    expect(mockLoginRequest).toHaveBeenCalledWith({ username: "captain", password: "secret" })
    expect(returnedUser).toEqual({ username: "captain" })
    expect(result.current.user).toEqual({ username: "captain" })
    expect(result.current.actionError).toBe("")
    expect(result.current.actionLoading).toBe(false)
  })

  it("surfaces_refresh_session_errors_after_login", async () => {
    mockMeRequest
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce({ status: 500, message: "Session boom" })
    mockLoginRequest.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.login({ username: "captain", password: "secret" })
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({ status: 500, message: "Session boom" })
    expect(result.current.actionError).toBe("Session boom")
    expect(result.current.actionLoading).toBe(false)
  })

  it("returns_null_when_login_refresh_hits_a_401", async () => {
    mockMeRequest
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce({ status: 401 })
    mockLoginRequest.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let returnedUser = Symbol("unset")
    await act(async () => {
      returnedUser = await result.current.login({ username: "guest", password: "pw" })
    })

    expect(returnedUser).toBe(null)
    expect(result.current.user).toBe(null)
    expect(result.current.actionError).toBe("")
  })

  it("surfaces_login_failures", async () => {
    mockMeRequest.mockResolvedValueOnce(null)
    mockLoginRequest.mockRejectedValueOnce({ message: "Bad credentials" })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.login({ username: "captain", password: "wrong" })
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({ message: "Bad credentials" })
    expect(result.current.actionError).toBe("Bad credentials")
    expect(result.current.actionLoading).toBe(false)
  })

  it("uses_the_default_login_message_when_login_fails_without_details", async () => {
    mockMeRequest.mockResolvedValueOnce(null)
    mockLoginRequest.mockRejectedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.login({ username: "captain", password: "wrong" })
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({})
    expect(result.current.actionError).toBe("Login failed.")
    expect(result.current.actionLoading).toBe(false)
  })

  it("registers_and_refreshes_the_session", async () => {
    mockMeRequest
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "new-user" })
    mockRegisterRequest.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let returnedUser = null
    await act(async () => {
      returnedUser = await result.current.register({
        username: "new-user",
        email: "new@example.com",
        password: "strong-pass",
      })
    })

    expect(mockRegisterRequest).toHaveBeenCalledWith({
      username: "new-user",
      email: "new@example.com",
      password: "strong-pass",
    })
    expect(returnedUser).toEqual({ username: "new-user" })
    expect(result.current.user).toEqual({ username: "new-user" })
  })

  it("surfaces_registration_failures", async () => {
    mockMeRequest.mockResolvedValueOnce(null)
    mockRegisterRequest.mockRejectedValueOnce({ message: "Username taken" })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.register({
          username: "new-user",
          email: "new@example.com",
          password: "strong-pass",
        })
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({ message: "Username taken" })
    expect(result.current.actionError).toBe("Username taken")
    expect(result.current.actionLoading).toBe(false)
  })

  it("uses_the_default_registration_message_when_registration_fails_without_details", async () => {
    mockMeRequest.mockResolvedValueOnce(null)
    mockRegisterRequest.mockRejectedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.register({
          username: "new-user",
          email: "new@example.com",
          password: "strong-pass",
        })
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({})
    expect(result.current.actionError).toBe("Registration failed.")
    expect(result.current.actionLoading).toBe(false)
  })

  it("logs_out_successfully", async () => {
    mockMeRequest.mockResolvedValueOnce({ username: "fil" })
    mockLogoutRequest.mockResolvedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(mockLogoutRequest).toHaveBeenCalledTimes(1)
    expect(result.current.user).toBe(null)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it("surfaces_logout_failures_and_allows_clearing_the_error", async () => {
    mockMeRequest.mockResolvedValueOnce({ username: "fil" })
    mockLogoutRequest.mockRejectedValueOnce({ message: "Socket closed" })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.logout()
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({ message: "Socket closed" })
    expect(result.current.user).toEqual({ username: "fil" })
    expect(result.current.actionError).toBe("Socket closed")
    expect(result.current.actionLoading).toBe(false)

    act(() => {
      result.current.clearActionError()
    })

    expect(result.current.actionError).toBe("")
  })

  it("uses_the_default_logout_message_when_logout_fails_without_details", async () => {
    mockMeRequest.mockResolvedValueOnce({ username: "fil" })
    mockLogoutRequest.mockRejectedValueOnce({})

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.bootstrapping).toBe(false)
    })

    let caughtError = null
    await act(async () => {
      try {
        await result.current.logout()
      } catch (error) {
        caughtError = error
      }
    })

    expect(caughtError).toEqual({})
    expect(result.current.user).toEqual({ username: "fil" })
    expect(result.current.actionError).toBe("Logout failed.")
    expect(result.current.actionLoading).toBe(false)
  })
})
