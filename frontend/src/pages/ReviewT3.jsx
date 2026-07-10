import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import ChessBoard from "../components/ChessBoard.jsx"
import { parseFenBoard } from "../components/chessboard"
import VersionStamp from "../components/VersionStamp"
import { getGameT3Review } from "../services/api"
import { formatRuleVariant } from "../utils/rules"
import "./ReviewT3.css"

const STARTING_FENS = {
  referee: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  white: "4K3/PPPPPPPP/8/8/8/8/8/8 w - - 0 1",
  black: "8/8/8/8/8/8/pppppppp/4k3 b - - 0 1",
}

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

function formatColor(color) {
  return color === "black" ? "Black" : "White"
}

function normalizeUci(value) {
  return String(value ?? "").trim().toLowerCase()
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

function componentLabel(name) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function componentItems(move) {
  const components = move?.components ?? {}
  return Object.entries(components)
    .filter(([, value]) => typeof value === "number" && Math.abs(value) >= 1)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 6)
}

function analysisKeyFromParts(ply, uci) {
  return `${Number(ply) || 0}:${normalizeUci(uci)}`
}

function analysisKey(move) {
  return analysisKeyFromParts(move?.ply, move?.uci)
}

function buildAnalysisIndexes(analysisMoves) {
  const byKey = new Map()
  const byPly = new Map()

  for (const move of analysisMoves ?? []) {
    byKey.set(analysisKey(move), move)
    byPly.set(Number(move?.ply) || 0, move)
  }

  return { byKey, byPly }
}

function findAnalysisForMove(indexes, move) {
  return indexes.byKey.get(analysisKey(move)) ?? indexes.byPly.get(Number(move?.ply) || 0) ?? null
}

function buildPlyGroups(moves) {
  const groups = []

  for (const move of moves ?? []) {
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

function formatPerspectiveLabel(group) {
  if (!group) {
    return "Start"
  }

  return `${group.turnNumber}${group.color === "black" ? "B" : "W"}`
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

function fenForPly(moves, ply, perspective) {
  if (ply <= 0) {
    return STARTING_FENS[perspective]
  }

  for (let index = (moves?.length ?? 0) - 1; index >= 0; index -= 1) {
    const move = moves[index]
    if (Number(move?.ply) > ply) {
      continue
    }

    const visibleFen = fenForPerspective(move?.replay_fen, perspective)
    if (visibleFen) {
      return visibleFen
    }
  }

  return STARTING_FENS[perspective]
}

function isCastlingUci(uci) {
  return ["e1g1", "e1c1", "e8g8", "e8c8"].includes(normalizeUci(uci))
}

function pieceAtFenSquare(fen, square) {
  const normalizedSquare = String(square ?? "").trim().toLowerCase()
  if (!/^[a-h][1-8]$/.test(normalizedSquare)) {
    return ""
  }

  const board = parseFenBoard(fen)
  const fileIndex = normalizedSquare.charCodeAt(0) - "a".charCodeAt(0)
  const rankIndex = 8 - Number.parseInt(normalizedSquare[1], 10)
  return board[rankIndex]?.[fileIndex] ?? ""
}

function castlingArrowsForUci(uci) {
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

function isCastlingMove(uci, previousBoardFen) {
  if (!isCastlingUci(uci)) {
    return false
  }

  const source = uci.slice(0, 2)
  const expectedKing = source === "e1" ? "K" : "k"
  return pieceAtFenSquare(previousBoardFen, source) === expectedKing
}

function dropSquareForMove(move) {
  const match = normalizeUci(move?.uci).match(/^[pnbrq]@([a-h][1-8])$/i)
  return match?.[1] ?? ""
}

function arrowsForMove(move, previousBoardFen) {
  const uci = normalizeUci(move?.uci)
  if (dropSquareForMove(move) || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return []
  }

  if (!move?.move_done) {
    return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "illegal" }]
  }

  if (isCastlingMove(uci, previousBoardFen)) {
    return castlingArrowsForUci(uci)
  }

  return [{ from: uci.slice(0, 2), to: uci.slice(2, 4), tone: "success" }]
}

function previousFullFenForPlyGroup(moves, group) {
  const firstMove = group?.moves?.[0]
  const firstIndex = moves.indexOf(firstMove)
  const startIndex = firstIndex >= 0 ? firstIndex - 1 : Number(group?.firstPly ?? 1) - 2

  for (let index = startIndex; index >= 0; index -= 1) {
    const fullFen = fenForPerspective(moves[index]?.replay_fen, "referee")
    if (fullFen) {
      return fullFen
    }
  }

  return STARTING_FENS.referee
}

function overlaysForPlyGroup(group, previousBoardFen = STARTING_FENS.referee) {
  if (!group) {
    return { arrows: [], badges: [], captureSquares: [] }
  }

  const arrows = []
  const badges = []
  const captureSquares = []

  group.moves.forEach((move, index) => {
    arrows.push(...arrowsForMove(move, previousBoardFen))

    const dropSquare = move?.move_done ? dropSquareForMove(move) : ""
    if (dropSquare) {
      badges.push({ square: dropSquare, label: "", tone: "success" })
    }

    const captureSquare = typeof move?.answer?.capture_square === "string" ? move.answer.capture_square.trim().toLowerCase() : ""
    if (/^[a-h][1-8]$/.test(captureSquare)) {
      captureSquares.push(captureSquare)
    }

    if (!move?.move_done) {
      const uci = normalizeUci(move?.uci)
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
        badges.push({ square: uci.slice(2, 4), label: String(index + 1), tone: "illegal" })
      }
    }
  })

  return {
    arrows,
    badges,
    captureSquares: [...new Set(captureSquares)],
  }
}

function riskLabel(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "unknown"
  }
  if (value >= 0.45) {
    return "high"
  }
  if (value >= 0.22) {
    return "watch"
  }
  return "low"
}

