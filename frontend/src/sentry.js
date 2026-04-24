import React from "react"
import * as Sentry from "@sentry/react"
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom"
import { FRONTEND_VERSION } from "./version"

const SENSITIVE_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "x-bot-registration-key",
])

export function parseSampleRate(value) {
  if (value === undefined || value === null || value === "") {
    return 0
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.min(1, Math.max(0, parsed))
}

export function beforeSend(event) {
  const headers = event?.request?.headers
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return event
  }

  Object.keys(headers).forEach((name) => {
    if (SENSITIVE_REQUEST_HEADERS.has(name.toLowerCase())) {
      headers[name] = "[Filtered]"
    }
  })
  return event
}

export function buildSentryOptions(env = import.meta.env) {
  const dsn = env.VITE_SENTRY_DSN
  if (!dsn) {
    return null
  }

  return {
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE || "production",
    release: `ks-web-app@${FRONTEND_VERSION}`,
    sendDefaultPii: false,
    tracesSampleRate: parseSampleRate(env.VITE_SENTRY_TRACES_SAMPLE_RATE),
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    beforeSend,
  }
}

export function initSentry(env = import.meta.env) {
  const options = buildSentryOptions(env)
  if (!options) {
    return false
  }

  Sentry.init(options)
  Sentry.setTag("service", "ks-web-app")
  return true
}

export { Sentry }
