import { beforeEach, describe, expect, it, vi } from "vitest"
import api, { askAny, convertGuest, createGame, createGameEventsSource, deleteWaitingGame, gameEventsUrl, getBots, getGame, getGameReview, getGameState, getGameTranscript, getLobbyStats, getMyActiveGames, getMyArchivedGames, getOpenGames, joinGame, login, logout, me, playAsGuest, recordCampaignVisit, register, resignGame, submitMove, techApi, userApi } from "../services/api"

describe("api client", () => {
  it("api_client_uses_relative_base_url", () => { expect(api.defaults.baseURL ?? "").toBe("") })
  it("api_client_enables_credentials", () => { expect(api.defaults.withCredentials).toBe(true) })
  it("api_client_sets_json_defaults_if_added", () => { const contentType = api.defaults.headers.common?.["Content-Type"] ?? api.defaults.headers?.["Content-Type"]; expect(contentType).toBe("application/json") })
})

describe("auth helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("register_posts_to_auth_register", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { user_id: "u1" } }); const payload = { username: "new-user", email: "new@example.com", password: "secret123" }; const result = await register(payload); expect(postSpy).toHaveBeenCalledWith("/api/auth/register", payload); expect(result).toEqual({ user_id: "u1" }) })
  it("login_posts_to_auth_login", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } }); const payload = { username: "new-user", password: "secret123" }; const result = await login(payload); expect(postSpy).toHaveBeenCalledWith("/api/auth/login", payload); expect(result).toEqual({ ok: true }) })
  it("play_as_guest_posts_to_auth_guest", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { username: "guest_adolf_adams" } }); const result = await playAsGuest(); expect(postSpy).toHaveBeenCalledWith("/api/auth/guest"); expect(result).toEqual({ username: "guest_adolf_adams" }) })
  it("convert_guest_posts_to_auth_guest_convert", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { username: "adolf_adams" } }); const payload = { email: "player@example.com", password: "secret123" }; const result = await convertGuest(payload); expect(postSpy).toHaveBeenCalledWith("/api/auth/guest/convert", payload); expect(result).toEqual({ username: "adolf_adams" }) })
  it("logout_posts_to_auth_logout", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} }); await logout(); expect(postSpy).toHaveBeenCalledWith("/api/auth/logout") })
  it("me_gets_auth_me", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { username: "test" } }); const result = await me(); expect(getSpy).toHaveBeenCalledWith("/api/auth/me"); expect(result).toEqual({ username: "test" }) })
  it("record_campaign_visit_posts_to_analytics_visit", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { attribution_id: "attr" } }); const payload = { landing_path: "/lobby", utm: { source: "reddit" } }; const result = await recordCampaignVisit(payload); expect(postSpy).toHaveBeenCalledWith("/api/analytics/visit", payload); expect(result).toEqual({ attribution_id: "attr" }) })
  it("logout_uses_the_default_fallback_when_the_transport_error_has_no_message", async () => {
    vi.spyOn(api, "post").mockRejectedValue({})
    await expect(logout()).rejects.toEqual({ status: undefined, code: undefined, message: "Unable to log out right now." })
  })
  it("me_surfaces_plain_request_messages_when_no_response_payload_exists", async () => {
    vi.spyOn(api, "get").mockRejectedValue({ message: "Socket closed" })
    await expect(me()).rejects.toEqual({ status: undefined, code: undefined, message: "Socket closed" })
  })
  it("register_normalizes_validation_errors", async () => {
    vi.spyOn(api, "post").mockRejectedValue({ response: { status: 422, data: { detail: "Invalid email format" } } })
    await expect(register({ username: "new_user", email: "bad-email", password: "password" })).rejects.toEqual({ status: 422, code: undefined, message: "Invalid email format" })
  })
  it("register_normalizes_fastapi_validation_error_arrays", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            { loc: ["body", "email"], msg: "Value error, Invalid email format" },
            { loc: ["body", "username"], msg: "String should match pattern '^[a-zA-Z0-9_]+$'" },
          ],
        },
      },
    })
    await expect(register({ username: "new-user", email: "bad-email", password: "password" })).rejects.toEqual({
      status: 422,
      code: undefined,
      message: "email: Invalid email format username: String should match pattern '^[a-zA-Z0-9_]+$'",
    })
  })
  it("register_ignores_invalid_validation_items_and_keeps_fieldless_messages", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            null,
            { loc: ["body", 1], msg: "Value error, Invalid payload" },
            { loc: ["body", "email"], msg: "" },
          ],
        },
      },
    })
    await expect(register({ username: "new-user", email: "bad-email", password: "password" })).rejects.toEqual({
      status: 422,
      code: undefined,
      message: "Invalid payload",
    })
  })
  it("register_keeps_fieldless_validation_messages_when_loc_is_not_an_array", async () => {
    vi.spyOn(api, "post").mockRejectedValue({
      response: {
        status: 422,
        data: {
          detail: [
            { loc: "body", msg: "Value error, Invalid payload" },
            { loc: ["body", "email"], msg: 42 },
          ],
        },
      },
    })
    await expect(register({ username: "new-user", email: "bad-email", password: "password" })).rejects.toEqual({
      status: 422,
      code: undefined,
      message: "Invalid payload",
    })
  })
  it("register_normalizes_conflict_detail_objects", async () => {
    vi.spyOn(api, "post").mockRejectedValue({ response: { status: 409, data: { detail: { field: "username", code: "USERNAME_TAKEN", message: "Username already exists" } } } })
    await expect(register({ username: "taken-user", email: "new@example.com", password: "secret123" })).rejects.toEqual({ status: 409, code: "USERNAME_TAKEN", message: "Username already exists" })
  })
  it("login_normalizes_auth_errors", async () => {
    vi.spyOn(api, "post").mockRejectedValue({ response: { status: 401, data: { detail: "Invalid username or password" } } })
    await expect(login({ username: "new-user", password: "wrong123" })).rejects.toEqual({ status: 401, code: undefined, message: "Invalid username or password" })
  })
  it("play_as_guest_uses_the_default_fallback_when_requests_fail_without_details", async () => {
    vi.spyOn(api, "post").mockRejectedValue({})
    await expect(playAsGuest()).rejects.toEqual({
      status: undefined,
      code: undefined,
      message: "Unable to start guest session right now.",
    })
  })
})

