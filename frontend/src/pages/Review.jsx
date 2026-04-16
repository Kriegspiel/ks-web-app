import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { getGame, getGameTranscript } from "../services/api"
import "./Review.css"

const STARTING_FENS = {
  referee: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  white: "4K3/PPPPPPPP/8/8/8/8/8/8 w - - 0 1",
  black: "8/8/8/8/8/8/pppppppp/4k3 b - - 0 1",
}

const ANNOUNCEMENT_TEXT = {
  ILLEGAL_MOVE: "Illegal move",
  REGULAR_MOVE: "Move complete",
  CAPTURE_DONE: "Capture",
  HAS_ANY: "Has pawn captures",
  NO_ANY: "No pawn captures",
  DRAW_TOOMANYREVERSIBLEMOVES: "Draw by too many reversible moves",
  DRAW_STALEMATE: "Draw by stalemate",
  DRAW_INSUFFICIENT: "Draw by insufficient material",
  CHECKMATE_WHITE_WINS: "Checkmate — White wins",
  CHECKMATE_BLACK_WINS: "Checkmate — Black wins",
  CHECK_RANK: "Check on rank",
  CHECK_FILE: "Check on file",
  CHECK_LONG_DIAGONAL: "Check on long diagonal",
  CHECK_SHORT_DIAGONAL: "Check on short diagonal",
  CHECK_KNIGHT: "Check by knight",
  CHECK_DOUBLE: "Double check",
}

function formatAnnouncement(code) {
  if (typeof code !== "string" || code.trim().length === 0) {
    return ""
  }

  return ANNOUNCEMENT_TEXT[code] ?? code
}

function formatCaptureAnnouncement(move) {
  const main = formatAnnouncement(move?.answer?.main)
  const captureSquare = typeof move?.answer?.capture_square === "string" ? move.answer.capture_square.trim().toUpperCase() : ""
  if (main === "Capture" && captureSquare) {
    return `${main} at ${captureSquare}`
  }

  return main
}

function moveAnnouncements(move) {
  if (!move) {
    return []
  }

  const questionType = String(move.question_type ?? "COMMON").toUpperCase()
  const normalizedUci = typeof move.uci === "string" ? move.uci.trim().toLowerCase() : ""
  const main = formatCaptureAnnouncement(move)
  const special = formatAnnouncement(move?.answer?.special)

  if (questionType !== "ASK_ANY" && normalizedUci) {
    const combined = [`[${normalizedUci}]`, main, special].filter(Boolean).join(" ")
    return combined ? [combined] : [`[${normalizedUci}]`]
  }

  const items = []
  if (main) {
    items.push(main)
  }
  if (special) {
    items.push(special)
  }

  return [...new Set(items.filter(Boolean))]
}

function formatPlySummary(group) {
  if (!group) {
    return ""
  }

  return group.moves
    .map((move) => moveAnnouncements(move).join(" · "))
    .filter(Boolean)
    .join(" · ")
}

function buildPlyGroups(moves) {
  const groups = []

  for (const move of moves) {
    const color = move?.color === "black" ? "black" : "white"
    const previous = groups[groups.length - 1]

    if (previous && previous.color === color) {
      previous.moves.push(move)
      previous.lastPly = move?.ply ?? previous.lastPly
      continue
    }

    groups.push({
      id: `${color}-${move?.ply ?? groups.length + 1}`,
      color,
      moves: [move],
      firstPly: move?.ply ?? 0,
      lastPly: move?.ply ?? 0,
    })
  }

  return groups.map((group, index) => ({
    ...group,
    index,
    turnNumber: Math.floor(index / 2) + 1,
  }))
}

function buildMoveRows(moves) {
  const groups = buildPlyGroups(moves)
  const rows = []

  for (let index = 0; index < groups.length; index += 2) {
    const first = groups[index]
    const second = groups[index + 1] ?? null
    const row = {
      moveNumber: first?.turnNumber ?? rows.length + 1,
      white: null,
      black: null,
    }

    if (first?.color === "white") {
      row.white = first
      row.black = second?.color === "black" ? second : null
    } else {
      row.black = first
      row.white = second?.color === "white" ? second : null
    }

    rows.push(row)
  }

  return rows
}

