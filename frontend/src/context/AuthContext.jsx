import { useCallback, useEffect, useMemo, useState } from "react"
import { login as loginRequest, logout as logoutRequest, me as meRequest, register as registerRequest } from "../services/api"
import { AuthContext } from "./authContextObject"

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [bootstrapping, setBootstrapping] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState("")

  const refreshSession = useCallback(async () => {
    try {
      const payload = await meRequest()
      setUser(payload)
      return payload
    } catch (error) {
      if (error?.status === 401) {
        setUser(null)
        return null
      }
      throw error
    }
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setBootstrapping(true)
      try {
        const payload = await meRequest()
        if (!active) return
        setUser(payload)
      } catch (error) {
        if (!active) return
        if (error?.status === 401) {
          setUser(null)
        } else {
          setActionError(error?.message ?? "Unable to load auth state.")
          setUser(null)
        }
      } finally {
        if (active) {
          setBootstrapping(false)
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async ({ username, password }) => {
    setActionLoading(true)
    setActionError("")
    try {
      await loginRequest({ username, password })
      const currentUser = await refreshSession()
      return currentUser
    } catch (error) {
      setActionError(error?.message ?? "Login failed.")
      throw error
    } finally {
      setActionLoading(false)
    }
  }, [refreshSession])

  const register = useCallback(async ({ username, email, password }) => {
    setActionLoading(true)
    setActionError("")
    try {
      await registerRequest({ username, email, password })
      const currentUser = await refreshSession()
      return currentUser
    } catch (error) {
      setActionError(error?.message ?? "Registration failed.")
      throw error
    } finally {
      setActionLoading(false)
    }
  }, [refreshSession])

  const logout = useCallback(async () => {
    setActionLoading(true)
    setActionError("")
    try {
      await logoutRequest()
      setUser(null)
    } catch (error) {
      setActionError(error?.message ?? "Logout failed.")
      throw error
    } finally {
      setActionLoading(false)
    }
  }, [])

  const clearActionError = useCallback(() => {
    setActionError("")
  }, [])

  const value = useMemo(() => ({
    user,
    isAuthenticated: user !== null,
    bootstrapping,
    actionLoading,
    actionError,
    login,
    register,
    logout,
    clearActionError,
  }), [user, bootstrapping, actionLoading, actionError, login, register, logout, clearActionError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
