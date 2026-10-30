import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router"
import ChessBoard from "../components/ChessBoard"
import TutorMessage, { AttemptReference } from "../components/TutorMessage"
import VersionStamp from "../components/VersionStamp"
import TutorHistory from "../components/TutorHistory"
import TutorUsage from "../components/TutorUsage"
import TutorSessionTitle from "../components/TutorSessionTitle"
import TutorIconButton from "../components/TutorIconButton"
import TutorSidebar from "../components/TutorSidebar"
import {
  actTutorExercise, createTutorSession, getTutorGames, getTutorSession, getTutorWorkspace,
  removeTutorMemory, sendTutorMessage, stopTutorSession,
} from "../services/api"
import "./Tutor.css"

function EvidenceText({ text }) {
  return String(text).split(/([2-9A-HJ-KM-NP-Z]{6}:\d+)/g).map((part, index) => {
    if (!/^[2-9A-HJ-KM-NP-Z]{6}:\d+$/.test(part)) return part
    const [code, ply] = part.split(":")
    return <AttemptReference key={index} gameCode={code} attempt={Number(ply)}>{code} · attempt {ply}</AttemptReference>
  })
}

function EvidenceLinks({ evidence }) {
  return <p className="coach-evidence">{evidence.map((ref) => <span key={`${ref.game_code}:${ref.ply}`}><EvidenceText text={`${ref.game_code}:${ref.ply}`} /> </span>)}</p>
}

