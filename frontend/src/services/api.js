import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const gameApi = {
  // Create a new game
  createGame: async (anyRule = true) => {
    const response = await api.post('/games', {}, {
      params: { any_rule: anyRule }
    });
    return response.data;
  },

  // Get game state
  getGameState: async (gameId, player) => {
    const response = await api.get(`/games/${gameId}`, {
      params: { player }
    });
    return response.data;
  },

  // Make a move
  makeMove: async (gameId, player, moveUci, questionType = 'COMMON') => {
    const response = await api.post(`/games/${gameId}/move`, {}, {
      params: {
        player,
        move_uci: moveUci,
        question_type: questionType
      }
    });
    return response.data;
  },

  // Delete a game
  deleteGame: async (gameId) => {
    const response = await api.delete(`/games/${gameId}`);
    return response.data;
  },
};

export default api;