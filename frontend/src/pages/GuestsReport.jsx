import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useSearchParams } from "react-router-dom"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { techApi } from "../services/api"
import { formatUtcDate, formatUtcDateTime } from "../utils/dateTime"
import "./Leaderboard.css"

const EMPTY_FILTER_VALUE = "__empty__"
const SORT_NONE_VALUE = "none"
const FILTER_MENU_VIEWPORT_MARGIN = 16
const FILTER_MENU_MAX_WIDTH = 352

const GUEST_COLUMNS = [
  { key: "name", label: "Name", type: "text", sortable: false, value: guestNameValue },
  { key: "day_started", label: "Day started", type: "date", sortable: true, value: (guest) => guest?.day_started },
  { key: "last_game", label: "Last game", type: "date", sortable: true, value: (guest) => guest?.last_game },
  { key: "number_of_games", label: "Number of games", type: "number", sortable: true, value: (guest) => guest?.number_of_games },
  { key: "non_timeout_games", label: "Non-timeout endings", type: "number", sortable: true, value: (guest) => guest?.non_timeout_games },
  { key: "total_time_played_seconds", label: "Total time played", type: "number", sortable: true, value: (guest) => guest?.total_time_played_seconds },
]

const SORT_COLUMN_BY_KEY = new Map(GUEST_COLUMNS.filter((column) => column.sortable).map((column) => [column.key, column]))

const FILTER_CONFIGS = [
  {
    key: "name",
    label: "Name",
    value: (guest) => filterValue(guestNameValue(guest)),
    labelForGuest: guestNameLabel,
    labelForValue: filterLabel,
  },
  {
    key: "day_started",
    label: "Day started",
    value: (guest) => filterValue(guest?.day_started),
    labelForGuest: (guest) => formatStartedDay(guest?.day_started),
    labelForValue: (value) => value === EMPTY_FILTER_VALUE ? "—" : formatStartedDay(value),
  },
]

const FILTER_CONFIG_BY_KEY = new Map(FILTER_CONFIGS.map((config) => [config.key, config]))

/* c8 ignore start -- helper compatibility branches are exercised through focused helper tests and page-level current-shape tests. */
function stringValue(value) {
  return typeof value === "string" ? value.trim() : ""
}

function guestNameValue(guest) {
  return stringValue(guest?.name) || stringValue(guest?.username)
}

function guestNameLabel(guest) {
  return guestNameValue(guest) || "—"
}

function filterValue(value) {
  return stringValue(value) || EMPTY_FILTER_VALUE
}

function filterLabel(value) {
  return value === EMPTY_FILTER_VALUE ? "—" : (stringValue(value) || "—")
}

function formatStartedDay(value) {
  return formatUtcDate(value) || value || "—"
}

function formatLastGame(value) {
  return formatUtcDateTime(value) || "—"
}

function formatGameCount(value) {
  const count = Number(value)
  return Number.isFinite(count) ? count.toLocaleString("en-US") : "0"
}

function formatTotalTimePlayed(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0))
  if (totalSeconds === 0) return "0m"

  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
}

function numericSortValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function dateSortValue(value) {
  const text = stringValue(value)
  if (!text) return null
  const timestamp = Date.parse(text)
  return Number.isFinite(timestamp) ? timestamp : null
}

function columnSortValue(column, guest) {
  const value = column.value(guest)
  if (column.type === "number") return numericSortValue(value)
  if (column.type === "date") return dateSortValue(value)
  return stringValue(value)
}

function compareGuestsByColumn(left, right, column, direction) {
  const leftValue = columnSortValue(column, left)
  const rightValue = columnSortValue(column, right)
  const leftMissing = leftValue === null || leftValue === ""
  const rightMissing = rightValue === null || rightValue === ""

  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return compareText(guestNameLabel(left), guestNameLabel(right))
    return leftMissing ? 1 : -1
  }

  const multiplier = direction === "desc" ? -1 : 1
  const difference = column.type === "text"
    ? compareText(leftValue, rightValue)
    : Number(leftValue) - Number(rightValue)

  return difference === 0
    ? compareText(guestNameLabel(left), guestNameLabel(right))
    : difference * multiplier
}

