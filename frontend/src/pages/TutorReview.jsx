import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import VersionStamp from "../components/VersionStamp"
import {
  generateTutorGameAnalysis,
  getTutorGame,
  submitTutorFeedback,
} from "../services/api"
import "./TutorReview.css"

const PROFILE_READY_GAMES = 5
const FEEDBACK_OPTIONS = [
  ["helpful", "Helpful"],
  ["not_helpful", "Not useful"],
  ["incorrect", "Incorrect"],
]

function formatCurrency(value) {
  return `$${value.toFixed(2)}`
}

function formatGeneratedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Saved review"
  }
  return `Saved ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`
}

function profileStepCount(profile) {
  return Math.min(PROFILE_READY_GAMES, Math.max(0, profile.reviewed_games))
}

function confidenceLabel(value) {
  if (value === "high") return "High confidence"
  if (value === "medium") return "Medium confidence"
  return "Exploratory"
}

function UsageCard({ usage }) {
  const spent = usage.spent_usd
  const limit = usage.limit_usd
  const remaining = usage.remaining_usd
  const reserved = usage.reserved_usd

  return (
    <section className="tutor-card tutor-usage-card" aria-labelledby="tutor-usage-title">
      <div className="tutor-card__heading">
        <p className="tutor-kicker">Safety control</p>
        <h2 id="tutor-usage-title">Usage this month</h2>
      </div>
      <p className="tutor-usage-card__amount">
        <strong>{formatCurrency(spent)}</strong> of {formatCurrency(limit)}
      </p>
      <div
        className="tutor-progress-bar"
        role="progressbar"
        aria-label="Tutor monthly budget used"
        aria-valuemin="0"
        aria-valuemax={limit}
        aria-valuenow={Math.min(limit, spent + reserved)}
      >
        <span style={{ width: `${limit > 0 ? Math.min(100, ((spent + reserved) / limit) * 100) : 100}%` }} />
      </div>
      <p>{formatCurrency(remaining)} remains in the private-beta budget.</p>
      {reserved > 0 ? <p className="tutor-card__meta">{formatCurrency(reserved)} is reserved for an analysis in progress.</p> : null}
    </section>
  )
}

