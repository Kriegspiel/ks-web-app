import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { userApi } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import { formatRuleVariant } from "../utils/rules"
import "./GameHistory.css"

const HISTORY_PAGE_SIZE = 100
const EMPTY_FILTER_VALUE = "__empty__"
const DEFAULT_SORT = Object.freeze({ key: "played_at", direction: "desc" })

const SORT_COLUMNS = [
  { key: "rule_set", label: "Rule set", type: "text", value: (game) => formatRuleVariant(game?.rule_variant) },
  { key: "color", label: "Color", type: "text", value: (game) => displayValue(game?.play_as) },
  { key: "opponent", label: "Opponent", type: "text", value: (game) => opponentLabel(game) },
  { key: "result", label: "Result", type: "text", value: (game) => displayValue(game?.result) },
  { key: "reason", label: "Reason", type: "text", value: (game) => formatReason(game?.reason) },
  { key: "turns", label: "Turns", type: "number", value: (game) => turnCount(game) },
  { key: "played_at", label: "Date and time", type: "date", value: (game) => game?.played_at },
  { key: "review", label: "Review", type: "text", value: (game) => reviewRef(game) },
]

const SORT_COLUMN_BY_KEY = new Map(SORT_COLUMNS.map((column) => [column.key, column]))

const FILTER_CONFIGS = [
  {
    key: "rule_set",
    label: "Rule set",
    value: (game) => filterValue(game?.rule_variant),
    labelForValue: (value) => value === EMPTY_FILTER_VALUE ? "—" : formatRuleVariant(value),
  },
  {
    key: "color",
    label: "Color",
    value: (game) => filterValue(game?.play_as),
    labelForValue: filterLabel,
  },
  {
    key: "opponent",
    label: "Opponent",
    value: (game) => `${opponentGroup(game)}:${filterValue(game?.opponent)}`,
    labelForGame: (game) => opponentLabel(game),
    groupForGame: (game) => opponentGroup(game) === "bot" ? "Bots" : "Humans",
  },
  {
    key: "result",
    label: "Result",
    value: (game) => filterValue(game?.result),
    labelForValue: filterLabel,
  },
  {
    key: "reason",
    label: "Reason",
    value: (game) => filterValue(game?.reason),
    labelForValue: (value) => value === EMPTY_FILTER_VALUE ? "—" : formatReason(value),
  },
]

const OPPONENT_GROUP_ORDER = { Humans: 0, Bots: 1 }

function formatDate(value) {
  return formatUtcDateTime(value) || "—"
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : ""
}

function displayValue(value) {
  return stringValue(value) || "—"
}

function filterValue(value) {
  return stringValue(value) || EMPTY_FILTER_VALUE
}

function filterLabel(value) {
  return value === EMPTY_FILTER_VALUE ? "—" : displayValue(value)
}

function opponentLabel(game) {
  const name = displayValue(game?.opponent)
  return String(game?.opponent_role ?? "").toLowerCase() === "bot" && name !== "—" ? `${name} (bot)` : name
}

function opponentGroup(game) {
  return String(game?.opponent_role ?? "").toLowerCase() === "bot" ? "bot" : "human"
}

function turnCount(game) {
  const explicit = Number(game?.turn_count)
  if (Number.isFinite(explicit)) {
    return explicit
  }
  const moveCount = Number(game?.move_count)
  return Number.isFinite(moveCount) ? Math.ceil(moveCount / 2) : 0
}

function formatReason(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "—"
  }

  const normalized = value.trim().toLowerCase()
  const known = {
    checkmate: "checkmate",
    resignation: "resignation",
    timeout: "timeout",
    time: "timeout",
    stalemate: "stalemate",
    insufficient: "insufficient material",
    too_many_reversible_moves: "too many reversible moves",
  }

  return known[normalized] ?? normalized.replace(/[_-]+/g, " ")
}

function reviewRef(game) {
  return stringValue(game?.game_code) || stringValue(game?.game_id)
}

function reviewPath(game) {
  const ref = reviewRef(game)
  return ref ? `/game/${ref}/review` : ""
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
}