export default function TutorPage() {
  const { gameCode } = useParams()
  const [params, setParams] = useSearchParams()
  const sessionId = params.get("session")
  const [workspace, setWorkspace] = useState(null)
  const [history, setHistory] = useState({ total: 0, games: [], next_offset: null })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [replayEvent, setReplayEvent] = useState(null)
  const [session, setSession] = useState(null)
  const [exerciseOverride, setExerciseOverride] = useState(null)
  const [tab, setTab] = useState("coach")
  const [draft, setDraft] = useState("")
  const [attempt, setAttempt] = useState("")
  const [explanation, setExplanation] = useState("")
  const [selected, setSelected] = useState(null)
  const [marking, setMarking] = useState(false)
  const [marks, setMarks] = useState([])
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const running = session?.status === "running"
  const practice = workspace?.learning.practice ?? []
  const exercise = exerciseOverride ?? practice.find((item) => item.session_id === sessionId)
  const conversationGameCode = gameCode ?? session?.game_code ?? exercise?.game_code
  const connected = workspace?.connection.connected === true
  const reviewing = replayEvent !== null
  const replayOverlay = replayEvent ? replayEvent.overlays : { arrows: [], badges: [], captureSquares: [] }

  useEffect(() => { setReplayEvent(null) }, [exercise?.exercise_id])

  useEffect(() => {
    let current = true
    getTutorWorkspace().then((data) => { if (current) { setWorkspace(data); setHistory(data.history) } })
      .catch((failure) => { if (current) setError(failure.message) })
    return () => { current = false }
  }, [])

  useEffect(() => {
    let current = true
    setExerciseOverride(null)
    setMarks([])
    setSelected(null)
    setAttempt("")
    if (!sessionId) {
      setSession(null)
      return () => { current = false }
    }
    getTutorSession(sessionId).then((data) => { if (current) setSession(data) })
      .catch((failure) => { if (current) setError(failure.message) })
    return () => { current = false }
  }, [sessionId, gameCode])

  useEffect(() => {
    if (!running) return undefined
    let current = true
    const timer = window.setInterval(async () => {
      try {
        const data = await getTutorSession(sessionId)
        if (!current) return
        if (data.status !== "running") {
          const next = await getTutorWorkspace()
          if (!current) return
          setWorkspace(next)
        }
        setSession(data)
      } catch (failure) {
        if (current) setError(failure.message)
      }
    }, 1500)
    return () => { current = false; window.clearInterval(timer) }
  }, [running, sessionId])

  async function perform(operation) {
    setPending(true)
    setError("")
    try { await operation() } catch (failure) { setError(failure.message) } finally { setPending(false) }
  }

  async function send(text) {
    if (!text.trim() || !connected || pending || running) return
    await perform(async () => {
      let active = session
      if (!active) {
        active = await createTutorSession({ game_code: gameCode ?? null })
        setSession(active)
      }
      const next = await sendTutorMessage(active.session_id, { request_id: crypto.randomUUID(), text })
      setParams({ session: active.session_id })
      setSession(next)
      setDraft("")
      setTab("coach")
    })
  }

  async function act(action, value = "") {
    if (reviewing) return
    await perform(async () => {
      const updated = await actTutorExercise(exercise.exercise_id, {
        request_id: crypto.randomUUID(), revision: exercise.revision, action, value, marks,
      })
      setExerciseOverride(updated)
      setSelected(null)
      setAttempt("")
      setWorkspace(await getTutorWorkspace())
    })
  }

  function mark(square) {
    setMarks((previous) => previous.includes(square) ? previous.filter((item) => item !== square) : [...previous, square])
  }

  function squareClick(square) {
    if (marking) { mark(square); return }
    if (selected) { setAttempt(`${selected}${square}`); setSelected(null) } else { setSelected(square) }
  }

  async function forget(kind, key) {
    await perform(async () => {
      await removeTutorMemory({ kind, key })
      setWorkspace(await getTutorWorkspace())
    })
  }

  async function loadMoreGames() {
    setHistoryLoading(true)
    setError("")
    try {
      const next = await getTutorGames(history.next_offset)
      setHistory((current) => ({ ...next, games: [...current.games, ...next.games.filter((game) => !current.games.some((existing) => existing.game_code === game.game_code))] }))
    } catch (failure) { setError(failure.message) } finally { setHistoryLoading(false) }
  }

  if (!workspace) return <main className="page-shell coach-page"><h1>Your kriegspiel tutor</h1><p role={error ? "alert" : "status"}>{error || "Loading your coaching workspace…"}</p><VersionStamp /></main>

  const goals = Object.values(workspace.learning.goals)
  const notes = Object.values(workspace.learning.notes)

  return (
    <main className="page-shell coach-page">
      <header className="coach-heading">
        <div><p className="coach-eyebrow">Fil’s personal alpha</p><h1>Your kriegspiel tutor</h1></div>
        <div className="coach-plan"><span className={connected ? "coach-dot is-connected" : "coach-dot"} />{connected ? "Using ChatGPT plan" : "ChatGPT connection needed"}<a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage</a></div>
      </header>
      {error ? <p className="coach-alert" role="alert">{error}</p> : null}
      {!connected ? <aside className="coach-connection"><h2>Connect your ChatGPT plan</h2><p>Your games and learning workspace are ready. Complete the private installation’s ChatGPT sign-in to start coaching.</p><p>Sol 6.1 · High reasoning · Subscription usage</p></aside> : null}
      <div className="coach-tabs" role="tablist" aria-label="Tutor views">
        <button role="tab" aria-selected={tab === "coach"} onClick={() => setTab("coach")}>Coach & board</button>
        <button role="tab" aria-selected={tab === "progress"} onClick={() => setTab("progress")}>Progress & memory</button>
      </div>
      <TutorSidebar sessions={workspace.sessions} sessionId={sessionId} gameCode={gameCode} history={history} historyLoading={historyLoading} onLoadMore={loadMoreGames}
        onSession={(id) => { setParams({ session: id }); setTab("coach") }} onNew={() => { setParams({}); setSession(null); setExerciseOverride(null); setTab("coach") }}
        title={session ? <TutorSessionTitle key={session.session_id} session={session} onRenamed={(updated) => {
        setSession((current) => current?.session_id === updated.session_id ? { ...current, title: updated.title } : current)
        setWorkspace((current) => ({ ...current, sessions: current.sessions.map((item) => item.session_id === updated.session_id ? { ...item, title: updated.title } : item) }))
      }} /> : null}>
      {tab === "coach" ? (
        <div className="coach-layout">
          <section className="coach-board-area" aria-label="Teaching board">
            {exercise ? (
              <>
                <div className="coach-exercise-heading"><p className="coach-eyebrow">{exercise.kind === "play" ? "Play it through" : exercise.kind === "predict" ? "Predict the referee" : "Explain your thinking"}</p><h2>{exercise.skill}</h2><p>{exercise.prompt}</p><EvidenceText text={`${exercise.game_code}:${exercise.ply}`} /></div>
                {reviewing ? <div className="coach-replay-notice"><p>{replayEvent.ply === 0 ? "Starting position" : `Your view after attempt ${replayEvent.ply}`}. Practice is unchanged.</p><TutorIconButton icon="return" label="Return to practice" onClick={() => setReplayEvent(null)} /></div> : null}
                <ChessBoard boardFen={replayEvent ? replayEvent.after_fen : exercise.board_fen} orientation={exercise.color}
                  highlightedSquares={!reviewing && selected ? [selected] : []} phantomSquares={reviewing ? [] : marks}
                  overlayArrows={replayOverlay.arrows} overlayBadges={replayOverlay.badges} captureSquares={replayOverlay.captureSquares}
                  disabled={pending || reviewing} onSquareClick={squareClick} onSquareRightClick={mark} />
                <TutorHistory key={exercise.exercise_id} exercise={exercise} selectedPly={replayEvent?.ply} onSelect={setReplayEvent} onReturn={() => setReplayEvent(null)} />
                <fieldset className="coach-practice-inputs" disabled={reviewing}>
                <label className="coach-mark-toggle"><input type="checkbox" checked={marking} onChange={(event) => setMarking(event.target.checked)} />Mark possible squares</label>
                {marks.length ? <p>Possibilities: {marks.join(", ")}</p> : null}
                {exercise.revealed ? <p className="coach-alert">Full board revealed. Further work on this position is assisted practice.</p> : null}
                {exercise.kind === "play" ? <form className="coach-move-form" onSubmit={(event) => { event.preventDefault(); act("move", attempt) }}><label>Move attempt<input value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="e2e4, e7e8q, or P@e4" /></label><button disabled={pending || !attempt || exercise.revealed}>Try move</button>{exercise.can_ask_any ? <button type="button" disabled={pending || exercise.revealed} onClick={() => act("ask_any")}>Any pawn captures?</button> : null}</form> : null}
                {exercise.kind === "predict" ? <div className="coach-predictions"><p>Attempt: {exercise.target}</p>{["REGULAR_MOVE", "ILLEGAL_MOVE", "CAPTURE_DONE", "IMPOSSIBLE_TO_ASK", "NONSENSE", "HAS_ANY", "NO_ANY"].map((value) => <button key={value} disabled={pending || exercise.events.some((event) => event.action === "predict")} onClick={() => act("predict", value)}>{value.replaceAll("_", " ").toLowerCase()}</button>)}</div> : null}
                {exercise.kind === "explain" ? <form id={`coach-explanation-${exercise.exercise_id}`} onSubmit={(event) => { event.preventDefault(); act("explain", explanation) }}><label>Your reasoning<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="What is certain? What is possible? What would you try, and why?" /></label></form> : null}
                <div className="coach-practice-actions" role="group" aria-label="Practice actions">
                  {exercise.kind === "explain" ? <TutorIconButton icon="save" label="Save explanation & marks" type="submit" form={`coach-explanation-${exercise.exercise_id}`} disabled={pending || !explanation.trim()} /> : null}
                  <TutorIconButton icon="hint" label="Give me a hint" disabled={pending || exercise.hints_remaining === 0} onClick={() => act("hint")} />
                  <TutorIconButton icon="reset" label="Retry position" disabled={pending} onClick={() => act("reset")} />
                  <TutorIconButton icon="reveal" label="Reveal full board" disabled={pending || exercise.revealed} onClick={() => act("reveal")} />
                </div>
                {exercise.hints.map((hint, index) => <p className="coach-hint" key={index}>Hint {index + 1}: {hint}</p>)}
                <ol className="coach-events">{exercise.events.map((event, index) => <li key={index}><strong>{event.action}</strong>{event.value ? ` · ${event.value}` : ""}{event.answer ? ` — ${event.answer.announcement}` : ""}{event.opponent_answer ? ` · Opponent: ${event.opponent_answer.announcement}` : ""}{event.expected ? ` · Referee: ${event.expected}${event.correct ? " · Correct" : " · Compare with your prediction"}` : ""}{event.assisted ? " · assisted" : ""}</li>)}</ol>
                <button disabled={!connected || running || pending} onClick={() => send(`Discuss my latest practice in exercise ${exercise.exercise_id}. Help me understand my reasoning and choose the next step.`)}>Discuss this practice</button>
                </fieldset>
              </>
            ) : <div className="coach-board-empty"><span aria-hidden="true">♘</span><h2>Learn from a position that matters to you.</h2><p>Your coach can bring a moment from your games onto this board. Try a move, mark possibilities, or explain your plan.</p><button disabled={!connected || running || pending} onClick={() => send(gameCode ? `Study my game ${gameCode}. Find one useful teaching moment, ask about my thinking, and open an interactive exercise.` : "Look across my games and current learning plan. Choose one useful teaching moment and open an interactive exercise.")}>Find a teaching moment</button></div>}
          </section>
          <section className="coach-conversation" aria-label="Conversation with your tutor">
            <h2>{gameCode ? `Discuss game ${gameCode}` : "Your coach"}</h2>
            {!session?.messages.length ? <div className="coach-welcome"><p>Tell me what you want to work on, or let’s find a useful starting point in your games.</p><div className="coach-starters">{["I have five minutes. What should I practise?", "Review my progress across my games.", "Help me understand the rules I play."].map((text) => <button key={text} disabled={!connected || pending || running} onClick={() => send(text)}>{text}</button>)}</div></div> : null}
            <div className="coach-messages" aria-live="polite">{session?.messages.map((message, index) => <article className={`coach-message is-${message.role}`} key={index}><span>{message.role === "user" ? "You" : "Tutor"}</span><TutorMessage text={message.text} gameCode={conversationGameCode} /></article>)}</div>
            {session ? <p className="coach-activity" role="status">{session.activity}</p> : null}
            {running ? <button onClick={() => perform(async () => { setSession(await stopTutorSession(sessionId)); setWorkspace(await getTutorWorkspace()) })} disabled={pending}>Stop thinking</button> : null}
            <form className="coach-composer" onSubmit={(event) => { event.preventDefault(); send(draft) }}><label>Message your tutor<textarea value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} placeholder="What were you thinking at that moment?" /></label><button className="coach-primary" disabled={!connected || running || pending || !draft.trim()}>Send</button></form>
            <small>Sol 6.1 · High reasoning. Opening saved conversations and using the practice board do not call the model.</small>
            {session ? <TutorUsage session={session} /> : null}
          </section>
        </div>
      ) : <div className="coach-progress">
        <section><p className="coach-eyebrow">Your learning programme</p><h2>Current goals</h2>{goals.length ? goals.map((goal) => <article className="coach-memory-card" key={goal.key}><small>{goal.status}</small><h3>{goal.title}</h3><p>{goal.rationale}</p><p>Success: {goal.success_criterion}</p><p>Next: {goal.next_activity}</p><EvidenceLinks evidence={goal.evidence} /><button disabled={pending} onClick={() => forget("goal", goal.key)}>Remove goal</button></article>) : <p>Your coach will propose a focused goal after studying your games and hearing what you want to improve.</p>}</section>
        <section><p className="coach-eyebrow">Open to correction</p><h2>What your coach remembers</h2>{notes.length ? notes.map((note) => <article className="coach-memory-card" key={note.key}><small>{note.kind} · {note.confidence} confidence</small><h3>{note.skill}</h3><p>{note.text}</p><EvidenceLinks evidence={note.evidence} /><button disabled={pending} onClick={() => forget("note", note.key)}>Forget this note</button></article>) : <p>Learning observations will appear with their supporting evidence. You can correct them in conversation or remove them here.</p>}</section>
        <section><p className="coach-eyebrow">Practice over time</p><h2>Revisit & retain</h2><p>Independent attempts, hints, and later game evidence tell different parts of your progress story.</p>{practice.length ? practice.map((item) => <article className="coach-memory-card" key={item.exercise_id}><h3>{item.skill}</h3><p>{item.prompt}</p><p>{item.hint_count} hints · {item.events.filter((event) => ["move", "predict", "explain"].includes(event.action)).length} recorded attempts{item.revealed ? " · board revealed" : ""}</p><p>Revisit: {item.due_at.slice(0, 10)}</p><button onClick={() => { setExerciseOverride(item); setTab("coach") }}>Open practice</button></article>) : <p>Your saved exercises and revisit dates will appear here.</p>}</section>
      </div>}
      </TutorSidebar>
      <VersionStamp />
    </main>
  )
}
