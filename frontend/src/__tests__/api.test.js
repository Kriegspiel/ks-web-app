import { beforeEach, describe, expect, it, vi } from "vitest"
import api, {
  createGame,
  getGame,
  getMyGames,
  getOpenGames,
  joinGame,
  login,
  logout,
  me,
  register,
} from "../services/api"

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

  it("normalizes_nested_game_error_shape", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      response: { status: 409, data: { error: { code: "GAME_ALREADY_JOINED", message: "You already joined this game." } } },
    })

    await expect(joinGame("ABC123")).rejects.toEqual({
      status: 409,
      code: "GAME_ALREADY_JOINED",
      message: "You already joined this game.",
    })
  })
})

describe("game helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("create_game_posts_to_api_game_create", async () => {
    const payload = { rule_variant: "berkeley_any", play_as: "random", time_control: "rapid" }
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { game_id: "g1" } })

    const result = await createGame(payload)

    expect(postSpy).toHaveBeenCalledWith("/api/game/create", payload)
    expect(result).toEqual({ game_id: "g1" })
  })

  it("open_mine_and_get_game_use_expected_endpoints", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { games: [] } })

    await getOpenGames()
    await getMyGames()
    await getGame("g-123")

    expect(getSpy).toHaveBeenNthCalledWith(1, "/api/game/open")
    expect(getSpy).toHaveBeenNthCalledWith(2, "/api/game/mine")
    expect(getSpy).toHaveBeenNthCalledWith(3, "/api/game/g-123")
  })
})
