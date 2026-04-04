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
    return { polyline: "", circles: [] }
  }

  const width = 320
  const height = 112
  const paddingX = 12
  const paddingY = 12
  const minElo = Math.min(...points.map((point) => point.elo))
  const maxElo = Math.max(...points.map((point) => point.elo))
  const eloRange = Math.max(1, maxElo - minElo)
  const xStep = points.length === 1 ? 0 : (width - paddingX * 2) / (points.length - 1)

  const circles = points.map((point, index) => {
    const x = paddingX + (xStep * index)
    const y = height - paddingY - (((point.elo - minElo) / eloRange) * (height - paddingY * 2))
    return { ...point, x, y }
  })

  return {
    polyline: circles.map((point) => `${point.x},${point.y}`).join(" "),
    circles,
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

  return (
    <div className="elo-chart">
      <div className="elo-chart__toolbar" role="group" aria-label="Elo chart axis mode">
        <span className="elo-chart__toolbar-label">X-axis</span>
        <button
          type="button"
          className={`elo-chart__toggle${xAxisMode === "game" ? " is-active" : ""}`}
          aria-pressed={xAxisMode === "game"}
          onClick={() => setXAxisMode("game")}
        >
          Game number
        </button>
        <button
          type="button"
          className={`elo-chart__toggle${xAxisMode === "date" ? " is-active" : ""}`}
          aria-pressed={xAxisMode === "date"}
          onClick={() => setXAxisMode("date")}
        >
          Date
        </button>
      </div>
      <div className="elo-chart__plot">
        <svg viewBox="0 0 320 112" role="img" aria-label="Elo rating over time">
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
      </div>
      <div className="elo-chart__axis" aria-hidden="true">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>
      {activePoint ? (
        <div className="elo-chart__details" aria-live="polite">
          <strong>{xAxisMode === "date" ? activePoint.dateLabel : `Game ${activePoint.gameNumber}`}</strong>
          <span>Elo {activePoint.elo}</span>
          <span>Delta {formatDelta(activePoint.delta)}</span>
        </div>
      ) : null}
      <div className="elo-chart__summary">
        <span>Start {series[0].elo}</span>
        <span>Latest {series[series.length - 1].elo}</span>
      </div>
    </div>
  )
}
