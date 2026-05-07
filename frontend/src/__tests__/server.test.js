import { describe, expect, it } from "vitest"
import {
  buildHttpsRedirectLocation,
  getForwardedScheme,
  resolveStaticFile,
  shouldProxyToBackend,
  shouldRedirectToHttps,
} from "../../server.mjs"

function req({ url = "/", host = "app.kriegspiel.org", headers = {} } = {}) {
  return {
    url,
    headers: {
      host,
      ...headers,
    },
  }
}

describe("production server routing", () => {
  it("uses_cf_visitor_as_the_forwarded_scheme", () => {
    expect(getForwardedScheme({ "cf-visitor": '{"scheme":"http"}', "x-forwarded-proto": "https" })).toBe("http")
    expect(getForwardedScheme({ "cf-visitor": '{"scheme":"https"}' })).toBe("https")
  })

  it("falls_back_to_x_forwarded_proto", () => {
    expect(getForwardedScheme({ "x-forwarded-proto": "https, http" })).toBe("https")
  })

  it("redirects_plain_http_forwarded_by_cloudflare", () => {
    const request = req({ url: "/auth/login?next=/lobby", headers: { "cf-visitor": '{"scheme":"http"}' } })

    expect(shouldRedirectToHttps(request)).toBe(true)
    expect(buildHttpsRedirectLocation(request)).toBe("https://app.kriegspiel.org/auth/login?next=/lobby")
  })

  it("does_not_redirect_https_forwarded_by_cloudflare", () => {
    expect(shouldRedirectToHttps(req({ headers: { "x-forwarded-proto": "https" } }))).toBe(false)
  })

  it("proxies_the_api_host_and_app_api_paths", () => {
    expect(shouldProxyToBackend(req({ host: "api.kriegspiel.org", url: "/health" }))).toBe(true)
    expect(shouldProxyToBackend(req({ host: "app.kriegspiel.org", url: "/api/auth/me" }))).toBe(true)
    expect(shouldProxyToBackend(req({ host: "app.kriegspiel.org", url: "/lobby" }))).toBe(false)
  })

  it("keeps_static_resolution_inside_the_dist_root", () => {
    const resolved = resolveStaticFile("/../../etc/passwd", "/tmp/ks-web-app-dist")

    expect(resolved.filePath).toBe("/tmp/ks-web-app-dist/index.html")
    expect(resolved.fallback).toBe(true)
  })

  it("rejects_encoded_static_traversal", () => {
    const resolved = resolveStaticFile("/%2e%2e/%2e%2e/etc/passwd", "/tmp/ks-web-app-dist")

    expect(resolved.filePath).toBe("/tmp/ks-web-app-dist/index.html")
    expect(resolved.fallback).toBe(true)
  })
})
