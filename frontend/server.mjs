import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8000"
export const DEFAULT_HSTS_VALUE = "max-age=31536000; includeSubDomains"

const DIST_ROOT = path.join(__dirname, "dist")
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
])

function firstForwardedValue(value) {
  return String(value || "")
    .split(",")
    .at(0)
    ?.trim()
    .toLowerCase() || ""
}

export function getForwardedScheme(headers) {
  const cfVisitor = headers["cf-visitor"]
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(String(cfVisitor))
      if (typeof parsed?.scheme === "string" && parsed.scheme.trim()) {
        return parsed.scheme.trim().toLowerCase()
      }
    } catch {
      // Fall back to X-Forwarded-Proto below.
    }
  }

  return firstForwardedValue(headers["x-forwarded-proto"])
}

export function buildHttpsRedirectLocation(req) {
  const host = req.headers.host
  if (!host) {
    return ""
  }
  return `https://${host}${req.url || "/"}`
}

export function shouldRedirectToHttps(req) {
  return getForwardedScheme(req.headers) === "http" && Boolean(buildHttpsRedirectLocation(req))
}

export function shouldProxyToBackend(req) {
  const host = firstForwardedValue(req.headers.host).split(":").at(0)
  const requestUrl = new URL(req.url || "/", "http://localhost")
  return host === "api.kriegspiel.org" || requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/")
}

export function shouldRejectPublicApiPrefix(req) {
  const host = firstForwardedValue(req.headers.host).split(":").at(0)
  const requestUrl = new URL(req.url || "/", "http://localhost")
  return host === "api.kriegspiel.org" && (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/"))
}

function applySecurityHeaders(headers, req) {
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("X-Frame-Options", "DENY")

  if (getForwardedScheme(req.headers) === "https") {
    headers.set("Strict-Transport-Security", process.env.KS_HSTS_HEADER || DEFAULT_HSTS_VALUE)
  }
}

function writeWithSecurityHeaders(req, res, statusCode, rawHeaders = {}) {
  const headers = new Headers(rawHeaders)
  applySecurityHeaders(headers, req)
  res.writeHead(statusCode, Object.fromEntries(headers.entries()))
}

function redirectToHttps(req, res) {
  const location = buildHttpsRedirectLocation(req)
  writeWithSecurityHeaders(req, res, 308, {
    "Cache-Control": "no-cache",
    Location: location,
  })
  res.end()
}

function notFound(req, res) {
  writeWithSecurityHeaders(req, res, 404, {
    "Content-Type": "application/json; charset=utf-8",
  })
  res.end(JSON.stringify({ detail: "Not Found" }))
}

function proxyHeaders(req) {
  const headers = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
      headers[name] = value
    }
  }

  headers["x-forwarded-host"] = req.headers.host || ""
  headers["x-forwarded-proto"] = getForwardedScheme(req.headers) || "https"
  headers["x-forwarded-for"] = [req.headers["x-forwarded-for"], req.socket.remoteAddress]
    .filter(Boolean)
    .join(", ")

  return headers
}

function proxyToBackend(req, res, backendOrigin) {
  const target = new URL(req.url || "/", backendOrigin)
  const proxyReq = http.request(
    target,
    {
      method: req.method,
      headers: proxyHeaders(req),
    },
    (proxyRes) => {
      const responseHeaders = {}
      for (const [name, value] of Object.entries(proxyRes.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
          responseHeaders[name] = value
        }
      }

      writeWithSecurityHeaders(req, res, proxyRes.statusCode || 502, responseHeaders)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on("error", () => {
    writeWithSecurityHeaders(req, res, 502, {
      "Content-Type": "text/plain; charset=utf-8",
    })
    res.end("Bad gateway")
  })

  req.pipe(proxyReq)
}

export function resolveStaticFile(requestPathname, distRoot = DIST_ROOT) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(requestPathname)
  } catch {
    return { filePath: path.join(distRoot, "index.html"), fallback: true }
  }

  const candidate = path.resolve(distRoot, `.${decodedPath}`)
  const relativePath = path.relative(distRoot, candidate)
  const safeCandidate = relativePath.startsWith("..") || path.isAbsolute(relativePath)
    ? path.join(distRoot, "index.html")
    : candidate

  try {
    const stats = fs.statSync(safeCandidate)
    if (stats.isFile()) {
      return { filePath: safeCandidate, fallback: false }
    }
  } catch {
    // React Router handles client-side routes through index.html.
  }

  return { filePath: path.join(distRoot, "index.html"), fallback: true }
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url || "/", "http://localhost")
  const { filePath, fallback } = resolveStaticFile(requestUrl.pathname)
  const extension = path.extname(filePath)
  const contentType = MIME_TYPES.get(extension) || "application/octet-stream"

  fs.readFile(filePath, (error, content) => {
    if (error) {
      writeWithSecurityHeaders(req, res, 404, {
        "Content-Type": "text/plain; charset=utf-8",
      })
      res.end("Not found")
      return
    }

    writeWithSecurityHeaders(req, res, 200, {
      "Cache-Control": fallback ? "no-cache" : "public, max-age=3600",
      "Content-Type": contentType,
    })

    if (req.method === "HEAD") {
      res.end()
      return
    }

    res.end(content)
  })
}

export function createServer({
  backendOrigin = process.env.KS_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN,
} = {}) {
  return http.createServer((req, res) => {
    if (shouldRedirectToHttps(req)) {
      redirectToHttps(req, res)
      return
    }

    if (shouldRejectPublicApiPrefix(req)) {
      notFound(req, res)
      return
    }

    if (shouldProxyToBackend(req)) {
      proxyToBackend(req, res, backendOrigin)
      return
    }

    serveStatic(req, res)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const host = process.env.HOST || "127.0.0.1"
  const port = Number.parseInt(process.env.PORT || "4173", 10)

  createServer().listen(port, host, () => {
    console.log(`ks-web-app server listening on http://${host}:${port}`)
  })
}
