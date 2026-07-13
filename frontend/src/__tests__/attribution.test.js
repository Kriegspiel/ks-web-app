import { describe, expect, it, vi } from "vitest"
import { ATTRIBUTION_STORAGE_KEY, buildCampaignVisitPayload, captureCampaignVisit } from "../attribution"

function memoryStorage() {
  const store = new Map()
  return {
    getItem: vi.fn((key) => store.get(key) ?? null),
    setItem: vi.fn((key, value) => store.set(key, value)),
  }
}

describe("attribution capture", () => {
  it("builds_a_sanitized_campaign_visit_payload_from_utm_params", () => {
    const payload = buildCampaignVisitPayload(
      {
        pathname: "/lobby",
        search: "?utm_source=reddit&utm_medium=post&utm_campaign=ruleset-default%F0%9F%92%A5&utm_content=clip",
        hash: "#start",
      },
      "https://www.reddit.com/r/chessvariants/",
    )

    expect(payload).toEqual({
      landing_path: "/lobby?utm_source=reddit&utm_medium=post&utm_campaign=ruleset-default%F0%9F%92%A5&utm_content=clip#start",
      referrer_host: "www.reddit.com",
      utm: {
        source: "reddit",
        medium: "post",
        campaign: "ruleset-default",
        content: "clip",
      },
    })
  })

  it("uses_safe_defaults_for_missing_location_and_invalid_referrers", () => {
    expect(buildCampaignVisitPayload(
      { search: "?utm_source= newsletter " },
      "not a url",
    )).toEqual({
      landing_path: "/?utm_source= newsletter ",
      referrer_host: null,
      utm: {
        source: "newsletter",
      },
    })
    expect(buildCampaignVisitPayload(
      { pathname: "/play", search: "?utm_source=reddit", hash: "#top" },
      "",
    )).toMatchObject({
      landing_path: "/play?utm_source=reddit#top",
      referrer_host: null,
    })
    expect(buildCampaignVisitPayload(
      { pathname: "", search: "?utm_source=direct", hash: "" },
      "mailto:hello@example.com",
    )).toMatchObject({
      landing_path: "/?utm_source=direct",
      referrer_host: null,
    })
  })

  it("returns_null_when_no_utm_params_are_present", () => {
    expect(buildCampaignVisitPayload({ pathname: "/lobby", search: "" })).toBeNull()
  })

  it("records_each_campaign_url_once_per_session_storage_signature", async () => {
    const storage = memoryStorage()
    const record = vi.fn().mockResolvedValue({ attribution_id: "attr" })
    const location = { pathname: "/lobby", search: "?utm_source=reddit&utm_campaign=ruleset-default", hash: "" }

    await expect(captureCampaignVisit(location, { storage, record, referrer: "https://reddit.com/" })).resolves.toBe(true)
    await expect(captureCampaignVisit(location, { storage, record, referrer: "https://reddit.com/" })).resolves.toBe(false)

    expect(record).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(ATTRIBUTION_STORAGE_KEY, expect.stringContaining("ruleset-default"))
  })

  it("ignores_storage_read_and_write_failures", async () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("blocked") }),
      setItem: vi.fn(() => { throw new Error("blocked") }),
    }
    const record = vi.fn().mockResolvedValue({ attribution_id: "attr" })

    await expect(captureCampaignVisit(
      { pathname: "/lobby", search: "?utm_source=reddit", hash: "" },
      { storage, record },
    )).resolves.toBe(true)

    expect(record).toHaveBeenCalledTimes(1)
  })

  it("uses_browserless_defaults_when_no_options_are_supplied", async () => {
    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const record = vi.fn().mockResolvedValue({ attribution_id: "attr" })

    vi.stubGlobal("document", undefined)
    vi.stubGlobal("window", undefined)
    try {
      await expect(captureCampaignVisit(
        { pathname: "/play", search: "?utm_source=cli", hash: "" },
        { record },
      )).resolves.toBe(true)
    } finally {
      vi.stubGlobal("document", originalDocument)
      vi.stubGlobal("window", originalWindow)
      vi.unstubAllGlobals()
    }

    expect(record).toHaveBeenCalledWith({
      landing_path: "/play?utm_source=cli",
      referrer_host: null,
      utm: { source: "cli" },
    })
  })
})
