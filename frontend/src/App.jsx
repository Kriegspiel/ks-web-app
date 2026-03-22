import { BrowserRouter, Routes, Route, useParams } from "react-router-dom"
import "./App.css"

function Placeholder({ title, children }) {
  return (
    <main className="page-shell">
      <h1>{title}</h1>
      {children}
    </main>
  )
}

function GamePlaceholder() {
  const { gameId } = useParams()

  return (
    <Placeholder title="Game">
      <p>gameId: {gameId}</p>
    </Placeholder>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="Home" />} />
      <Route path="/auth/login" element={<Placeholder title="Login" />} />
      <Route path="/auth/register" element={<Placeholder title="Register" />} />
      <Route path="/lobby" element={<Placeholder title="Lobby" />} />
      <Route path="/game/:gameId" element={<GamePlaceholder />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
