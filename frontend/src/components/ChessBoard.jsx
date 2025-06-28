import React from 'react';
import './ChessBoard.css';

const ChessBoard = ({ onSquareClick, highlightedSquares = [] }) => {
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

  return (
    <div className="chess-board">
      <div className="board-grid">
        {ranks.map(rank => 
          files.map(file => {
            const square = getSquareName(file, rank);
            const isLight = isLightSquare(file, rank);
            const highlighted = isHighlighted(square);
            
            return (
              <div
                key={square}
                className={`square ${isLight ? 'light' : 'dark'} ${highlighted ? 'highlighted' : ''}`}
                onClick={() => onSquareClick && onSquareClick(square)}
                data-square={square}
              >
                <span className="square-label">{square}</span>
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