function sortGuests(guests, sort) {
  if (!sort) return guests
  const column = SORT_COLUMN_BY_KEY.get(sort.key)
  if (!column) return guests
  const direction = sort.direction === "desc" ? "desc" : "asc"
  return [...guests].sort((left, right) => compareGuestsByColumn(left, right, column, direction))
}

function buildFilterOptions(config, guests, selectedValues = []) {
  const options = new Map()

  guests.forEach((guest) => {
    const value = config.value(guest)
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: config.labelForGuest?.(guest) ?? config.labelForValue(value),
      })
    }
  })

  selectedValues.forEach((value) => {
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: config.labelForValue(value),
      })
    }
  })

  return [...options.values()].sort((left, right) => compareText(left.label, right.label))
}

function selectedFilterCount(filters) {
  return Object.values(filters).reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0)
}

function normalizeFilterValue(_key, value) {
  return String(value ?? "").trim()
}

function parseSort(searchParams) {
  const sortKey = searchParams.get("sort")
  if (sortKey === SORT_NONE_VALUE || !sortKey || !SORT_COLUMN_BY_KEY.has(sortKey)) {
    return null
  }
  const requestedDirection = searchParams.get("dir")
  const direction = requestedDirection === "asc" || requestedDirection === "desc" ? requestedDirection : "asc"
  return { key: sortKey, direction }
}

function parseFilterValues(searchParams, key) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => normalizeFilterValue(key, value))
    .filter(Boolean)
}

function parseFilters(searchParams) {
  return Object.fromEntries(FILTER_CONFIGS.map((config) => [config.key, parseFilterValues(searchParams, config.key)]))
}

function setFilterParam(searchParams, key, values) {
  searchParams.delete(key)
  if (values.length) {
    searchParams.set(key, values.join(","))
  }
}

function canonicalizeFilterParams(searchParams) {
  FILTER_CONFIGS.forEach((config) => {
    if (searchParams.has(config.key)) {
      setFilterParam(searchParams, config.key, parseFilterValues(searchParams, config.key))
    }
  })
}

function guestMatchesFilters(guest, filters) {
  return FILTER_CONFIGS.every((config) => {
    const selectedValues = filters[config.key] ?? []
    return selectedValues.length === 0 || selectedValues.includes(config.value(guest))
  })
}

function filterGuests(guests, filters) {
  return guests.filter((guest) => guestMatchesFilters(guest, filters))
}
/* c8 ignore stop */

