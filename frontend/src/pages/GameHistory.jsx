import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { userApi } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import { formatRuleVariant } from "../utils/rules"
import "./GameHistory.css"

const DEFAULT_PAGE_SIZE = 100
const PAGE_SIZE_OPTIONS = [100, 500, 1000, 10000]
const EMPTY_FILTER_VALUE = "__empty__"
const SORT_NONE_VALUE = "none"
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
    labelForValue: opponentFilterLabel,
    groupForGame: (game) => opponentGroup(game) === "bot" ? "Bots" : "Humans",
    groupForValue: (value) => splitOpponentFilterValue(value).group === "bot" ? "Bots" : "Humans",
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

const FILTER_CONFIG_BY_KEY = new Map(FILTER_CONFIGS.map((config) => [config.key, config]))
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

function splitOpponentFilterValue(value) {
  const text = String(value ?? "")
  const separator = text.indexOf(":")
  if (separator < 0) {
    return { group: "human", value: text }
  }
  return { group: text.slice(0, separator), value: text.slice(separator + 1) }
}

function opponentFilterLabel(value) {
  const parsed = splitOpponentFilterValue(value)
  const label = filterLabel(parsed.value)
  return parsed.group === "bot" && label !== "—" ? `${label} (bot)` : label
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
  if (!sort) {
    return games
  }

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

function buildFilterOptions(games, config, selectedValues = []) {
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

  selectedValues.forEach((value) => {
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: config.labelForValue(value),
        group: config.groupForValue?.(value) ?? "",
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

function defaultSortDirection(columnKey) {
  return columnKey === DEFAULT_SORT.key ? DEFAULT_SORT.direction : "asc"
}

function parsePage(value) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parsePageSize(value) {
  const parsed = Number.parseInt(value ?? "", 10)
  return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

function parseSort(searchParams) {
  const sortKey = searchParams.get("sort")
  if (sortKey === SORT_NONE_VALUE) {
    return null
  }
  if (!sortKey) {
    return DEFAULT_SORT
  }
  if (!SORT_COLUMN_BY_KEY.has(sortKey)) {
    return DEFAULT_SORT
  }
  const requestedDirection = searchParams.get("dir")
  const direction = requestedDirection === "asc" || requestedDirection === "desc"
    ? requestedDirection
    : defaultSortDirection(sortKey)
  return { key: sortKey, direction }
}

function parseFilterValues(searchParams, key) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
}

function parseFilters(searchParams) {
  return Object.fromEntries(FILTER_CONFIGS.map((config) => [config.key, parseFilterValues(searchParams, config.key)]))
}

function setPageParam(searchParams, page) {
  if (page <= 1) {
    searchParams.delete("page")
  } else {
    searchParams.set("page", String(page))
  }
}

function setFilterParam(searchParams, key, values) {
  searchParams.delete(key)
  if (values.length) {
    searchParams.set(key, values.join(","))
  }
}

function filterMenuGroups(options) {
  return groupFilterOptions(options)
}

function HistoryFilterMenu({ config, options, selectedValues, onToggle, onClear }) {
  const selected = new Set(selectedValues)
  const groups = filterMenuGroups(options)

  return (
    <div className="history-filter-menu__panel" role="menu">
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
      <button className="history-filter-menu__clear" type="button" onClick={onClear} disabled={!selectedValues.length}>Clear {config.label}</button>
    </div>
  )
}

function SortToggle({ column, sort, onSort }) {
  const active = sort?.key === column.key
  const direction = active ? sort.direction : "none"

  return (
    <button
      type="button"
      className={`history-sort-toggle history-sort-toggle--${direction}`}
      aria-label={`Sort ${column.label}`}
      title={`Sort ${column.label}`}
      onClick={() => onSort(column.key)}
    >
      <span className="history-sort-toggle__triangle" aria-hidden="true" />
    </button>
  )
}

function ColumnHeader({ column, sort, filterConfig, filterOptions, selectedValues, open, onOpen, onSort, onToggleFilter, onClearFilter }) {
  const active = sort?.key === column.key
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
  const selectedCount = selectedValues.length

  return (
    <th aria-sort={ariaSort}>
      <div className="history-column-filter">
        <div className="history-column-heading">
          {filterConfig ? (
            <button
              type="button"
              className="history-column-title-button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => onOpen(open ? "" : column.key)}
            >
              <span>{column.label}</span>
              {selectedCount ? <span className="history-column-title-count">{selectedCount}</span> : null}
            </button>
          ) : (
            <span className="history-column-title">{column.label}</span>
          )}
          <SortToggle column={column} sort={sort} onSort={onSort} />
        </div>
        {filterConfig && open ? (
          <HistoryFilterMenu
            config={filterConfig}
            options={filterOptions}
            selectedValues={selectedValues}
            onToggle={(value) => onToggleFilter(filterConfig.key, value)}
            onClear={() => onClearFilter(filterConfig.key)}
          />
        ) : null}
      </div>
    </th>
  )
}

export default function GameHistoryPage() {
  const { username = "" } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [history, setHistory] = useState({ games: [], pagination: { page: 1, pages: 0, total: 0 } })
  const [openFilterKey, setOpenFilterKey] = useState("")

  const page = parsePage(searchParams.get("page"))
  const pageSize = parsePageSize(searchParams.get("per_page"))
  const sort = useMemo(() => parseSort(searchParams), [searchParams])
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  useEffect(() => {
    if (!openFilterKey) {
      return undefined
    }

    function closeOnPointerDown(event) {
      if (event.target instanceof Element && event.target.closest(".history-column-filter")) {
        return
      }
      setOpenFilterKey("")
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpenFilterKey("")
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [openFilterKey])

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      setLoading(true)
      setError("")
      try {
        const payload = await userApi.getGameHistory(username, page, pageSize)
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
  }, [username, page, pageSize])

  const pagination = history.pagination ?? { page, pages: 0, total: 0 }
  const filterOptions = useMemo(() => Object.fromEntries(
    FILTER_CONFIGS.map((config) => [config.key, buildFilterOptions(history.games, config, filters[config.key] ?? [])]),
  ), [filters, history.games])
  const visibleGames = useMemo(
    () => sortGames(history.games.filter((game) => gameMatchesFilters(game, filters)), sort),
    [filters, history.games, sort],
  )
  const activeFilterCount = selectedFilterCount(filters)

  function updateSearch(updater, options = { replace: true }) {
    const next = new URLSearchParams(searchParams)
    updater(next)
    setSearchParams(next, options)
  }

  function handleSort(columnKey) {
    setOpenFilterKey("")
    updateSearch((next) => {
      let nextSort
      if (!sort || sort.key !== columnKey) {
        nextSort = { key: columnKey, direction: "asc" }
      } else if (sort.direction === "asc") {
        nextSort = { key: columnKey, direction: "desc" }
      } else {
        nextSort = null
      }

      if (!nextSort) {
        next.set("sort", SORT_NONE_VALUE)
        next.delete("dir")
      } else {
        next.set("sort", nextSort.key)
        next.set("dir", nextSort.direction)
      }
    })
  }

  function toggleFilter(filterKey, value) {
    updateSearch((next) => {
      const values = new Set(parseFilterValues(next, filterKey))
      if (values.has(value)) {
        values.delete(value)
      } else {
        values.add(value)
      }
      setFilterParam(next, filterKey, [...values])
      setPageParam(next, 1)
    })
  }

  function clearFilter(filterKey) {
    updateSearch((next) => {
      setFilterParam(next, filterKey, [])
      setPageParam(next, 1)
    })
  }

  function clearAllFilters() {
    setOpenFilterKey("")
    updateSearch((next) => {
      FILTER_CONFIGS.forEach((config) => next.delete(config.key))
      setPageParam(next, 1)
    })
  }

  function handlePageSizeChange(event) {
    const nextPageSize = parsePageSize(event.target.value)
    setOpenFilterKey("")
    updateSearch((next) => {
      if (nextPageSize === DEFAULT_PAGE_SIZE) {
        next.delete("per_page")
      } else {
        next.set("per_page", String(nextPageSize))
      }
      setPageParam(next, 1)
    })
  }

  function setPage(nextPage) {
    updateSearch((next) => setPageParam(next, nextPage), { replace: false })
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
              <div className="history-controls" aria-label="Game history controls">
                <button className="history-clear-filters" type="button" onClick={clearAllFilters} disabled={!activeFilterCount}>Clear filters</button>
                <label className="history-page-size-control">
                  <span>Games per page</span>
                  <select value={pageSize} onChange={handlePageSizeChange}>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.toLocaleString("en-US")}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead>
                    <tr>
                      {SORT_COLUMNS.map((column) => (
                        <ColumnHeader
                          key={column.key}
                          column={column}
                          sort={sort}
                          filterConfig={FILTER_CONFIG_BY_KEY.get(column.key)}
                          filterOptions={filterOptions[column.key] ?? []}
                          selectedValues={filters[column.key] ?? []}
                          open={openFilterKey === column.key}
                          onOpen={setOpenFilterKey}
                          onSort={handleSort}
                          onToggleFilter={toggleFilter}
                          onClearFilter={clearFilter}
                        />
                      ))}
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
            <button type="button" onClick={() => setPage(Math.max(page - 1, 1))} disabled={page <= 1}>Prev</button>
            <span>Page {pagination.page ?? page} of {pagination.pages ?? 0}</span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={pagination.pages > 0 ? page >= pagination.pages : history.games.length === 0}>Next</button>
          </div>
        </>
      ) : null}
      <VersionStamp />
    </main>
  )
}
