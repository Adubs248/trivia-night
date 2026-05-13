import { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

export default function Timer({ seconds, total, locked }) {
  const { setTimeRemaining } = useGameStore();
  const intervalRef = useRef(null);
  const secondsRef = useRef(seconds);

  // Keep ref in sync
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  // Start a local countdown as fallback in case server ticks are delayed
  useEffect(() => {
    if (locked || seconds <= 0) {
      clearInterval(intervalRef.current);
      return;
    }
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (secondsRef.current > 0) {
        secondsRef.current -= 1;
        setTimeRemaining(secondsRef.current);
      } else {
        clearInterval(intervalRef.current);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [locked]);

  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const cls = pct <= 20 ? 'danger' : pct <= 40 ? 'warning' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className={`timer-number ${cls === 'danger' ? 'text-danger' : cls === 'warning' ? 'text-accent' : ''}`}
        style={{ minWidth: 40 }}>
        {locked ? '🔒' : seconds}
      </span>
      <div className="timer-bar-container" style={{ flex: 1 }}>
        <div className={`timer-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