function compareSortValues(left, right, type, direction) {
  if (type === "number") {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    const leftMissing = !Number.isFinite(leftNumber)
    const rightMissing = !Number.isFinite(rightNumber)
    if (leftMissing || rightMissing) {
      return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
    }
    const comparison = leftNumber - rightNumber
    return direction === "asc" ? comparison : -comparison
  }

  if (type === "date") {
    const leftTime = Date.parse(left)
    const rightTime = Date.parse(right)
    const leftMissing = !Number.isFinite(leftTime)
    const rightMissing = !Number.isFinite(rightTime)
    if (leftMissing || rightMissing) {
      return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
    }
    const comparison = leftTime - rightTime
    return direction === "asc" ? comparison : -comparison
  }

  const leftText = displayValue(left)
  const rightText = displayValue(right)
  const leftMissing = leftText === "—"
  const rightMissing = rightText === "—"
  if (leftMissing || rightMissing) {
    return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
  }
  const comparison = compareText(leftText, rightText)
  return direction === "asc" ? comparison : -comparison
}

function sortGames(games, sort) {
  const column = SORT_COLUMN_BY_KEY.get(sort.key) ?? SORT_COLUMN_BY_KEY.get(DEFAULT_SORT.key)
  const direction = sort.direction === "asc" ? "asc" : "desc"

  return games
    .map((game, index) => ({ game, index }))
    .sort((left, right) => {
      const comparison = compareSortValues(column.value(left.game), column.value(right.game), column.type, direction)
      if (comparison !== 0) {
        return comparison
      }
      return left.index - right.index
    })
    .map((entry) => entry.game)
}

function buildFilterOptions(games, config) {
  const options = new Map()

  games.forEach((game) => {
    const value = config.value(game)
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: config.labelForGame?.(game) ?? config.labelForValue(value),
        group: config.groupForGame?.(game) ?? "",
      })
    }
  })

  return [...options.values()].sort((left, right) => {
    const groupComparison = (OPPONENT_GROUP_ORDER[left.group] ?? 10) - (OPPONENT_GROUP_ORDER[right.group] ?? 10)
    return groupComparison || compareText(left.label, right.label)
  })
}

function groupFilterOptions(options) {
  const groups = []
  options.forEach((option) => {
    const label = option.group || ""
    let group = groups.find((current) => current.label === label)
    if (!group) {
      group = { label, options: [] }
      groups.push(group)
    }
    group.options.push(option)
  })
  return groups
}

function selectedFilterCount(filters) {
  return Object.values(filters).reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0)
}

function gameMatchesFilters(game, filters) {
  return FILTER_CONFIGS.every((config) => {
    const selectedValues = filters[config.key] ?? []
    return selectedValues.length === 0 || selectedValues.includes(config.value(game))
  })
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("a, button, input, label, select, textarea, summary"))
}

