import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useSearchParams } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { userApi } from "../services/api"
import "./Leaderboard.css"

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [20, 50, 100]
const SORT_NONE_VALUE = "none"
const DEFAULT_SORT = Object.freeze({ key: "rank", direction: "asc" })
const FILTER_MENU_VIEWPORT_MARGIN = 16
const FILTER_MENU_MAX_WIDTH = 352

const SORT_COLUMNS = [
  { key: "rank", label: "Rank" },
  { key: "username", label: "Username" },
  { key: "type", label: "Type" },
  { key: "overall", label: "Overall" },
  { key: "vs_humans", label: "vs Humans" },
  { key: "vs_bots", label: "vs Bots" },
  { key: "games", label: "Games" },
  { key: "win_rate", label: "Win rate" },
]

const SORT_COLUMN_BY_KEY = new Map(SORT_COLUMNS.map((column) => [column.key, column]))

const FILTER_CONFIGS = [
  {
    key: "username",
    label: "Username",
    value: (player) => filterValue(player?.username),
    labelForPlayer: (player) => displayValue(player?.username),
    labelForValue: filterLabel,
    groupForPlayer: (player) => `${playerTypeLabel(player)}s`,
  },
  {
    key: "type",
    label: "Type",
    value: (player) => playerTypeValue(player),
    labelForValue: typeFilterLabel,
  },
]

const FILTER_CONFIG_BY_KEY = new Map(FILTER_CONFIGS.map((config) => [config.key, config]))
const FILTER_GROUP_ORDER = { Humans: 0, Bots: 1 }

function stringValue(value) {
  return typeof value === "string" ? value.trim() : ""
}

function displayValue(value) {
  return stringValue(value) || "—"
}

function filterValue(value) {
  return stringValue(value) || "__empty__"
}

function filterLabel(value) {
  return value === "__empty__" ? "—" : displayValue(value)
}

function playerTypeValue(player) {
  return player?.is_bot || player?.role === "bot" ? "bot" : "human"
}

function playerTypeLabel(player) {
  return playerTypeValue(player) === "bot" ? "Bot" : "Human"
}

function typeFilterLabel(value) {
  return String(value ?? "").toLowerCase() === "bot" ? "Bot" : "Human"
}

function normalizeFilterValue(key, value) {
  const text = String(value ?? "").trim()
  return key === "type" ? text.toLowerCase() : text
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" })
}

