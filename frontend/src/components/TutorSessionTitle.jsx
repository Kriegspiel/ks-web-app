import { useEffect, useRef, useState } from "react"
import { renameTutorSession } from "../services/api"
import TutorIconButton, { TutorIcon } from "./TutorIconButton"

export default function TutorSessionTitle({ session, onRenamed }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const titleButton = useRef(null)
  const wasEditing = useRef(false)
  useEffect(() => {
    if (editing) wasEditing.current = true
    else if (wasEditing.current) titleButton.current.focus()
  }, [editing])

  async function save(event) {
    event.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      onRenamed(await renameTutorSession(session.session_id, { title: name.trim() }))
      setEditing(false)
    } catch (failure) { setError(failure.message) } finally { setSaving(false) }
  }

  return <section className="coach-current-session" aria-label="Current learning session">
    <p className="coach-eyebrow">Learning session</p>
    {editing ? <form onSubmit={save} onKeyDown={(event) => { if (event.key === "Escape" && !saving) { event.preventDefault(); setEditing(false) } }}>
      <label>Learning session name<input autoFocus value={name} maxLength={120} required disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
      <TutorIconButton icon="save" label={saving ? "Saving session name…" : "Save session name"} type="submit" disabled={saving || !name.trim()} />
      <TutorIconButton icon="cancel" label="Cancel rename" disabled={saving} onClick={() => setEditing(false)} />
      {error ? <p role="alert">{error}</p> : null}
    </form> : <h2 aria-label={session.title}><button ref={titleButton} className="coach-session-title" title="Rename learning session" aria-label={`Rename learning session: ${session.title}`} onClick={() => { setName(session.title); setError(""); setEditing(true) }}>{session.title}<TutorIcon name="rename" /></button></h2>}
  </section>
}
