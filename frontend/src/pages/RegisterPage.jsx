import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"

function getValidationError(formState) {
  if (!formState.username.trim()) return "Username is required."
  if (!formState.email.trim()) return "Email is required."
  if (!formState.email.includes("@") || formState.email.startsWith("@") || formState.email.endsWith("@")) {
    return "Invalid email format."
  }
  if (!formState.password) return "Password is required."
  if (formState.password.length < 8) return "Password must be at least 8 characters."
  if (!/[A-Za-z]/.test(formState.password) || !/\d/.test(formState.password)) {
    return "Password must include at least one letter and one digit."
  }
  return ""
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, actionLoading, actionError, clearActionError } = useAuth()
  const [formState, setFormState] = useState({ username: "", email: "", password: "" })
  const [submitted, setSubmitted] = useState(false)

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
      await register({
        username: formState.username.trim(),
        email: formState.email.trim(),
        password: formState.password,
      })
      navigate("/lobby", { replace: true })
    } catch {
      // actionError rendered from context
    }
  }

  const inlineValidationError = submitted ? getValidationError(formState) : ""

  return (
    <main className="page-shell">
      <h1>Register</h1>
      <form className="auth-form" onSubmit={onSubmit} noValidate aria-busy={actionLoading}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={formState.username} onChange={onChange} autoComplete="username" required />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" value={formState.email} onChange={onChange} autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formState.password} onChange={onChange} autoComplete="new-password" required />

        {inlineValidationError ? <p className="auth-error" role="alert">{inlineValidationError}</p> : null}
        {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

        <button type="submit" disabled={actionLoading}>
          {actionLoading ? "Registering…" : "Register"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/auth/login">Login</Link>
      </p>
      <VersionStamp />
    </main>
  )
}
