import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import TechReportLoadTime from "../components/TechReportLoadTime"
import VersionStamp from "../components/VersionStamp"
import { BOT_MATRIX_GAMES, BOT_MATRIX_PLAYERS, BOT_MATRIX_TOTALS } from "../data/botMatrixReport"
import "./BotMatrixReport.css"
import "./Leaderboard.css"

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
  }))
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

function buildBotMatrixReport() {
  const playerByCode = new Map(BOT_MATRIX_PLAYERS.map((player) => [player.code, player]))
  const games = normalizedGames()
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

  const totalRows = BOT_MATRIX_TOTALS.map((row) => ({
    ...row,
    player: playerByCode.get(row.code),
  })).filter((row) => row.player)

  return {
    matrixRows,
    endConditionRows,
    totalRows,
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

export default function BotMatrixReportPage() {
  const [loading, setLoading] = useState(true)
  const [loadDurationMs, setLoadDurationMs] = useState(null)
  const [report, setReport] = useState(null)

  useEffect(() => {
    const startedAt = Date.now()
    setReport(buildBotMatrixReport())
    setLoadDurationMs(Date.now() - startedAt)
    setLoading(false)
  }, [])

  return (
    <main className="page-shell leaderboard-page bot-matrix-page">
      <h1>Kriegsspiel bot matrix</h1>
      <p className="page-meta-stamp">
        Built from {report?.uniqueGameCount ?? 0} completed bot games and {report?.rowRecordCount ?? 0} row-perspective records.
      </p>
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

          <section className="leaderboard-table-wrap bot-matrix-small-table" aria-labelledby="bot-matrix-totals-heading">
            <h2 id="bot-matrix-totals-heading">Bot totals</h2>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Calls</th>
                  <th>Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.totalRows.map((row) => (
                  <tr key={row.code}>
                    <td><PlayerLink player={row.player} /></td>
                    <td>{row.calls}</td>
                    <td>{row.tokens}</td>
                    <td>{row.cost}</td>
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