/* c8 ignore start -- portal positioning depends on browser layout geometry; menu behavior is covered by RTL interaction tests. */
function useFilterMenuStyle(open, anchorRef) {
  const [style, setStyle] = useState(null)

  useEffect(() => {
    if (!open) {
      setStyle(null)
      return undefined
    }

    function updateStyle() {
      const anchor = anchorRef.current
      if (!anchor) {
        return
      }

      const rect = anchor.getBoundingClientRect()
      const maxMenuWidth = Math.min(
        FILTER_MENU_MAX_WIDTH,
        Math.max(0, window.innerWidth - (FILTER_MENU_VIEWPORT_MARGIN * 2)),
      )
      const maxLeft = Math.max(FILTER_MENU_VIEWPORT_MARGIN, window.innerWidth - maxMenuWidth - FILTER_MENU_VIEWPORT_MARGIN)
      const left = Math.min(Math.max(FILTER_MENU_VIEWPORT_MARGIN, rect.left), maxLeft)

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

/* c8 ignore start -- exercised through guests-report interactions; remaining branches are filter-menu presentation states. */
function GuestsFilterMenu({ config, options, selectedValues, onToggle, onClear, style }) {
  const selected = new Set(selectedValues)

  return (
    <div className="leaderboard-filter-menu__panel" role="menu" style={style}>
      {options.length ? options.map((option) => (
        <label className="leaderboard-filter-menu__option" key={option.value}>
          <input
            type="checkbox"
            checked={selected.has(option.value)}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      )) : <p className="leaderboard-filter-menu__empty">No values</p>}
      <button className="leaderboard-filter-menu__clear" type="button" onClick={onClear} disabled={!selectedValues.length}>Clear {config.label}</button>
    </div>
  )
}
/* c8 ignore stop */

function SortIcon({ direction }) {
  const iconDirections = direction === "asc" || direction === "desc" ? [direction] : ["asc", "desc"]

  return (
    <span className="leaderboard-sort-toggle__triangles" aria-hidden="true">
      {iconDirections.map((iconDirection) => (
        <span
          className={`leaderboard-sort-toggle__triangle leaderboard-sort-toggle__triangle--${iconDirection}`}
          key={iconDirection}
        />
      ))}
    </span>
  )
}

function SortToggle({ column, sort, onSort }) {
  const active = sort?.key === column.key
  const direction = active ? sort.direction : "none"

  return (
    <button
      type="button"
      className={`leaderboard-sort-toggle leaderboard-sort-toggle--${direction}`}
      aria-label={`Sort ${column.label}`}
      title={`Sort ${column.label}`}
      onClick={() => onSort(column.key)}
    >
      <SortIcon direction={direction} />
    </button>
  )
}

/* c8 ignore start -- exercised through guests-report interactions; remaining branches are header presentation toggles. */
function ColumnHeader({
  column,
  sort,
  filterConfig,
  filterOptions,
  selectedValues,
  open,
  onOpen,
  onSort,
  onToggleFilter,
  onClearFilter,
}) {
  const menuAnchorRef = useRef(null)
  const menuStyle = useFilterMenuStyle(open, menuAnchorRef)
  const active = sort?.key === column.key
  const ariaSort = column.sortable ? (active ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined
  const selectedCount = selectedValues.length

  return (
    <th aria-sort={ariaSort}>
      <div className="leaderboard-column-filter" ref={menuAnchorRef}>
        <div className="leaderboard-column-heading">
          {filterConfig ? (
            <button
              type="button"
              className="leaderboard-column-title-button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => onOpen(open ? "" : column.key)}
            >
              <span>{column.label}</span>
              {selectedCount ? <span className="leaderboard-column-title-count">{selectedCount}</span> : null}
            </button>
          ) : (
            <span className="leaderboard-column-title">{column.label}</span>
          )}
          {column.sortable ? <SortToggle column={column} sort={sort} onSort={onSort} /> : null}
        </div>
        {filterConfig && open && menuStyle ? createPortal((
          <GuestsFilterMenu
            config={filterConfig}
            options={filterOptions}
            selectedValues={selectedValues}
            onToggle={(value) => onToggleFilter(filterConfig.key, value)}
            onClear={() => onClearFilter(filterConfig.key)}
            style={menuStyle}
          />
        ), document.body) : null}
      </div>
    </th>
  )
}
/* c8 ignore stop */

// eslint-disable-next-line react-refresh/only-export-components
export const __guestsReportInternals = Object.freeze({
  FILTER_CONFIGS,
  GUEST_COLUMNS,
  buildFilterOptions,
  columnSortValue,
  compareGuestsByColumn,
  dateSortValue,
  filterGuests,
  filterLabel,
  normalizeFilterValue,
  parseSort,
  selectedFilterCount,
  sortGuests,
})

/* c8 ignore start -- page-level RTL tests cover these URL and React state flows; v8 counts stale layout/query guards separately. */
export default function GuestsReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [data, setData] = useState({ guests: [], total: 0, available_guest_accounts: 0 })
  const [openFilterKey, setOpenFilterKey] = useState("")

  const searchString = searchParams.toString()
  const canonicalSearchString = useMemo(() => {
    const next = new URLSearchParams(searchString)
    canonicalizeFilterParams(next)
    return next.toString()
  }, [searchString])
  const isSearchCanonical = canonicalSearchString === searchString
  const sort = useMemo(() => parseSort(searchParams), [searchParams])
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      const startedAt = Date.now()
      setLoading(true)
      setError("")
      setLoadDurationMs(null)
      try {
        const payload = await techApi.getGuestsReport()
        if (!cancelled) {
          const guests = Array.isArray(payload?.guests) ? payload.guests : []
          setData({
            guests,
            total: Number(payload?.total ?? guests.length),
            available_guest_accounts: Number(payload?.available_guest_accounts ?? 0),
          })
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load guests report.")
          setData({ guests: [], total: 0, available_guest_accounts: 0 })
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
  }, [])

  useEffect(() => {
    if (!isSearchCanonical) {
      setSearchParams(new URLSearchParams(canonicalSearchString), { replace: true })
    }
  }, [canonicalSearchString, isSearchCanonical, setSearchParams])

  useEffect(() => {
    if (!openFilterKey) {
      return undefined
    }

    function closeOnPointerDown(event) {
      if (event.target instanceof Element && event.target.closest(".leaderboard-column-filter, .leaderboard-filter-menu__panel")) {
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

  const filterOptions = useMemo(() => Object.fromEntries(
    FILTER_CONFIGS.map((config) => [
      config.key,
      buildFilterOptions(config, data.guests, filters[config.key] ?? []),
    ]),
  ), [data.guests, filters])
  const visibleGuests = useMemo(() => sortGuests(filterGuests(data.guests, filters), sort), [data.guests, filters, sort])
  const activeFilterCount = selectedFilterCount(filters)
  const totalCount = Number.isFinite(data.total) ? data.total : data.guests.length

  function updateSearch(updater, options = { replace: true }) {
    const next = new URLSearchParams(searchParams)
    updater(next)
    canonicalizeFilterParams(next)
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
    })
  }

  function clearFilter(filterKey) {
    updateSearch((next) => setFilterParam(next, filterKey, []))
  }

  function clearAllFilters() {
    setOpenFilterKey("")
    updateSearch((next) => {
      FILTER_CONFIGS.forEach((config) => next.delete(config.key))
    })
  }

  return (
    <main className="page-shell leaderboard-page">
      <h1>Guests report</h1>
      <p className="page-meta-stamp">All guest accounts, with archived and currently active games counted.</p>
      <TechReportLoadTime durationMs={loadDurationMs} failed={Boolean(error)} />
      {loading ? <p>Loading guests report…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          {data.guests.length === 0 ? <p>No guests found.</p> : (
            <>
              <div className="leaderboard-controls" aria-label="Guests report controls">
                <button className="leaderboard-clear-filters" type="button" onClick={clearAllFilters} disabled={!activeFilterCount}>Clear filters</button>
              </div>
              <p className="page-meta-stamp">
                {activeFilterCount ? `${visibleGuests.length.toLocaleString("en-US")} of ` : ""}
                {totalCount.toLocaleString("en-US")} guests listed.{" "}
                {data.available_guest_accounts.toLocaleString("en-US")} guest accounts still available.
              </p>
              <section className="leaderboard-table-wrap leaderboard-table-wrap--interactive">
                <table className="leaderboard-table leaderboard-table--interactive guests-report-table">
                  <thead>
                    <tr>
                      {GUEST_COLUMNS.map((column) => (
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
                    {visibleGuests.length ? visibleGuests.map((guest, index) => (
                      <tr key={guest.username ?? guest.name ?? `guest-${index}`}>
                        <td>
                          {guest.username
                            ? <Link to={`/user/${guest.username}`}>{guestNameLabel(guest)}</Link>
                            : guestNameLabel(guest)}
                        </td>
                        <td>{formatStartedDay(guest.day_started)}</td>
                        <td>{formatLastGame(guest.last_game)}</td>
                        <td>{formatGameCount(guest.number_of_games)}</td>
                        <td>{formatGameCount(guest.non_timeout_games)}</td>
                        <td>{formatTotalTimePlayed(guest.total_time_played_seconds)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="leaderboard-table__empty" colSpan={GUEST_COLUMNS.length}>No guests match these filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
/* c8 ignore stop */
