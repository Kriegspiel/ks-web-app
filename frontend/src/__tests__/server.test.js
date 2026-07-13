import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  buildHttpsRedirectLocation,
  createServer,
  getForwardedScheme,
  resolveStaticFile,
  shouldRejectPublicApiPrefix,
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

const distRoot = path.resolve(process.cwd(), "dist")
const servers = new Set()

function resetDist(files = { "index.html": "<main>app shell</main>" }) {
  fs.rmSync(distRoot, { recursive: true, force: true })
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(distRoot, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }
}

function listen(server) {
  servers.add(server)
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port))
  })
}

function close(server) {
  servers.delete(server)
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function requestServer(port, { method = "GET", path: requestPath = "/", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: requestPath,
        headers,
      },
      (response) => {
        let body = ""
        response.setEncoding("utf8")
        response.on("data", (chunk) => { body += chunk })
        response.on("end", () => resolve({ response, body }))
      },
    )
    request.on("error", reject)
    request.end()
  })
}

async function unusedPort() {
  const server = http.createServer()
  const port = await listen(server)
  await close(server)
  return port
}

afterEach(async () => {
  await Promise.all([...servers].map((server) => close(server)))
  fs.rmSync(distRoot, { recursive: true, force: true })
})

describe("production server routing", () => {
  it("uses_cf_visitor_as_the_forwarded_scheme", () => {
    expect(getForwardedScheme({ "cf-visitor": '{"scheme":"http"}', "x-forwarded-proto": "https" })).toBe("http")
    expect(getForwardedScheme({ "cf-visitor": '{"scheme":"https"}' })).toBe("https")
    expect(getForwardedScheme({ "cf-visitor": "not json", "x-forwarded-proto": "http" })).toBe("http")
  })

  it("falls_back_to_x_forwarded_proto", () => {
    expect(getForwardedScheme({ "x-forwarded-proto": "https, http" })).toBe("https")
    expect(getForwardedScheme({})).toBe("")
  })

  it("redirects_plain_http_forwarded_by_cloudflare", () => {
    const request = req({ url: "/auth/login?next=/lobby", headers: { "cf-visitor": '{"scheme":"http"}' } })

    expect(shouldRedirectToHttps(request)).toBe(true)
    expect(buildHttpsRedirectLocation(request)).toBe("https://app.kriegspiel.org/auth/login?next=/lobby")
    expect(buildHttpsRedirectLocation(req({ host: "" }))).toBe("")
    expect(buildHttpsRedirectLocation({ headers: { host: "app.kriegspiel.org" } })).toBe("https://app.kriegspiel.org/")
  })

  it("does_not_redirect_https_forwarded_by_cloudflare", () => {
    expect(shouldRedirectToHttps(req({ headers: { "x-forwarded-proto": "https" } }))).toBe(false)
  })

  it("proxies_the_api_host_and_app_api_paths", () => {
    expect(shouldProxyToBackend(req({ host: "api.kriegspiel.org", url: "/health" }))).toBe(true)
    expect(shouldProxyToBackend(req({ host: "app.kriegspiel.org", url: "/api/auth/me" }))).toBe(true)
    expect(shouldProxyToBackend(req({ host: "app.kriegspiel.org", url: "/lobby" }))).toBe(false)
    expect(shouldProxyToBackend({ headers: { host: "app.kriegspiel.org" } })).toBe(false)
  })

  it("rejects_api_prefixed_paths_on_the_public_api_host", () => {
    expect(shouldRejectPublicApiPrefix(req({ host: "api.kriegspiel.org", url: "/api/health" }))).toBe(true)
    expect(shouldRejectPublicApiPrefix(req({ host: "api.kriegspiel.org", url: "/api/auth/me" }))).toBe(true)
    expect(shouldRejectPublicApiPrefix(req({ host: "api.kriegspiel.org", url: "/health" }))).toBe(false)
    expect(shouldRejectPublicApiPrefix(req({ host: "app.kriegspiel.org", url: "/api/auth/me" }))).toBe(false)
    expect(shouldRejectPublicApiPrefix({ headers: { host: "api.kriegspiel.org" } })).toBe(false)
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

  it("resolves_static_files_and_bad_uri_fallbacks", () => {
    const tempDist = fs.mkdtempSync(path.join(process.cwd(), "server-dist-"))
    try {
      fs.writeFileSync(path.join(tempDist, "index.html"), "fallback")
      fs.writeFileSync(path.join(tempDist, "asset.txt"), "asset")

      expect(resolveStaticFile("/asset.txt", tempDist)).toEqual({
        filePath: path.join(tempDist, "asset.txt"),
        fallback: false,
      })
      expect(resolveStaticFile("/%E0%A4%A", tempDist)).toEqual({
        filePath: path.join(tempDist, "index.html"),
        fallback: true,
      })
    } finally {
      fs.rmSync(tempDist, { recursive: true, force: true })
    }
  })

  it("serves_redirects_public_api_rejections_static_files_and_head_requests", async () => {
    resetDist({
      "index.html": "<main>app shell</main>",
      "assets/app.js": "console.log('ok')",
      "assets/data.bin": "raw",
    })
    const server = createServer()
    const port = await listen(server)

    const redirect = await requestServer(port, {
      path: "/lobby",
      headers: { host: "app.kriegspiel.org", "x-forwarded-proto": "http" },
    })
    expect(redirect.response.statusCode).toBe(308)
    expect(redirect.response.headers.location).toBe("https://app.kriegspiel.org/lobby")
    expect(redirect.response.headers["x-content-type-options"]).toBe("nosniff")

    const rejected = await requestServer(port, {
      path: "/api/health",
      headers: { host: "api.kriegspiel.org", "x-forwarded-proto": "https" },
    })
    expect(rejected.response.statusCode).toBe(404)
    expect(rejected.response.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains")
    expect(JSON.parse(rejected.body)).toEqual({ detail: "Not Found" })

    const staticAsset = await requestServer(port, {
      path: "/assets/app.js",
      headers: { host: "app.kriegspiel.org", "x-forwarded-proto": "https" },
    })
    expect(staticAsset.response.statusCode).toBe(200)
    expect(staticAsset.response.headers["cache-control"]).toBe("public, max-age=3600")
    expect(staticAsset.response.headers["content-type"]).toBe("text/javascript; charset=utf-8")
    expect(staticAsset.body).toBe("console.log('ok')")

    const binaryAsset = await requestServer(port, {
      path: "/assets/data.bin",
      headers: { host: "app.kriegspiel.org", "x-forwarded-proto": "https" },
    })
    expect(binaryAsset.response.headers["content-type"]).toBe("application/octet-stream")

    const headFallback = await requestServer(port, {
      method: "HEAD",
      path: "/review/ABC123",
      headers: { host: "app.kriegspiel.org", "x-forwarded-proto": "https" },
    })
    expect(headFallback.response.statusCode).toBe(200)
    expect(headFallback.response.headers["cache-control"]).toBe("no-cache")
    expect(headFallback.body).toBe("")

    fs.rmSync(path.join(distRoot, "index.html"))
    const missing = await requestServer(port, {
      path: "/missing",
      headers: { host: "app.kriegspiel.org" },
    })
    expect(missing.response.statusCode).toBe(404)
    expect(missing.body).toBe("Not found")
  })

  it("proxies_app_api_requests_to_the_backend_and_filters_hop_by_hop_headers", async () => {
    const backendRequests = []
    const backend = http.createServer((backendReq, backendRes) => {
      backendRequests.push({
        url: backendReq.url,
        headers: backendReq.headers,
      })
      backendRes.writeHead(201, {
        "Content-Type": "application/json",
        Connection: "close",
        "X-Backend": "seen",
      })
      backendRes.end(JSON.stringify({ ok: true }))
    })
    const backendPort = await listen(backend)
    const server = createServer({ backendOrigin: `http://127.0.0.1:${backendPort}` })
    const port = await listen(server)

    const proxied = await requestServer(port, {
      path: "/api/echo?x=1",
      headers: {
        host: "app.kriegspiel.org",
        connection: "upgrade",
        "x-forwarded-for": "203.0.113.1",
      },
    })

    expect(proxied.response.statusCode).toBe(201)
    expect(proxied.response.headers["x-backend"]).toBe("seen")
    expect(proxied.body).toBe(JSON.stringify({ ok: true }))
    expect(backendRequests).toHaveLength(1)
    expect(backendRequests[0].url).toBe("/api/echo?x=1")
    expect(backendRequests[0].headers["x-forwarded-host"]).toBe("app.kriegspiel.org")
    expect(backendRequests[0].headers["x-forwarded-proto"]).toBe("https")
    expect(backendRequests[0].headers["x-forwarded-for"]).toContain("203.0.113.1")
    expect(backendRequests[0].headers.connection).not.toBe("upgrade")
  })

  it("returns_bad_gateway_when_the_backend_proxy_fails", async () => {
    const portWithoutServer = await unusedPort()
    const server = createServer({ backendOrigin: `http://127.0.0.1:${portWithoutServer}` })
    const port = await listen(server)

    const failed = await requestServer(port, {
      path: "/api/echo",
      headers: { host: "app.kriegspiel.org" },
    })

    expect(failed.response.statusCode).toBe(502)
    expect(failed.body).toBe("Bad gateway")
  })
})
