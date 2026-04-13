import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"

function getValidationError(formState) {
  if (!formState.username.trim()) return "Username is required."
  if (!/^[A-Za-z0-9_]+$/.test(formState.username.trim())) {
    return "Username can contain only letters, digits, and underscores."
  }
  if (formState.username.trim().length > 33) return "Username must be at most 33 characters."
  if (!formState.email.trim()) return "Email is required."
  if (!formState.email.includes("@") || formState.email.startsWith("@") || formState.email.endsWith("@")) {
    return "Invalid email format."
  }
  if (!formState.password) return "Password is required."
  if (formState.password.length > 512) return "Password must be at most 512 characters."
  return ""
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, actionLoading, actionError, clearActionError } = useAuth()
  const [formState, setFormState] = useState({ username: "", email: "", password: "" })
  const [submitted, setSubmitted] = useState(false)
  const [submissionErrors, setSubmissionErrors] = useState({ username: "", email: "", form: "" })

  function onChange(event) {
    clearActionError()
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
    setSubmissionErrors((current) => ({ ...current, [name]: "", form: "" }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setSubmissionErrors({ username: "", email: "", form: "" })

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
    } catch (error) {
      if (error?.status === 409 && error?.code === "USERNAME_TAKEN") {
        setSubmissionErrors({ username: error.message || "Username already exists", email: "", form: "" })
        return
      }
      if (error?.status === 409 && error?.code === "EMAIL_TAKEN") {
        setSubmissionErrors({ username: "", email: error.message || "Email already registered", form: "" })
        return
      }
      setSubmissionErrors({ username: "", email: "", form: error?.message || "" })
    }
  }

  const inlineValidationError = submitted ? getValidationError(formState) : ""
  const visibleActionError = submissionErrors.username || submissionErrors.email || submissionErrors.form ? "" : actionError

  return (
    <main className="page-shell">
      <h1>Register</h1>
      <form className="auth-form" onSubmit={onSubmit} noValidate aria-busy={actionLoading}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={formState.username} onChange={onChange} autoComplete="username" required />
        {submissionErrors.username ? <p className="auth-error" role="alert">{submissionErrors.username}</p> : null}

        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" value={formState.email} onChange={onChange} autoComplete="email" required />
        {submissionErrors.email ? <p className="auth-error" role="alert">{submissionErrors.email}</p> : null}

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formState.password} onChange={onChange} autoComplete="new-password" required />

        {inlineValidationError ? <p className="auth-error" role="alert">{inlineValidationError}</p> : null}
        {submissionErrors.form ? <p className="auth-error" role="alert">{submissionErrors.form}</p> : null}
        {visibleActionError ? <p className="auth-error" role="alert">{visibleActionError}</p> : null}

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