function buildFilterOptions(sourceOptions, config, selectedValues = [], fallbackPlayers = []) {
  const options = new Map()
  const facetOptions = Array.isArray(sourceOptions) ? sourceOptions : []

  facetOptions.forEach((option) => {
    const rawValue = typeof option === "object" && option !== null ? filterValue(option.value) : filterValue(option)
    const value = normalizeFilterValue(config.key, rawValue)
    if (!options.has(value)) {
      const label = typeof option === "object" && option !== null ? stringValue(option.label) : ""
      const group = typeof option === "object" && option !== null ? stringValue(option.group) : ""
      options.set(value, {
        value,
        label: label || config.labelForValue(value),
        group,
      })
    }
  })

  if (options.size === 0) {
    fallbackPlayers.forEach((player) => {
      const value = config.value(player)
      if (!options.has(value)) {
        options.set(value, {
          value,
          label: config.labelForPlayer?.(player) ?? config.labelForValue(value),
          group: config.groupForPlayer?.(player) ?? "",
        })
      }
    })
  }

  selectedValues.forEach((value) => {
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: config.labelForValue(value),
        group: "",
      })
    }
  })

  return [...options.values()].sort((left, right) => {
    const groupComparison = (FILTER_GROUP_ORDER[left.group] ?? 10) - (FILTER_GROUP_ORDER[right.group] ?? 10)
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

function canonicalizeFilterParams(searchParams) {
  FILTER_CONFIGS.forEach((config) => {
    if (searchParams.has(config.key)) {
      setFilterParam(searchParams, config.key, parseFilterValues(searchParams, config.key))
    }
  })
}

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

function LeaderboardFilterMenu({ config, options, selectedValues, loading, error, onToggle, onClear, style }) {
  const selected = new Set(selectedValues)
  const groups = groupFilterOptions(options)

  return (
    <div className="leaderboard-filter-menu__panel" role="menu" style={style}>
      {loading ? <p className="leaderboard-filter-menu__status">Loading values...</p> : null}
      {error ? <p className="leaderboard-filter-menu__status leaderboard-filter-menu__status--error" role="alert">{error}</p> : null}
      {groups.length ? groups.map((group) => (
        <div className="leaderboard-filter-menu__group" key={group.label || "values"}>
          {group.label ? <p className="leaderboard-filter-menu__group-title">{group.label}</p> : null}
          {group.options.map((option) => (
            <label className="leaderboard-filter-menu__option" key={option.value}>
              <input
                type="checkbox"
                checked={selected.has(option.value)}
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )) : !loading ? <p className="leaderboard-filter-menu__empty">No values</p> : null}
      <button className="leaderboard-filter-menu__clear" type="button" onClick={onClear} disabled={!selectedValues.length}>Clear {config.label}</button>
    </div>
  )
}

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

function ColumnHeader({
  column,
  sort,
  filterConfig,
  filterOptions,
  filterOptionsLoading,
  filterOptionsError,
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
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
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
          <SortToggle column={column} sort={sort} onSort={onSort} />
        </div>
        {filterConfig && open && menuStyle ? createPortal((
          <LeaderboardFilterMenu
            config={filterConfig}
            options={filterOptions}
            selectedValues={selectedValues}
            loading={filterOptionsLoading}
            error={filterOptionsError}
            onToggle={(value) => onToggleFilter(filterConfig.key, value)}
            onClear={() => onClearFilter(filterConfig.key)}
            style={menuStyle}
          />
        ), document.body) : null}
      </div>
    </th>
  )
}

function ratingValue(player, track) {
  const fallback = track === "overall" ? player?.elo : 1200
  const value = Number(player?.ratings?.[track]?.elo ?? fallback)
  return Number.isFinite(value) ? value : 1200
}

function gamesPlayed(player) {
  const value = Number(player?.games_played ?? 0)
  return Number.isFinite(value) ? value : 0
}

function winRateText(player) {
  const value = Number(player?.win_rate ?? 0)
  return `${(Number.isFinite(value) ? value * 100 : 0).toFixed(1)}%`
}

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState({ players: [], pagination: { page: 1, pages: 0, total: 0 } })
  const [filterOptionsState, setFilterOptionsState] = useState({
    options: {},
    loaded: false,
    loading: false,
    error: "",
  })
  const [openFilterKey, setOpenFilterKey] = useState("")

  const searchString = searchParams.toString()
  const canonicalSearchString = useMemo(() => {
    const next = new URLSearchParams(searchString)
    canonicalizeFilterParams(next)
    return next.toString()
  }, [searchString])
  const isSearchCanonical = canonicalSearchString === searchString
  const page = parsePage(searchParams.get("page"))
  const pageSize = parsePageSize(searchParams.get("per_page"))
  const sort = useMemo(() => parseSort(searchParams), [searchParams])
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

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

  useEffect(() => {
    if (!isSearchCanonical) {
      return undefined
    }

    let cancelled = false
    async function loadLeaderboard() {
      setLoading(true)
      setError("")
      try {
        const payload = await userApi.getLeaderboard(page, pageSize, {
          sort,
          filters,
          includeFilterOptions: false,
        })
        if (!cancelled) {
          const payloadFilterOptions = payload?.filter_options
          setData({
            players: Array.isArray(payload?.players) ? payload.players : [],
            pagination: payload?.pagination ?? { page, pages: 0, total: 0 },
          })
          if (
            payloadFilterOptions
            && typeof payloadFilterOptions === "object"
            && Object.keys(payloadFilterOptions).length > 0
          ) {
            setFilterOptionsState((previous) => previous.loaded
              ? previous
              : { options: payloadFilterOptions, loaded: true, loading: false, error: "" })
          }
        }
      } catch (apiError) {
        if (!cancelled) {
          setError(apiError?.message ?? "Unable to load leaderboard.")
          setData({ players: [], pagination: { page, pages: 0, total: 0 } })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLeaderboard()
    return () => { cancelled = true }
  }, [page, pageSize, sort, filters, isSearchCanonical])

  const pagination = data.pagination ?? { page, pages: 0, total: 0 }
  const filterOptions = useMemo(() => Object.fromEntries(
    FILTER_CONFIGS.map((config) => [
      config.key,
      buildFilterOptions(filterOptionsState.options?.[config.key], config, filters[config.key] ?? [], data.players),
    ]),
  ), [data.players, filterOptionsState.options, filters])
  const activeFilterCount = selectedFilterCount(filters)
  const displayPagination = {
    page: pagination.page ?? page,
    pages: pagination.pages ?? 0,
  }
  const canPageBackward = page > 1
  const canPageForward = pagination.pages > 0 ? page < pagination.pages : data.players.length > 0
  const showTable = data.players.length > 0 || activeFilterCount > 0

  useEffect(() => {
    if (!openFilterKey || filterOptionsState.loaded || filterOptionsState.loading) {
      return undefined
    }

    setFilterOptionsState((previous) => ({ ...previous, loading: true, error: "" }))
    userApi.getLeaderboardFilterOptions()
      .then((payload) => {
        setFilterOptionsState({
          options: payload?.filter_options ?? {},
          loaded: true,
          loading: false,
          error: "",
        })
      })
      .catch((apiError) => {
        setFilterOptionsState((previous) => ({
          ...previous,
          loading: false,
          error: apiError?.message ?? "Unable to load filter values.",
        }))
      })
    return undefined
  }, [filterOptionsState.loaded, filterOptionsState.loading, openFilterKey])

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

      setPageParam(next, 1)
      if (!nextSort) {
        next.set("sort", SORT_NONE_VALUE)
        next.delete("dir")
      } else if (nextSort.key === DEFAULT_SORT.key && nextSort.direction === DEFAULT_SORT.direction) {
        next.delete("sort")
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

  return (
    <main className="page-shell leaderboard-page">
      <h1>Leaderboard</h1>
      {loading ? <p>Loading leaderboard…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {!loading && !error ? (
        <>
          <p className="page-meta-stamp">
            Humans appear after 5 completed games. Listed bots can appear earlier.
          </p>
          {!showTable ? <p>No ranked players found.</p> : (
            <>
              <div className="leaderboard-controls" aria-label="Leaderboard controls">
                <button className="leaderboard-clear-filters" type="button" onClick={clearAllFilters} disabled={!activeFilterCount}>Clear filters</button>
                <label className="leaderboard-page-size-control">
                  <span>Players per page</span>
                  <select value={pageSize} onChange={handlePageSizeChange}>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.toLocaleString("en-US")}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="leaderboard-table-wrap leaderboard-table-wrap--interactive">
                <table className="leaderboard-table leaderboard-table--interactive">
                  <thead>
                    <tr>
                      {SORT_COLUMNS.map((column) => (
                        <ColumnHeader
                          key={column.key}
                          column={column}
                          sort={sort}
                          filterConfig={FILTER_CONFIG_BY_KEY.get(column.key)}
                          filterOptions={filterOptions[column.key] ?? []}
                          filterOptionsLoading={filterOptionsState.loading}
                          filterOptionsError={filterOptionsState.error}
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
                    {data.players.length ? data.players.map((player) => (
                      <tr key={`${player.username}-${player.rank}`}>
                        <td>{player.rank ?? "—"}</td>
                        <td>
                          {player.username ? <Link to={`/user/${encodeURIComponent(player.username)}`}>{player.username}</Link> : "—"}
                        </td>
                        <td>{playerTypeLabel(player)}</td>
                        <td>{ratingValue(player, "overall")}</td>
                        <td>{ratingValue(player, "vs_humans")}</td>
                        <td>{ratingValue(player, "vs_bots")}</td>
                        <td>{gamesPlayed(player)}</td>
                        <td>{winRateText(player)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td className="leaderboard-table__empty" colSpan={SORT_COLUMNS.length}>No players match these filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="pagination-controls">
            <button type="button" onClick={() => setPage(Math.max(page - 1, 1))} disabled={!canPageBackward}>Prev</button>
            <span>Page {displayPagination.page} of {displayPagination.pages}</span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={!canPageForward}>Next</button>
          </div>
          <VersionStamp />
        </>
      ) : null}
    </main>
  )
}
