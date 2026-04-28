import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import ThemeToggle from "./ThemeToggle"

function AuthLinks() {
  const { isAuthenticated, actionLoading, logout, user } = useAuth()
  const location = useLocation()
  const lobbyCurrent = location.pathname === "/" || location.pathname === "/lobby"
  const username = typeof user?.username === "string" ? user.username : ""
  const userProfilePath = username ? `/user/${encodeURIComponent(username)}` : "/settings"
  const userCurrent = username ? location.pathname === userProfilePath : location.pathname === "/settings"

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
        <Link to="/lobby" aria-current={lobbyCurrent ? "page" : undefined}>Lobby</Link>
        <details className="header-profile-menu">
          <summary className="header-profile-menu__trigger">Profile</summary>
          <div className="header-profile-menu__panel">
            <Link
              className="header-profile-menu__item"
              to={userProfilePath}
              aria-current={userCurrent ? "page" : undefined}
            >
              User
            </Link>
            <button
              type="button"
              className="header-profile-menu__item header-profile-menu__item--button"
              onClick={onLogout}
              disabled={actionLoading}
            >
              {actionLoading ? "Logging out…" : "Logout"}
            </button>
          </div>
        </details>
      </>
    )
  }

  return (
    <>
      <Link to="/lobby" aria-current={lobbyCurrent ? "page" : undefined}>Lobby</Link>
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
