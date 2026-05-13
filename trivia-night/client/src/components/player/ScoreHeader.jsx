// client/src/components/player/ScoreHeader.jsx
import { useGameStore } from '../../store/gameStore';

export function ScoreHeader() {
  const { player, game, currentRound } = useGameStore();
  if (!player) return null;
  const initials = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: player.avatarColor || 'var(--accent2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600,
        }}>{initials}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{player.name}</div>
          {player.teamName && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{player.teamName}</div>}
        </div>
      </div>
      <div style={{
        background: 'var(--accent)', color: '#0d0d14',
        borderRadius: 20, padding: '4px 14px',
        fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
      }}>
        {(player.score || 0).toLocaleString()} pts
      </div>
    </div>
  );
}
export default ScoreHeader;
