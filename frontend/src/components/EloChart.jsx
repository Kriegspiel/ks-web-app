import { useId, useMemo, useState } from "react"
import { formatUtcDate } from "../utils/dateTime"

function buildEloSeries(historyGames) {
  if (!Array.isArray(historyGames)) {
    return []
  }

  return [...historyGames]
    .filter((game) => Number.isFinite(Number(game?.elo_after)))
    .sort((left, right) => Date.parse(left?.played_at ?? "") - Date.parse(right?.played_at ?? ""))
    .map((game, index) => ({
      index,
      gameNumber: index + 1,
      dateLabel: game?.played_at ? formatUtcDate(game.played_at) : "Unknown date",
      elo: Number(game.elo_after),
      delta: Number(game?.elo_delta ?? 0),
    }))
}

function buildChartPoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { polyline: "", circles: [], minElo: 0, maxElo: 0, ticks: [] }
  }

  const width = 320
  const height = 152
  const paddingX = 18
  const paddingY = 18
  const minElo = Math.min(...points.map((point) => point.elo))
  const maxElo = Math.max(...points.map((point) => point.elo))
  const eloRange = Math.max(1, maxElo - minElo)
  const xStep = points.length === 1 ? 0 : (width - paddingX * 2) / (points.length - 1)
  const chartHeight = height - paddingY * 2

  const circles = points.map((point, index) => {
    const x = paddingX + (xStep * index)
    const y = height - paddingY - (((point.elo - minElo) / eloRange) * chartHeight)
    return { ...point, x, y }
  })

  const tickCount = Math.min(4, Math.max(2, points.length))
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0 : index / (tickCount - 1)
    const value = Math.round(maxElo - (eloRange * ratio))
    const y = paddingY + (chartHeight * ratio)
    return { value, y }
  })

  return {
    polyline: circles.map((point) => `${point.x},${point.y}`).join(" "),
    circles,
    minElo,
    maxElo,
    ticks,
    width,
    height,
  }
}

function formatDelta(delta) {
  if (!delta) {
    return "0"
  }
  return `${delta > 0 ? "+" : ""}${delta}`
}

export default function EloChart({ historyGames, emptyText }) {
  const [xAxisMode, setXAxisMode] = useState("date")
  const chartId = useId()
  const series = useMemo(() => buildEloSeries(historyGames), [historyGames])
  const chart = useMemo(() => buildChartPoints(series), [series])
  const [activeIndex, setActiveIndex] = useState(series.length > 0 ? series.length - 1 : -1)
  const activePoint = activeIndex >= 0 ? chart.circles[activeIndex] : null

  if (series.length === 0) {
    return <p>{emptyText}</p>
  }

  const axisStart = xAxisMode === "date" ? series[0].dateLabel : `Game ${series[0].gameNumber}`
  const axisEnd = xAxisMode === "date" ? series[series.length - 1].dateLabel : `Game ${series[series.length - 1].gameNumber}`
  const activeLabel = activePoint
    ? (xAxisMode === "date" ? activePoint.dateLabel : `Game ${activePoint.gameNumber}`)
    : ""
  const tooltipStyle = activePoint
    ? {
        left: `${(activePoint.x / chart.width) * 100}%`,
        top: `${(activePoint.y / chart.height) * 100}%`,
      }
    : null

  function handlePlotHover(event) {
    if (chart.circles.length === 0) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - bounds.left) / bounds.width) * chart.width
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    chart.circles.forEach((point, index) => {
      const distance = Math.abs(point.x - svgX)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    setActiveIndex(closestIndex)
  }

  return (
    <div className="elo-chart">
      <div className="elo-chart__toolbar">
        <span className={`elo-chart__mode-label${xAxisMode === "date" ? " is-active" : ""}`}>Date</span>
        <button
          type="button"
          role="switch"
          aria-checked={xAxisMode === "game"}
          aria-label={`X-axis mode: ${xAxisMode === "game" ? "Game number" : "Date"}`}
          className="elo-chart__switch"
          onClick={() => setXAxisMode((current) => (current === "date" ? "game" : "date"))}
        >
          <span className="elo-chart__switch-track">
            <span className={`elo-chart__switch-thumb${xAxisMode === "game" ? " is-game" : ""}`} />
          </span>
        </button>
        <span className={`elo-chart__mode-label${xAxisMode === "game" ? " is-active" : ""}`}>Game number</span>
      </div>
      <div
        className="elo-chart__plot"
        onMouseMove={handlePlotHover}
        onMouseLeave={() => setActiveIndex(series.length - 1)}
      >
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Elo rating over time">
          {chart.ticks.map((tick) => (
            <g key={`${tick.value}-${tick.y}`}>
              <line className="elo-chart__grid" x1="18" x2={chart.width - 18} y1={tick.y} y2={tick.y} />
              <text className="elo-chart__tick-label" x="0" y={tick.y + 4}>{tick.value}</text>
            </g>
          ))}
          {activePoint ? (
            <line className="elo-chart__focus-line" x1={activePoint.x} x2={activePoint.x} y1="18" y2={chart.height - 18} />
          ) : null}
          <polyline className="elo-chart__line" fill="none" points={chart.polyline} />
          {chart.circles.map((point) => (
            <circle
              key={`${point.dateLabel}-${point.index}`}
              className={`elo-chart__point${activePoint?.index === point.index ? " is-active" : ""}`}
              cx={point.x}
              cy={point.y}
              r="4"
              tabIndex="0"
              onMouseEnter={() => setActiveIndex(point.index)}
              onFocus={() => setActiveIndex(point.index)}
            >
              <title>{`${xAxisMode === "date" ? point.dateLabel : `Game ${point.gameNumber}`}: ${point.elo} (${formatDelta(point.delta)})`}</title>
            </circle>
          ))}
        </svg>
        {activePoint && tooltipStyle ? (
          <div className="elo-chart__tooltip" style={tooltipStyle} aria-live="polite">
            <strong>{activeLabel}</strong>
            <span>Elo {activePoint.elo}</span>
            <span>Delta {formatDelta(activePoint.delta)}</span>
          </div>
        ) : null}
      </div>
      <div className="elo-chart__axis" aria-hidden="true">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>
      <div className="elo-chart__summary">
        <span>Start {series[0].elo}</span>
        <span>Latest {series[series.length - 1].elo}</span>
      </div>
    </div>
  )
}
