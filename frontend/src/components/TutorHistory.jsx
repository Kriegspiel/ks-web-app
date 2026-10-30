import { useEffect, useRef, useState } from "react"
import { getTutorHistory } from "../services/api"
import TutorIconButton from "./TutorIconButton"

export default function TutorHistory({ exercise, selectedPly, onSelect, onReturn }) {
  const initiated = useRef(false)
  const [history, setHistory] = useState({ events: [], next_start: null, total_attempts: exercise.ply - 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [playing, setPlaying] = useState(false)
  const selected = history.events.findIndex((event) => event.ply === selectedPly)
  const rows = new Map()
  for (const event of history.events) {
    if (!rows.has(event.turn)) rows.set(event.turn, { white: [], black: [] })
    rows.get(event.turn)[event.color].push(event)
  }

  async function load(start) {
    setLoading(true)
    setError("")
    try {
      const next = await getTutorHistory(exercise.exercise_id, start)
      setHistory((current) => ({ ...next, events: [...current.events, ...next.events.filter((event) => !current.events.some((previous) => previous.ply === event.ply))] }))
    } catch (failure) { setError(failure.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (selectedPly == null) setPlaying(false)
  }, [selectedPly])

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setTimeout(() => {
      if (selected < history.events.length - 1) onSelect(history.events[selected + 1])
      else setPlaying(false)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [playing, selected, history.events, onSelect])

  function select(index) {
    setPlaying(false)
    const first = history.events[0]
    onSelect(index < 0 ? { ...first, ply: 0, attempt: null, after_fen: first.before_fen } : history.events[index])
  }

  return <details className="coach-referee-history" onToggle={(event) => {
    if (event.currentTarget.open && !initiated.current) { initiated.current = true; load(1) }
    if (!event.currentTarget.open) setPlaying(false)
  }}>
    <summary>Referee history before this moment</summary>
    <p>Recorded game before practice. Only your perspective is shown.</p>
    {loading ? <p role="status">Loading referee history…</p> : null}
    {error ? <p role="alert">{error}<button onClick={() => load(history.next_start ?? 1)}>Retry history</button></p> : null}
    {history.events.length ? <>
      <div className="coach-replay-controls" role="group" aria-label="History replay controls">
        <TutorIconButton icon="first" label="First" onClick={() => select(-1)} disabled={selectedPly === 0} />
        <TutorIconButton icon="previous" label="Prev" onClick={() => select(selected - 1)} disabled={selected < 0} />
        <TutorIconButton icon={playing ? "pause" : "play"} label={playing ? "Pause replay" : "Play replay"} aria-pressed={playing} onClick={() => { if (selected === history.events.length - 1) onSelect(history.events[0]); setPlaying(!playing) }} />
        <TutorIconButton icon="next" label="Next" onClick={() => select(Math.min(history.events.length - 1, selected + 1))} disabled={selected === history.events.length - 1} />
        <TutorIconButton icon="last" label="Last" onClick={() => select(history.events.length - 1)} disabled={selected === history.events.length - 1} />
        <TutorIconButton icon="return" label="Return to practice" onClick={() => { setPlaying(false); onReturn() }} />
      </div>
      <p aria-live="polite">{selectedPly == null ? "Practice position" : selectedPly === 0 ? "Starting position" : `Viewing attempt ${selectedPly}`} · {history.events.length} visible entries loaded</p>
      <ol className="coach-referee-turns">{[...rows].map(([turn, sides]) => <li key={turn}>
        <h3>Turn {turn}</h3><div className="coach-referee-sides">{["white", "black"].map((color) => <div className="coach-referee-side" key={color}>
          <strong>{color === "white" ? "White" : "Black"}</strong>
          {sides[color].map((event) => <button className="coach-referee-attempt" key={event.ply} aria-pressed={event.ply === selectedPly} onClick={() => select(history.events.indexOf(event))}>
            <span>Attempt {event.ply}{event.attempt ? <> · <code>{event.attempt}</code></> : null}</span>
            {event.messages.map((message, index) => <span key={index}>{message}</span>)}
          </button>)}
        </div>)}</div>
      </li>)}</ol>
    </> : !loading && !error ? <p>No recorded attempts before this practice position.</p> : null}
    {history.next_start != null ? <button disabled={loading} onClick={() => load(history.next_start)}>Load more history</button> : null}
  </details>
}
