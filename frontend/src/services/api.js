import axios from "axios"

const api = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

function extractMessage(error, fallback) {
  const detail = error?.response?.data?.detail
  const validationMessages = Array.isArray(detail)
    ? detail
      .map((item) => {
        if (!item || typeof item !== "object") return ""
        const rawMessage = typeof item.msg === "string" ? item.msg.replace(/^Value error,\s*/, "") : ""
        const loc = Array.isArray(item.loc) ? item.loc : []
        const field = typeof loc.at(-1) === "string" ? loc.at(-1) : ""
        if (!rawMessage) return ""
        return field ? `${field}: ${rawMessage}` : rawMessage
      })
      .filter(Boolean)
    : []
  if (validationMessages.length > 0) return validationMessages.join(" ")
  const responseMessage = error?.response?.data?.error?.message
    ?? (typeof detail === "string" ? detail : detail?.message)
  if (typeof responseMessage === "string" && responseMessage.trim().length > 0) return responseMessage
  const requestMessage = error?.message
  if (typeof requestMessage === "string" && requestMessage.trim().length > 0) return requestMessage
  return fallback
}

function normalizeError(error, fallback) {
  return {
    status: error?.response?.status,
    code: error?.response?.data?.error?.code ?? error?.response?.data?.detail?.code,
    message: extractMessage(error, fallback),
  }
}

export async function register(payload) {
  try {
    const response = await api.post('/api/auth/register', payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Unable to register right now.')
  }
}
export async function login(payload) {
  try {
    const response = await api.post('/api/auth/login', payload)
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Unable to log in right now.')
  }
}
export async function logout() {
  try {
    await api.post('/api/auth/logout')
  } catch (error) {
    throw normalizeError(error, 'Unable to log out right now.')
  }
}
export async function me() {
  try {
    const response = await api.get('/api/auth/me')
    return response.data
  } catch (error) {
    throw normalizeError(error, 'Unable to load auth state.')
  }
}
export async function getBots() { try { const response = await api.get('/api/bots'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load bots right now.') } }
export async function createGame(payload) { try { const response = await api.post('/api/game/create', payload); return response.data } catch (error) { throw normalizeError(error, 'Unable to create game right now.') } }
export async function joinGame(gameCode) { try { const response = await api.post(`/api/game/join/${encodeURIComponent(gameCode)}`); return response.data } catch (error) { throw normalizeError(error, 'Unable to join that game right now.') } }
export async function getOpenGames() { try { const response = await api.get('/api/game/open'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load open games right now.') } }
export async function getLobbyStats() { try { const response = await api.get('/api/game/stats'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load lobby stats right now.') } }
export async function getMyGames() { try { const response = await api.get('/api/game/mine'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load your games right now.') } }
export async function getGame(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game details right now.') } }
export async function getGameTranscript(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}/moves`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game transcript right now.') } }
export async function getGameState(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}/state`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game state right now.') } }
export async function deleteWaitingGame(gameId) { try { await api.delete(`/api/game/${encodeURIComponent(gameId)}`) } catch (error) { throw normalizeError(error, 'Unable to close this waiting game right now.') } }
export async function submitMove(gameId, uci) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/move`, { uci }); return response.data } catch (error) { throw normalizeError(error, 'Unable to submit move right now.') } }
export async function askAny(gameId) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/ask-any`); return response.data } catch (error) { throw normalizeError(error, 'Unable to ask any-captures right now.') } }
export async function resignGame(gameId) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/resign`); return response.data } catch (error) { throw normalizeError(error, 'Unable to resign this game right now.') } }
export const userApi = {
  async getProfile(username) { const response = await api.get(`/api/user/${encodeURIComponent(username)}`); return response.data },
  async getGameHistory(username, page = 1, perPage = 20) { const response = await api.get(`/api/user/${encodeURIComponent(username)}/games`, { params: { page, per_page: perPage } }); return response.data },
  async getRatingHistory(username, track = "overall", limit = 100) { const response = await api.get(`/api/user/${encodeURIComponent(username)}/rating-history`, { params: { track, limit } }); return response.data },
  async getLeaderboard(page = 1, perPage = 20) { const response = await api.get('/api/leaderboard', { params: { page, per_page: perPage } }); return response.data },
  async updateSettings(payload) { const response = await api.patch('/api/user/settings', payload); return response.data },
}
export const techApi = {
  async getBotsReport(days = 10) { const response = await api.get("/api/tech/bots-report", { params: { days } }); return response.data },
}
export default api
