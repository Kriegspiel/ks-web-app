import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { BOT_MATRIX_GAME_DATES, BOT_MATRIX_GAMES, BOT_MATRIX_PLAYERS, BOT_MATRIX_TOTALS } from "../data/botMatrixReport"
import "./BotMatrixReport.css"
import "./Leaderboard.css"

const DAY_MS = 24 * 60 * 60 * 1000

const GAME_FIELDS = {
  player: 0,
  opponent: 1,
  result: 2,
  plies: 3,
  gameCode: 4,
  playerTokens: 5,
  playerCost: 6,
  opponentTokens: 7,
  opponentCost: 8,
  endCondition: 9,
}

const END_CONDITION_ORDER = ["timeout", "resignation", "checkmate", "stalemate", "insufficient"]
const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "lifetime", label: "Lifetime" },
]
const PERIOD_DAY_WINDOWS = {
  week: 7,
  month: 30,
  year: 365,
}
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

function parseCompactNumber(value) {
  const text = String(value ?? "").trim().replace(/[$,]/g, "")
  if (!text) return 0
  const suffix = text.at(-1)?.toLowerCase()
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1
  const numberText = multiplier === 1 ? text : text.slice(0, -1)
  const number = Number(numberText)
  return Number.isFinite(number) ? number * multiplier : 0
}

function parseCost(value) {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""))
  return Number.isFinite(number) ? number : 0
}

function parseUtcTimestamp(value) {
  const text = String(value ?? "").trim()
  if (!text) return null
  const timestamp = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function stripTrailingZeros(value) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")
}

function formatAveragePlies(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "0"
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toFixed(1)
}

function formatTokens(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return "0"
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
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return "$0"
  const digits = number < 0.01 ? 4 : 3
  return `$${stripTrailingZeros(number.toFixed(digits))}`
}

function formatAverage(value) {
  if (value === null) return "—"
  const number = Number(value)
  if (!Number.isFinite(number)) return "—"
  return Number.isInteger(number) ? number.toLocaleString("en-US") : number.toFixed(1)
}

function formatShare(value) {
  if (value === null) return "0%"
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return "0%"
  const percent = number * 100
  return `${stripTrailingZeros(percent.toFixed(percent < 10 ? 1 : 0))}%`
}

function conditionLabel(condition) {
  return {
    checkmate: "Checkmate",
    insufficient: "Insufficient material",
    resignation: "Resignation",
    stalemate: "Stalemate",
    timeout: "Timeout",
  }[condition] ?? "Unknown"
}

function normalizedGames() {
  return BOT_MATRIX_GAMES.map((game) => ({
    player: game[GAME_FIELDS.player],
    opponent: game[GAME_FIELDS.opponent],
    result: game[GAME_FIELDS.result],
    plies: Number(game[GAME_FIELDS.plies]) || 0,
    gameCode: game[GAME_FIELDS.gameCode],
    playerTokens: parseCompactNumber(game[GAME_FIELDS.playerTokens]),
    playerCost: parseCost(game[GAME_FIELDS.playerCost]),
    opponentTokens: parseCompactNumber(game[GAME_FIELDS.opponentTokens]),
    opponentCost: parseCost(game[GAME_FIELDS.opponentCost]),
    endCondition: game[GAME_FIELDS.endCondition],
    playedAt: parseUtcTimestamp(BOT_MATRIX_GAME_DATES[game[GAME_FIELDS.gameCode]]),
  }))
}

function periodCutoff(period, now) {
  if (period === "today") {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }
  const days = PERIOD_DAY_WINDOWS[period]
  return days ? now.getTime() - days * DAY_MS : null
}

function gamesForPeriod(games, period, now) {
  const cutoff = periodCutoff(period, now)
  if (cutoff === null) return games
  const nowMs = now.getTime()
  return games.filter((game) => typeof game.playedAt === "number" && game.playedAt >= cutoff && game.playedAt <= nowMs)
}

