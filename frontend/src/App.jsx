import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import AppHeader from "./components/AppHeader"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./hooks/useAuth"
import HomePage from "./pages/HomePage"
import LobbyPage from "./pages/LobbyPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import GamePage from "./pages/GamePage"
import "./App.css"

function LoadingPage() {
  return (
    <main className="page-shell" aria-live="polite">
      <h1>Loading session…</h1>
      <p>Checking your current login status.</p>
    </main>
  )
}

function AppLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <Outlet />
    </div>
  )
}

function normalizeRedirectTarget(fromState) {
  const path = `${fromState?.pathname ?? ""}${fromState?.search ?? ""}${fromState?.hash ?? ""}`
  if (!path || path.startsWith("/auth/")) {
    return "/lobby"
  }
  return path
}

function RequireAuth({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return <LoadingPage />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    )
  }

  return children
}

function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return <LoadingPage />
  }

  if (isAuthenticated) {
    const destination = normalizeRedirectTarget(location.state?.from)
    return <Navigate to={destination} replace />
  }

  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/auth/login"
          element={(
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          )}
        />
        <Route
          path="/auth/register"
          element={(
            <RedirectIfAuthenticated>
              <RegisterPage />
            </RedirectIfAuthenticated>
          )}
        />
        <Route
          path="/lobby"
          element={(
            <RequireAuth>
              <LobbyPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/game/:gameId"
          element={(
            <RequireAuth>
              <GamePage />
            </RequireAuth>
          )}
        />
      </Route>
    </Routes>
  )
}

export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}
