import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
import VersionStamp from "../components/VersionStamp"
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
  CAPTURE_DONE: "Capture done",
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

function formatTranscriptMove(move) {
  const questionType = String(move?.question_type ?? "COMMON").toUpperCase()
  const prompt = questionType === "ASK_ANY" ? "Ask any pawn captures" : "Move attempt"
  const main = typeof move?.answer?.main === "string" ? ANNOUNCEMENT_TEXT[move.answer.main] ?? move.answer.main : "UNKNOWN"
  const special = typeof move?.answer?.special === "string" ? ANNOUNCEMENT_TEXT[move.answer.special] ?? move.answer.special : ""
  const captureSquare = typeof move?.answer?.capture_square === "string" ? move.answer.capture_square.trim().toUpperCase() : ""
  const messages = []
  if (main) {
    messages.push(move?.answer?.main === "CAPTURE_DONE" && captureSquare ? `${main} at ${captureSquare}` : main)
  }
  if (special) {
    messages.push(special)
  }
  return `${prompt} — ${messages.join(" · ") || "UNKNOWN"}`
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
  if (main === "Capture done" && captureSquare) {
    return `${main} at ${captureSquare}`
  }

  return main
}

function moveAnnouncements(move) {
  if (!move) {
    return []
  }

  const items = []
  const questionType = String(move.question_type ?? "COMMON").toUpperCase()
  const normalizedUci = typeof move.uci === "string" ? move.uci.trim().toLowerCase() : ""

  if (questionType !== "ASK_ANY" && normalizedUci) {
    items.push(`[${normalizedUci}]`)
  }

  const main = formatCaptureAnnouncement(move)
  const special = formatAnnouncement(move?.answer?.special)
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
  const { gameId } = useParams()
  const navigate = useNavigate()

  const [moves, setMoves] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPly, setCurrentPly] = useState(0)
  const [perspective, setPerspective] = useState("referee")
  const [boardOrientation, setBoardOrientation] = useState("white")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError("")

      try {
        const [transcript, game] = await Promise.all([getGameTranscript(gameId), getGame(gameId)])
        if (!active) {
          return
        }

        if (!Array.isArray(transcript?.moves)) {
          setError("Replay transcript is unavailable.")
          return
        }

        setMoves(transcript.moves)
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
  }, [gameId])

  const maxPly = moves.length
  const moveRows = useMemo(() => buildMoveRows(moves), [moves])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        setCurrentPly((prev) => Math.max(0, prev - 1))
      }
      if (event.key === "ArrowRight") {
        setCurrentPly((prev) => Math.min(maxPly, prev + 1))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [maxPly])

  const boardFen = useMemo(() => fenForPly(moves, currentPly, perspective), [moves, currentPly, perspective])
  const selectedMove = currentPly > 0 ? moves[currentPly - 1] : null
  const selectedPlyGroup = useMemo(() => {
    if (!selectedMove) {
      return null
    }

    return buildPlyGroups(moves).find((group) => selectedMove.ply >= group.firstPly && selectedMove.ply <= group.lastPly) ?? null
  }, [moves, selectedMove])
  const overlayState = useMemo(() => overlaysForPlyGroup(selectedPlyGroup), [selectedPlyGroup])

  return (
    <main className="page-shell review-page" aria-live="polite">
      <div className="review-page__header">
        <h1>Game review</h1>
        <button type="button" onClick={() => navigate(`/game/${gameId}`)}>Back to game</button>
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
              <button type="button" onClick={() => setCurrentPly(0)} disabled={currentPly === 0}>First</button>
              <button type="button" onClick={() => setCurrentPly((prev) => Math.max(0, prev - 1))} disabled={currentPly === 0}>Prev</button>
              <span className="review-page__ply">Ply {currentPly} / {maxPly}</span>
              <button type="button" onClick={() => setCurrentPly((prev) => Math.min(maxPly, prev + 1))} disabled={currentPly === maxPly}>Next</button>
              <button type="button" onClick={() => setCurrentPly(maxPly)} disabled={currentPly === maxPly}>Last</button>
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
            <ol className="review-page__move-rows">
              {moveRows.map((row) => (
                <li key={row.moveNumber} className="review-page__move-row">
                  <div className="review-page__move-number">{row.moveNumber}</div>
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
                          onClick={() => setCurrentPly(move.lastPly)}
                        >
                          <span className="review-page__ply-color">{color === "white" ? "White" : "Black"}</span>
                          <span className="review-page__ply-head">{formatPlySummary(move)}</span>
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
      <VersionStamp />
    </main>
  )
}
