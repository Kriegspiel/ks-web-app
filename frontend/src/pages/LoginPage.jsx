import { useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"

function normalizeDestination(fromState) {
  const path = `${fromState?.pathname ?? ""}${fromState?.search ?? ""}${fromState?.hash ?? ""}`
  if (!path || path.startsWith("/auth/")) {
    return "/lobby"
  }
  return path
}

function getValidationError(formState) {
  if (!formState.username.trim()) return "Username is required."
  if (!formState.password) return "Password is required."
  return ""
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, actionLoading, actionError, clearActionError } = useAuth()
  const [formState, setFormState] = useState({ username: "", password: "" })
  const [submitted, setSubmitted] = useState(false)

  const destination = useMemo(() => normalizeDestination(location.state?.from), [location.state])

  function onChange(event) {
    clearActionError()
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitted(true)

    const error = getValidationError(formState)
    if (error) {
      return
    }

    try {
      await login({ username: formState.username.trim(), password: formState.password })
      navigate(destination, { replace: true })
    } catch {
      // actionError rendered from context
    }
  }

  const inlineValidationError = submitted ? getValidationError(formState) : ""

  return (
    <main className="page-shell">
      <h1>Login</h1>
      <form className="auth-form" onSubmit={onSubmit} noValidate aria-busy={actionLoading}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={formState.username} onChange={onChange} autoComplete="username" required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formState.password} onChange={onChange} autoComplete="current-password" required />

        {inlineValidationError ? <p className="auth-error" role="alert">{inlineValidationError}</p> : null}
        {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

        <button type="submit" disabled={actionLoading}>
          {actionLoading ? "Logging in…" : "Login"}
        </button>
      </form>
      <p>
        Need an account? <Link to="/auth/register">Register</Link>
      </p>
      <VersionStamp />
    </main>
  )
}