function finalTimestampForGroup(group) {
  if (!group || !Array.isArray(group.moves) || group.moves.length === 0) {
    return null
  }

  const final = new Date(group.moves[group.moves.length - 1]?.timestamp ?? "")
  if (Number.isNaN(final.getTime())) {
    return null
  }

  return final
}

function formatElapsedBetween(startValue, endValue) {
  const start = new Date(startValue ?? "")
  const end = new Date(endValue ?? "")
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "—"
  }

  let seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  const minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function fenForPerspective(replayFen, perspective) {
  if (!replayFen || typeof replayFen !== "object") {
    return ""
  }

  if (perspective === "referee") {
    return replayFen.full ?? ""
  }

  return replayFen[perspective] ?? ""
}

function formatResult(result) {
  if (!result || typeof result !== "object") {
    return "Result unavailable"
  }
  const winner = result.winner ? `${result.winner} wins` : "Draw"
  const reason = result.reason ? ` by ${result.reason}` : ""
  return `${winner}${reason}`
}

function formatPerspectiveLabel(group) {
  if (!group) {
    return "Start"
  }

  return `${group.turnNumber}${group.color === "black" ? "B" : "W"}`
}

function formatTurnNumber(group) {
  if (!group) {
    return "0"
  }
  return String(group.turnNumber)
}

