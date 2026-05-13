// client/src/components/shared/Timer.jsx
import { useGameStore } from '../../store/gameStore';

export default function Timer({ seconds, total, locked }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const cls = pct <= 20 ? 'danger' : pct <= 40 ? 'warning' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className={`timer-number ${cls === 'danger' ? 'text-danger' : cls === 'warning' ? 'text-accent' : ''}`}>
        {locked ? '🔒' : seconds}
      </span>
      <div className="timer-bar-container" style={{ flex: 1 }}>
        <div
          className={`timer-bar-fill ${cls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
