import { recordCampaignVisit } from "./services/api"

export const ATTRIBUTION_STORAGE_KEY = "ks_attribution_last_visit_v1"

const UTM_PARAMS = [
  ["utm_source", "source", 80],
  ["utm_medium", "medium", 80],
  ["utm_campaign", "campaign", 120],
  ["utm_content", "content", 120],
  ["utm_term", "term", 120],
]

function sanitizeValue(value, maxLength) {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[^a-zA-Z0-9_.:/@+\-\s]/g, "")
    .trim()
}

function referrerHost(referrer) {
  if (!referrer) return null
  try {
    return new URL(referrer).host || null
  } catch {
    return null
  }
}

function locationPath(location) {
  const pathname = location?.pathname || "/"
  const search = location?.search || ""
  const hash = location?.hash || ""
  return `${pathname}${search}${hash}`
}

export function buildCampaignVisitPayload(location, referrer = "") {
  const params = new URLSearchParams(location?.search || "")
  const utm = {}

  for (const [paramName, fieldName, maxLength] of UTM_PARAMS) {
    const value = sanitizeValue(params.get(paramName) || "", maxLength)
    if (value) {
      utm[fieldName] = value
    }
  }

  if (Object.keys(utm).length === 0) {
    return null
  }

  return {
    landing_path: locationPath(location),
    referrer_host: referrerHost(referrer),
    utm,
  }
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem?.(key, value)
  } catch {
    // Ignore storage denial; attribution capture should never block the app.
  }
}

export async function captureCampaignVisit(
  location,
  {
    referrer = typeof document !== "undefined" ? document.referrer : "",
    storage = typeof window !== "undefined" ? window.sessionStorage : null,
    record = recordCampaignVisit,
  } = {},
) {
  const payload = buildCampaignVisitPayload(location, referrer)
  if (!payload) return false

  const signature = JSON.stringify(payload)
  if (readStorage(storage, ATTRIBUTION_STORAGE_KEY) === signature) {
    return false
  }

  await record(payload)
  writeStorage(storage, ATTRIBUTION_STORAGE_KEY, signature)
  return true
}
