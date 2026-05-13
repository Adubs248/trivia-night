import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import JoinPage from './pages/JoinPage';
import GamePage from './pages/GamePage';
import HostLoginPage from './pages/HostLoginPage';
import HostDashboardPage from './pages/HostDashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/host/login" element={<HostLoginPage />} />
        <Route path="/host/dashboard" element={<HostDashboardPage />} />
        <Route path="/leaderboard/:gameCode" element={<LeaderboardPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
