import { beforeEach, describe, expect, it, vi } from "vitest"
import api, { askAny, createGame, deleteWaitingGame, getBots, getGame, getGameState, getMyGames, getOpenGames, joinGame, login, logout, me, register, resignGame, submitMove, techApi, userApi } from "../services/api"

describe("api client", () => {
  it("api_client_uses_relative_base_url", () => { expect(api.defaults.baseURL ?? "").toBe("") })
  it("api_client_enables_credentials", () => { expect(api.defaults.withCredentials).toBe(true) })
  it("api_client_sets_json_defaults_if_added", () => { const contentType = api.defaults.headers.common?.["Content-Type"] ?? api.defaults.headers?.["Content-Type"]; expect(contentType).toBe("application/json") })
})

describe("auth helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("register_posts_to_auth_register", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { user_id: "u1" } }); const payload = { username: "new-user", email: "new@example.com", password: "secret123" }; const result = await register(payload); expect(postSpy).toHaveBeenCalledWith("/api/auth/register", payload); expect(result).toEqual({ user_id: "u1" }) })
  it("login_posts_to_auth_login", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } }); const payload = { username: "new-user", password: "secret123" }; const result = await login(payload); expect(postSpy).toHaveBeenCalledWith("/api/auth/login", payload); expect(result).toEqual({ ok: true }) })
  it("logout_posts_to_auth_logout", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} }); await logout(); expect(postSpy).toHaveBeenCalledWith("/api/auth/logout") })
  it("me_gets_auth_me", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { username: "test" } }); const result = await me(); expect(getSpy).toHaveBeenCalledWith("/api/auth/me"); expect(result).toEqual({ username: "test" }) })
})

describe("game helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("create_game_posts_to_api_game_create", async () => { const payload = { rule_variant: "berkeley_any", play_as: "random", time_control: "rapid", opponent_type: "human" }; const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { game_id: "g1" } }); const result = await createGame(payload); expect(postSpy).toHaveBeenCalledWith("/api/game/create", payload); expect(result).toEqual({ game_id: "g1" }) })
  it("bot_and_game_reads_use_expected_endpoints", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { games: [] } }); await getBots(); await getOpenGames(); await getMyGames(); await getGame("g-123"); await getGameState("g-123"); expect(getSpy).toHaveBeenNthCalledWith(1, "/api/bots"); expect(getSpy).toHaveBeenNthCalledWith(2, "/api/game/open"); expect(getSpy).toHaveBeenNthCalledWith(3, "/api/game/mine"); expect(getSpy).toHaveBeenNthCalledWith(4, "/api/game/g-123"); expect(getSpy).toHaveBeenNthCalledWith(5, "/api/game/g-123/state") })
  it("move_ask_any_resign_use_expected_endpoints", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } }); await submitMove("g-123", "e2e4"); await askAny("g-123"); await resignGame("g-123"); expect(postSpy).toHaveBeenNthCalledWith(1, "/api/game/g-123/move", { uci: "e2e4" }); expect(postSpy).toHaveBeenNthCalledWith(2, "/api/game/g-123/ask-any"); expect(postSpy).toHaveBeenNthCalledWith(3, "/api/game/g-123/resign") })
  it("delete_waiting_game_uses_expected_endpoint", async () => { const deleteSpy = vi.spyOn(api, "delete").mockResolvedValue({ data: {} }); await deleteWaitingGame("g-123"); expect(deleteSpy).toHaveBeenCalledWith("/api/game/g-123") })
  it("normalizes_nested_game_error_shape", async () => { vi.spyOn(api, "post").mockRejectedValue({ response: { status: 409, data: { error: { code: "GAME_ALREADY_JOINED", message: "You already joined this game." } } } }); await expect(joinGame("ABC123")).rejects.toEqual({ status: 409, code: "GAME_ALREADY_JOINED", message: "You already joined this game." }) })
})

describe("user helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("profile_history_and_leaderboard_use_expected_endpoints", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} }); await userApi.getProfile("fil"); await userApi.getGameHistory("fil", 2, 30); await userApi.getRatingHistory("fil", "vs_bots", 100); await userApi.getLeaderboard(3, 10); expect(getSpy).toHaveBeenNthCalledWith(1, "/api/user/fil"); expect(getSpy).toHaveBeenNthCalledWith(2, "/api/user/fil/games", { params: { page: 2, per_page: 30 } }); expect(getSpy).toHaveBeenNthCalledWith(3, "/api/user/fil/rating-history", { params: { track: "vs_bots", limit: 100 } }); expect(getSpy).toHaveBeenNthCalledWith(4, "/api/leaderboard", { params: { page: 3, per_page: 10 } }) })
  it("bots_report_uses_expected_endpoint", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} }); await techApi.getBotsReport(10); expect(getSpy).toHaveBeenCalledWith("/api/tech/bots-report", { params: { days: 10 } }) })
  it("update_settings_patches_expected_endpoint", async () => { const patchSpy = vi.spyOn(api, "patch").mockResolvedValue({ data: { board_theme: "wood" } }); const payload = { board_theme: "wood" }; const result = await userApi.updateSettings(payload); expect(patchSpy).toHaveBeenCalledWith("/api/user/settings", payload); expect(result).toEqual({ board_theme: "wood" }) })
})
