import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import LiveLeaderboard from '../components/leaderboard/LiveLeaderboard';

export default function LeaderboardPage() {
  const { gameCode } = useParams();
  const { requestLeaderboard } = useSocket();

  // Auto-refresh leaderboard every 30s for the display screen
  useEffect(() => {
    requestLeaderboard();
    const interval = setInterval(requestLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <LiveLeaderboard gameCode={gameCode} />
    </div>
  );
}
