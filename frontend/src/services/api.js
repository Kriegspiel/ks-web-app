import axios from "axios"

const api = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

function extractMessage(error, fallback) {
  const responseMessage = error?.response?.data?.error?.message ?? error?.response?.data?.detail
  if (typeof responseMessage === "string" && responseMessage.trim().length > 0) return responseMessage
  const requestMessage = error?.message
  if (typeof requestMessage === "string" && requestMessage.trim().length > 0) return requestMessage
  return fallback
}

function normalizeError(error, fallback) {
  return { status: error?.response?.status, code: error?.response?.data?.error?.code, message: extractMessage(error, fallback) }
}

export async function register(payload) { const response = await api.post('/api/auth/register', payload); return response.data }
export async function login(payload) { const response = await api.post('/api/auth/login', payload); return response.data }
export async function logout() { await api.post('/api/auth/logout') }
export async function me() { const response = await api.get('/api/auth/me'); return response.data }
export async function getBots() { try { const response = await api.get('/api/bots'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load bots right now.') } }
export async function createGame(payload) { try { const response = await api.post('/api/game/create', payload); return response.data } catch (error) { throw normalizeError(error, 'Unable to create game right now.') } }
export async function joinGame(gameCode) { try { const response = await api.post(`/api/game/join/${encodeURIComponent(gameCode)}`); return response.data } catch (error) { throw normalizeError(error, 'Unable to join that game right now.') } }
export async function getOpenGames() { try { const response = await api.get('/api/game/open'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load open games right now.') } }
export async function getMyGames() { try { const response = await api.get('/api/game/mine'); return response.data } catch (error) { throw normalizeError(error, 'Unable to load your games right now.') } }
export async function getGame(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game details right now.') } }
export async function getGameTranscript(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}/moves`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game transcript right now.') } }
export async function getGameState(gameId) { try { const response = await api.get(`/api/game/${encodeURIComponent(gameId)}/state`); return response.data } catch (error) { throw normalizeError(error, 'Unable to load game state right now.') } }
export async function submitMove(gameId, uci) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/move`, { uci }); return response.data } catch (error) { throw normalizeError(error, 'Unable to submit move right now.') } }
export async function askAny(gameId) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/ask-any`); return response.data } catch (error) { throw normalizeError(error, 'Unable to ask any-captures right now.') } }
export async function resignGame(gameId) { try { const response = await api.post(`/api/game/${encodeURIComponent(gameId)}/resign`); return response.data } catch (error) { throw normalizeError(error, 'Unable to resign this game right now.') } }
export const userApi = {
  async getProfile(username) { const response = await api.get(`/api/user/${encodeURIComponent(username)}`); return response.data },
  async getGameHistory(username, page = 1, perPage = 20) { const response = await api.get(`/api/user/${encodeURIComponent(username)}/games`, { params: { page, per_page: perPage } }); return response.data },
  async getLeaderboard(page = 1, perPage = 20) { const response = await api.get('/api/leaderboard', { params: { page, per_page: perPage } }); return response.data },
  async updateSettings(payload) { const response = await api.patch('/api/user/settings', payload); return response.data },
}
export default api
