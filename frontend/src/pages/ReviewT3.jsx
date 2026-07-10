import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { getGameT3Review } from "../services/api"
import { formatRuleVariant } from "../utils/rules"
import "./ReviewT3.css"

const LABEL_CLASS = {
  good: "is-good",
  inaccuracy: "is-inaccuracy",
  mistake: "is-mistake",
  blunder: "is-blunder",
  "illegal or unsuccessful attempt": "is-illegal",
  unscored: "is-unscored",
}

function formatPlayer(player, fallback) {
  return player?.username || fallback
}

function formatNumber(value, digits = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a"
  }
  return value.toFixed(digits)
}

function formatDelta(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a"
  }
  if (value > 0) {
    return `+${value.toFixed(1)}`
  }
  return value.toFixed(1)
}

function formatProbability(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a"
  }
  return `${Math.round(value * 100)}%`
}

function summaryItems(summary) {
  return [
    ["Analyzed", summary?.analyzed_moves ?? 0],
    ["Good", summary?.best_moves ?? 0],
    ["Inaccuracies", summary?.inaccuracies ?? 0],
    ["Mistakes", summary?.mistakes ?? 0],
    ["Blunders", summary?.blunders ?? 0],
  ]
}

function probabilityItems(move) {
  const probabilities = move?.probabilities ?? {}
  return [
    ["Legal", probabilities.legal_probability],
    ["Capture", probabilities.capture_probability],
    ["Check", probabilities.check_probability],
    ["Reply risk", probabilities.exposed_piece_capture_probability],
  ]
}

function componentItems(move) {
  const components = move?.components ?? {}
  return Object.entries(components)
    .filter(([, value]) => typeof value === "number" && Math.abs(value) >= 1)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 5)
}

function componentLabel(name) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function MoveAnalysisRow({ move }) {
  const labelClass = LABEL_CLASS[move.label] ?? "is-unscored"
  return (
    <article className="review-t3__move">
      <div className="review-t3__move-main">
        <div className="review-t3__move-title">
          <span className="review-t3__ply">#{move.ply}</span>
          <strong>{move.color === "black" ? "Black" : "White"} {move.uci}</strong>
          <span className={`review-t3__label ${labelClass}`}>{move.label}</span>
        </div>
        <p className="review-t3__explanation">{move.explanation}</p>
        <div className="review-t3__reasons" aria-label={`Reasons for ${move.uci}`}>
          {(move.reasons ?? []).slice(0, 3).map((reason) => (
            <span key={`${move.ply}-${reason.name}`} className={`review-t3__reason is-${reason.direction}`}>
              {reason.description}
            </span>
          ))}
        </div>
      </div>
      <dl className="review-t3__metrics" aria-label={`Metrics for ${move.uci}`}>
        <div>
          <dt>Score</dt>
          <dd>{formatNumber(move.score)}</dd>
        </div>
        <div>
          <dt>Delta</dt>
          <dd>{formatDelta(move.move_delta)}</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd>{move.best_uci ?? "n/a"}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{move.confidence}</dd>
        </div>
      </dl>
      <div className="review-t3__details">
        <div className="review-t3__detail-block">
          <h3>Probabilities</h3>
          <ul>
            {probabilityItems(move).map(([label, value]) => (
              <li key={label}><span>{label}</span><strong>{formatProbability(value)}</strong></li>
            ))}
          </ul>
        </div>
        <div className="review-t3__detail-block">
          <h3>Score Terms</h3>
          <ul>
            {componentItems(move).map(([name, value]) => (
              <li key={name}><span>{componentLabel(name)}</span><strong>{formatDelta(value)}</strong></li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

export default function ReviewT3Page() {
  const { gameCode, gameId } = useParams()
  const gameRef = gameCode ?? gameId ?? ""
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function loadReview() {
      if (!gameRef) {
        setError("Missing game reference.")
        setLoading(false)
        return
      }
      setLoading(true)
      setError("")
      try {
        const nextReview = await getGameT3Review(gameRef)
        if (!cancelled) {
          setReview(nextReview)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError?.message ?? "Unable to load T3 review right now.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    loadReview()
    return () => {
      cancelled = true
    }
  }, [gameRef])

  const summary = review?.analysis?.summary
  const moves = useMemo(() => review?.analysis?.moves ?? [], [review])
  const supported = review?.analysis?.meta?.supported !== false
  const standardReviewPath = `/game/${review?.game?.game_code ?? gameRef}/review`

  return (
    <main className="page-shell review-t3" aria-live="polite">
      <div className="review-t3__header">
        <div>
          <h1>T3 review</h1>
          <p>
            {formatPlayer(review?.game?.white, "White")} vs {formatPlayer(review?.game?.black, "Black")}
            {review?.game?.rule_variant ? ` · ${formatRuleVariant(review.game.rule_variant)}` : ""}
          </p>
        </div>
        <Link className="review-t3__review-link" to={standardReviewPath}>Replay</Link>
      </div>

      {loading ? <p className="review-t3__notice">Loading analysis...</p> : null}
      {error ? <p className="review-t3__error">{error}</p> : null}

      {review && !loading ? (
        <>
          <section className="review-t3__summary" aria-label="T3 analysis summary">
            {summaryItems(summary).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>

          {!supported ? (
            <p className="review-t3__notice">{review.analysis.meta.openai_error}</p>
          ) : null}

          {supported && moves.length ? (
            <section className="review-t3__moves" aria-label="Move analysis">
              {moves.map((move) => <MoveAnalysisRow key={`${move.ply}-${move.uci}`} move={move} />)}
            </section>
          ) : null}

          {supported && !moves.length ? <p className="review-t3__notice">No scored moves available.</p> : null}

          <footer className="review-t3__footer">
            <span>{review.analysis.meta.analyzer}</span>
            <span>{review.analysis.meta.model ? `Model: ${review.analysis.meta.model}` : "Model unavailable"}</span>
            <span>{review.analysis.meta.openai_status}</span>
          </footer>
        </>
      ) : null}

      <VersionStamp />
    </main>
  )
}
