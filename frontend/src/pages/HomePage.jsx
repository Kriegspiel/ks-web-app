import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function HomePage() {
  const { isAuthenticated, user } = useAuth()

  return (
    <main className="page-shell">
      <h1>Home</h1>
      {isAuthenticated ? (
        <>
          <p>Welcome back, {user?.username ?? "player"}.</p>
          <nav className="inline-links">
            <Link to="/lobby">Go to lobby</Link>
          </nav>
        </>
      ) : (
        <>
          <p>Please login or create an account.</p>
          <nav className="inline-links">
            <Link to="/auth/login">Login</Link>
            <Link to="/auth/register">Register</Link>
          </nav>
        </>
      )}
    </main>
  )
}
