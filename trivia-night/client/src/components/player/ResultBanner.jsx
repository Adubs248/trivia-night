import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

export function ResultBanner({ isCorrect, pointsAwarded, speedBonus }) {
  return (
    <div className={`result-banner ${isCorrect ? 'correct' : 'wrong'}`}>
      <span style={{ fontSize: 22 }}>{isCorrect ? '✓' : '✗'}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {isCorrect ? 'Correct!' : 'Not quite!'}
        </div>
        {isCorrect && speedBonus > 0 && (
          <div style={{ fontSize: 11, color: 'var(--accent3)' }}>Speed bonus: +{speedBonus}</div>
        )}
      </div>
      <div className="result-pts">{isCorrect ? `+${pointsAwarded}` : '+0'}</div>
    </div>
  );
}

export function AchievementToast() {
  const { achievements } = useGameStore();
  const [visible, setVisible] = useState(null);

  useEffect(() => {
    if (achievements.length === 0) return;
    const latest = achievements[achievements.length - 1];
    setVisible(latest);
    const t = setTimeout(() => setVisible(null), 3500);
    return () => clearTimeout(t);
  }, [achievements.length]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--surface)', border: '1px solid var(--accent)',
      borderRadius: 12, padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 10,
      zIndex: 999, whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 24 }}>{visible.icon}</span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
          {visible.label}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{visible.desc}</div>
      </div>
    </div>
  );
}
