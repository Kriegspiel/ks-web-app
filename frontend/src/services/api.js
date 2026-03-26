import axios from "axios"

const api = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
})

function extractMessage(error, fallback) {
  const responseMessage = error?.response?.data?.error?.message ?? error?.response?.data?.detail
  if (typeof responseMessage === "string" && responseMessage.trim().length > 0) {
    return responseMessage
  }

  const requestMessage = error?.message
  if (typeof requestMessage === "string" && requestMessage.trim().length > 0) {
    return requestMessage
  }

  return fallback
}

function normalizeError(error, fallback) {
  return {
    status: error?.response?.status,
    code: error?.response?.data?.error?.code,
    message: extractMessage(error, fallback),
  }
}

export async function register(payload) {
  try {
    const response = await api.post("/api/auth/register", payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to register right now.")
  }
}

export async function login(payload) {
  try {
    const response = await api.post("/api/auth/login", payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to login right now.")
  }
}

export async function logout() {
  try {
    await api.post("/api/auth/logout")
  } catch (error) {
    throw normalizeError(error, "Unable to logout right now.")
  }
}

export async function me() {
  try {
    const response = await api.get("/api/auth/me")
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to fetch your session.")
  }
}

export async function createGame(payload) {
  try {
    const response = await api.post("/api/game/create", payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to create game right now.")
  }
}

export async function joinGame(gameCode) {
  try {
    const response = await api.post(`/api/game/join/${encodeURIComponent(gameCode)}`)
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to join that game right now.")
  }
}

export async function getOpenGames() {
  try {
    const response = await api.get("/api/game/open")
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to load open games right now.")
  }
}

export async function getMyGames() {
  try {
    const response = await api.get("/api/game/mine")
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to load your games right now.")
  }
}

export async function getGame(gameId) {
  try {
    const response = await api.get(`/api/game/${encodeURIComponent(gameId)}`)
    return response.data
  } catch (error) {
    throw normalizeError(error, "Unable to load game details right now.")
  }
}

export default api
