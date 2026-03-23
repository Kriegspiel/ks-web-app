import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { useAuth } from "./hooks/useAuth"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import LobbyPage from "./pages/LobbyPage"
import "./App.css"

function LoadingPage() {
  return (
    <main className="page-shell">
      <h1>Loading session…</h1>
      <p>Checking your current login status.</p>
    </main>
  )
}

function RequireAuth({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()
  const location = useLocation()

  if (bootstrapping) {
    return <LoadingPage />
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />
  }

  return children
}

function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, bootstrapping } = useAuth()

  if (bootstrapping) {
    return <LoadingPage />
  }

  if (isAuthenticated) {
    return <Navigate to="/lobby" replace />
  }

  return children
}

function GamePlaceholder() {
  const { gameId } = useParams()

  return (
    <main className="page-shell">
      <h1>Game</h1>
      <p>gameId: {gameId}</p>
    </main>
  )
}

export function AppRoutes() {
  return (
    <Routes>
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
            <GamePlaceholder />
          </RequireAuth>
        )}
      />
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
