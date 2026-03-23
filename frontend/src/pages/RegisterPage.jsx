import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, actionLoading, actionError, clearActionError } = useAuth()
  const [formState, setFormState] = useState({ username: "", email: "", password: "" })

  function onChange(event) {
    clearActionError()
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    await register(formState)
    navigate("/lobby", { replace: true })
  }

  return (
    <main className="page-shell">
      <h1>Register</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        <label htmlFor="username">Username</label>
        <input id="username" name="username" value={formState.username} onChange={onChange} required />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" name="email" value={formState.email} onChange={onChange} required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" name="password" value={formState.password} onChange={onChange} required />

        {actionError ? <p className="auth-error">{actionError}</p> : null}

        <button type="submit" disabled={actionLoading}>
          {actionLoading ? "Registering…" : "Register"}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/auth/login">Login</Link>
      </p>
    </main>
  )
}