function moveCaption(move) {
  const uci = normalizeUci(move?.uci)
  return uci ? `${formatColor(move?.color)} ${uci}` : formatColor(move?.color)
}

function MoveCoachCard({ analysis, move }) {
  if (!analysis) {
    return (
      <article className="review-t3__coach-card">
        <h3>{moveCaption(move)}</h3>
        <p className="review-t3__coach-empty">No scored T3 analysis is available for this replay entry.</p>
      </article>
    )
  }

  const labelClass = LABEL_CLASS[analysis.label] ?? "is-unscored"
  const risk = analysis.probabilities?.exposed_piece_capture_probability
  const legal = analysis.probabilities?.legal_probability
  const check = analysis.probabilities?.check_probability
  const activity = analysis.components?.development
  const pressure = analysis.components?.check_pressure
  const safety = analysis.components?.safety_penalty

  return (
    <article className="review-t3__coach-card">
      <div className="review-t3__coach-title">
        <div>
          <span className="review-t3__eyebrow">{moveCaption(move)}</span>
          <h3>{analysis.side_to_move_label ?? "Position assessment"}</h3>
        </div>
        <span className={`review-t3__label ${labelClass}`}>{analysis.label}</span>
      </div>

      <dl className="review-t3__coach-metrics" aria-label={`T3 metrics for ${normalizeUci(move?.uci) || "move"}`}>
        <div>
          <dt>Position score</dt>
          <dd>{formatNumber(analysis.score)}</dd>
        </div>
        <div>
          <dt>Best gap</dt>
          <dd>{formatDelta(analysis.move_delta)}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{formatProbability(risk)} <span>{riskLabel(risk)}</span></dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{analysis.confidence ?? "n/a"}</dd>
        </div>
      </dl>

      <p className="review-t3__explanation">{analysis.explanation}</p>

      <div className="review-t3__signal-grid" aria-label="T3 score signals">
        <span><strong>{formatDelta(activity)}</strong> Activity</span>
        <span><strong>{formatDelta(pressure)}</strong> Check pressure</span>
        <span><strong>{formatDelta(safety)}</strong> Safety</span>
        <span><strong>{formatProbability(legal)}</strong> Legal</span>
        <span><strong>{formatProbability(check)}</strong> Check chance</span>
      </div>

      <div className="review-t3__reasons" aria-label={`Reasons for ${normalizeUci(move?.uci) || "move"}`}>
        {(analysis.reasons ?? []).slice(0, 3).map((reason) => (
          <span key={`${analysis.ply}-${reason.name}`} className={`review-t3__reason is-${reason.direction}`}>
            {reason.description}
          </span>
        ))}
      </div>

      <div className="review-t3__coach-details">
        <div>
          <h4>Best alternatives</h4>
          <ol>
            {(analysis.top_alternatives ?? []).slice(0, 3).map((alternative) => (
              <li key={`${analysis.ply}-${alternative.uci}`}>
                <span>{alternative.uci}</span>
                <strong>{formatNumber(alternative.score)}</strong>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4>Largest terms</h4>
          <ol>
            {componentItems(analysis).map(([name, value]) => (
              <li key={name}>
                <span>{componentLabel(name)}</span>
                <strong>{formatDelta(value)}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  )
}

function TimelineButton({ group, analysisIndexes, selected, onSelect }) {
  const primaryMove = group.moves.find((move) => findAnalysisForMove(analysisIndexes, move)) ?? group.moves[group.moves.length - 1]
  const analysis = findAnalysisForMove(analysisIndexes, primaryMove)
  const labelClass = LABEL_CLASS[analysis?.label] ?? "is-unscored"
  const uci = normalizeUci(primaryMove?.uci)

  return (
    <button
      type="button"
      className={`review-t3__timeline-button ${selected ? "is-active" : ""}`}
      onClick={() => onSelect(group.index)}
      aria-label={`Go to ${formatPerspectiveLabel(group)} ${uci || group.color}`}
    >
      <span>{formatPerspectiveLabel(group)}</span>
      <strong>{uci || "move"}</strong>
      <i className={labelClass}>{analysis?.label ?? "unscored"}</i>
    </button>
  )
}

export default function ReviewT3Page() {
  const { gameCode, gameId } = useParams()
  const gameRef = gameCode ?? gameId ?? ""
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPly, setCurrentPly] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [perspective, setPerspective] = useState("referee")
  const [boardOrientation, setBoardOrientation] = useState("white")

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
          setCurrentPly(-1)
          setIsPlaying(false)
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

  const moves = useMemo(() => review?.transcript?.moves ?? [], [review])
  const summary = review?.analysis?.summary
  const analysisMoves = useMemo(() => review?.analysis?.moves ?? [], [review])
  const analysisIndexes = useMemo(() => buildAnalysisIndexes(analysisMoves), [analysisMoves])
  const plyGroups = useMemo(() => buildPlyGroups(moves), [moves])
  const maxGroupIndex = Math.max(plyGroups.length - 1, -1)
  const finalGroup = maxGroupIndex >= 0 ? plyGroups[maxGroupIndex] : null
  const selectedPlyGroup = currentPly >= 0 ? plyGroups[currentPly] ?? null : null
  const selectedMoveAnalyses = useMemo(
    () => (selectedPlyGroup?.moves ?? []).map((move) => ({ move, analysis: findAnalysisForMove(analysisIndexes, move) })),
    [analysisIndexes, selectedPlyGroup],
  )

  useEffect(() => {
    if (currentPly > maxGroupIndex) {
      setCurrentPly(maxGroupIndex)
    }
  }, [currentPly, maxGroupIndex])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }
    if (currentPly >= maxGroupIndex) {
      setIsPlaying(false)
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCurrentPly((previousPly) => Math.min(maxGroupIndex, previousPly + 1))
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [currentPly, isPlaying, maxGroupIndex])

  const boardFen = useMemo(
    () => fenForPly(moves, selectedPlyGroup?.lastPly ?? 0, perspective),
    [moves, perspective, selectedPlyGroup],
  )
  const previousBoardFen = useMemo(
    () => previousFullFenForPlyGroup(moves, selectedPlyGroup),
    [moves, selectedPlyGroup],
  )
  const overlayState = useMemo(() => {
    const overlay = overlaysForPlyGroup(selectedPlyGroup, previousBoardFen)
    if (perspective !== "referee" && selectedPlyGroup && perspective !== selectedPlyGroup.color) {
      return { arrows: [], badges: [], captureSquares: overlay.captureSquares }
    }
    return overlay
  }, [perspective, previousBoardFen, selectedPlyGroup])
  const supported = review?.analysis?.meta?.supported !== false
  const standardReviewPath = `/game/${review?.game?.game_code ?? gameRef}/review`
  const counterLabel = selectedPlyGroup ? formatPerspectiveLabel(selectedPlyGroup) : "Start"
  const maxCounterLabel = finalGroup ? formatPerspectiveLabel(finalGroup) : "0W"

  function goToFirstPly() {
    setIsPlaying(false)
    setCurrentPly(-1)
  }

  function goToPreviousPly() {
    setIsPlaying(false)
    setCurrentPly((previousPly) => Math.max(-1, previousPly - 1))
  }

  function goToNextPly() {
    setIsPlaying(false)
    setCurrentPly((previousPly) => Math.min(maxGroupIndex, previousPly + 1))
  }

  function goToLastPly() {
    setIsPlaying(false)
    setCurrentPly(maxGroupIndex)
  }

  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (maxGroupIndex < 0) {
      return
    }

    setCurrentPly((previousPly) => (
      previousPly >= maxGroupIndex ? 0 : Math.min(maxGroupIndex, previousPly + 1)
    ))
    setIsPlaying(true)
  }

  return (
    <main className="page-shell review-t3" aria-live="polite">
      <div className="review-t3__header">
        <div>
          <h1>T3 replay</h1>
          <p>
            {formatPlayer(review?.game?.white, "White")} vs {formatPlayer(review?.game?.black, "Black")}
            {review?.game?.rule_variant ? ` · ${formatRuleVariant(review.game.rule_variant)}` : ""}
          </p>
        </div>
        <Link className="review-t3__review-link" to={standardReviewPath}>Replay</Link>
      </div>

      {loading ? <p className="review-t3__notice">Loading analysis...</p> : null}
      {error ? <p className="review-t3__error" role="alert">{error}</p> : null}

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

          {supported ? (
            <div className="review-t3__replay-layout">
              <section className="review-t3__board-panel" aria-label="T3 replay board">
                <div className="review-t3__board-toolbar" aria-label="Replay view controls">
                  <div className="review-t3__toolbar-group">
                    <span>View</span>
                    <div className="review-t3__segmented-control" role="tablist" aria-label="Replay perspective">
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
                          className={perspective === value ? "is-active" : ""}
                          onClick={() => setPerspective(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="review-t3__toolbar-group">
                    <span>Bottom</span>
                    <div className="review-t3__segmented-control" role="tablist" aria-label="Board orientation">
                      {[
                        ["white", "White", "White bottom"],
                        ["black", "Black", "Black bottom"],
                      ].map(([value, label, ariaLabel]) => (
                        <button
                          key={value}
                          type="button"
                          role="tab"
                          aria-label={ariaLabel}
                          aria-selected={boardOrientation === value}
                          className={boardOrientation === value ? "is-active" : ""}
                          onClick={() => setBoardOrientation(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
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

                <div className="review-t3__replay-controls" role="group" aria-label="Replay controls">
                  <button type="button" aria-label="First" title="First" onClick={goToFirstPly} disabled={currentPly < 0}>
                    First
                  </button>
                  <button type="button" aria-label="Prev" title="Prev" onClick={goToPreviousPly} disabled={currentPly < 0}>
                    Prev
                  </button>
                  <span className="review-t3__replay-counter" aria-label="Replay position counter">
                    {counterLabel}/{maxCounterLabel}
                  </span>
                  <button
                    type="button"
                    className="review-t3__play-button"
                    aria-label={isPlaying ? "Pause replay" : "Play replay"}
                    aria-pressed={isPlaying}
                    onClick={togglePlayback}
                    disabled={maxGroupIndex < 0}
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <button type="button" aria-label="Next" title="Next" onClick={goToNextPly} disabled={currentPly >= maxGroupIndex}>
                    Next
                  </button>
                  <button type="button" aria-label="Last" title="Last" onClick={goToLastPly} disabled={currentPly >= maxGroupIndex}>
                    Last
                  </button>
                </div>
              </section>

              <aside className="review-t3__coach-panel" aria-label="Current move coaching">
                {!selectedPlyGroup ? (
                  <div className="review-t3__coach-start">
                    <span className="review-t3__eyebrow">Start</span>
                    <h2>Game start</h2>
                    <p>No move selected.</p>
                  </div>
                ) : (
                  <>
                    <div className="review-t3__coach-heading">
                      <span className="review-t3__eyebrow">{formatPerspectiveLabel(selectedPlyGroup)}</span>
                      <h2>{formatColor(selectedPlyGroup.color)} to move</h2>
                    </div>
                    <div className="review-t3__coach-stack">
                      {selectedMoveAnalyses.map(({ move, analysis }) => (
                        <MoveCoachCard key={`${move?.ply}-${move?.uci}`} move={move} analysis={analysis} />
                      ))}
                    </div>
                  </>
                )}
              </aside>
            </div>
          ) : null}

          {supported && plyGroups.length ? (
            <section className="review-t3__timeline" aria-label="T3 move timeline">
              <button
                type="button"
                className={`review-t3__timeline-button review-t3__timeline-button--start${currentPly < 0 ? " is-active" : ""}`}
                onClick={goToFirstPly}
                aria-label="Go to game start"
              >
                <span>Start</span>
                <strong>Initial</strong>
                <i>board</i>
              </button>
              {plyGroups.map((group) => (
                <TimelineButton
                  key={group.id}
                  group={group}
                  analysisIndexes={analysisIndexes}
                  selected={currentPly === group.index}
                  onSelect={(index) => {
                    setIsPlaying(false)
                    setCurrentPly(index)
                  }}
                />
              ))}
            </section>
          ) : null}

          {supported && !plyGroups.length ? <p className="review-t3__notice">No replay moves available.</p> : null}

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
