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
})
