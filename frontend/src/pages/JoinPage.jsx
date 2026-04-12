import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { joinGame } from "../services/api"

function formatJoinError(error) {
  if (error?.status === 404) {
    return "That join code was not found. Double-check the link and try again."
  }

  if (error?.status === 409 || error?.code === "GAME_FULL") {
    return "That game is already full. Start a new game from the lobby."
  }

  return "We could not join that game right now. Please try again from the lobby."
}

export default function JoinPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { gameCode = "" } = useParams()

  const [errorMessage, setErrorMessage] = useState("")
  const [joining, setJoining] = useState(true)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (requestedRef.current) {
      return
    }
    requestedRef.current = true

    const normalizedCode = gameCode.trim().toUpperCase()
    if (!normalizedCode) {
      setJoining(false)
      setErrorMessage("That join code is missing. Please use a valid join link.")
      return
    }

    async function runJoin() {
      try {
        const joined = await joinGame(normalizedCode)
        navigate(`/game/${joined.game_code ?? joined.game_id}`, { replace: true })
      } catch (error) {
        if (error?.status === 401) {
          navigate("/auth/login", {
            replace: true,
            state: {
              from: {
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
              },
            },
          })
          return
        }

        if (error?.status === 409 && error?.code === "CANNOT_JOIN_OWN_GAME") {
          navigate(`/game/${normalizedCode}`, { replace: true })
          return
        }

        setErrorMessage(formatJoinError(error))
        setJoining(false)
      }
    }

    runJoin()
  }, [gameCode, location.hash, location.pathname, location.search, navigate])

  return (
    <main className="page-shell" aria-live="polite">
      <h1>Join game</h1>
      {joining ? (
        <p>Joining game <code>{gameCode.toUpperCase()}</code>…</p>
      ) : (
        <>
          <p className="auth-error" role="alert">{errorMessage}</p>
          <p>
            <Link to="/lobby">Back to lobby</Link>
          </p>
        </>
      )}
    </main>
  )
}