describe("game helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("create_game_posts_to_api_game_create", async () => { const payload = { rule_variant: "berkeley_any", play_as: "random", time_control: "rapid", opponent_type: "human" }; const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { game_id: "g1" } }); const result = await createGame(payload); expect(postSpy).toHaveBeenCalledWith("/api/game/create", payload); expect(result).toEqual({ game_id: "g1" }) })
  it("bot_and_game_reads_use_expected_endpoints", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { games: [] } }); await getBots(); await getOpenGames(); await getMyActiveGames(); await getMyArchivedGames(); await getGame("g-123"); await getGameState("g-123"); expect(getSpy).toHaveBeenNthCalledWith(1, "/api/bots"); expect(getSpy).toHaveBeenNthCalledWith(2, "/api/game/open"); expect(getSpy).toHaveBeenNthCalledWith(3, "/api/game/mine/active"); expect(getSpy).toHaveBeenNthCalledWith(4, "/api/game/mine/archived"); expect(getSpy).toHaveBeenNthCalledWith(5, "/api/game/g-123"); expect(getSpy).toHaveBeenNthCalledWith(6, "/api/game/g-123/state") })
  it("game_event_streams_use_expected_endpoint", () => {
    expect(gameEventsUrl("g/123")).toBe("/api/game/g%2F123/events")
  })
  it("game_event_source_uses_credentials_when_available", () => {
    const OriginalEventSource = window.EventSource
    const eventSourceSpy = vi.fn(function EventSourceMock(url, options) {
      this.url = url
      this.options = options
    })
    window.EventSource = eventSourceSpy
    try {
      const source = createGameEventsSource("g-123")
      expect(eventSourceSpy).toHaveBeenCalledWith("/api/game/g-123/events", { withCredentials: true })
      expect(source.url).toBe("/api/game/g-123/events")
      expect(source.options).toEqual({ withCredentials: true })
    } finally {
      if (OriginalEventSource === undefined) {
        delete window.EventSource
      } else {
        window.EventSource = OriginalEventSource
      }
    }
  })
  it("game_event_source_returns_null_when_eventsource_is_unavailable", () => {
    const OriginalEventSource = window.EventSource
    delete window.EventSource
    try {
      expect(createGameEventsSource("g-123")).toBeNull()
    } finally {
      if (OriginalEventSource !== undefined) {
        window.EventSource = OriginalEventSource
      }
    }
  })
  it("join_transcript_and_stats_reads_use_expected_endpoints", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} })
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: {} })

    await joinGame("ABC 123/?!")
    await getLobbyStats()
    await getGameTranscript("g/123")
    await getGameReview("g/123")

    expect(postSpy).toHaveBeenCalledWith("/api/game/join/ABC%20123%2F%3F!")
    expect(getSpy).toHaveBeenNthCalledWith(1, "/api/game/stats")
    expect(getSpy).toHaveBeenNthCalledWith(2, "/api/game/g%2F123/moves")
    expect(getSpy).toHaveBeenNthCalledWith(3, "/api/game/g%2F123/review")
  })
  it("move_ask_any_resign_use_expected_endpoints", async () => { const postSpy = vi.spyOn(api, "post").mockResolvedValue({ data: { ok: true } }); await submitMove("g-123", "e2e4"); await askAny("g-123"); await resignGame("g-123"); expect(postSpy).toHaveBeenNthCalledWith(1, "/api/game/g-123/move", { uci: "e2e4" }); expect(postSpy).toHaveBeenNthCalledWith(2, "/api/game/g-123/ask-any"); expect(postSpy).toHaveBeenNthCalledWith(3, "/api/game/g-123/resign") })
  it("delete_waiting_game_uses_expected_endpoint", async () => { const deleteSpy = vi.spyOn(api, "delete").mockResolvedValue({ data: {} }); await deleteWaitingGame("g-123"); expect(deleteSpy).toHaveBeenCalledWith("/api/game/g-123") })
  it("normalizes_nested_game_error_shape", async () => { vi.spyOn(api, "post").mockRejectedValue({ response: { status: 409, data: { error: { code: "GAME_ALREADY_JOINED", message: "You already joined this game." } } } }); await expect(joinGame("ABC123")).rejects.toEqual({ status: 409, code: "GAME_ALREADY_JOINED", message: "You already joined this game." }) })
  it.each([
    ["getBots", "get", () => getBots(), "Unable to load bots right now."],
    ["createGame", "post", () => createGame({ rule_variant: "berkeley", opponent_type: "human" }), "Unable to create game right now."],
    ["joinGame", "post", () => joinGame("ABC123"), "Unable to join that game right now."],
    ["getOpenGames", "get", () => getOpenGames(), "Unable to load open games right now."],
    ["getLobbyStats", "get", () => getLobbyStats(), "Unable to load lobby stats right now."],
    ["getMyActiveGames", "get", () => getMyActiveGames(), "Unable to load your games right now."],
    ["getMyArchivedGames", "get", () => getMyArchivedGames(), "Unable to load your games right now."],
    ["getGame", "get", () => getGame("g-123"), "Unable to load game details right now."],
    ["getGameTranscript", "get", () => getGameTranscript("g-123"), "Unable to load game transcript right now."],
    ["getGameReview", "get", () => getGameReview("g-123"), "Unable to load game review right now."],
    ["getGameState", "get", () => getGameState("g-123"), "Unable to load game state right now."],
    ["deleteWaitingGame", "delete", () => deleteWaitingGame("g-123"), "Unable to close this waiting game right now."],
    ["submitMove", "post", () => submitMove("g-123", "e2e4"), "Unable to submit move right now."],
    ["askAny", "post", () => askAny("g-123"), "Unable to ask any-captures right now."],
    ["resignGame", "post", () => resignGame("g-123"), "Unable to resign this game right now."],
  ])("%s_uses_the_default_fallback_when_requests_fail_without_details", async (_name, method, invoke, message) => {
    vi.spyOn(api, method).mockRejectedValue({})
    await expect(invoke()).rejects.toEqual({ status: undefined, code: undefined, message })
  })
})

