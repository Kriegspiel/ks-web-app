import { describe, it, expect } from "vitest"
import api from "../services/api"

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