function summarizeGames(games) {
  const summary = games.reduce((current, game) => {
    if (game.result === "W") current.wins += 1
    if (game.result === "D") current.draws += 1
    if (game.result === "L") current.losses += 1
    current.plies += game.plies
    current.playerTokens += game.playerTokens
    current.playerCost += game.playerCost
    current.opponentTokens += game.opponentTokens
    current.opponentCost += game.opponentCost
    return current
  }, {
    wins: 0,
    draws: 0,
    losses: 0,
    plies: 0,
    playerTokens: 0,
    playerCost: 0,
    opponentTokens: 0,
    opponentCost: 0,
  })

  const count = games.length
  return {
    games: count,
    record: `${summary.wins}-${summary.draws}-${summary.losses}`,
    averagePlies: count ? summary.plies / count : 0,
    playerTokens: count ? summary.playerTokens / count : 0,
    playerCost: count ? summary.playerCost / count : 0,
    opponentTokens: count ? summary.opponentTokens / count : 0,
    opponentCost: count ? summary.opponentCost / count : 0,
  }
}

function totalCallsByCode() {
  return new Map(BOT_MATRIX_TOTALS.map((row) => [row.code, parseCompactNumber(row.calls)]))
}

function opponentMatchesScope(game, scope, playerByCode) {
  if (scope === "all") return true
  const opponentIsBot = playerByCode.has(game.opponent)
  return scope === "bots" ? opponentIsBot : !opponentIsBot
}