describe("user helpers", () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it("profile_history_and_leaderboard_use_expected_endpoints", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} }); await userApi.getProfile("fil"); await userApi.getGameHistory("fil", 2, 30); await userApi.getRatingHistory("fil", "vs_bots", 100); await userApi.getLeaderboard(3, 10); expect(getSpy).toHaveBeenNthCalledWith(1, "/api/user/fil"); expect(getSpy).toHaveBeenNthCalledWith(2, "/api/user/fil/games", { params: { page: 2, per_page: 30 } }); expect(getSpy).toHaveBeenNthCalledWith(3, "/api/user/fil/rating-history", { params: { track: "vs_bots", limit: 100 } }); expect(getSpy).toHaveBeenNthCalledWith(4, "/api/leaderboard", { params: { page: 3, per_page: 10 } }) })
  it("game_history_serializes_sort_and_filter_options", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} })

    await userApi.getGameHistory("fil", 1, 100, {
      sort: { key: "turns", direction: "asc" },
      includeFilterOptions: false,
      filters: {
        opponent: ["human:bob", "bot:randobot"],
        result: ["win"],
        reason: [],
      },
    })
    await userApi.getGameHistory("fil", 1, 100, { sort: null, filters: {} })

    expect(getSpy).toHaveBeenNthCalledWith(1, "/api/user/fil/games", {
      params: {
        page: 1,
        per_page: 100,
        include_filter_options: false,
        sort: "turns",
        dir: "asc",
        opponent: "human:bob,bot:randobot",
        result: "win",
      },
    })
    expect(getSpy).toHaveBeenNthCalledWith(2, "/api/user/fil/games", {
      params: {
        page: 1,
        per_page: 100,
        sort: "none",
      },
    })
  })
  it("game_history_filter_options_uses_expected_endpoint", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: { filter_options: {} } })

    const result = await userApi.getGameHistoryFilterOptions("fil/random")

    expect(getSpy).toHaveBeenCalledWith("/api/user/fil%2Frandom/games/filter-options")
    expect(result).toEqual({ filter_options: {} })
  })
  it("game_history_serializes_opponent_group_tokens", async () => {
    const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} })

    await userApi.getGameHistory("fil", 1, 100, {
      filters: { opponent: ["bot:*"] },
      includeFilterOptions: false,
    })

    expect(getSpy).toHaveBeenCalledWith("/api/user/fil/games", {
      params: {
        page: 1,
        per_page: 100,
        include_filter_options: false,
        opponent: "bot:*",
      },
    })
  })
  it("tech_reports_use_expected_endpoints", async () => { const getSpy = vi.spyOn(api, "get").mockResolvedValue({ data: {} }); await techApi.getBotsReport(10); await techApi.getBotMatrixReport("week"); await techApi.getGuestsReport(); await techApi.getUsersReport(); await techApi.getAcquisitionReport(7); expect(getSpy).toHaveBeenNthCalledWith(1, "/api/tech/bots-report", { params: { days: 10 } }); expect(getSpy).toHaveBeenNthCalledWith(2, "/api/tech/bot-matrix-report", { params: { period: "week" } }); expect(getSpy).toHaveBeenNthCalledWith(3, "/api/tech/guests-report"); expect(getSpy).toHaveBeenNthCalledWith(4, "/api/tech/users-report"); expect(getSpy).toHaveBeenNthCalledWith(5, "/api/tech/acquisition-report", { params: { days: 7 } }) })
  it("update_settings_patches_expected_endpoint", async () => { const patchSpy = vi.spyOn(api, "patch").mockResolvedValue({ data: { board_theme: "wood" } }); const payload = { board_theme: "wood" }; const result = await userApi.updateSettings(payload); expect(patchSpy).toHaveBeenCalledWith("/api/user/settings", payload); expect(result).toEqual({ board_theme: "wood" }) })
})
