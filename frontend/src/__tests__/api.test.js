import { beforeEach, describe, expect, it, vi } from "vitest"
import api, { login, logout, me, register } from "../services/api"

describe("api client", () => {
  it("api_client_uses_relative_base_url", () => {
    expect(api.defaults.baseURL ?? "").toBe("")
  })

  it("api_client_enables_credentials", () => {
    expect(api.defaults.withCredentials).toBe(true)
  })

  it("api_client_sets_json_defaults_if_added", () => {
    const contentType = api.defaults.headers.common?.["Content-Type"] ?? api.defaults.headers?.["Content-Type"]
    expect(contentType).toBe("application/json")
  })
})

describe("auth helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("register_posts_to_auth_register", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { user_id: "u1" } })

    const payload = { username: "new-user", email: "new@example.com", password: "secret123" }
    const result = await register(payload)

    expect(postSpy).toHaveBeenCalledWith("/auth/register", payload)
    expect(result).toEqual({ user_id: "u1" })
  })

  it("login_posts_to_auth_login", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } })

    const payload = { username: "new-user", password: "secret123" }
    const result = await login(payload)

    expect(postSpy).toHaveBeenCalledWith("/auth/login", payload)
    expect(result).toEqual({ ok: true })
  })

  it("logout_posts_to_auth_logout", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} })

    await logout()

    expect(postSpy).toHaveBeenCalledWith("/auth/logout")
  })

  it("me_gets_auth_me", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { username: "test" } })

    const result = await me()

    expect(getSpy).toHaveBeenCalledWith("/auth/me")
    expect(result).toEqual({ username: "test" })
  })

  it("normalizes_409_and_detail_message", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      response: { status: 409, data: { detail: "Username already exists" } },
    })

    await expect(register({ username: "taken", email: "taken@example.com", password: "secret123" })).rejects.toEqual({
      status: 409,
      message: "Username already exists",
    })
  })
})
