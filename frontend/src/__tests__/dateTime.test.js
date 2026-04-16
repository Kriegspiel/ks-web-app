import { describe, expect, it } from "vitest"
import { formatUtcDate, formatUtcDateTime } from "../utils/dateTime"

describe("dateTime helpers", () => {
  it("formats_utc_timestamps_and_dates", () => {
    expect(formatUtcDateTime("2026-04-05T12:03:12Z")).toBe("2026-04-05 12:03:12 UTC")
    expect(formatUtcDate("2026-04-05T12:03:12Z")).toBe("2026-04-05")
  })

  it("returns_empty_strings_for_missing_values_and_echoes_invalid_values", () => {
    expect(formatUtcDateTime("")).toBe("")
    expect(formatUtcDate("")).toBe("")
    expect(formatUtcDateTime("not-a-date")).toBe("not-a-date")
    expect(formatUtcDate("not-a-date")).toBe("not-a-date")
  })
})
