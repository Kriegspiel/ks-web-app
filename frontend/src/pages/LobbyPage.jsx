import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, logout, actionLoading, actionError } = useAuth()

  async function onLogout() {
    await logout()
    navigate("/auth/login", { replace: true })
  }

  return (
    <main className="page-shell">
      <h1>Lobby</h1>
      <p>Signed in as {user?.username ?? user?.email ?? "player"}.</p>
      {actionError ? <p className="auth-error">{actionError}</p> : null}
      <button type="button" disabled={actionLoading} onClick={onLogout}>
        {actionLoading ? "Logging out…" : "Logout"}
      </button>
    </main>
  )
}