function HistoryFilterDropdown({ label, options, selectedValues, onToggle, onClear }) {
  const [open, setOpen] = useState(false)
  const selected = new Set(selectedValues)
  const groups = groupFilterOptions(options)
  const summary = selectedValues.length ? `${selectedValues.length} selected` : "All"

  return (
    <details className="history-filter-menu" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label={`Filter ${label}`}>
        <span>{label}</span>
        <span className="history-filter-menu__count">{summary}</span>
      </summary>
      {open ? (
        <div className="history-filter-menu__panel">
          {groups.length ? groups.map((group) => (
            <div className="history-filter-menu__group" key={group.label || "values"}>
              {group.label ? <p className="history-filter-menu__group-title">{group.label}</p> : null}
              {group.options.map((option) => (
                <label className="history-filter-menu__option" key={option.value}>
                  <input
                    type="checkbox"
                    checked={selected.has(option.value)}
                    onChange={() => onToggle(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )) : <p className="history-filter-menu__empty">No values</p>}
          <button className="history-filter-menu__clear" type="button" onClick={onClear} disabled={!selectedValues.length}>Clear</button>
        </div>
      ) : null}
    </details>
  )
}

function SortHeader({ column, sort, onSort }) {
  const active = sort.key === column.key
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`history-sort-button${active ? " history-sort-button--active" : ""}`.trim()}
        onClick={() => onSort(column.key)}
      >
        <span>{column.label}</span>
        <span className="history-sort-button__indicator" aria-hidden="true">{active ? (sort.direction === "asc" ? "Asc" : "Desc") : ""}</span>
      </button>
    </th>
  )
}

export default function GameHistoryPage() {
  const { username = "" } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState({ games: [], pagination: { page: 1, pages: 0, total: 0 } })
  const [sort, setSort] = useState(DEFAULT_SORT)
  const [filters, setFilters] = useState({})

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      setLoading(true)
      setError("")
      try {
        const payload = await userApi.getGameHistory(username, page, HISTORY_PAGE_SIZE)
        if (!cancelled) {
          setHistory({
            games: Array.isArray(payload?.games) ? payload.games : [],
            pagination: payload?.pagination ?? { page, pages: 0, total: 0 },
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.status === 404 ? "User not found." : (apiError?.message ?? "Unable to load game history."))
          setHistory({ games: [], pagination: { page, pages: 0, total: 0 } })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [username, page])

  const pagination = history.pagination ?? { page, pages: 0, total: 0 }
  const filterOptions = useMemo(() => Object.fromEntries(
    FILTER_CONFIGS.map((config) => [config.key, buildFilterOptions(history.games, config)]),
  ), [history.games])
  const visibleGames = useMemo(
    () => sortGames(history.games.filter((game) => gameMatchesFilters(game, filters)), sort),
    [filters, history.games, sort],
  )
  const activeFilterCount = selectedFilterCount(filters)

  function handleSort(columnKey) {
    setSort((current) => {
      if (current.key !== columnKey) {
        return { key: columnKey, direction: columnKey === "played_at" ? "desc" : "asc" }
      }
      return { key: columnKey, direction: current.direction === "asc" ? "desc" : "asc" }
    })
  }

  function toggleFilter(filterKey, value) {
    setFilters((current) => {
      const values = new Set(current[filterKey] ?? [])
      if (values.has(value)) {
        values.delete(value)
      } else {
        values.add(value)
      }
      return { ...current, [filterKey]: [...values] }
    })
  }

  function clearFilter(filterKey) {
    setFilters((current) => ({ ...current, [filterKey]: [] }))
  }

  function clearAllFilters() {
    setFilters({})
  }

  function openReview(game) {
    const path = reviewPath(game)
    if (path) {
      navigate(path)
    }
  }

  function handleRowClick(event, game) {
    if (!isInteractiveTarget(event.target)) {
      openReview(game)
    }
  }

  function handleRowKeyDown(event, game) {
    if ((event.key === "Enter" || event.key === " ") && !isInteractiveTarget(event.target)) {
      event.preventDefault()
      openReview(game)
    }
  }

  return (
    <main className="page-shell history-page">
      <h1>{username}&apos;s game history</h1>
      <p className="history-page__back-link-wrap">
        <Link className="history-page__back-link" to={`/user/${username}`}>Back to user</Link>
      </p>
      {loading ? <p>Loading history…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {history.games.length === 0 ? <p>No games found on this page.</p> : (
            <>
              <div className="history-controls" aria-label="Game history filters">
                {FILTER_CONFIGS.map((config) => (
                  <HistoryFilterDropdown
                    key={config.key}
                    label={config.label}
                    options={filterOptions[config.key] ?? []}
                    selectedValues={filters[config.key] ?? []}
                    onToggle={(value) => toggleFilter(config.key, value)}
                    onClear={() => clearFilter(config.key)}
                  />
                ))}
                <button className="history-clear-filters" type="button" onClick={clearAllFilters} disabled={!activeFilterCount}>Clear filters</button>
              </div>
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      {SORT_COLUMNS.map((column) => <SortHeader key={column.key} column={column} sort={sort} onSort={handleSort} />)}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGames.length ? visibleGames.map((game, index) => {
                      const path = reviewPath(game)
                      return (
                        <tr
                          className={path ? "history-table__row history-table__row--openable" : "history-table__row"}
                          key={game.game_id ?? game.game_code ?? index}
                          tabIndex={path ? 0 : undefined}
                          onClick={(event) => handleRowClick(event, game)}
                          onKeyDown={(event) => handleRowKeyDown(event, game)}
                        >
                          <td>{formatRuleVariant(game.rule_variant)}</td>
                          <td>{displayValue(game.play_as)}</td>
                          <td>
                            {game.opponent ? <Link className="history-opponent-link" to={`/user/${game.opponent}`}>{opponentLabel(game)}</Link> : "—"}
                          </td>
                          <td>{displayValue(game.result)}</td>
                          <td>{formatReason(game.reason)}</td>
                          <td>{turnCount(game)}</td>
                          <td>{formatDate(game.played_at)}</td>
                          <td>{path ? <Link to={path}>Open</Link> : "—"}</td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td className="history-table__empty" colSpan={SORT_COLUMNS.length}>No games match these filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="pagination-controls">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page <= 1}>Prev</button>
            <span>Page {pagination.page ?? page} of {pagination.pages ?? 0}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={pagination.pages > 0 ? page >= pagination.pages : history.games.length === 0}>Next</button>
          </div>
        </>
      ) : null}
      <VersionStamp />
    </main>
  )
}
