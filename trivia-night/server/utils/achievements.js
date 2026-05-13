const db = require('../db');

const BADGES = {
  first_correct:  { label: 'First Blood',    icon: '🎯', desc: 'First correct answer' },
  speed_demon:    { label: 'Speed Demon',     icon: '⚡', desc: 'Answered in under 3 seconds' },
  hot_streak:     { label: 'Hot Streak',      icon: '🔥', desc: '5 correct in a row' },
  perfect_round:  { label: 'Perfect Round',   icon: '⭐', desc: 'All correct in a round' },
  comeback_kid:   { label: 'Comeback Kid',    icon: '💪', desc: 'Moved up 5+ positions' },
};

async function checkAchievements(player, { isCorrect, timeTakenMs }) {
  const earned = [];

  if (!isCorrect) return earned;

  // Speed demon — under 3 seconds
  if (timeTakenMs < 3000) {
    const badge = await awardIfNew(player, 'speed_demon');
    if (badge) earned.push(badge);
  }

  // Hot streak — 5 in a row
  if (player.streak >= 5) {
    const badge = await awardIfNew(player, 'hot_streak');
    if (badge) earned.push(badge);
  }

  // First correct (score was 0 before this)
  if (player.score === 0 && isCorrect) {
    const badge = await awardIfNew(player, 'first_correct');
    if (badge) earned.push(badge);
  }

  return earned;
}

async function awardIfNew(player, badgeType) {
  const existing = await db.query(
    'SELECT id FROM achievements WHERE player_id = $1 AND badge_type = $2',
    [player.id, badgeType]
  );
  if (existing.rows.length) return null;
  await db.query(
    'INSERT INTO achievements (game_id, player_id, badge_type) VALUES ($1, $2, $3)',
    [player.game_id, player.id, badgeType]
  );
  return { type: badgeType, ...BADGES[badgeType] };
}

module.exports = { checkAchievements, BADGES };
