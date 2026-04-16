import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import EloChart from "../components/EloChart"

const SERIES_BY_MODE = {
  date: [
    { label: "2026-04-01", elo: 1500, delta: 12 },
    { label: "2026-04-02", elo: 1492, delta: -8 },
    { label: "2026-04-03", elo: 1492, delta: 0 },
  ],
  game: [
    { label: "Game 1", elo: 1500, delta: 12 },
    { label: "Game 2", elo: 1492, delta: -8 },
    { label: "Game 3", elo: 1492, delta: 0 },
  ],
}

function stubPlotBounds(plot) {
  return vi.spyOn(plot, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 332,
    height: 152,
    right: 332,
    bottom: 152,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

describe("EloChart", () => {
  it("renders_empty_state_when_no_series_are_available", () => {
    render(<EloChart seriesByMode={{ date: [], game: [] }} emptyText="No Elo history yet." />)

    expect(screen.getByText("No Elo history yet.")).toBeInTheDocument()
  })

  it("renders_toolbars_and_updates_the_tooltip_when_hovering_points", () => {
    const { container } = render(
      <EloChart
        seriesByMode={SERIES_BY_MODE}
        emptyText="No Elo history yet."
        ratingTrack="vs_humans"
      />,
    )

    expect(screen.getByRole("tab", { name: "vs Humans" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Date" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Start 1500")).toBeInTheDocument()
    expect(screen.getByText("Latest 1492")).toBeInTheDocument()

    const plot = container.querySelector(".elo-chart__plot")
    const boundsSpy = stubPlotBounds(plot)

    fireEvent.mouseMove(plot, { clientX: 0, clientY: 20 })
    expect(screen.getByText("vs Humans Elo 1500")).toBeInTheDocument()
    expect(screen.getByText("Delta +12")).toBeInTheDocument()

    fireEvent.mouseMove(plot, { clientX: 332, clientY: 20 })
    expect(screen.getByText("vs Humans Elo 1492")).toBeInTheDocument()
    expect(screen.getByText("Delta 0")).toBeInTheDocument()

    fireEvent.mouseLeave(plot)
    expect(screen.queryByText(/Delta /)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getByRole("tab", { name: "Game number" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Game 1")).toBeInTheDocument()
    expect(screen.getByText("Game 3")).toBeInTheDocument()

    boundsSpy.mockRestore()
  })

  it("supports_single_point_series_without_the_track_toggle", () => {
    const singlePointSeries = {
      date: [{ label: "Only game", elo: 1600, delta: -4 }],
      game: [{ label: "Game 1", elo: 1600, delta: -4 }],
    }
    const { container } = render(
      <EloChart
        seriesByMode={singlePointSeries}
        emptyText="No Elo history yet."
        ratingTrack="mystery"
        showTrackToggle={false}
      />,
    )

    expect(screen.queryByRole("tablist", { name: "Elo track" })).not.toBeInTheDocument()

    const plot = container.querySelector(".elo-chart__plot")
    const boundsSpy = stubPlotBounds(plot)
    fireEvent.mouseMove(plot, { clientX: 10, clientY: 20 })

    expect(screen.getByText("Overall Elo 1600")).toBeInTheDocument()
    expect(screen.getByText("Delta -4")).toBeInTheDocument()

    boundsSpy.mockRestore()
  })
})
