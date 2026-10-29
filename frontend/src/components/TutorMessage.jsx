import { lazy, memo, Suspense, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"
import ChessBoard from "./ChessBoard"
import { getTutorAttempt } from "../services/api"
import { attemptOverlays } from "./tutorBoard"

const Markdown = lazy(() => import("react-markdown"))

function AttemptBoard({ data }) {
  const event = data.event
  const overlays = attemptOverlays(event)
  const label = event.attempt || (event.question === "ASK_ANY" ? "Any pawn captures?" : "Opponent turn — move coordinates hidden")
  return <>
    <p className="coach-preview-caption"><code>{label}</code><span>{event.answer.announcement.replaceAll("_", " ").toLowerCase()}</span></p>
    <ChessBoard boardFen={event.before_fen} orientation={data.color} disabled
      overlayArrows={overlays.arrows} overlayBadges={overlays.badges} />
    <small>Your view immediately before this attempt. Opponent pieces stay hidden.</small>
  </>
}

export function AttemptReference({ gameCode, attempt, children }) {
  const id = useId()
  const anchor = useRef(null)
  const request = useRef(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 12, left: 12 })
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  function show() {
    const rect = anchor.current.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: Math.max(12, rect.bottom + 8 + 430 <= window.innerHeight ? rect.bottom + 8 : rect.top - 438) })
    setOpen(true)
    if (!request.current) request.current = getTutorAttempt(gameCode, attempt).then(setData).catch(() => setError(true))
  }
  return <>
    <Link ref={anchor} className="coach-attempt-reference" to={`/game/${gameCode}/review`}
      aria-label={`${gameCode} · attempt ${attempt}`} aria-describedby={open ? id : undefined}
      onMouseEnter={show} onFocus={show} onMouseLeave={() => setOpen(false)} onBlur={() => setOpen(false)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false) }}>
      {children}
    </Link>
    {open ? createPortal(<div id={id} className="coach-attempt-preview" role="tooltip" style={position}>
      <strong>{gameCode} · attempt {attempt}</strong>
      {error ? <p>Attempt preview unavailable from your perspective.</p> : data ? <AttemptBoard data={data} /> : <p>Loading your view…</p>}
    </div>, document.body) : null}
  </>
}

// Transform text nodes only: never rewrite existing links, inline code, code blocks or raw HTML.
// The markdown renderer retains its default safe-URL policy and never executes HTML.
const TOKEN = /\b([2-9A-HJ-KM-NP-Z]{6}):(\d{1,5})(?:[–-](\d{1,5}))?|\battempts?\s+(\d{1,5})(?:[–-](\d{1,5}))?|\b(?:[O0]-[O0](?:-[O0])?|[PNBRQ]@[a-h][1-8]|[KQRBN]?[a-h][1-8](?:[-–→x][a-h][1-8]|[a-h][1-8])(?:=?[QRBNqrbn])?|[KQRBN]?(?:[a-h]|[1-8])?x?[a-h][1-8](?:=[QRBN])?)[+#]?(?![A-Za-z0-9_])/g

function tokens(text, gameCode) {
  const result = []
  let end = 0
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > end) result.push({ type: "text", value: text.slice(end, match.index) })
    const code = match[1] || gameCode
    const first = match[2] || match[4]
    const last = match[3] || match[5]
    if (first && code) {
      const reference = (number, label) => ({ type: "link", url: `/game/${code}/review?attempt=${number}`, children: [{ type: "text", value: label }] })
      result.push(reference(first, `${code} · attempt ${first}`))
      if (last) result.push({ type: "text", value: "–" }, reference(last, last))
    } else result.push({ type: first ? "text" : "inlineCode", value: match[0] })
    end = match.index + match[0].length
  }
  if (end < text.length) result.push({ type: "text", value: text.slice(end) })
  return result
}

function remarkTutorTokens({ gameCode }) {
  function walk(node) {
    if (!node.children || ["link", "linkReference"].includes(node.type)) return
    node.children = node.children.flatMap((child) => {
      if (child.type === "text") return tokens(child.value, gameCode)
      walk(child)
      return [child]
    })
  }
  return walk
}

function EvidenceAnchor({ href, children }) {
  const reference = (href || "").match(/^\/game\/([2-9A-HJ-KM-NP-Z]{6})\/review\?attempt=(\d+)$/)
  return reference ? <AttemptReference gameCode={reference[1]} attempt={Number(reference[2])}>{children}</AttemptReference>
    : <a href={href} rel="noreferrer">{children}</a>
}

function TutorMessage({ text, gameCode }) {
  return <div className="coach-markdown"><Suspense fallback={<p>{text}</p>}><Markdown skipHtml disallowedElements={["img"]}
    remarkPlugins={[[remarkTutorTokens, { gameCode }]]}
    components={{ a: EvidenceAnchor, h1: "h3", h2: "h3", h3: "h3" }}>{text}</Markdown></Suspense></div>
}

export default memo(TutorMessage)
