import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import "./BotMatrixReport.css"
import "./Leaderboard.css"

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "lifetime", label: "Lifetime" },
]
const TOTAL_SCOPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "humans", label: "vs Humans" },
  { value: "bots", label: "vs Bots" },
]
const TOTAL_SORT_FIELDS = [
  { key: "player", label: "Player" },
  { key: "games", label: "Total games" },
  { key: "avgPlies", label: "Avg plies" },
  { key: "avgCalls", label: "Avg calls" },
  { key: "avgTokens", label: "Avg tokens" },
  { key: "avgCost", label: "Avg cost" },
  { key: "winShare", label: "Win share" },
  { key: "drawShare", label: "Draw share" },
  { key: "lossShare", label: "Loss share" },
]
const DEFAULT_TOTALS_SORT = { key: "games", direction: "desc" }
const DEFAULT_USAGE_START_DATE = "2026-07-04"

function usageTooltip(startDate = DEFAULT_USAGE_START_DATE) {
  return `Average over known cost records starting ${startDate}.`
}

function stripTrailingZeros(value) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatAveragePlies(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toFixed(1)
}

function formatTokens(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  if (number <= 0) return "0"
  if (number >= 1_000_000) {
    const scaled = number / 1_000_000
    return `${stripTrailingZeros(scaled.toFixed(scaled < 10 ? 2 : 1))}M`
  }
  if (number >= 1_000) {
    const scaled = number / 1_000
    return `${stripTrailingZeros(scaled.toFixed(scaled < 10 ? 1 : 0))}k`
  }
  return Math.round(number).toLocaleString("en-US")
}

function formatCost(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  if (number <= 0) return "$0"
  const digits = number < 0.01 ? 4 : 3
  return `$${stripTrailingZeros(number.toFixed(digits))}`
}

function formatAverage(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toFixed(1)
}

function formatShare(value) {
  const number = numberOrNull(value)
  if (number === null || number <= 0) return "0%"
  const percent = number * 100
  return `${stripTrailingZeros(percent.toFixed(percent < 10 ? 1 : 0))}%`
}

function normalizePlayer(player) {
  const username = String(player?.username ?? "").trim()
  const name = String(player?.name ?? player?.display_name ?? player?.displayName ?? username).trim()
  return {
    username,
    name: name || username || "Unknown bot",
    code: username,
  }
}

function normalizeSummary(summary) {
  if (!summary) return null
  return {
    games: Number(summary.games ?? 0) || 0,
    record: String(summary.record ?? `${Number(summary.wins ?? 0)}-${Number(summary.draws ?? 0)}-${Number(summary.losses ?? 0)}`),
    averagePlies: numberOrNull(summary.average_plies ?? summary.averagePlies ?? summary.avg_plies ?? summary.avgPlies),
    playerTokens: numberOrNull(summary.player_tokens ?? summary.playerTokens),
    playerCost: numberOrNull(summary.player_cost ?? summary.playerCost),
    opponentTokens: numberOrNull(summary.opponent_tokens ?? summary.opponentTokens),
    opponentCost: numberOrNull(summary.opponent_cost ?? summary.opponentCost),
    usageRecordedGames: Number(summary.usage_recorded_games ?? summary.usageRecordedGames ?? 0) || 0,
    opponentUsageRecordedGames: Number(summary.opponent_usage_recorded_games ?? summary.opponentUsageRecordedGames ?? 0) || 0,
    usageStartDate: String(summary.usage_start_date ?? summary.usageStartDate ?? DEFAULT_USAGE_START_DATE),
  }
}

function normalizeTotalRow(row, usageStartDate) {
  const player = normalizePlayer(row?.player ?? row)
  return {
    code: player.username,
    player,
    playerName: player.name,
    games: Number(row?.games ?? 0) || 0,
    avgPlies: numberOrNull(row?.avg_plies ?? row?.avgPlies ?? row?.average_plies ?? row?.averagePlies),
    avgCalls: numberOrNull(row?.avg_calls ?? row?.avgCalls),
    avgTokens: numberOrNull(row?.avg_tokens ?? row?.avgTokens),
    avgCost: numberOrNull(row?.avg_cost ?? row?.avgCost),
    usageRecordedGames: Number(row?.usage_recorded_games ?? row?.usageRecordedGames ?? 0) || 0,
    usageStartDate: String(row?.usage_start_date ?? row?.usageStartDate ?? usageStartDate ?? DEFAULT_USAGE_START_DATE),
    winShare: numberOrNull(row?.win_share ?? row?.winShare),
    drawShare: numberOrNull(row?.draw_share ?? row?.drawShare),
    lossShare: numberOrNull(row?.loss_share ?? row?.lossShare),
  }
}

