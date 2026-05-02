import { Link } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"

const TECH_LINKS = [
  {
    href: "/tech/bots-report",
    title: "Bots report",
    description: "Daily bot game counts and win-rate splits for recent completed games.",
  },
  {
    href: "/tech/guests-report",
    title: "Guests report",
    description: "Guest accounts, first-seen days, latest games, and remaining guest-name capacity.",
  },
  {
    href: "/tech/users-report",
    title: "Users report",
    description: "DAU, WAU, MAU, trend charts, and the latest user games.",
  },
]

export default function TechIndexPage() {
  return (
    <main className="page-shell leaderboard-page">
      <h1>Tech</h1>
      <p className="page-meta-stamp">Operational reports and diagnostics for Kriegspiel.</p>
      <section className="tech-index-grid" aria-label="Tech pages">
        {TECH_LINKS.map((item) => (
          <Link key={item.href} to={item.href} className="tech-index-card">
            <span>{item.title}</span>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
      <VersionStamp />
    </main>
  )
}
