import React from 'react';
import './ChessBoard.css';

const ChessBoard = ({ onSquareClick, highlightedSquares = [], boardFen = null }) => {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  const isLightSquare = (file, rank) => {
    return (files.indexOf(file) + rank) % 2 === 0;
  };

  const getSquareName = (file, rank) => {
    return `${file}${rank}`;
  };

  const isHighlighted = (square) => {
    return highlightedSquares.includes(square);
  };

  // Parse FEN to create a full 8x8 board array first
  const parseFenToBoard = (fen) => {
    if (!fen) return null;

    const position = fen.split(' ')[0];
    const ranks_fen = position.split('/');
    const board = [];

    // Process each rank (row)
    for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
      const rankStr = ranks_fen[rankIndex] || '8';
      const row = [];

      for (let i = 0; i < rankStr.length; i++) {
        const char = rankStr[i];

        if (char >= '1' && char <= '8') {
          // Empty squares
          const emptyCount = parseInt(char);
          for (let j = 0; j < emptyCount; j++) {
            row.push(null);
          }
        } else {
          // Piece
          row.push(char);
        }
      }

      // Ensure row has exactly 8 squares
      while (row.length < 8) {
        row.push(null);
      }

      board.push(row);
    }

    return board;
  };

  // Get piece at specific file and rank
  const getPieceAt = (file, rank) => {
    const board = parseFenToBoard(boardFen);
    if (!board) return null;

    const fileIndex = files.indexOf(file);
    const rankIndex = ranks.indexOf(rank);

    if (fileIndex === -1 || rankIndex === -1) return null;
    if (rankIndex >= board.length || fileIndex >= board[rankIndex].length) return null;

    return board[rankIndex][fileIndex];
  };

  // Convert piece letter to Unicode symbol
  const getPieceSymbol = (piece) => {
    const symbols = {
      'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };
    return symbols[piece] || '';
  };

  // Debug: log the board state
  if (boardFen) {
    console.log('Board FEN:', boardFen);
    const parsedBoard = parseFenToBoard(boardFen);
    console.log('Parsed board:', parsedBoard);

    // Test a specific square
    const testPiece = getPieceAt('a', 1);
    console.log('Piece at a1:', testPiece);
    const testSymbol = getPieceSymbol(testPiece);
    console.log('Symbol for a1:', testSymbol);
  }

  return (
    <div className="chess-board">
      <div className="board-grid">
        {ranks.map(rank =>
          files.map(file => {
            const square = getSquareName(file, rank);
            const isLight = isLightSquare(file, rank);
            const highlighted = isHighlighted(square);
            const piece = getPieceAt(file, rank);
            const pieceSymbol = getPieceSymbol(piece);

            return (
              <div
                key={square}
                className={`square ${isLight ? 'light' : 'dark'} ${highlighted ? 'highlighted' : ''}`}
                onClick={() => onSquareClick && onSquareClick(square)}
                data-square={square}
              >
                <span className="square-label">{square}</span>
                {pieceSymbol && (
                  <span className={`piece ${piece && piece === piece.toUpperCase() ? 'white' : 'black'}`}>
                    {pieceSymbol}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* File labels (a-h) */}
      <div className="file-labels">
        {files.map(file => (
          <div key={file} className="file-label">{file}</div>
        ))}
      </div>

      {/* Rank labels (1-8) */}
      <div className="rank-labels">
        {ranks.map(rank => (
          <div key={rank} className="rank-label">{rank}</div>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;