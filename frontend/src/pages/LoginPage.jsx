import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, actionLoading, actionError, clearActionError } = useAuth()
  const [formState, setFormState] = useState({ username: "", password: "" })

  const destination = location.state?.from?.pathname ?? "/lobby"

  function onChange(event) {
    clearActionError()
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    try {
      await login(formState)
      navigate(destination, { replace: true })
    } catch {
      // actionError rendered from context
    }
  }

  return (
    <main className="page-shell">
      <h1>Login</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={formState.username} onChange={onChange} required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formState.password} onChange={onChange} required />

        {actionError ? <p className="auth-error">{actionError}</p> : null}

        <button type="submit" disabled={actionLoading}>
          {actionLoading ? "Logging in…" : "Login"}
        </button>
      </form>
      <p>
        Need an account? <Link to="/auth/register">Register</Link>
      </p>
    </main>
  )
}