function ProfileCard({ profile }) {
  const reviewed = Math.max(0, profile.reviewed_games)
  const completedSteps = profileStepCount(profile)

  return (
    <section className="tutor-card tutor-profile-card" aria-labelledby="tutor-profile-title">
      <div className="tutor-card__heading">
        <p className="tutor-kicker">Across your games</p>
        <h2 id="tutor-profile-title">Tutor memory</h2>
      </div>
      <div className="tutor-profile-card__count">
        <strong>{reviewed}</strong>
        <span>{reviewed === 1 ? "review" : "reviews"}</span>
      </div>
      <div className="tutor-memory-steps" aria-label={`${completedSteps} of ${PROFILE_READY_GAMES} reviews toward progress insights`}>
        {Array.from({ length: PROFILE_READY_GAMES }, (_, index) => (
          <span key={index} className={index < completedSteps ? "is-complete" : ""} />
        ))}
      </div>
      {profile.ready ? (
        <>
          <p className="tutor-profile-card__summary">{profile.summary}</p>
          {profile.strengths.length ? (
            <div>
              <h3>Patterns to keep</h3>
              <ul className="tutor-chip-list">
                {profile.strengths.map((strength) => <li key={strength}>{strength}</li>)}
              </ul>
            </div>
          ) : null}
          {profile.focus_areas.length ? (
            <div className="tutor-profile-focus">
              <h3>Current focus</h3>
              {profile.focus_areas.map((area) => (
                <article key={area.skill}>
                  <strong>{area.skill}</strong>
                  <p>{area.reason}</p>
                  <p className="tutor-action-line">Next: {area.next_action}</p>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p>
          {profile.games_until_ready} more useful {profile.games_until_ready === 1 ? "review" : "reviews"} before Tutor treats recurring signals as progress trends.
        </p>
      )}
    </section>
  )
}

function EmptyAnalysis({ data, generating, onGenerate }) {
  const canGenerate = data.eligible === true && data.usage.remaining_usd > 0

  return (
    <section className="tutor-card tutor-empty-card" aria-labelledby="tutor-empty-title">
      <p className="tutor-kicker">Game-specific coaching</p>
      <h2 id="tutor-empty-title">Turn this replay into a training plan.</h2>
      {data.eligible ? (
        <>
          <p>
            Tutor will study your move attempts, sequencing, and the public referee answers from this game, then compare them with what it remembers from earlier reviews.
          </p>
          <button type="button" className="tutor-generate-button" disabled={!canGenerate || generating} onClick={onGenerate}>
            {generating ? "Tutor is thinking…" : "Analyze this game"}
          </button>
          <p className="tutor-card__meta">One explicit request. The result is saved, so opening it again does not use the model.</p>
        </>
      ) : (
        <p className="tutor-inline-notice">{data.eligibility_reason}</p>
      )}
    </section>
  )
}

function SkillColumn({ title, items, tone }) {
  return (
    <section className={`tutor-skill-column tutor-skill-column--${tone}`}>
      <h2>{title}</h2>
      {items.length ? items.map((item) => (
        <article key={`${title}-${item.skill}`}>
          <h3>{item.skill}</h3>
          <p>{item.evidence}</p>
          <p className="tutor-action-line">Try next: {item.action}</p>
        </article>
      )) : <p>No strong signal in this game.</p>}
    </section>
  )
}

function AnalysisView({ analysis }) {
  const review = analysis.review

  return (
    <div className="tutor-analysis" aria-label="Tutor analysis">
      <section className="tutor-card tutor-overview-card">
        <div className="tutor-analysis__stamp">
          <span>{analysis.cached ? "Cached · no new model cost" : "New analysis"}</span>
          <span>{formatGeneratedAt(analysis.generated_at)}</span>
        </div>
        <p className="tutor-kicker">Coach’s read</p>
        <h2>What this game says</h2>
        <p className="tutor-overview-card__lead">{review.overview}</p>
        <p className="tutor-result-context">{review.result_context}</p>
      </section>

      <section className="tutor-moments" aria-labelledby="tutor-moments-title">
        <div className="tutor-section-heading">
          <p className="tutor-kicker">Evidence, not hindsight</p>
          <h2 id="tutor-moments-title">Key moments</h2>
        </div>
        {review.key_moments.length ? (
          <ol>
            {review.key_moments.map((moment) => (
              <li key={`${moment.turn}-${moment.title}`} className="tutor-card tutor-moment-card">
                <div className="tutor-moment-card__topline">
                  <span>Turn {moment.turn}</span>
                  <span className={`tutor-confidence tutor-confidence--${moment.confidence}`}>{confidenceLabel(moment.confidence)}</span>
                </div>
                <h3>{moment.title}</h3>
                <p>{moment.observation}</p>
                <dl>
                  <div>
                    <dt>Why it matters</dt>
                    <dd>{moment.why_it_matters}</dd>
                  </div>
                  <div>
                    <dt>Next time</dt>
                    <dd>{moment.suggestion}</dd>
                  </div>
                </dl>
                <div className="tutor-evidence-tags" aria-label="Evidence references">
                  {moment.evidence.map((reference) => <span key={reference}>{reference}</span>)}
                </div>
              </li>
            ))}
          </ol>
        ) : <p className="tutor-inline-notice">This game did not produce a reliable key moment.</p>}
      </section>

      <div className="tutor-skills-grid">
        <SkillColumn title="Keep doing" items={review.strengths} tone="strength" />
        <SkillColumn title="Work on next" items={review.improvements} tone="focus" />
      </div>

      <section className="tutor-card tutor-drill-card" aria-labelledby="tutor-drill-title">
        <p className="tutor-kicker">One deliberate practice</p>
        <h2 id="tutor-drill-title">{review.next_drill.title}</h2>
        <p>{review.next_drill.instructions}</p>
        <div>
          <span>Success looks like</span>
          <strong>{review.next_drill.success_criterion}</strong>
        </div>
      </section>
    </div>
  )
}

function FeedbackCard({ analysis, gameCode, onSaved }) {
  const [rating, setRating] = useState(analysis.feedback?.rating ?? "")
  const [comment, setComment] = useState(analysis.feedback?.comment ?? "")
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(analysis.feedback ? "Feedback saved." : "")

  async function submitFeedback(event) {
    event.preventDefault()
    if (!rating || sending) return
    setSending(true)
    setMessage("")
    try {
      const saved = await submitTutorFeedback(gameCode, { rating, comment: comment.trim() || null })
      onSaved(saved)
      setMessage("Feedback saved. It will help tune the beta.")
    } catch (error) {
      setMessage(error?.message ?? "Unable to save feedback right now.")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="tutor-card tutor-feedback-card" aria-labelledby="tutor-feedback-title">
      <p className="tutor-kicker">Private-beta signal</p>
      <h2 id="tutor-feedback-title">Was this coaching useful?</h2>
      <form onSubmit={submitFeedback}>
        <div className="tutor-feedback-options">
          {FEEDBACK_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={rating === value}
              className={rating === value ? "is-selected" : ""}
              onClick={() => setRating(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label htmlFor="tutor-feedback-comment">What should Tutor improve? <span>Optional</span></label>
        <textarea
          id="tutor-feedback-comment"
          maxLength="500"
          rows="3"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Especially useful, misleading, or missing…"
        />
        <button type="submit" disabled={!rating || sending}>{sending ? "Saving…" : "Save feedback"}</button>
      </form>
      {message ? <p className="tutor-feedback-card__message" role="status">{message}</p> : null}
    </section>
  )
}

export default function TutorReviewPage() {
  const { gameCode = "" } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [actionError, setActionError] = useState("")

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError("")

    getTutorGame(gameCode)
      .then((response) => {
        if (active) setData(response)
      })
      .catch((error) => {
        if (active) setLoadError(error?.message ?? "Unable to load Tutor review right now.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [gameCode])

  async function generateAnalysis() {
    setGenerating(true)
    setActionError("")
    try {
      setData(await generateTutorGameAnalysis(gameCode))
    } catch (error) {
      setActionError(error?.message ?? "Unable to generate Tutor review right now.")
    } finally {
      setGenerating(false)
    }
  }

  function saveFeedback(feedback) {
    setData((current) => ({ ...current, analysis: { ...current.analysis, feedback } }))
  }

  const analysis = data?.analysis ?? null
  const profile = data?.profile ?? null
  const pageTitle = `Tutor review · ${gameCode}`

  return (
    <main className="page-shell tutor-page" aria-live="polite">
      <header className="tutor-page__header">
        <div>
          <p className="tutor-eyebrow"><span>Private beta</span> Kriegspiel Tutor</p>
          <h1>{pageTitle}</h1>
          <p>Your player-perspective coach for this completed game.</p>
        </div>
        <Link className="button-link button-link--secondary" to={`/game/${encodeURIComponent(gameCode)}/review`}>Back to replay</Link>
      </header>

      <section className="tutor-privacy-note" aria-label="Tutor evidence policy">
        <strong>Player-safe by design.</strong>
        <span>Tutor receives your attempts and public referee answers—not replay FENs or opponent move squares.</span>
      </section>

      {loading ? <p className="tutor-page__notice">Loading Tutor memory…</p> : null}
      {loadError ? <p className="auth-error tutor-page__error" role="alert">{loadError}</p> : null}

      {!loading && !loadError && data ? (
        <>
          <div className="tutor-summary-grid">
            <ProfileCard profile={profile} />
            <UsageCard usage={data.usage} />
          </div>

          {actionError ? <p className="auth-error tutor-page__error" role="alert">{actionError}</p> : null}
          {analysis ? <AnalysisView analysis={analysis} /> : (
            <EmptyAnalysis data={data} generating={generating} onGenerate={generateAnalysis} />
          )}
          {analysis ? <FeedbackCard analysis={analysis} gameCode={gameCode} onSaved={saveFeedback} /> : null}
        </>
      ) : null}

      <VersionStamp />
    </main>
  )
}
