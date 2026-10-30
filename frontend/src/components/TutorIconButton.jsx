import { useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"

const pictograms = {
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 21v-8h10v8M7 3v5h9" /></>,
  hint: <><path d="M9 18h6M10 21h4M8.5 14.5a6 6 0 1 1 7 0c-1 .8-1.5 1.5-1.5 3.5h-4c0-2-.5-2.7-1.5-3.5Z" /></>,
  reset: <><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" /></>,
  reveal: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  rename: <><path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z" /></>,
  cancel: <path d="m6 6 12 12M6 18 18 6" />,
  first: <path d="M5 5v14M19 5l-9 7 9 7V5Z" />,
  previous: <path d="m15 5-9 7 9 7" />,
  play: <path d="m7 4 14 8-14 8V4Z" />,
  pause: <path d="M8 4v16M16 4v16" />,
  next: <path d="m9 5 9 7-9 7" />,
  last: <path d="M19 5v14M5 5l9 7-9 7V5Z" />,
  return: <path d="M9 4 3 10l6 6M3 10h12a6 6 0 0 1 0 12" />,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  new: <path d="M12 5v14M5 12h14" />,
}

export function TutorIcon({ name }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{pictograms[name]}</svg>
}

export default function TutorIconButton({ icon, label, ...props }) {
  const id = useId()
  const [position, setPosition] = useState(null)
  useEffect(() => {
    if (!position) return undefined
    const dismiss = () => setPosition(null)
    const escape = (event) => { if (event.key === "Escape") dismiss() }
    document.addEventListener("keydown", escape)
    window.addEventListener("scroll", dismiss, true)
    window.addEventListener("resize", dismiss)
    return () => {
      document.removeEventListener("keydown", escape)
      window.removeEventListener("scroll", dismiss, true)
      window.removeEventListener("resize", dismiss)
    }
  }, [position])
  function show(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition({ root: event.currentTarget.closest("dialog") ?? document.body,
      style: { left: Math.max(8, Math.min(rect.left, window.innerWidth - 224)),
        ...(rect.bottom + 48 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) } })
  }
  return <span className="coach-icon-control" onMouseEnter={show} onMouseLeave={() => setPosition(null)} onFocus={show} onBlur={() => setPosition(null)}>
    <button className="coach-icon-button" type="button" aria-label={label} aria-describedby={position ? id : undefined} {...props}><TutorIcon name={icon} /></button>
    {position ? createPortal(<span role="tooltip" id={id} className="coach-icon-tooltip" style={position.style}>{label}</span>, position.root) : null}
  </span>
}
