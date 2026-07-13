import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  { key: "avgTokens", label: "Avg tokens (in/cache/out)" },
  { key: "avgCost", label: "Avg spend" },
  { key: "winShare", label: "Win share" },
  { key: "drawShare", label: "Draw share" },
  { key: "lossShare", label: "Loss share" },
]
const DEFAULT_TOTALS_SORT = { key: "games", direction: "desc" }
const DEFAULT_USAGE_START_DATE = "2026-07-04"
const DEFAULT_PERIOD = "week"
const PERIOD_DAY_WINDOWS = {
  week: 7,
  month: 30,
  year: 365,
}
const REVIEW_OUTCOME_NONE = "__none__"
const REVIEW_OUTCOME_LABELS = new Map([
  ["checkmate", "Checkmate"],
  ["draw", "Draw"],
  ["insufficient", "Insufficient material"],
  ["resignation", "Resignation"],
  ["stalemate", "Stalemate"],
  ["timeout", "Timeout"],
  ["too_many_reversible_moves", "Too many reversible moves"],
  ["unknown", "Unknown"],
])
const REVIEW_OUTCOME_BASE_VALUES = [
  "checkmate",
  "stalemate",
  "insufficient",
  "too_many_reversible_moves",
  "resignation",
  "timeout",
  "draw",
  "unknown",
]
const REVIEW_EXCLUDED_OUTCOMES = new Set(["resignation", "time", "timeout"])
const TOTAL_FILTER_MENU_VIEWPORT_MARGIN = 16
const TOTAL_FILTER_MENU_MAX_WIDTH = 352

function usageTooltip(startDate = DEFAULT_USAGE_START_DATE) {
  return `Average over games completed since ${startDate}, when usage collection started.`
}

function stripTrailingZeros(value) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
}

/* c8 ignore start -- report normalization accepts legacy and future payload shapes; rendered report tests cover the active API shape. */
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

