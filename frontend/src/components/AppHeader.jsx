import { useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import ThemeToggle from "./ThemeToggle"
import { getMyGames } from "../services/api"

const ACTIVE_STATES = new Set(["active"])
const ACTIVE_GAME_POLL_MS = 15000

function pickActiveGame(games) {
  if (!Array.isArray(games)) {
    return null
  }

  return games.find((game) => ACTIVE_STATES.has(String(game?.state ?? "").toLowerCase())) ?? null
}

function AuthLinks() {
  const { isAuthenticated, user, actionLoading, logout } = useAuth()
  const location = useLocation()

  const [activeGame, setActiveGame] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveGame(null)
      return undefined
    }

    let cancelled = false

    async function refreshActiveGame() {
      try {
        const response = await getMyGames()
        if (cancelled) {
          return
        }

        const nextActive = pickActiveGame(response?.games)
        setActiveGame(nextActive)
      } catch {
        if (!cancelled) {
          setActiveGame(null)
        }
      }
    }

    refreshActiveGame()
    const intervalId = window.setInterval(refreshActiveGame, ACTIVE_GAME_POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isAuthenticated])

  async function onLogout() {
    try {
      await logout()
    } catch {
      // error presented via auth context and page-level containers
    }
  }

  const activeGamePath = useMemo(() => {
    if (!activeGame?.game_id) {
      return null
    }
    return `/game/${activeGame.game_id}`
  }, [activeGame?.game_id])

  if (isAuthenticated) {
    return (
      <>
        <span className="header-user" aria-live="polite">Signed in as {user?.username ?? user?.email ?? "player"}</span>
        <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>Home</Link>
        <Link to="/lobby" aria-current={location.pathname === "/lobby" ? "page" : undefined}>Lobby</Link>
        {activeGamePath ? (
          <Link to={activeGamePath} aria-current={location.pathname === activeGamePath ? "page" : undefined}>
            Active game {activeGame?.game_code ? `(${activeGame.game_code})` : ""}
          </Link>
        ) : null}
        <button type="button" className="header-logout-button" onClick={onLogout} disabled={actionLoading}>
          {actionLoading ? "Logging out…" : "Logout"}
        </button>
      </>
    )
  }

  return (
    <>
      <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>Home</Link>
      <Link to="/auth/login" aria-current={location.pathname === "/auth/login" ? "page" : undefined}>Login</Link>
      <Link to="/auth/register" aria-current={location.pathname === "/auth/register" ? "page" : undefined}>Register</Link>
    </>
  )
}

export default function AppHeader() {
  const location = useLocation()

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__brand-group">
          <Link className="app-header__brand" to="/" aria-current={location.pathname === "/" ? "page" : undefined}>
            Kriegspiel
          </Link>
          <ThemeToggle />
        </div>
        <nav className="app-header__nav" aria-label="Primary navigation">
          <AuthLinks />
        </nav>
      </div>
    </header>
  )
}
