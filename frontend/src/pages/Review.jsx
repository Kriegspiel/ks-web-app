import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard"
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
  if (replayFen?.[perspective]) {
    return replayFen[perspective]
  }

  return STARTING_FENS[perspective]
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
  const orientation = perspective === "black" ? "black" : "white"

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
            <ChessBoard boardFen={boardFen} orientation={orientation} disabled />

            <div className="review-page__controls" role="group" aria-label="Replay controls">
              <button type="button" onClick={() => setCurrentPly(0)} disabled={currentPly === 0}>First</button>
              <button type="button" onClick={() => setCurrentPly((prev) => Math.max(0, prev - 1))} disabled={currentPly === 0}>Prev</button>
              <span className="review-page__ply">Ply {currentPly} / {maxPly}</span>
              <button type="button" onClick={() => setCurrentPly((prev) => Math.min(maxPly, prev + 1))} disabled={currentPly === maxPly}>Next</button>
              <button type="button" onClick={() => setCurrentPly(maxPly)} disabled={currentPly === maxPly}>Last</button>
            </div>

            <fieldset className="review-page__perspective">
              <legend>Perspective</legend>
              {[
                ["referee", "Referee"],
                ["white", "White"],
                ["black", "Black"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="perspective"
                    value={value}
                    checked={perspective === value}
                    onChange={() => setPerspective(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          </section>

          <aside className="review-page__log-column">
            <h2>Move log</h2>
            <ol className="review-page__moves">
              {moves.map((move, index) => (
                <li key={`${move.ply}-${index}`}>
                  <button
                    type="button"
                    className={currentPly === index + 1 ? "is-active" : ""}
                    onClick={() => setCurrentPly(index + 1)}
                  >
                    {move.ply}. {formatTranscriptMove(move)}
                  </button>
                </li>
              ))}
            </ol>

            <p className="review-page__result">Result: {formatResult(result)}</p>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

