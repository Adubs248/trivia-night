import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import QuestionView from '../components/player/QuestionView';
import ScoreHeader from '../components/player/ScoreHeader';
import { AchievementToast } from '../components/player/ResultBanner';

export default function GamePage() {
  const { player, game } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!player) navigate('/join');
  }, [player]);

  if (!player) return null;

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      <ScoreHeader />
      <QuestionView />
      <AchievementToast />
    </div>
  );
}
