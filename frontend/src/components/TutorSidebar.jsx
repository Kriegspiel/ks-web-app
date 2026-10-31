import { useEffect, useId, useRef, useState } from "react"
import { Link } from "react-router"
import { formatRuleVariant } from "../utils/rules"
import TutorIconButton, { TutorIcon } from "./TutorIconButton"

const breakpoint = "(min-width: 1280px)"

function gameOutcome(game) {
  const winner = game.result?.winner
  if (!["white", "black", null].includes(winner)) return "Result unavailable"
  if (winner === null) return "Draw"
  return winner === game.color ? "Win" : "Loss"
}

export default function TutorSidebar({ sessions, sessionId, gameCode, history, historyLoading, onLoadMore, onSession, onNew, title, children }) {
  const [wide, setWide] = useState(() => window.matchMedia(breakpoint).matches)
  const [open, setOpen] = useState(wide)
  const dialog = useRef(null)
  const trigger = useRef(null)
  const id = useId()
  useEffect(() => {
    const media = window.matchMedia(breakpoint)
    const change = (event) => { setWide(event.matches); setOpen(event.matches) }
    media.addEventListener("change", change)
    return () => media.removeEventListener("change", change)
  }, [])
  useEffect(() => {
    if (wide || !open) return undefined
    const element = dialog.current
    const button = trigger.current.querySelector("button")
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = "hidden"
    return () => { element.close(); document.body.style.overflow = overflow; button.focus() }
  }, [wide, open])

  function navigate(action) {
    action()
    if (!wide) setOpen(false)
  }
  const navigation = <>
    <header className="coach-sidebar-heading"><strong>Learning</strong><TutorIconButton icon="sidebar" label="Hide menu" aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); trigger.current.querySelector("button").focus() }} /></header>
    <button className="coach-new-session" onClick={() => navigate(onNew)}><TutorIcon name="new" />New session</button>
    <section className="coach-learning">
      <h2>Continue learning</h2>
      <div className="coach-sessions">
        {sessions.length ? sessions.map((item) => <button key={item.session_id} className={item.session_id === sessionId ? "coach-session is-selected" : "coach-session"} aria-current={item.session_id === sessionId ? "true" : undefined} onClick={() => navigate(() => onSession(item.session_id))}><span>{item.title}</span><small>{item.status}</small></button>) : <p>Your conversations will be saved here.</p>}
      </div>
    </section>
    <section className="coach-history" aria-labelledby={`${id}-games`}>
      <h2 id={`${id}-games`}>Your games <small>{history.total}</small></h2>
      <div className="coach-games" role="region" aria-label="Completed game list" tabIndex={0}>
        {history.games.map((game) => <Link className="coach-game" key={game.game_code} to={`/game/${game.game_code}/review/tutor`} onClick={() => { if (!wide) setOpen(false) }} aria-current={game.game_code === gameCode ? "page" : undefined}>
          <span className="coach-game-top"><strong>vs. {game.opponent || "Unknown opponent"}</strong><span className="coach-game-outcome">{gameOutcome(game)}</span></span>
          <small>{formatRuleVariant(game.variant)} · {game.completed_moves} moves as {game.color}</small>
          <span className="coach-game-code">{game.game_code}</span>
        </Link>)}
        {history.next_offset != null ? <button disabled={historyLoading} onClick={onLoadMore}>{historyLoading ? "Loading games…" : "Load more games"}</button> : null}
      </div>
    </section>
  </>
  return <div className={`coach-workspace${wide && open ? " has-sidebar" : ""}`}>
    {wide ? open ? <aside id={id} className="coach-sidebar" aria-label="Learning navigation">{navigation}</aside> : null :
      <dialog id={id} ref={dialog} className="coach-sidebar-dialog" aria-label="Learning navigation" onCancel={(event) => { event.preventDefault(); setOpen(false) }} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
        {open ? <div className="coach-sidebar">{navigation}</div> : null}
      </dialog>}
    <div className="coach-workspace-bar"><span ref={trigger} tabIndex={-1}><TutorIconButton icon="sidebar" label={open ? "Hide menu" : "Show menu"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} /></span>{title}</div>
    <div className="coach-workspace-main">{children}</div>
  </div>
}
