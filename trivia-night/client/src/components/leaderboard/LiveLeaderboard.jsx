/**
 * client/src/components/leaderboard/LiveLeaderboard.jsx
 * Large-screen animated leaderboard for projectors/TVs
 *
 * Features:
 * - Animated rank changes (smooth position transitions)
 * - Podium for top 3
 * - Streak indicators
 * - Team/solo view toggle
 * - Tie detection
 */

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useSocket } from '../../hooks/useSocket';

// Colors per rank position
const RANK_COLORS = ['#f0c040', '#c0c0c0', '#cd7f32'];

export default function LiveLeaderboard({ gameCode }) {
  const { leaderboard, game } = useGameStore();
  const { requestLeaderboard } = useSocket();
  const [prevRanks, setPrevRanks] = useState({});
  const [animating, setAnimating] = useState(false);
  const [viewMode, setViewMode] = useState('players'); // players | teams
  const prevLeaderboardRef = useRef([]);

  // Fetch leaderboard on mount
  useEffect(() => {
    requestLeaderboard();
  }, []);

  // Track rank changes for animations
  useEffect(() => {
    const oldRanks = {};
    prevLeaderboardRef.current.forEach((p, i) => { oldRanks[p.id] = i; });
    setPrevRanks(oldRanks);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 600);
    prevLeaderboardRef.current = leaderboard;
  }, [leaderboard]);

  // Aggregate team scores
  const teamScores = leaderboard.reduce((acc, p) => {
    const team = p.team_name || `${p.name} (solo)`;
    if (!acc[team]) acc[team] = { name: team, score: 0, members: [] };
    acc[team].score += p.score;
    acc[team].members.push(p.name);
    return acc;
  }, {});
  const teamList = Object.values(teamScores).sort((a, b) => b.score - a.score);

  const displayList = viewMode === 'teams' ? teamList : leaderboard;
  const top3 = displayList.slice(0, 3);
  const rest = displayList.slice(3, 20);

  return (
    <div className="leaderboard-screen" aria-label="Live Leaderboard">
      {/* Header */}
      <div className="lb-header">
        <h1 className="lb-title">
          <span className="lb-title-accent">LEADER</span>BOARD
        </h1>
        <div className="lb-meta">
          {game?.title} · {leaderboard.length} players
        </div>
        <div className="lb-toggle">
          <button
            className={`toggle-btn ${viewMode === 'players' ? 'active' : ''}`}
            onClick={() => setViewMode('players')}
          >
            Players
          </button>
          <button
            className={`toggle-btn ${viewMode === 'teams' ? 'active' : ''}`}
            onClick={() => setViewMode('teams')}
          >
            Teams
          </button>
        </div>
      </div>

      {/* Podium — top 3 */}
      {top3.length >= 3 && (
        <div className="podium" role="region" aria-label="Top 3 players">
          {/* 2nd place */}
          <PodiumSlot player={top3[1]} position={2} color={RANK_COLORS[1]} />
          {/* 1st place (center, tallest) */}
          <PodiumSlot player={top3[0]} position={1} color={RANK_COLORS[0]} />
          {/* 3rd place */}
          <PodiumSlot player={top3[2]} position={3} color={RANK_COLORS[2]} />
        </div>
      )}

      {/* Ranked list — 4th and beyond */}
      <div className="lb-list" role="list">
        {rest.map((player, i) => {
          const rank = i + 4;
          const prevRank = prevRanks[player.id];
          const moved = prevRank !== undefined ? prevRank - (rank - 1) : 0;
          const isTied = i > 0 && displayList[i].score === displayList[i - 1].score;

          return (
            <div
              key={player.id || player.name}
              className={`lb-row ${i < 7 ? 'highlight' : ''} ${animating && moved !== 0 ? 'moving' : ''}`}
              role="listitem"
              style={{
                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <span className="lb-rank">
                {isTied && <span className="tie-badge" aria-label="Tied">=</span>}
                #{rank}
              </span>
              <div
                className="lb-avatar"
                style={{ background: player.avatar_color + '22', color: player.avatar_color }}
                aria-hidden="true"
              >
                {getInitials(player.name)}
              </div>
              <div className="lb-player-info">
                <span className="lb-player-name">{player.name}</span>
                {player.team_name && <span className="lb-team">{player.team_name}</span>}
              </div>
              {player.streak >= 3 && (
                <span className="streak-badge" aria-label={`${player.streak} streak`}>
                  🔥 {player.streak}
                </span>
              )}
              <div className="lb-score-col">
                <span className="lb-score">{player.score?.toLocaleString()}</span>
                {moved !== 0 && (
                  <span className={`rank-change ${moved > 0 ? 'up' : 'down'}`} aria-label={moved > 0 ? 'Moved up' : 'Moved down'}>
                    {moved > 0 ? `▲${moved}` : `▼${Math.abs(moved)}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumSlot({ player, position, color }) {
  const heights = { 1: 100, 2: 72, 3: 52 };
  if (!player) return null;
  return (
    <div className="podium-slot">
      <div className="podium-player-name">{player.name}</div>
      {player.team_name && <div className="podium-team">{player.team_name}</div>}
      <div className="podium-score" style={{ color }}>{player.score?.toLocaleString()}</div>
      {player.streak >= 3 && <div className="podium-streak">🔥 {player.streak}</div>}
      <div
        className="podium-block"
        style={{ height: heights[position], background: color, color: position === 1 ? '#0d0d14' : '#0d0d14' }}
        aria-label={`Position ${position}`}
      >
        {position}
      </div>
    </div>
  );
}

function getInitials(name) {
  return name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
