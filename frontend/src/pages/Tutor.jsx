import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import ChessBoard from "../components/ChessBoard"
import {
  actTutorExercise, createTutorSession, getTutorSession, getTutorWorkspace,
  removeTutorMemory, sendTutorMessage, stopTutorSession,
} from "../services/api"
import "./Tutor.css"

function EvidenceText({ text }) {
  return String(text).split(/([2-9A-HJ-KM-NP-Z]{6}:\d+)/g).map((part, index) => {
    if (!/^[2-9A-HJ-KM-NP-Z]{6}:\d+$/.test(part)) return part
    const [code, ply] = part.split(":")
    return <Link key={index} to={`/game/${code}/review`}>{code} · attempt {ply}</Link>
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
  const connected = workspace?.connection.connected === true

  useEffect(() => {
    let current = true
    getTutorWorkspace().then((data) => { if (current) setWorkspace(data) })
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

  if (!workspace) return <main className="page-shell coach-page"><h1>Your Tutor</h1><p role={error ? "alert" : "status"}>{error || "Loading your coaching workspace…"}</p></main>

  const goals = Object.values(workspace.learning.goals)
  const notes = Object.values(workspace.learning.notes)

  return (
    <main className="page-shell coach-page">
      <header className="coach-heading">
        <div><p className="coach-eyebrow">Fil’s personal alpha</p><h1>Your Kriegspiel Tutor</h1><p>A learning programme built from your games and your thinking.</p></div>
        <div className="coach-plan"><span className={connected ? "coach-dot is-connected" : "coach-dot"} />{connected ? "Using ChatGPT plan" : "ChatGPT connection needed"}<a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage</a></div>
      </header>
      {error ? <p className="coach-alert" role="alert">{error}</p> : null}
      {!connected ? <aside className="coach-connection"><h2>Connect your ChatGPT plan</h2><p>Your games and learning workspace are ready. Complete the private installation’s ChatGPT sign-in to start coaching.</p><p>Sol 6.1 · High reasoning · Subscription usage</p></aside> : null}
      <div className="coach-tabs" role="tablist" aria-label="Tutor views">
        <button role="tab" aria-selected={tab === "coach"} onClick={() => setTab("coach")}>Coach & board</button>
        <button role="tab" aria-selected={tab === "progress"} onClick={() => setTab("progress")}>Progress & memory</button>
      </div>
      {tab === "coach" ? (
        <div className="coach-layout">
          <aside className="coach-sidebar">
            <button className="coach-primary" onClick={() => { setParams({}); setSession(null); setExerciseOverride(null) }}>New session</button>
            <h2>Continue learning</h2>
            {workspace.sessions.length ? workspace.sessions.map((item) => <button key={item.session_id} className={item.session_id === sessionId ? "coach-session is-selected" : "coach-session"} onClick={() => setParams({ session: item.session_id })}>{item.title}<small>{item.status}</small></button>) : <p>Your conversations will be saved here.</p>}
            <h2>Your games</h2><p>{workspace.history.total} completed games available to your coach.</p>
            {workspace.history.games.map((game) => <Link className="coach-game" key={game.game_code} to={`/game/${game.game_code}/review/tutor`}>{game.game_code}<small>{game.variant} · {game.completed_moves} moves as {game.color}</small></Link>)}
          </aside>
          <section className="coach-board-area" aria-label="Teaching board">
            {exercise ? (
              <>
                <div className="coach-exercise-heading"><p className="coach-eyebrow">{exercise.kind === "play" ? "Play it through" : exercise.kind === "predict" ? "Predict the referee" : "Explain your thinking"}</p><h2>{exercise.skill}</h2><p>{exercise.prompt}</p><EvidenceText text={`${exercise.game_code}:${exercise.ply}`} /></div>
                <ChessBoard boardFen={exercise.board_fen} orientation={exercise.color} highlightedSquares={selected ? [selected] : []} phantomSquares={marks} disabled={pending} onSquareClick={squareClick} onSquareRightClick={mark} />
                <details className="coach-referee-history"><summary>Referee history before this moment</summary>{exercise.scoresheet.turns.slice(-12).map((turn) => <div key={turn.turn}><strong>Turn {turn.turn}</strong>{["white", "black"].map((color) => <p key={color}><span>{color}: </span>{turn[color].map((entry, index) => <span key={index}>{typeof entry === "string" ? entry : entry.message}{" "}</span>)}</p>)}</div>)}</details>
                <label className="coach-mark-toggle"><input type="checkbox" checked={marking} onChange={(event) => setMarking(event.target.checked)} />Mark possible squares</label>
                {marks.length ? <p>Possibilities: {marks.join(", ")}</p> : null}
                {exercise.revealed ? <p className="coach-alert">Full board revealed. Further work on this position is assisted practice.</p> : null}
                {exercise.kind === "play" ? <form className="coach-move-form" onSubmit={(event) => { event.preventDefault(); act("move", attempt) }}><label>Move attempt<input value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="e2e4, e7e8q, or P@e4" /></label><button disabled={pending || !attempt || exercise.revealed}>Try move</button>{exercise.can_ask_any ? <button type="button" disabled={pending || exercise.revealed} onClick={() => act("ask_any")}>Any pawn captures?</button> : null}</form> : null}
                {exercise.kind === "predict" ? <div className="coach-predictions"><p>Attempt: {exercise.target}</p>{["REGULAR_MOVE", "ILLEGAL_MOVE", "CAPTURE_DONE", "IMPOSSIBLE_TO_ASK", "NONSENSE", "HAS_ANY", "NO_ANY"].map((value) => <button key={value} disabled={pending || exercise.events.some((event) => event.action === "predict")} onClick={() => act("predict", value)}>{value.replaceAll("_", " ").toLowerCase()}</button>)}</div> : null}
                {exercise.kind === "explain" ? <form onSubmit={(event) => { event.preventDefault(); act("explain", explanation) }}><label>Your reasoning<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="What is certain? What is possible? What would you try, and why?" /></label><button disabled={pending || !explanation.trim()}>Save explanation & marks</button></form> : null}
                <div className="coach-practice-actions"><button disabled={pending || exercise.hints_remaining === 0} onClick={() => act("hint")}>Give me a hint</button><button disabled={pending} onClick={() => act("reset")}>Retry position</button><button disabled={pending || exercise.revealed} onClick={() => act("reveal")}>Reveal full board</button></div>
                {exercise.hints.map((hint, index) => <p className="coach-hint" key={index}>Hint {index + 1}: {hint}</p>)}
                <ol className="coach-events">{exercise.events.map((event, index) => <li key={index}><strong>{event.action}</strong>{event.value ? ` · ${event.value}` : ""}{event.answer ? ` — ${event.answer.announcement}` : ""}{event.opponent_answer ? ` · Opponent: ${event.opponent_answer.announcement}` : ""}{event.expected ? ` · Referee: ${event.expected}${event.correct ? " · Correct" : " · Compare with your prediction"}` : ""}{event.assisted ? " · assisted" : ""}</li>)}</ol>
                <button disabled={!connected || running || pending} onClick={() => send(`Discuss my latest practice in exercise ${exercise.exercise_id}. Help me understand my reasoning and choose the next step.`)}>Discuss this practice</button>
              </>
            ) : <div className="coach-board-empty"><span aria-hidden="true">♘</span><h2>Learn from a position that matters to you.</h2><p>Your coach can bring a moment from your games onto this board. Try a move, mark possibilities, or explain your plan.</p><button disabled={!connected || running || pending} onClick={() => send(gameCode ? `Study my game ${gameCode}. Find one useful teaching moment, ask about my thinking, and open an interactive exercise.` : "Look across my games and current learning plan. Choose one useful teaching moment and open an interactive exercise.")}>Find a teaching moment</button></div>}
          </section>
          <section className="coach-conversation" aria-label="Conversation with your tutor">
            <h2>{gameCode ? `Discuss game ${gameCode}` : "Your coach"}</h2>
            {!session?.messages.length ? <div className="coach-welcome"><p>Tell me what you want to work on, or let’s find a useful starting point in your games.</p><div className="coach-starters">{["I have five minutes. What should I practise?", "Review my progress across my games.", "Help me understand the rules I play."].map((text) => <button key={text} disabled={!connected || pending || running} onClick={() => send(text)}>{text}</button>)}</div></div> : null}
            <div className="coach-messages" aria-live="polite">{session?.messages.map((message, index) => <article className={`coach-message is-${message.role}`} key={index}><span>{message.role === "user" ? "You" : "Tutor"}</span><p><EvidenceText text={message.text} /></p></article>)}</div>
            {session ? <p className="coach-activity" role="status">{session.activity}</p> : null}
            {running ? <button onClick={() => perform(async () => { setSession(await stopTutorSession(sessionId)); setWorkspace(await getTutorWorkspace()) })} disabled={pending}>Stop thinking</button> : null}
            <form className="coach-composer" onSubmit={(event) => { event.preventDefault(); send(draft) }}><label>Message your tutor<textarea value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} placeholder="What were you thinking at that moment?" /></label><button className="coach-primary" disabled={!connected || running || pending || !draft.trim()}>Send</button></form>
            <small>Sol 6.1 · High reasoning. Opening saved conversations and using the practice board do not call the model.</small>
          </section>
        </div>
      ) : <div className="coach-progress">
        <section><p className="coach-eyebrow">Your learning programme</p><h2>Current goals</h2>{goals.length ? goals.map((goal) => <article className="coach-memory-card" key={goal.key}><small>{goal.status}</small><h3>{goal.title}</h3><p>{goal.rationale}</p><p>Success: {goal.success_criterion}</p><p>Next: {goal.next_activity}</p><EvidenceLinks evidence={goal.evidence} /><button disabled={pending} onClick={() => forget("goal", goal.key)}>Remove goal</button></article>) : <p>Your coach will propose a focused goal after studying your games and hearing what you want to improve.</p>}</section>
        <section><p className="coach-eyebrow">Open to correction</p><h2>What your coach remembers</h2>{notes.length ? notes.map((note) => <article className="coach-memory-card" key={note.key}><small>{note.kind} · {note.confidence} confidence</small><h3>{note.skill}</h3><p>{note.text}</p><EvidenceLinks evidence={note.evidence} /><button disabled={pending} onClick={() => forget("note", note.key)}>Forget this note</button></article>) : <p>Learning observations will appear with their supporting evidence. You can correct them in conversation or remove them here.</p>}</section>
        <section><p className="coach-eyebrow">Practice over time</p><h2>Revisit & retain</h2><p>Independent attempts, hints, and later game evidence tell different parts of your progress story.</p>{practice.length ? practice.map((item) => <article className="coach-memory-card" key={item.exercise_id}><h3>{item.skill}</h3><p>{item.prompt}</p><p>{item.hint_count} hints · {item.events.filter((event) => ["move", "predict", "explain"].includes(event.action)).length} recorded attempts{item.revealed ? " · board revealed" : ""}</p><p>Revisit: {item.due_at.slice(0, 10)}</p><button onClick={() => { setExerciseOverride(item); setTab("coach") }}>Open practice</button></article>) : <p>Your saved exercises and revisit dates will appear here.</p>}</section>
      </div>}
    </main>
  )
}