function buildTotalRows(games, allGames, playerByCode, scope, sort) {
  const callsByCode = totalCallsByCode()
  const scopedGames = games.filter((game) => opponentMatchesScope(game, scope, playerByCode))
  const allScopedGames = allGames.filter((game) => opponentMatchesScope(game, scope, playerByCode))
  const allGamesByPlayer = new Map()
  const allScopedGamesByPlayer = new Map()

  BOT_MATRIX_PLAYERS.forEach((player) => {
    allGamesByPlayer.set(player.code, allGames.filter((game) => game.player === player.code))
    allScopedGamesByPlayer.set(player.code, allScopedGames.filter((game) => game.player === player.code))
  })

  const rows = BOT_MATRIX_PLAYERS.map((player) => {
    const playerGames = scopedGames.filter((game) => game.player === player.code)
    const count = playerGames.length
    const totals = playerGames.reduce((current, game) => {
      current.plies += game.plies
      current.tokens += game.playerTokens
      current.cost += game.playerCost
      if (game.result === "W") current.wins += 1
      if (game.result === "D") current.draws += 1
      if (game.result === "L") current.losses += 1
      return current
    }, { plies: 0, tokens: 0, cost: 0, wins: 0, draws: 0, losses: 0 })
    const fullPlayerGames = allGamesByPlayer.get(player.code) ?? []
    const fullScopedPlayerGames = allScopedGamesByPlayer.get(player.code) ?? []
    const callsAreExact = count > 0 && count === fullPlayerGames.length && fullScopedPlayerGames.length === fullPlayerGames.length
    const totalCalls = callsAreExact ? callsByCode.get(player.code) ?? 0 : null

    return {
      code: player.code,
      player,
      playerName: player.name,
      games: count,
      avgPlies: count ? totals.plies / count : null,
      avgCalls: count && totalCalls !== null ? totalCalls / count : null,
      avgTokens: count ? totals.tokens / count : null,
      avgCost: count ? totals.cost / count : null,
      winShare: count ? totals.wins / count : null,
      drawShare: count ? totals.draws / count : null,
      lossShare: count ? totals.losses / count : null,
    }
  })

  return sortTotalRows(rows, sort)
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

function buildBotMatrixReport(period = "lifetime", now = new Date(Date.now()), totalScope = "all", totalSort = DEFAULT_TOTALS_SORT) {
  const playerByCode = new Map(BOT_MATRIX_PLAYERS.map((player) => [player.code, player]))
  const allGames = normalizedGames()
  const games = gamesForPeriod(allGames, period, now)
  const gamesByCell = new Map()

  games.forEach((game) => {
    const key = `${game.player}:${game.opponent}`
    const cellGames = gamesByCell.get(key) ?? []
    cellGames.push(game)
    gamesByCell.set(key, cellGames)
  })

  const matrixRows = BOT_MATRIX_PLAYERS.map((player) => {
    const rowGames = games.filter((game) => game.player === player.code)
    return {
      player,
      cells: BOT_MATRIX_PLAYERS.map((opponent) => ({
        opponent,
        summary: player.code === opponent.code ? null : summarizeGames(gamesByCell.get(`${player.code}:${opponent.code}`) ?? []),
      })),
      average: summarizeGames(rowGames),
    }
  })

  const uniqueGameByCode = new Map()
  games.forEach((game) => {
    if (!uniqueGameByCode.has(game.gameCode)) {
      uniqueGameByCode.set(game.gameCode, game)
    }
  })
  const uniqueGames = Array.from(uniqueGameByCode.values())
  const endConditionRows = END_CONDITION_ORDER.map((condition) => ({
    condition,
    label: conditionLabel(condition),
    games: uniqueGames.filter((game) => game.endCondition === condition).length,
  }))

  return {
    matrixRows,
    endConditionRows,
    totalRows: buildTotalRows(games, allGames, playerByCode, totalScope, totalSort),
    uniqueGameCount: uniqueGames.length,
    rowRecordCount: games.length,
  }
}

function PlayerLink({ player, className = "" }) {
  return (
    <Link className={className} to={`/user/${player.username}`}>
      {player.name}
    </Link>
  )
}

function MatrixCell({ rowPlayer, summary, average = false }) {
  if (!summary) {
    return <div className="bot-matrix-cell bot-matrix-cell--empty">Same player</div>
  }

  return (
    <div className={average ? "bot-matrix-cell bot-matrix-cell--average" : "bot-matrix-cell"}>
      <strong>{summary.record}</strong>
      <span>{formatAveragePlies(summary.averagePlies)} avg plies</span>
      <Link to={`/user/${rowPlayer.username}/games`}>{rowPlayer.name} games</Link>
      <span>this bot {formatTokens(summary.playerTokens)} / {formatCost(summary.playerCost)}</span>
      <span>opponent {formatTokens(summary.opponentTokens)} / {formatCost(summary.opponentCost)}</span>
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

function TotalMetric({ value, kind }) {
  if (kind === "number") return value.toLocaleString("en-US")
  if (kind === "plies" || kind === "calls") return formatAverage(value)
  if (kind === "tokens") return value !== null && Number.isFinite(Number(value)) ? formatTokens(value) : "—"
  if (kind === "cost") return value !== null && Number.isFinite(Number(value)) ? formatCost(value) : "—"
  if (kind === "share") return formatShare(value)
  return "—"
}

export default function BotMatrixReportPage() {
  const [period, setPeriod] = useState("lifetime")
  const [totalScope, setTotalScope] = useState("all")
  const [totalSort, setTotalSort] = useState(DEFAULT_TOTALS_SORT)
  const [loading, setLoading] = useState(true)
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [report, setReport] = useState(null)

  useEffect(() => {
    const startedAt = Date.now()
    setReport(buildBotMatrixReport(period, new Date(startedAt), totalScope, totalSort))
    setLoadDurationMs(Date.now() - startedAt)
    setLoading(false)
  }, [period, totalScope, totalSort])

  function handleTotalSort(field) {
    setTotalSort((current) => ({
      key: field,
      direction: current.key === field && current.direction === "desc" ? "asc" : field === "player" ? "asc" : "desc",
    }))
  }

  return (
    <main className="page-shell leaderboard-page bot-matrix-page">
      <h1>Kriegsspiel bot matrix</h1>
      <p className="page-meta-stamp">
        Built from {report?.uniqueGameCount ?? 0} completed bot games and {report?.rowRecordCount ?? 0} row-perspective records.
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
      <TechReportLoadTime durationMs={loadDurationMs} />
      {loading ? <p>Loading bot matrix...</p> : null}
      {!loading && report ? (
        <>
          <section className="leaderboard-table-wrap bot-matrix-wrap" aria-labelledby="bot-matrix-heading">
            <h2 id="bot-matrix-heading">Outcome matrix</h2>
            <div className="bot-matrix-scroll">
              <table className="leaderboard-table bot-matrix-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {BOT_MATRIX_PLAYERS.map((player) => (
                      <th key={player.code}>
                        <PlayerLink player={player} />
                      </th>
                    ))}
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {report.matrixRows.map((row) => (
                    <tr key={row.player.code}>
                      <th scope="row"><PlayerLink player={row.player} /></th>
                      {row.cells.map((cell) => (
                        <td key={`${row.player.code}-${cell.opponent.code}`}>
                          <MatrixCell rowPlayer={row.player} summary={cell.summary} />
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
                    <td><TotalMetric value={row.avgCalls} kind="calls" /></td>
                    <td><TotalMetric value={row.avgTokens} kind="tokens" /></td>
                    <td><TotalMetric value={row.avgCost} kind="cost" /></td>
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
