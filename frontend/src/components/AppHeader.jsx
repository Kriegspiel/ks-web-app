import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import ThemeToggle from "./ThemeToggle"

function AuthLinks() {
  const { isAuthenticated, actionLoading, logout } = useAuth()
  const location = useLocation()

  async function onLogout() {
    try {
      await logout()
    } catch {
      // error presented via auth context and page-level containers
    }
  }

  if (isAuthenticated) {
    return (
      <>
        <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>Home</Link>
        <Link to="/lobby" aria-current={location.pathname === "/lobby" ? "page" : undefined}>Lobby</Link>
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
