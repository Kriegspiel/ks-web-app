import React, { useState, useEffect } from 'react';
import ChessBoard from './ChessBoard';
import { gameApi } from '../services/api';
import './KriegspielGame.css';

const KriegspielGame = () => {
  const [gameState, setGameState] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState('white');
  const [moveInput, setMoveInput] = useState('');
  const [questionType, setQuestionType] = useState('COMMON');
  const [gameLog, setGameLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fromSquare, setFromSquare] = useState('');
  const [toSquare, setToSquare] = useState('');

  const createNewGame = async () => {
    try {
      setLoading(true);
      setError(null);
      const game = await gameApi.createGame(true);
      setGameId(game.game_id);
      await loadGameState(game.game_id);
      setGameLog([`New game created: ${game.game_id}`]);
    } catch (err) {
      setError(`Failed to create game: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadGameState = async (id) => {
    if (!id) return;
    try {
      const state = await gameApi.getGameState(id, currentPlayer);
      setGameState(state);
    } catch (err) {
      setError(`Failed to load game state: ${err.message}`);
    }
  };

  const makeMove = async () => {
    if (!gameId || !moveInput) return;

    try {
      setLoading(true);
      setError(null);

      const result = await gameApi.makeMove(gameId, currentPlayer, moveInput, questionType);

      // Add to game log
      let logEntry = `${currentPlayer}: ${moveInput} -> ${result.legal ? 'Legal' : 'Illegal'}`;
      if (result.announcement) {
        logEntry += ` (${result.announcement})`;
      }
      if (result.special_case) {
        logEntry += ` [${result.special_case}]`;
      }

      setGameLog(prev => [...prev, logEntry]);

      // If move was legal and it's the opponent's turn, switch players
      if (result.legal) {
        setCurrentPlayer(prev => prev === 'white' ? 'black' : 'white');
      }

      // Reload game state
      await loadGameState(gameId);

      // Clear move input
      setMoveInput('');
      setFromSquare('');
      setToSquare('');

    } catch (err) {
      setError(`Failed to make move: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSquareClick = (square) => {
    if (!fromSquare) {
      setFromSquare(square);
    } else if (!toSquare) {
      setToSquare(square);
      setMoveInput(`${fromSquare}${square}`);
    } else {
      // Reset if both squares are already selected
      setFromSquare(square);
      setToSquare('');
      setMoveInput('');
    }
  };

  const askAnyCaptures = async () => {
    if (!gameId) return;

    try {
      setLoading(true);
      setError(null);

      // Use a dummy move for ASK_ANY questions
      const result = await gameApi.makeMove(gameId, currentPlayer, 'e2e4', 'ASK_ANY');

      const logEntry = `${currentPlayer}: ASK_ANY -> ${result.announcement || 'No response'}`;
      setGameLog(prev => [...prev, logEntry]);

      await loadGameState(gameId);

    } catch (err) {
      setError(`Failed to ask about captures: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setGameState(null);
    setGameId(null);
    setCurrentPlayer('white');
    setMoveInput('');
    setGameLog([]);
    setError(null);
    setFromSquare('');
    setToSquare('');
  };

  useEffect(() => {
    const loadGameStateWrapper = async (id) => {
      if (!id) return;
      try {
        const state = await gameApi.getGameState(id, currentPlayer);
        setGameState(state);
      } catch (err) {
        setError(`Failed to load game state: ${err.message}`);
      }
    };

    if (gameId) {
      const interval = setInterval(() => {
        loadGameStateWrapper(gameId);
      }, 2000); // Refresh game state every 2 seconds

      return () => clearInterval(interval);
    }
  }, [gameId, currentPlayer]);

  const highlightedSquares = [];
  if (fromSquare) highlightedSquares.push(fromSquare);
  if (toSquare) highlightedSquares.push(toSquare);

  return (
    <div className="kriegspiel-game">
      <h1>Kriegspiel Chess</h1>

      <div className="game-container">
        <div className="game-board">
          <ChessBoard
            onSquareClick={handleSquareClick}
            highlightedSquares={highlightedSquares}
            boardFen={gameState?.board_fen}
          />
        </div>

        <div className="game-controls">
          <div className="game-info">
            {gameState && (
              <>
                <h3>Game Status</h3>
                <p><strong>Game ID:</strong> {gameId}</p>
                <p><strong>Current Turn:</strong> {gameState.turn}</p>
                <p><strong>Your Color:</strong> {currentPlayer}</p>
                <p><strong>Game Over:</strong> {gameState.is_game_over ? 'Yes' : 'No'}</p>
                <p><strong>Board:</strong> {gameState.visible_board}</p>
              </>
            )}
          </div>

          <div className="move-controls">
            <h3>Make a Move</h3>

            <div className="move-input-section">
              <label>
                Move (UCI format):
                <input
                  type="text"
                  value={moveInput}
                  onChange={(e) => setMoveInput(e.target.value)}
                  placeholder="e.g., e2e4"
                  disabled={loading}
                />
              </label>

              <label>
                Question Type:
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  disabled={loading}
                >
                  <option value="COMMON">Common Move</option>
                  <option value="ASK_ANY">Ask Any</option>
                </select>
              </label>
            </div>

            <div className="square-selection">
              <p>Click squares to build move:</p>
              <p>From: <span className="square-display">{fromSquare || 'none'}</span></p>
              <p>To: <span className="square-display">{toSquare || 'none'}</span></p>
            </div>

            <div className="action-buttons">
              <button
                onClick={makeMove}
                disabled={loading || !moveInput || !gameId}
              >
                {loading ? 'Making Move...' : 'Make Move'}
              </button>

              <button
                onClick={askAnyCaptures}
                disabled={loading || !gameId}
              >
                Ask: Any Captures?
              </button>
            </div>
          </div>

          <div className="game-actions">
            <h3>Game Actions</h3>
            <button onClick={createNewGame} disabled={loading}>
              {loading ? 'Creating...' : 'New Game'}
            </button>
            <button onClick={resetGame}>Reset</button>
            <button
              onClick={() => setCurrentPlayer(prev => prev === 'white' ? 'black' : 'white')}
              disabled={!gameId}
            >
              Switch Player View
            </button>
          </div>

          {error && (
            <div className="error-message">
              <h4>Error:</h4>
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      <div className="game-log">
        <h3>Game Log</h3>
        <div className="log-content">
          {gameLog.map((entry, index) => (
            <div key={index} className="log-entry">
              {entry}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KriegspielGame;