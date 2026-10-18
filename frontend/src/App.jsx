import { lazy, Suspense } from "react"
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router"
import AppHeader from "./components/AppHeader"
import AppFooter from "./components/AppFooter"
import AttributionCapture from "./components/AttributionCapture"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { useAuth } from "./hooks/useAuth"
import JoinPage from "./pages/JoinPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import "./App.css"

const LobbyPage = lazy(() => import("./pages/LobbyPage"))
const GamePage = lazy(() => import("./pages/GamePage"))
const ReviewPage = lazy(() => import("./pages/Review"))
const TutorReviewPage = lazy(() => import("./pages/TutorReview"))
const ProfilePage = lazy(() => import("./pages/Profile"))
const GameHistoryPage = lazy(() => import("./pages/GameHistory"))
const LeaderboardPage = lazy(() => import("./pages/Leaderboard"))
const AcquisitionReportPage = lazy(() => import("./pages/AcquisitionReport"))
const BotMatrixReportPage = lazy(() => import("./pages/BotMatrixReport"))
const BotsReportPage = lazy(() => import("./pages/BotsReport"))
const GuestsReportPage = lazy(() => import("./pages/GuestsReport"))
const TechIndexPage = lazy(() => import("./pages/TechIndex"))
const UsersReportPage = lazy(() => import("./pages/UsersReport"))
const SettingsPage = lazy(() => import("./pages/Settings"))
const SubscriptionPage = lazy(() => import("./pages/Subscription"))

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
      <Suspense fallback={(
        <main className="page-shell" role="status" aria-live="polite">
          <h1>Loading page…</h1>
        </main>
      )}>
        <Outlet />
      </Suspense>
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

function TechAccessDeniedPage() {
  return (
    <main className="page-shell leaderboard-page">
      <h1>Tech</h1>
      <p className="page-meta-stamp">Tech reports are private.</p>
    </main>
  )
}

function RequireTechAccess({ children }) {
  const { isAuthenticated, bootstrapping, user } = useAuth()
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

  if (user?.can_view_tech_reports !== true) {
    return <TechAccessDeniedPage />
  }

  return children
}

function TutorNotFoundPage() {
  return (
    <main className="page-shell tutor-not-found-page">
      <h1>Page not found</h1>
      <p>This private page is not available for your account.</p>
      <Link className="button-link button-link--primary" to="/lobby">Return to lobby</Link>
    </main>
  )
}

function RequireTutorAccess({ children }) {
  const { isAuthenticated, bootstrapping, user } = useAuth()
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

  if (user?.can_use_tutor !== true) {
    return <TutorNotFoundPage />
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
          <Route
            path="/game/:gameCode/review/tutor"
            element={(
              <RequireTutorAccess>
                <TutorReviewPage />
              </RequireTutorAccess>
            )}
          />
          <Route path="/user/:username" element={<ProfilePage />} />
          <Route path="/user/:username/games" element={<GameHistoryPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route
            path="/tech"
            element={(
              <RequireTechAccess>
                <TechIndexPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/tech/bots-report"
            element={(
              <RequireTechAccess>
                <BotsReportPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/tech/bot-matrix"
            element={(
              <RequireTechAccess>
                <BotMatrixReportPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/tech/guests-report"
            element={(
              <RequireTechAccess>
                <GuestsReportPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/tech/users-report"
            element={(
              <RequireTechAccess>
                <UsersReportPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/tech/acquisition-report"
            element={(
              <RequireTechAccess>
                <AcquisitionReportPage />
              </RequireTechAccess>
            )}
          />
          <Route
            path="/settings"
            element={(
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/subscription"
            element={<SubscriptionPage />}
          />
          <Route
            path="/subcription"
            element={<SubscriptionPage />}
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