function sortTotalRows(rows, sort) {
  const field = TOTAL_SORT_FIELDS.some((item) => item.key === sort.key) ? sort.key : DEFAULT_TOTALS_SORT.key
  const direction = sort.direction === "asc" ? "asc" : "desc"
  const multiplier = direction === "asc" ? 1 : -1

  return [...rows].sort((left, right) => {
    if (field === "player") {
      return left.playerName.localeCompare(right.playerName) * multiplier
    }

    const leftValue = left[field]
    const rightValue = right[field]
    const leftMissing = leftValue === null || !Number.isFinite(Number(leftValue))
    const rightMissing = rightValue === null || !Number.isFinite(Number(rightValue))
    if (leftMissing && rightMissing) return left.playerName.localeCompare(right.playerName)
    if (leftMissing) return 1
    if (rightMissing) return -1

    const difference = Number(leftValue) - Number(rightValue)
    return difference === 0 ? left.playerName.localeCompare(right.playerName) : difference * multiplier
  })
}

function normalizeReport(payload, totalScope, totalSort) {
  const players = Array.isArray(payload?.players) ? payload.players.map(normalizePlayer) : []
  const totalRowsByScope = payload?.total_rows ?? payload?.totalRows ?? {}
  const scopedRows = Array.isArray(totalRowsByScope[totalScope]) ? totalRowsByScope[totalScope] : []
  const usageStartDate = String(payload?.usage_start_date ?? payload?.usageStartDate ?? DEFAULT_USAGE_START_DATE)

  return {
    players,
    matrixRows: (Array.isArray(payload?.matrix_rows) ? payload.matrix_rows : payload?.matrixRows ?? []).map((row) => ({
      player: normalizePlayer(row.player),
      cells: (Array.isArray(row.cells) ? row.cells : []).map((cell) => ({
        opponent: normalizePlayer(cell.opponent),
        summary: normalizeSummary(cell.summary),
      })),
      average: normalizeSummary(row.average),
    })),
    endConditionRows: (Array.isArray(payload?.end_condition_rows) ? payload.end_condition_rows : payload?.endConditionRows ?? []).map((row) => ({
      condition: row.condition ?? row.label,
      label: row.label ?? row.condition ?? "Unknown",
      games: Number(row.games ?? 0) || 0,
    })),
    totalRows: sortTotalRows(scopedRows.map((row) => normalizeTotalRow(row, usageStartDate)), totalSort),
    uniqueGameCount: Number(payload?.unique_game_count ?? payload?.uniqueGameCount ?? 0) || 0,
    rowRecordCount: Number(payload?.row_record_count ?? payload?.rowRecordCount ?? 0) || 0,
    usageStartDate,
  }
}

function PlayerLink({ player, className = "" }) {
  return (
    <Link className={className} to={`/user/${player.username}`}>
      {player.name}
    </Link>
  )
}

function botMatchupName(player) {
  return String(player?.name || player?.username || "Unknown bot")
    .replace(/^\s*LLM\s+/i, "")
    .replace(/\s*\(bot\)\s*$/i, "")
    .replace(/\bGPT-4.5 Nano\b/g, "GPT 4.5 Nano")
    .replace(/\bGPT-Nano\b/g, "GPT Nano")
    .replace(/\bGPT-OSS\b/g, "GPT OSS")
    .trim() || "Unknown bot"
}

function botMatchupGamesPath(rowPlayer, opponent) {
  if (!opponent?.username) {
    return `/user/${rowPlayer.username}/games`
  }
  const params = new URLSearchParams({ opponent: `bot:${opponent.username}` })
  return `/user/${rowPlayer.username}/games?${params.toString()}`
}

function MatrixCell({ rowPlayer, opponent, summary, average = false }) {
  if (!summary) {
    return <div className="bot-matrix-cell bot-matrix-cell--empty">Same player</div>
  }

  const gamesLabel = opponent?.username
    ? `${botMatchupName(rowPlayer)} versus ${botMatchupName(opponent)} games`
    : `${rowPlayer.name} games`

  return (
    <div className={average ? "bot-matrix-cell bot-matrix-cell--average" : "bot-matrix-cell"}>
      <strong>{summary.record}</strong>
      <span>{formatAveragePlies(summary.averagePlies)} avg plies</span>
      <Link to={botMatchupGamesPath(rowPlayer, opponent)}>{gamesLabel}</Link>
      <span title={usageTooltip(summary.usageStartDate)}>
        this bot {formatTokens(summary.playerTokens)} / {formatCost(summary.playerCost)}
      </span>
      <span title={usageTooltip(summary.usageStartDate)}>
        opponent {formatTokens(summary.opponentTokens)} / {formatCost(summary.opponentCost)}
      </span>
    </div>
  )
}

function SortableHeader({ field, sort, onSort }) {
  const active = sort.key === field.key
  const nextDirection = active && sort.direction === "desc" ? "asc" : field.key === "player" ? "asc" : "desc"
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={active ? "bot-matrix-sort-button bot-matrix-sort-button--active" : "bot-matrix-sort-button"}
        onClick={() => onSort(field.key)}
        aria-label={`Sort by ${field.label} ${nextDirection}`}
      >
        <span>{field.label}</span>
        {active ? <span className="bot-matrix-sort-button__direction">{sort.direction.toUpperCase()}</span> : null}
      </button>
    </th>
  )
}

