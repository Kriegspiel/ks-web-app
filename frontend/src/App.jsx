import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import KriegspielGame from './components/KriegspielGame';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<KriegspielGame />} />
          <Route path="/game/:gameId" element={<KriegspielGame />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
