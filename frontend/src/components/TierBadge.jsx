import "./TierBadge.css"

function tierClassName(code) {
  const normalized = String(code || "").trim().toLowerCase()
  return /^t[0-6]$/.test(normalized) || normalized === "td" ? `tier-badge--${normalized}` : ""
}

export default function TierBadge({ code, className = "", ...props }) {
  const classes = ["tier-badge", tierClassName(code), className].filter(Boolean).join(" ")
  return (
    <span className={classes} {...props}>
      {code}
    </span>
  )
}