function TotalMetric({ value, kind, usageStartDate }) {
  let text = "—"
  if (kind === "number") text = value.toLocaleString("en-US")
  else if (kind === "plies" || kind === "calls") text = formatAverage(value)
  else if (kind === "tokens") text = formatTokens(value)
  else if (kind === "cost") text = formatCost(value)
  else if (kind === "share") text = formatShare(value)

  if (kind === "calls" || kind === "tokens" || kind === "cost") {
    return <span title={usageTooltip(usageStartDate)}>{text}</span>
  }
  return text
}

export default function BotMatrixReportPage() {
  const [period, setPeriod] = useState("lifetime")
  const [totalScope, setTotalScope] = useState("all")
  const [totalSort, setTotalSort] = useState(DEFAULT_TOTALS_SORT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [payload, setPayload] = useState(null)
  const report = useMemo(() => normalizeReport(payload, totalScope, totalSort), [payload, totalScope, totalSort])

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const startedAt = Date.now()
      setLoading(true)
      setError("")
      setLoadDurationMs(null)
      try {
        const data = await techApi.getBotMatrixReport(period)
        if (!cancelled) setPayload(data)
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load bot matrix report.")
          setPayload(null)
        }
      } finally {
        if (!cancelled) {
          setLoadDurationMs(Date.now() - startedAt)
          setLoading(false)
        }
      }
    }

    loadReport()
    return () => { cancelled = true }
  }, [period])

  function handleTotalSort(field) {
    setTotalSort((current) => ({
      key: field,
      direction: current.key === field && current.direction === "desc" ? "asc" : field === "player" ? "asc" : "desc",
    }))
  }

  return (
    <main className="page-shell leaderboard-page bot-matrix-page">
      <h1>Bots' matrix</h1>
      <p className="page-meta-stamp">
        Built from {report.uniqueGameCount.toLocaleString("en-US")} completed bot-vs-bot games and {report.rowRecordCount.toLocaleString("en-US")} row-perspective records.
      </p>
      <div className="bot-matrix-controls">
        <label className="bot-matrix-period-field" htmlFor="bot-matrix-period">
          <span>Time period</span>
          <select id="bot-matrix-period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <TechReportLoadTime durationMs={loadDurationMs} failed={Boolean(error)} />
      {loading ? <p>Loading bot matrix...</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <section className="leaderboard-table-wrap bot-matrix-wrap" aria-labelledby="bot-matrix-heading">
            <h2 id="bot-matrix-heading">Outcome matrix</h2>
            <div className="bot-matrix-scroll">
              <table className="leaderboard-table bot-matrix-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {report.players.map((player) => (
                      <th key={player.username}>
                        <PlayerLink player={player} />
                      </th>
                    ))}
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {report.matrixRows.map((row) => (
                    <tr key={row.player.username}>
                      <th scope="row"><PlayerLink player={row.player} /></th>
                      {row.cells.map((cell) => (
                        <td key={`${row.player.username}-${cell.opponent.username}`}>
                          <MatrixCell rowPlayer={row.player} opponent={cell.opponent} summary={cell.summary} />
                        </td>
                      ))}
                      <td>
                        <MatrixCell rowPlayer={row.player} summary={row.average} average />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="leaderboard-table-wrap bot-matrix-small-table" aria-labelledby="bot-matrix-endings-heading">
            <h2 id="bot-matrix-endings-heading">End conditions</h2>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>End condition</th>
                  <th>Games</th>
                </tr>
              </thead>
              <tbody>
                {report.endConditionRows.map((row) => (
                  <tr key={row.condition}>
                    <td>{row.label}</td>
                    <td>{row.games.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="leaderboard-table-wrap bot-matrix-totals-table" aria-labelledby="bot-matrix-totals-heading">
            <h2 id="bot-matrix-totals-heading">Bot totals</h2>
            <div className="bot-matrix-total-scope" aria-label="Bot totals opponent scope">
              {TOTAL_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === totalScope ? "bot-matrix-total-scope__button bot-matrix-total-scope__button--active" : "bot-matrix-total-scope__button"}
                  aria-pressed={option.value === totalScope}
                  onClick={() => setTotalScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  {TOTAL_SORT_FIELDS.map((field) => (
                    <SortableHeader key={field.key} field={field} sort={totalSort} onSort={handleTotalSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.totalRows.map((row) => (
                  <tr key={row.code}>
                    <td><PlayerLink player={row.player} /></td>
                    <td>{row.games.toLocaleString("en-US")}</td>
                    <td><TotalMetric value={row.avgPlies} kind="plies" /></td>
                    <td><TotalMetric value={row.avgCalls} kind="calls" usageStartDate={row.usageStartDate} /></td>
                    <td><TotalMetric value={row.avgTokens} kind="tokens" usageStartDate={row.usageStartDate} /></td>
                    <td><TotalMetric value={row.avgCost} kind="cost" usageStartDate={row.usageStartDate} /></td>
                    <td><TotalMetric value={row.winShare} kind="share" /></td>
                    <td><TotalMetric value={row.drawShare} kind="share" /></td>
                    <td><TotalMetric value={row.lossShare} kind="share" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
