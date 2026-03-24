import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function LobbyPage() {
  const { user, actionError } = useAuth()

  return (
    <main className="page-shell">
      <h1>Lobby</h1>
      <p>Signed in as {user?.username ?? user?.email ?? "player"}.</p>
      {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}
      <p>
        Ready for a match? <Link to="/game/demo">Open game placeholder</Link>
      </p>
    </main>
  )
}