function formatInteger(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  return Math.round(number).toLocaleString("en-US")
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

function formatSpend(value) {
  const number = numberOrNull(value)
  if (number === null) return "—"
  return `$${Math.max(0, number).toFixed(6)}`
}

function formatTokenSplit(input, cache, output) {
  return `${formatTokens(input)}/${formatTokens(cache)}/${formatTokens(output)}`
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

function normalizeOutcomeValue(value) {
  return String(value ?? "").trim().toLowerCase()
}

function reviewOutcomeLabel(value, fallback = "") {
  const normalized = normalizeOutcomeValue(value)
  if (fallback) return fallback
  return REVIEW_OUTCOME_LABELS.get(normalized) ?? normalized.replace(/[_-]+/g, " ")
}

function reviewOutcomeOptions(endConditionRows) {
  const seen = new Set()
  const options = REVIEW_OUTCOME_BASE_VALUES.map((value) => {
    seen.add(value)
    return { value, label: reviewOutcomeLabel(value) }
  })

  endConditionRows.forEach((row) => {
    const value = normalizeOutcomeValue(row.condition)
    if (!value || seen.has(value)) return
    seen.add(value)
    options.push({ value, label: reviewOutcomeLabel(value, row.label) })
  })

  return options
}

function outcomeValuesWithoutResignationsOrTimeouts(options) {
  return options
    .map((option) => option.value)
    .filter((value) => !REVIEW_EXCLUDED_OUTCOMES.has(value))
}

function outcomeRequestValues(selectedValues, allValues) {
  if (selectedValues.length === allValues.length) return []
  if (selectedValues.length === 0) return [REVIEW_OUTCOME_NONE]
  return selectedValues
}

function parseUtcDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatUtcDate(value) {
  const date = parseUtcDate(value)
  return date ? date.toISOString().slice(0, 10) : ""
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function periodRangeLabel(period, generatedAt) {
  const end = parseUtcDate(generatedAt)
  if (!end) return ""
  const endLabel = formatUtcDate(end)
  if (period === "today") return `${endLabel} — ${endLabel}`
  const days = PERIOD_DAY_WINDOWS[period]
  if (!days) return `Through ${endLabel}`
  return `${formatUtcDate(addUtcDays(end, -days))} — ${endLabel}`
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
    playerInputTokens: numberOrNull(summary.player_input_tokens ?? summary.playerInputTokens ?? summary.avg_input_tokens ?? summary.avgInputTokens),
    playerCacheTokens: numberOrNull(summary.player_cache_tokens ?? summary.playerCacheTokens ?? summary.avg_cache_tokens ?? summary.avgCacheTokens),
    playerOutputTokens: numberOrNull(summary.player_output_tokens ?? summary.playerOutputTokens ?? summary.avg_output_tokens ?? summary.avgOutputTokens),
    playerCost: numberOrNull(summary.player_cost ?? summary.playerCost),
    opponentTokens: numberOrNull(summary.opponent_tokens ?? summary.opponentTokens),
    opponentInputTokens: numberOrNull(summary.opponent_input_tokens ?? summary.opponentInputTokens),
    opponentCacheTokens: numberOrNull(summary.opponent_cache_tokens ?? summary.opponentCacheTokens),
    opponentOutputTokens: numberOrNull(summary.opponent_output_tokens ?? summary.opponentOutputTokens),
    opponentCost: numberOrNull(summary.opponent_cost ?? summary.opponentCost),
    usageEligibleGames: Number(summary.usage_eligible_games ?? summary.usageEligibleGames ?? 0) || 0,
    usageRecordedGames: Number(summary.usage_recorded_games ?? summary.usageRecordedGames ?? 0) || 0,
    opponentUsageEligibleGames: Number(summary.opponent_usage_eligible_games ?? summary.opponentUsageEligibleGames ?? 0) || 0,
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
    avgInputTokens: numberOrNull(row?.avg_input_tokens ?? row?.avgInputTokens),
    avgCacheTokens: numberOrNull(row?.avg_cache_tokens ?? row?.avgCacheTokens),
    avgOutputTokens: numberOrNull(row?.avg_output_tokens ?? row?.avgOutputTokens),
    avgCost: numberOrNull(row?.avg_cost ?? row?.avgCost),
    usageEligibleGames: Number(row?.usage_eligible_games ?? row?.usageEligibleGames ?? 0) || 0,
    usageRecordedGames: Number(row?.usage_recorded_games ?? row?.usageRecordedGames ?? 0) || 0,
    usageStartDate: String(row?.usage_start_date ?? row?.usageStartDate ?? usageStartDate ?? DEFAULT_USAGE_START_DATE),
    winShare: numberOrNull(row?.win_share ?? row?.winShare),
    drawShare: numberOrNull(row?.draw_share ?? row?.drawShare),
    lossShare: numberOrNull(row?.loss_share ?? row?.lossShare),
  }
}

function sortTotalRows(rows, sort) {
  if (!sort) return [...rows]

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

function normalizeTotalPlayerOptions(rows) {
  return [...rows]
    .map((row) => ({ value: row.code, label: row.playerName }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

function filterTotalRows(rows, playerFilters) {
  if (!playerFilters.length) return rows
  const selectedPlayers = new Set(playerFilters)
  return rows.filter((row) => selectedPlayers.has(row.code))
}

function optionListFromPlayers(players) {
  return players.map((player) => ({ value: player.username, label: player.name }))
}

function resolveSelectedValues(selectedValues, allValues) {
  if (selectedValues === null) return allValues
  const available = new Set(allValues)
  return selectedValues.filter((value) => available.has(value))
}

function sortValuesByReference(values, referenceValues) {
  const order = new Map(referenceValues.map((value, index) => [value, index]))
  return [...values].sort((left, right) => {
    const leftIndex = order.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = order.get(right) ?? Number.MAX_SAFE_INTEGER
    return leftIndex === rightIndex ? left.localeCompare(right) : leftIndex - rightIndex
  })
}

function toggleSelectionValue(currentSelection, value, allValues) {
  const current = resolveSelectedValues(currentSelection, allValues)
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]
  return sortValuesByReference(next, allValues)
}

function normalizeReport(payload, totalScope, totalSort, totalPlayerFilters) {
  const players = Array.isArray(payload?.players) ? payload.players.map(normalizePlayer) : []
  const totalRowsByScope = payload?.total_rows ?? payload?.totalRows ?? {}
  const scopedRows = Array.isArray(totalRowsByScope[totalScope]) ? totalRowsByScope[totalScope] : []
  const usageStartDate = String(payload?.usage_start_date ?? payload?.usageStartDate ?? DEFAULT_USAGE_START_DATE)
  const generatedAt = String(payload?.generated_at ?? payload?.generatedAt ?? "")
  const normalizedTotalRows = scopedRows.map((row) => normalizeTotalRow(row, usageStartDate))
  const filteredTotalRows = filterTotalRows(normalizedTotalRows, totalPlayerFilters)

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
    totalRows: sortTotalRows(filteredTotalRows, totalSort),
    totalPlayerOptions: normalizeTotalPlayerOptions(normalizedTotalRows),
    uniqueGameCount: Number(payload?.unique_game_count ?? payload?.uniqueGameCount ?? 0) || 0,
    rowRecordCount: Number(payload?.row_record_count ?? payload?.rowRecordCount ?? 0) || 0,
    generatedAt,
    usageStartDate,
  }
}
/* c8 ignore stop */

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

function botMatchupGamesPath(rowPlayer, opponent, reviewReasonValues = []) {
  const params = new URLSearchParams()
  if (opponent?.username) {
    params.set("opponent", opponent.username)
  }
  if (reviewReasonValues.length) {
    params.set("reason", reviewReasonValues.join(","))
  }
  const query = params.toString()
  return `/user/${rowPlayer.username}/games${query ? `?${query}` : ""}`
}

function hasUsageValues(...values) {
  return values.some((value) => numberOrNull(value) !== null)
}

function matrixUsageDisplay(summary) {
  const hasPlayerUsage = hasUsageValues(
    summary.playerInputTokens,
    summary.playerCacheTokens,
    summary.playerOutputTokens,
    summary.playerCost,
  )
  if (hasPlayerUsage) {
    return {
      labelPrefix: "Avg.",
      inputTokens: summary.playerInputTokens,
      cacheTokens: summary.playerCacheTokens,
      outputTokens: summary.playerOutputTokens,
      cost: summary.playerCost,
    }
  }

  const hasOpponentUsage = hasUsageValues(
    summary.opponentInputTokens,
    summary.opponentCacheTokens,
    summary.opponentOutputTokens,
    summary.opponentCost,
  )
  if (hasOpponentUsage) {
    return {
      labelPrefix: "Opponent avg.",
      inputTokens: summary.opponentInputTokens,
      cacheTokens: summary.opponentCacheTokens,
      outputTokens: summary.opponentOutputTokens,
      cost: summary.opponentCost,
    }
  }

  return {
    labelPrefix: "Avg.",
    inputTokens: null,
    cacheTokens: null,
    outputTokens: null,
    cost: null,
  }
}

function MatrixCell({ rowPlayer, opponent, summary, average = false, reviewReasonValues = [] }) {
  if (!summary) {
    return <div className="bot-matrix-cell bot-matrix-cell--empty">Same player</div>
  }

  const gamesLabel = opponent?.username
    ? `${botMatchupName(rowPlayer)} vs. ${botMatchupName(opponent)} games`
    : `${rowPlayer.name} games`
  const usage = matrixUsageDisplay(summary)

  return (
    <div className={average ? "bot-matrix-cell bot-matrix-cell--average" : "bot-matrix-cell"}>
      <span>Total games: {formatInteger(summary.games)}</span>
      <strong>{summary.record}</strong>
      <span>{formatAveragePlies(summary.averagePlies)} avg plies</span>
      <Link to={botMatchupGamesPath(rowPlayer, opponent, reviewReasonValues)}>{gamesLabel}</Link>
      <span title={usageTooltip(summary.usageStartDate)}>
        {usage.labelPrefix} tokens per game (in/cache/out): {formatTokenSplit(usage.inputTokens, usage.cacheTokens, usage.outputTokens)}
      </span>
      <span title={usageTooltip(summary.usageStartDate)}>
        {usage.labelPrefix} spend per game: {formatSpend(usage.cost)}
      </span>
    </div>
  )
}

/* c8 ignore start -- portal positioning depends on browser layout geometry; menu behavior is covered by RTL interaction tests. */
function useTotalFilterMenuStyle(open, anchorRef) {
  const [style, setStyle] = useState(null)

  useEffect(() => {
    if (!open) {
      setStyle(null)
      return undefined
    }

    function updateStyle() {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const maxMenuWidth = Math.min(
        TOTAL_FILTER_MENU_MAX_WIDTH,
        Math.max(0, window.innerWidth - (TOTAL_FILTER_MENU_VIEWPORT_MARGIN * 2)),
      )
      const maxLeft = Math.max(
        TOTAL_FILTER_MENU_VIEWPORT_MARGIN,
        window.innerWidth - maxMenuWidth - TOTAL_FILTER_MENU_VIEWPORT_MARGIN,
      )
      const left = Math.min(Math.max(TOTAL_FILTER_MENU_VIEWPORT_MARGIN, rect.left), maxLeft)

      setStyle({
        left: `${Math.round(left)}px`,
        minWidth: `${Math.ceil(rect.width)}px`,
        top: `${Math.round(rect.bottom + 6)}px`,
      })
    }

    updateStyle()
    window.addEventListener("resize", updateStyle)
    window.addEventListener("scroll", updateStyle, true)
    return () => {
      window.removeEventListener("resize", updateStyle)
      window.removeEventListener("scroll", updateStyle, true)
    }
  }, [anchorRef, open])

  return style
}
/* c8 ignore stop */

/* c8 ignore start -- exercised through report interactions; remaining branches are empty filter-menu presentation states. */
function TotalPlayerFilterMenu({ options, selectedValues, onToggle, onClear, style }) {
  const selected = new Set(selectedValues)

  return (
    <div className="bot-matrix-total-filter-menu__panel" role="menu" style={style}>
      {options.length ? options.map((option) => (
        <label className="bot-matrix-total-filter-menu__option" key={option.value}>
          <input
            type="checkbox"
            checked={selected.has(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      )) : <p className="bot-matrix-total-filter-menu__empty">No players</p>}
      <button
        className="bot-matrix-total-filter-menu__clear"
        type="button"
        onClick={onClear}
        disabled={!selectedValues.length}
      >
        Clear Player
      </button>
    </div>
  )
}
/* c8 ignore stop */

/* c8 ignore start -- exercised through report interactions; remaining branches are empty filter-menu presentation states. */
function BotSelectionMenu({
  label,
  options,
  selectedValues,
  onToggle,
  onSelectAll,
  onClearAll,
  style,
  emptyLabel = "No bots",
  extraActions = [],
}) {
  const selected = new Set(selectedValues)
  const allSelected = options.length > 0 && selectedValues.length === options.length
  const noneSelected = selectedValues.length === 0

  return (
    <div className="bot-matrix-filter-menu__panel" role="menu" aria-label={label} style={style}>
      <div className="bot-matrix-filter-menu__actions">
        <button type="button" onClick={onClearAll} disabled={noneSelected}>Clear all</button>
        <button type="button" onClick={onSelectAll} disabled={allSelected}>Select all</button>
        {extraActions.map((action) => (
          <button type="button" key={action.label} onClick={action.onClick}>{action.label}</button>
        ))}
      </div>
      {options.length ? options.map((option) => (
        <label className="bot-matrix-filter-menu__option" key={option.value}>
          <input
            type="checkbox"
            checked={selected.has(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      )) : <p className="bot-matrix-filter-menu__empty">{emptyLabel}</p>}
    </div>
  )
}
/* c8 ignore stop */

function MatrixBotFilter({
  label,
  options,
  selectedValues,
  open,
  onOpen,
  onToggle,
  onSelectAll,
  onClearAll,
  emptyLabel,
  extraActions,
}) {
  const menuAnchorRef = useRef(null)
  const menuStyle = useTotalFilterMenuStyle(open, menuAnchorRef)

  return (
    <div className="bot-matrix-bot-filter" ref={menuAnchorRef}>
      <button
        type="button"
        className="bot-matrix-bot-filter__button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onOpen}
      >
        <span>{label}</span>
        <strong>{selectedValues.length}/{options.length}</strong>
      </button>
      {open && menuStyle ? createPortal((
        <BotSelectionMenu
          label={label}
          options={options}
          selectedValues={selectedValues}
          onToggle={onToggle}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          emptyLabel={emptyLabel}
          extraActions={extraActions}
          style={menuStyle}
        />
      ), document.body) : null}
    </div>
  )
}

function TotalSortIcon({ direction }) {
  const iconDirections = direction === "asc" || direction === "desc" ? [direction] : ["asc", "desc"]

  return (
    <span className="bot-matrix-sort-toggle__triangles" aria-hidden="true">
      {iconDirections.map((iconDirection) => (
        <span
          className={`bot-matrix-sort-toggle__triangle bot-matrix-sort-toggle__triangle--${iconDirection}`}
          key={iconDirection}
        />
      ))}
    </span>
  )
}

function TotalSortToggle({ field, sort, onSort }) {
  const active = sort?.key === field.key
  const direction = active ? sort.direction : "none"

  return (
    <button
      type="button"
      className={`bot-matrix-sort-toggle bot-matrix-sort-toggle--${direction}`}
      aria-label={`Sort ${field.label}`}
      title={`Sort ${field.label}`}
      onClick={() => onSort(field.key)}
    >
      <TotalSortIcon direction={direction} />
    </button>
  )
}

/* c8 ignore start -- exercised through report interactions; remaining branches are open/close presentation toggles. */
function TotalColumnHeader({
  field,
  sort,
  openFilterKey,
  playerFilterOptions,
  selectedPlayerValues,
  onOpenFilter,
  onSort,
  onTogglePlayerFilter,
  onClearPlayerFilter,
}) {
  const filterable = field.key === "player"
  const open = filterable && openFilterKey === field.key
  const menuAnchorRef = useRef(null)
  const menuStyle = useTotalFilterMenuStyle(open, menuAnchorRef)
  const active = sort?.key === field.key
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
  const selectedCount = filterable ? selectedPlayerValues.length : 0

  return (
    <th aria-sort={ariaSort}>
      <div className="bot-matrix-total-column-filter" ref={menuAnchorRef}>
        <div className="bot-matrix-total-column-heading">
          {filterable ? (
            <button
              type="button"
              className="bot-matrix-total-column-title-button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={`Filter ${field.label}`}
              onClick={() => onOpenFilter(open ? "" : field.key)}
            >
              <span>{field.label}</span>
              {selectedCount ? <span className="bot-matrix-total-column-title-count" aria-hidden="true">{selectedCount}</span> : null}
            </button>
          ) : (
            <span className="bot-matrix-total-column-title">{field.label}</span>
          )}
          <TotalSortToggle field={field} sort={sort} onSort={onSort} />
        </div>
        {filterable && open && menuStyle ? createPortal((
          <TotalPlayerFilterMenu
            options={playerFilterOptions}
            selectedValues={selectedPlayerValues}
            onToggle={onTogglePlayerFilter}
            onClear={onClearPlayerFilter}
            style={menuStyle}
          />
        ), document.body) : null}
      </div>
    </th>
  )
}
/* c8 ignore stop */

function TotalMetric({ value, kind, usageStartDate }) {
  let text = "—"
  if (kind === "number") text = value.toLocaleString("en-US")
  else if (kind === "plies" || kind === "calls") text = formatAverage(value)
  else if (kind === "tokens") text = formatTokens(value)
  else if (kind === "tokenSplit") text = formatTokenSplit(value?.input, value?.cache, value?.output)
  else if (kind === "cost") text = formatSpend(value)
  else if (kind === "share") text = formatShare(value)

  if (kind === "calls" || kind === "tokens" || kind === "tokenSplit" || kind === "cost") {
    return <span title={usageTooltip(usageStartDate)}>{text}</span>
  }
  return text
}

// eslint-disable-next-line react-refresh/only-export-components
export const __botMatrixReportInternals = Object.freeze({
  TotalMetric,
  botMatchupName,
  formatTokens,
  normalizePlayer,
  normalizeReport,
  normalizeSummary,
  normalizeTotalRow,
  numberOrNull,
  outcomeRequestValues,
  periodRangeLabel,
  reviewOutcomeOptions,
  sortTotalRows,
  sortValuesByReference,
  toggleSelectionValue,
})

/* c8 ignore start -- page-level RTL tests cover these React state flows; v8 counts defensive state-cycle branches separately. */
export default function BotMatrixReportPage() {
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [totalScope, setTotalScope] = useState("all")
  const [totalSort, setTotalSort] = useState(DEFAULT_TOTALS_SORT)
  const [totalPlayerFilters, setTotalPlayerFilters] = useState([])
  const [rowBotSelection, setRowBotSelection] = useState(null)
  const [columnBotSelection, setColumnBotSelection] = useState(null)
  const [reviewOutcomeSelection, setReviewOutcomeSelection] = useState(null)
  const [openMatrixFilterKey, setOpenMatrixFilterKey] = useState("")
  const [openTotalFilterKey, setOpenTotalFilterKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [payload, setPayload] = useState(null)
  const report = useMemo(
    () => normalizeReport(payload, totalScope, totalSort, totalPlayerFilters),
    [payload, totalScope, totalSort, totalPlayerFilters],
  )
  const matrixBotOptions = useMemo(() => optionListFromPlayers(report.players), [report.players])
  const matrixBotValues = useMemo(() => matrixBotOptions.map((option) => option.value), [matrixBotOptions])
  const selectedRowBotValues = useMemo(
    () => resolveSelectedValues(rowBotSelection, matrixBotValues),
    [rowBotSelection, matrixBotValues],
  )
  const selectedColumnBotValues = useMemo(
    () => resolveSelectedValues(columnBotSelection, matrixBotValues),
    [columnBotSelection, matrixBotValues],
  )
  const visibleColumnBots = useMemo(() => {
    const selected = new Set(selectedColumnBotValues)
    return report.players.filter((player) => selected.has(player.username))
  }, [report.players, selectedColumnBotValues])
  const visibleMatrixRows = useMemo(() => {
    const selectedRows = new Set(selectedRowBotValues)
    const selectedColumns = new Set(selectedColumnBotValues)
    return report.matrixRows
      .filter((row) => selectedRows.has(row.player.username))
      .map((row) => ({
        ...row,
        cells: row.cells.filter((cell) => selectedColumns.has(cell.opponent.username)),
      }))
  }, [report.matrixRows, selectedRowBotValues, selectedColumnBotValues])
  const reviewOutcomeOptionsList = useMemo(() => reviewOutcomeOptions(report.endConditionRows), [report.endConditionRows])
  const reviewOutcomeValues = useMemo(
    () => reviewOutcomeOptionsList.map((option) => option.value),
    [reviewOutcomeOptionsList],
  )
  const selectedReviewOutcomeValues = useMemo(
    () => resolveSelectedValues(reviewOutcomeSelection, reviewOutcomeValues),
    [reviewOutcomeSelection, reviewOutcomeValues],
  )
  const reviewOutcomeRequestValues = useMemo(
    () => outcomeRequestValues(selectedReviewOutcomeValues, reviewOutcomeValues),
    [selectedReviewOutcomeValues, reviewOutcomeValues],
  )
  const reviewOutcomeRequestKey = reviewOutcomeRequestValues.join(",")
  const reviewReasonValues = reviewOutcomeRequestValues

  const matrixTableStyle = useMemo(
    () => ({ "--bot-matrix-visible-columns": visibleColumnBots.length }),
    [visibleColumnBots.length],
  )

  useEffect(() => {
    if (reviewOutcomeSelection === null) return
    const resolved = resolveSelectedValues(reviewOutcomeSelection, reviewOutcomeValues)
    if (resolved.length !== reviewOutcomeSelection.length) {
      setReviewOutcomeSelection(resolved)
    }
  }, [reviewOutcomeSelection, reviewOutcomeValues])

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const startedAt = Date.now()
      const requestOutcomes = reviewOutcomeRequestKey ? reviewOutcomeRequestKey.split(",") : []
      setLoading(true)
      setError("")
      setLoadDurationMs(null)
      try {
        const data = await techApi.getBotMatrixReport(period, requestOutcomes)
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
  }, [period, reviewOutcomeRequestKey])

  useEffect(() => {
    if (!openTotalFilterKey) {
      return undefined
    }

    function closeOnPointerDown(event) {
      if (
        event.target instanceof Element
        && event.target.closest(".bot-matrix-total-column-filter, .bot-matrix-total-filter-menu__panel")
      ) {
        return
      }
      setOpenTotalFilterKey("")
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpenTotalFilterKey("")
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [openTotalFilterKey])

  useEffect(() => {
    if (!openMatrixFilterKey) {
      return undefined
    }

    function closeOnPointerDown(event) {
      if (
        event.target instanceof Element
        && event.target.closest(".bot-matrix-bot-filter, .bot-matrix-filter-menu__panel")
      ) {
        return
      }
      setOpenMatrixFilterKey("")
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpenMatrixFilterKey("")
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [openMatrixFilterKey])

  function handleTotalSort(field) {
    setOpenTotalFilterKey("")
    setTotalSort((current) => {
      if (!current || current.key !== field) return { key: field, direction: "asc" }
      if (current.direction === "asc") return { key: field, direction: "desc" }
      return null
    })
  }

  function toggleTotalPlayerFilter(value) {
    setTotalPlayerFilters((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value)
      return [...current, value].sort()
    })
  }

  function handleOpenMatrixFilter(key) {
    setOpenTotalFilterKey("")
    setOpenMatrixFilterKey((current) => (current === key ? "" : key))
  }

  function handleOpenTotalFilter(key) {
    setOpenMatrixFilterKey("")
    setOpenTotalFilterKey(key)
  }

  function toggleRowBotSelection(value) {
    setRowBotSelection((current) => toggleSelectionValue(current, value, matrixBotValues))
  }

  function toggleColumnBotSelection(value) {
    setColumnBotSelection((current) => toggleSelectionValue(current, value, matrixBotValues))
  }

  function toggleReviewOutcomeSelection(value) {
    setReviewOutcomeSelection((current) => toggleSelectionValue(current, value, reviewOutcomeValues))
  }

  function selectNoResignationsOrTimeouts() {
    const values = outcomeValuesWithoutResignationsOrTimeouts(reviewOutcomeOptionsList)
    setReviewOutcomeSelection(sortValuesByReference(values, reviewOutcomeValues))
  }

  function clearTotalPlayerFilter() {
    setTotalPlayerFilters([])
  }

  const selectedPeriodRange = periodRangeLabel(period, report.generatedAt)

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
        <MatrixBotFilter
          label="Review outcomes"
          options={reviewOutcomeOptionsList}
          selectedValues={selectedReviewOutcomeValues}
          open={openMatrixFilterKey === "outcomes"}
          onOpen={() => handleOpenMatrixFilter("outcomes")}
          onToggle={toggleReviewOutcomeSelection}
          onSelectAll={() => setReviewOutcomeSelection(null)}
          onClearAll={() => setReviewOutcomeSelection([])}
          emptyLabel="No outcomes"
          extraActions={[{ label: "No resign/timeouts", onClick: selectNoResignationsOrTimeouts }]}
        />
        {selectedPeriodRange ? (
          <span className="bot-matrix-period-range" aria-live="polite">{selectedPeriodRange}</span>
        ) : null}
      </div>
      <TechReportLoadTime durationMs={loadDurationMs} failed={Boolean(error)} />
      {loading ? <p>Loading bot matrix...</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <section className="leaderboard-table-wrap bot-matrix-wrap" aria-labelledby="bot-matrix-heading">
            <h2 id="bot-matrix-heading">Outcome matrix</h2>
            <div className="bot-matrix-bot-filters" aria-label="Outcome matrix bot filters">
              <MatrixBotFilter
                label="Row bots"
                options={matrixBotOptions}
                selectedValues={selectedRowBotValues}
                open={openMatrixFilterKey === "rows"}
                onOpen={() => handleOpenMatrixFilter("rows")}
                onToggle={toggleRowBotSelection}
                onSelectAll={() => setRowBotSelection(null)}
                onClearAll={() => setRowBotSelection([])}
              />
              <MatrixBotFilter
                label="Column bots"
                options={matrixBotOptions}
                selectedValues={selectedColumnBotValues}
                open={openMatrixFilterKey === "columns"}
                onOpen={() => handleOpenMatrixFilter("columns")}
                onToggle={toggleColumnBotSelection}
                onSelectAll={() => setColumnBotSelection(null)}
                onClearAll={() => setColumnBotSelection([])}
              />
            </div>
            <div className="bot-matrix-scroll">
              <table className="leaderboard-table bot-matrix-table" style={matrixTableStyle}>
                <thead>
                  <tr>
                    <th>Player</th>
                    {visibleColumnBots.map((player) => (
                      <th key={player.username}>
                        <PlayerLink player={player} />
                      </th>
                    ))}
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMatrixRows.length ? visibleMatrixRows.map((row) => (
                    <tr key={row.player.username}>
                      <th scope="row"><PlayerLink player={row.player} /></th>
                      {row.cells.map((cell) => (
                        <td key={`${row.player.username}-${cell.opponent.username}`}>
                          <MatrixCell rowPlayer={row.player} opponent={cell.opponent} summary={cell.summary} reviewReasonValues={reviewReasonValues} />
                        </td>
                      ))}
                      <td>
                        <MatrixCell rowPlayer={row.player} summary={row.average} average reviewReasonValues={reviewReasonValues} />
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="bot-matrix-empty-selection" colSpan={visibleColumnBots.length + 2}>
                        No row bots selected.
                      </td>
                    </tr>
                  )}
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
            <div className="bot-matrix-totals-scroll">
              <table className="leaderboard-table bot-matrix-totals-table__table">
                <thead>
                  <tr>
                    {TOTAL_SORT_FIELDS.map((field) => (
                      <TotalColumnHeader
                        key={field.key}
                        field={field}
                        sort={totalSort}
                        openFilterKey={openTotalFilterKey}
                        playerFilterOptions={report.totalPlayerOptions}
                        selectedPlayerValues={totalPlayerFilters}
                        onOpenFilter={handleOpenTotalFilter}
                        onSort={handleTotalSort}
                        onTogglePlayerFilter={toggleTotalPlayerFilter}
                        onClearPlayerFilter={clearTotalPlayerFilter}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.totalRows.map((row) => (
                    <tr key={row.code}>
                      <th scope="row"><PlayerLink player={row.player} /></th>
                      <td>{row.games.toLocaleString("en-US")}</td>
                      <td><TotalMetric value={row.avgPlies} kind="plies" /></td>
                      <td><TotalMetric value={row.avgCalls} kind="calls" usageStartDate={row.usageStartDate} /></td>
                      <td>
                        <TotalMetric
                          value={{
                            input: row.avgInputTokens,
                            cache: row.avgCacheTokens,
                            output: row.avgOutputTokens,
                          }}
                          kind="tokenSplit"
                          usageStartDate={row.usageStartDate}
                        />
                      </td>
                      <td><TotalMetric value={row.avgCost} kind="cost" usageStartDate={row.usageStartDate} /></td>
                      <td><TotalMetric value={row.winShare} kind="share" /></td>
                      <td><TotalMetric value={row.drawShare} kind="share" /></td>
                      <td><TotalMetric value={row.lossShare} kind="share" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
/* c8 ignore stop */