function formatUtcDateTime(value) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "—"
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const seconds = String(date.getUTCSeconds()).padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`
}

function formatDuration(startValue, endValue) {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return "—"
  }

  let remaining = Math.floor((end.getTime() - start.getTime()) / 1000)
  const days = Math.floor(remaining / 86400)
  remaining -= days * 86400
  const hours = Math.floor(remaining / 3600)
  remaining -= hours * 3600
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining - minutes * 60

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  if (minutes || hours || days) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

function normalizeRatings(source) {
  const ratings = source?.ratings ?? {}
  const overall = ratings?.overall?.elo ?? source?.elo ?? null
  const vsHumans = ratings?.vs_humans?.elo ?? null
  const vsBots = ratings?.vs_bots?.elo ?? null
  return {
    overall: overall == null ? null : Number(overall),
    vsHumans: vsHumans == null ? null : Number(vsHumans),
    vsBots: vsBots == null ? null : Number(vsBots),
  }
}

function historicalRatingsForColor(game, color) {
  const player = color === "black" ? game?.black : game?.white
  const current = normalizeRatings(player)
  const snapshot = game?.rating_snapshot
  if (!snapshot || typeof snapshot !== "object") {
    return {
      overall: null,
      vsHumans: null,
      vsBots: null,
    }
  }

  const overall = snapshot?.overall?.[`${color}_before`]
  const specific = snapshot?.specific?.[`${color}_before`]
  const track = snapshot?.[`${color}_track`]
  return {
    overall: overall == null ? null : Number(overall),
    vsHumans: track === "vs_humans" ? Number(specific) : current.vsHumans,
    vsBots: track === "vs_bots" ? Number(specific) : current.vsBots,
  }
}

function ratingValue(value) {
  return Number.isFinite(value) ? String(value) : "—"
}

function playerLabel(player) {
  if (!player?.username) {
    return "—"
  }
  return player.role === "bot" ? `${player.username} (bot)` : player.username
}

function fenForPly(moves, ply, perspective) {
  if (ply <= 0) {
    return STARTING_FENS[perspective]
  }

  const entry = moves[ply - 1]
  const replayFen = entry?.replay_fen
  const visibleFen = fenForPerspective(replayFen, perspective)
  if (visibleFen) {
    return visibleFen
  }

  return STARTING_FENS[perspective]
}

function isCastlingUci(uci) {
  return ["e1g1", "e1c1", "e8g8", "e8c8"].includes(String(uci ?? "").toLowerCase())
}

function arrowsForMove(move) {
  const uci = String(move?.uci ?? "").trim().toLowerCase()
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return []
  }

  if (!move?.move_done) {
    return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "illegal" }]
  }

  if (isCastlingUci(uci)) {
    if (uci === "e1g1") {
      return [{ from: "e1", to: "g1", tone: "success" }, { from: "h1", to: "f1", tone: "success" }]
    }
    if (uci === "e1c1") {
      return [{ from: "e1", to: "c1", tone: "success" }, { from: "a1", to: "d1", tone: "success" }]
    }
    if (uci === "e8g8") {
      return [{ from: "e8", to: "g8", tone: "success" }, { from: "h8", to: "f8", tone: "success" }]
    }
    return [{ from: "e8", to: "c8", tone: "success" }, { from: "a8", to: "d8", tone: "success" }]
  }

  return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "success" }]
}

function summarizePlyGroup(group) {
  if (!group) {
    return []
  }

  return group.moves.flatMap((move) => moveAnnouncements(move))
}

function overlaysForPlyGroup(group) {
  if (!group) {
    return { arrows: [], badges: [], captureSquares: [] }
  }

  const arrows = []
  const badges = []
  const captureSquares = []

  group.moves.forEach((move, index) => {
    arrows.push(...arrowsForMove(move))

    const captureSquare = typeof move?.answer?.capture_square === "string" ? move.answer.capture_square.trim().toLowerCase() : ""
    if (captureSquare && /^[a-h][1-8]$/.test(captureSquare)) {
      captureSquares.push(captureSquare)
    }

    if (!move?.move_done) {
      const uci = String(move?.uci ?? "").trim().toLowerCase()
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
        badges.push({
          square: uci.slice(2, 4),
          label: String(index + 1),
          tone: "illegal",
        })
      }
    }
  })

  return {
    arrows,
    badges,
    captureSquares: [...new Set(captureSquares)],
  }
}

export default function ReviewPage() {
  const { gameCode, gameId } = useParams()
  const gameRef = gameCode ?? gameId ?? ""
  const { user } = useAuth()

  const [moves, setMoves] = useState([])
  const [game, setGame] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPly, setCurrentPly] = useState(-1)
  const [perspective, setPerspective] = useState("referee")
  const [boardOrientation, setBoardOrientation] = useState("white")
  const moveRowsRef = useRef(null)
  const maxGroupIndexRef = useRef(-1)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError("")

      try {
        const [transcript, game] = await Promise.all([getGameTranscript(gameRef), getGame(gameRef)])
        if (!active) {
          return
        }

        if (!Array.isArray(transcript?.moves)) {
          setError("Replay transcript is unavailable.")
          return
        }

        setMoves(transcript.moves)
        setGame(game ?? null)
        setResult(game?.result ?? null)
      } catch (requestError) {
        if (active) {
          setError(requestError?.message ?? "Unable to load review page right now.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [gameRef])

  const plyGroups = useMemo(() => buildPlyGroups(moves), [moves])
  const moveRows = useMemo(() => buildMoveRows(moves), [moves])
  const maxGroupIndex = Math.max(plyGroups.length - 1, -1)
  const finalGroup = maxGroupIndex >= 0 ? plyGroups[maxGroupIndex] : null
  maxGroupIndexRef.current = maxGroupIndex

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        setCurrentPly((prev) => Math.max(-1, prev - 1))
      }
      if (event.key === "ArrowRight") {
        setCurrentPly((prev) => Math.min(maxGroupIndexRef.current, prev + 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (currentPly < 0) {
      return
    }

    const container = moveRowsRef.current
    const active = container?.querySelector?.(`[data-ply-index="${currentPly}"]`)
    if (!(active instanceof HTMLElement)) {
      return
    }

    if (container instanceof HTMLElement) {
      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()
      const topOverflow = activeRect.top < containerRect.top
      const bottomOverflow = activeRect.bottom > containerRect.bottom

      if (topOverflow || bottomOverflow) {
        const offsetTop = active.offsetTop
        const targetTop = topOverflow
          ? offsetTop
          : offsetTop - container.clientHeight + active.offsetHeight
        container.scrollTo({
          top: Math.max(0, targetTop),
          behavior: "smooth",
        })
      }
    }
  }, [currentPly])

  const selectedPlyGroup = currentPly >= 0 ? plyGroups[currentPly] ?? null : null
  const boardFen = useMemo(
    () => fenForPly(moves, selectedPlyGroup?.lastPly ?? 0, perspective),
    [moves, selectedPlyGroup, perspective],
  )
  const overlayState = useMemo(() => {
    if (perspective !== "referee" && selectedPlyGroup && perspective !== selectedPlyGroup.color) {
      const opponentOverlay = overlaysForPlyGroup(selectedPlyGroup)
      return { arrows: [], badges: [], captureSquares: opponentOverlay.captureSquares }
    }
    return overlaysForPlyGroup(selectedPlyGroup)
  }, [selectedPlyGroup, perspective])
  const counterLabel = selectedPlyGroup ? formatPerspectiveLabel(selectedPlyGroup) : "Start"
  const maxCounterLabel = finalGroup ? formatPerspectiveLabel(finalGroup) : "0W"
  const startedAt = formatUtcDateTime(game?.created_at)
  const endedAt = formatUtcDateTime(game?.updated_at)
  const duration = formatDuration(game?.created_at, game?.updated_at)
  const whiteCurrentRatings = normalizeRatings(game?.white)
  const blackCurrentRatings = normalizeRatings(game?.black)
  const whiteHistoricalRatings = historicalRatingsForColor(game, "white")
  const blackHistoricalRatings = historicalRatingsForColor(game, "black")
  const signedInAs = user?.username ?? user?.email ?? "player"

  return (
    <main className="page-shell review-page" aria-live="polite">
      <div className="review-page__header">
        <h1>Game review</h1>
        <p className="review-page__signed-in">Signed in as {signedInAs}.</p>
      </div>

      {loading ? <p className="review-page__notice">Loading transcript…</p> : null}
      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      {!loading && !error ? (
        <div className="review-page__layout">
          <section className="review-page__board-column">
            <div className="review-page__top-toggle">
              <div className="elo-chart__track-toggle review-page__toggle-group" role="tablist" aria-label="Replay perspective">
                {[
                  ["referee", "Referee"],
                  ["white", "White"],
                  ["black", "Black"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={perspective === value}
                    className={`elo-chart__track-pill${perspective === value ? " is-active" : ""}`}
                    onClick={() => setPerspective(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ChessBoard
              boardFen={boardFen}
              orientation={boardOrientation}
              captureSquares={overlayState.captureSquares}
              overlayArrows={overlayState.arrows}
              overlayBadges={overlayState.badges}
              disabled
            />

            <div className="review-page__controls" role="group" aria-label="Replay controls">
              <button type="button" aria-label="First" title="First" onClick={() => setCurrentPly(-1)} disabled={currentPly < 0}>
                <span aria-hidden="true">«</span>
              </button>
              <button
                type="button"
                aria-label="Prev"
                title="Prev"
                onClick={() => setCurrentPly((prev) => Math.max(-1, prev - 1))}
                disabled={currentPly < 0}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <span className="review-page__ply">Turn {counterLabel} / {maxCounterLabel}</span>
              <button
                type="button"
                aria-label="Next"
                title="Next"
                onClick={() => setCurrentPly((prev) => Math.min(maxGroupIndex, prev + 1))}
                disabled={currentPly >= maxGroupIndex}
              >
                <span aria-hidden="true">›</span>
              </button>
              <button type="button" aria-label="Last" title="Last" onClick={() => setCurrentPly(maxGroupIndex)} disabled={currentPly >= maxGroupIndex}>
                <span aria-hidden="true">»</span>
              </button>
            </div>

            <div className="review-page__board-footer">
              <div className="elo-chart__track-toggle elo-chart__mode-toggle review-page__toggle-group" role="tablist" aria-label="Board orientation">
                {[
                  ["white", "White bottom"],
                  ["black", "Black bottom"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={boardOrientation === value}
                    className={`elo-chart__track-pill${boardOrientation === value ? " is-active" : ""}`}
                    onClick={() => setBoardOrientation(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="review-page__log-column">
            <h2>Move log</h2>
            <ol className="review-page__move-rows" ref={moveRowsRef}>
              {moveRows.map((row) => (
                <li key={row.moveNumber} className="review-page__move-row">
                  {(() => {
                    const whiteCompletedAt = finalTimestampForGroup(row.white)
                    const blackCompletedAt = finalTimestampForGroup(row.black)
                    const rowStartedAt =
                      finalTimestampForGroup(moveRows[row.moveNumber - 2]?.black) ??
                      finalTimestampForGroup(moveRows[row.moveNumber - 2]?.white) ??
                      game?.created_at
                    const whiteElapsed = whiteCompletedAt ? formatElapsedBetween(rowStartedAt, whiteCompletedAt) : "—"
                    const blackElapsed = blackCompletedAt ? formatElapsedBetween(whiteCompletedAt ?? rowStartedAt, blackCompletedAt) : "—"

                    return (
                  <div className="review-page__row-header">
                    <span className="review-page__row-time review-page__row-time--white">{whiteElapsed}</span>
                    <span className="review-page__move-number">{formatTurnNumber(row.white ?? row.black)}</span>
                    <span className="review-page__row-time review-page__row-time--black">{blackElapsed}</span>
                  </div>
                    )
                  })()}
                  <div className="review-page__ply-grid">
                    {["white", "black"].map((color) => {
                      const move = row[color]
                      if (!move) {
                        return <div key={color} className="review-page__ply-card review-page__ply-card--empty" />
                      }

                      const announcements = summarizePlyGroup(move)
                      return (
                        <button
                          key={color}
                          type="button"
                          className={`review-page__ply-card${selectedPlyGroup?.id === move.id ? " is-active" : ""}`}
                          data-ply-index={move.index}
                          aria-label={`${color === "white" ? "White" : "Black"} ${formatPlySummary(move)}`}
                          onClick={() => setCurrentPly(move.index)}
                        >
                          <span className="review-page__ply-color">{color === "white" ? "White" : "Black"}</span>
                          <ol className="review-page__announcement-list">
                            {announcements.map((announcement, index) => (
                              <li key={`${move.id}-${index}`} className="review-page__announcement-item">
                                <span className="review-page__announcement-badge">{index + 1}</span>
                                <span>{announcement}</span>
                              </li>
                            ))}
                          </ol>
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ol>

            <p className="review-page__result">Result: {formatResult(result)}</p>
          </aside>
        </div>
      ) : null}
      {!loading && !error && game ? (
        <section className="review-page__stats" aria-labelledby="review-stats-heading">
          <h2 id="review-stats-heading">Game stats</h2>
          <div className="review-page__stats-grid">
            {[
              ["white", game.white, whiteHistoricalRatings, whiteCurrentRatings],
              ["black", game.black, blackHistoricalRatings, blackCurrentRatings],
            ].map(([color, player, thenRatings, nowRatings]) => (
              <article key={color} className="review-page__stats-card">
                <h3>
                  {color === "white" ? "White" : "Black"}:{" "}
                  {player?.username ? (
                    <Link className="review-page__player-link" to={`/user/${player.username}`}>
                      {playerLabel(player)}
                    </Link>
                  ) : "—"}
                </h3>
                <div className="review-page__rating-columns">
                  <div>
                    <h4>At game</h4>
                    <ul className="review-page__rating-list">
                      <li><span>Overall</span><strong>{ratingValue(thenRatings?.overall)}</strong></li>
                      <li><span>vs Humans</span><strong>{ratingValue(thenRatings?.vsHumans)}</strong></li>
                      <li><span>vs Bots</span><strong>{ratingValue(thenRatings?.vsBots)}</strong></li>
                    </ul>
                  </div>
                  <div>
                    <h4>Now</h4>
                    <ul className="review-page__rating-list">
                      <li><span>Overall</span><strong>{ratingValue(nowRatings?.overall)}</strong></li>
                      <li><span>vs Humans</span><strong>{ratingValue(nowRatings?.vsHumans)}</strong></li>
                      <li><span>vs Bots</span><strong>{ratingValue(nowRatings?.vsBots)}</strong></li>
                    </ul>
                  </div>
                </div>
              </article>
            ))}
            <article className="review-page__stats-card review-page__stats-card--meta">
              <h3>Game details</h3>
              <ul className="review-page__rating-list">
                <li><span>Game code</span><strong>{game?.game_code ?? gameRef}</strong></li>
                <li><span>Started</span><strong>{startedAt}</strong></li>
                <li><span>Finished</span><strong>{endedAt}</strong></li>
                <li><span>Duration</span><strong>{duration}</strong></li>
              </ul>
            </article>
          </div>
        </section>
      ) : null}
      <VersionStamp />
    </main>
  )
}
