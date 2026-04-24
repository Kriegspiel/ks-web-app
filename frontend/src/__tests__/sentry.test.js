import { afterEach, describe, expect, it, vi } from "vitest"

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  reactRouterV7BrowserTracingIntegration: vi.fn(() => ({ name: "react-router-v7" })),
  reactErrorHandler: vi.fn(() => vi.fn()),
}))

vi.mock("@sentry/react", () => sentryMocks)

afterEach(() => {
  Object.values(sentryMocks).forEach((mock) => mock.mockClear())
})

describe("Sentry browser setup", () => {
  it("skips_initialization_without_a_dsn", async () => {
    const { initSentry } = await import("../sentry")

    expect(initSentry({ MODE: "production" })).toBe(false)
    expect(sentryMocks.init).not.toHaveBeenCalled()
    expect(sentryMocks.setTag).not.toHaveBeenCalled()
  })

  it("builds_privacy_first_options_with_release_environment_and_tracing", async () => {
    const { beforeSend, buildSentryOptions } = await import("../sentry")

    const options = buildSentryOptions({
      MODE: "production",
      VITE_SENTRY_DSN: "https://public@example.com/1",
      VITE_SENTRY_ENVIRONMENT: "prod",
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.25",
    })

    expect(options).toMatchObject({
      dsn: "https://public@example.com/1",
      environment: "prod",
      sendDefaultPii: false,
      tracesSampleRate: 0.25,
      beforeSend,
    })
    expect(options.release).toMatch(/^ks-web-app@\d+\.\d+\.\d+$/)
    expect(options.integrations).toEqual([{ name: "react-router-v7" }])
    expect(sentryMocks.reactRouterV7BrowserTracingIntegration).toHaveBeenCalledTimes(1)
  })

  it("initializes_and_tags_browser_events_when_a_dsn_is_present", async () => {
    const { initSentry } = await import("../sentry")

    expect(initSentry({ MODE: "production", VITE_SENTRY_DSN: "https://public@example.com/1" })).toBe(true)

    expect(sentryMocks.init).toHaveBeenCalledTimes(1)
    expect(sentryMocks.setTag).toHaveBeenCalledWith("service", "ks-web-app")
  })

  it("redacts_sensitive_request_headers_before_sending", async () => {
    const { beforeSend } = await import("../sentry")
    const event = {
      request: {
        headers: {
          Authorization: "Bearer secret",
          cookie: "session=secret",
          "X-Bot-Registration-Key": "secret",
          "User-Agent": "vitest",
        },
      },
    }

    expect(beforeSend(event)).toEqual({
      request: {
        headers: {
          Authorization: "[Filtered]",
          cookie: "[Filtered]",
          "X-Bot-Registration-Key": "[Filtered]",
          "User-Agent": "vitest",
        },
      },
    })
  })

  it("clamps_invalid_trace_sample_rates_to_the_safe_range", async () => {
    const { parseSampleRate } = await import("../sentry")

    expect(parseSampleRate(undefined)).toBe(0)
    expect(parseSampleRate("oops")).toBe(0)
    expect(parseSampleRate("-1")).toBe(0)
    expect(parseSampleRate("2")).toBe(1)
  })
})
