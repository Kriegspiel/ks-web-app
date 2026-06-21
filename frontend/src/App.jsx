import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import AppHeader from "./components/AppHeader"
import AppFooter from "./components/AppFooter"
import AttributionCapture from "./components/AttributionCapture"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { useAuth } from "./hooks/useAuth"
import LobbyPage from "./pages/LobbyPage"
import JoinPage from "./pages/JoinPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import GamePage from "./pages/GamePage"
import ReviewPage from "./pages/Review"
import ProfilePage from "./pages/Profile"
import GameHistoryPage from "./pages/GameHistory"
import LeaderboardPage from "./pages/Leaderboard"
import AcquisitionReportPage from "./pages/AcquisitionReport"
import BotsReportPage from "./pages/BotsReport"
import GuestsReportPage from "./pages/GuestsReport"
import TechIndexPage from "./pages/TechIndex"
import UsersReportPage from "./pages/UsersReport"
import SettingsPage from "./pages/Settings"
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
      <AppFooter />
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
    <>
      <AttributionCapture />
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={(
              <RequireAuth>
                <LobbyPage />
              </RequireAuth>
            )}
          />
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
          <Route path="/join/:gameCode" element={<JoinPage />} />
          <Route
            path="/game/:gameCode"
            element={(
              <RequireAuth>
                <GamePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/game/:gameCode/review"
            element={(
              <RequireAuth>
                <ReviewPage />
              </RequireAuth>
            )}
          />
          <Route path="/user/:username" element={<ProfilePage />} />
          <Route path="/user/:username/games" element={<GameHistoryPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/tech" element={<TechIndexPage />} />
          <Route path="/tech/bots-report" element={<BotsReportPage />} />
          <Route path="/tech/guests-report" element={<GuestsReportPage />} />
          <Route path="/tech/users-report" element={<UsersReportPage />} />
          <Route path="/tech/acquisition-report" element={<AcquisitionReportPage />} />
          <Route
            path="/settings"
            element={(
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            )}
          />
        </Route>
      </Routes>
    </>
  )
}

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  )
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
