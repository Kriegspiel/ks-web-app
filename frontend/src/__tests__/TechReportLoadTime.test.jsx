import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import TechReportLoadTime from "../components/TechReportLoadTime"

describe("TechReportLoadTime", () => {
  it("formats_invalid_short_and_failed_durations", () => {
    const { rerender, container } = render(<TechReportLoadTime durationMs={null} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<TechReportLoadTime durationMs={-1} />)
    expect(screen.getByText("Loaded in .")).toBeInTheDocument()

    rerender(<TechReportLoadTime durationMs={250} />)
    expect(screen.getByText("Loaded in 250 ms.")).toBeInTheDocument()

    rerender(<TechReportLoadTime durationMs={12_345} failed />)
    expect(screen.getByText("Request failed after 12 s.")).toBeInTheDocument()
  })
})
