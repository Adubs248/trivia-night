/**
 * server/utils/scoring.js
 * Handles all point calculations
 *
 * Speed Bonus:
 *   Full points if answered in first 25% of time
 *   Linearly decreasing down to 50% of points at time expiry
 *
 * Streak Bonus:
 *   3 in a row = +10%, 5 in a row = +20%, 10 in a row = +50%
 */

/**
 * Calculate points awarded for an answer
 * @param {Object} params
 * @param {string} params.answerText - what the player submitted
 * @param {string} params.correctAnswer - the correct answer
 * @param {string} params.questionType - multiple_choice | short_answer | true_false | etc
 * @param {number} params.basePoints - base point value of question
 * @param {number} params.timerSeconds - total time allowed
 * @param {number} params.timeTakenMs - milliseconds player took to answer
 * @param {boolean} params.speedBonusEnabled
 * @param {number} params.currentStreak - player's current correct streak
 * @param {boolean} params.penaltyForWrong
 * @returns {{ isCorrect, pointsAwarded, speedBonus, streakBonus }}
 */
function calculateScore({
  answerText,
  correctAnswer,
  questionType = 'multiple_choice',
  basePoints = 100,
  timerSeconds = 30,
  timeTakenMs = 0,
  speedBonusEnabled = true,
  currentStreak = 0,
  penaltyForWrong = false,
}) {
  const isCorrect = checkAnswer(answerText, correctAnswer, questionType);

  if (!isCorrect) {
    const penalty = penaltyForWrong ? Math.floor(basePoints * 0.25) : 0;
    return { isCorrect: false, pointsAwarded: -penalty, speedBonus: 0, streakBonus: 0 };
  }

  let points = basePoints;
  let speedBonus = 0;
  let streakBonus = 0;

  // Speed bonus: linear scale from 100% (instant) to 50% (at time limit)
  if (speedBonusEnabled) {
    const totalMs = timerSeconds * 1000;
    const ratio = Math.max(0, Math.min(1, 1 - (timeTakenMs / totalMs)));
    // Bonus ranges from 0 (at time limit) to 50% of base (instant)
    speedBonus = Math.floor(basePoints * 0.5 * ratio);
    points += speedBonus;
  }

  // Streak bonus
  if (currentStreak >= 10) streakBonus = Math.floor(points * 0.5);
  else if (currentStreak >= 5) streakBonus = Math.floor(points * 0.2);
  else if (currentStreak >= 3) streakBonus = Math.floor(points * 0.1);
  points += streakBonus;

  return { isCorrect: true, pointsAwarded: points, speedBonus, streakBonus };
}

/**
 * Check if an answer is correct
 * Handles fuzzy matching for short answers
 */
function checkAnswer(submitted, correct, questionType) {
  if (!submitted || !correct) return false;

  const s = submitted.toString().trim().toLowerCase();
  const c = correct.toString().trim().toLowerCase();

  switch (questionType) {
    case 'multiple_choice':
    case 'true_false':
      // Exact match (e.g. "B" or "True")
      return s === c;

    case 'short_answer': {
      // Accept if submitted contains the correct answer or vice versa
      // Also strip punctuation for flexibility
      const normalize = (str) => str.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const sNorm = normalize(s);
      const cNorm = normalize(c);
      if (sNorm === cNorm) return true;
      if (sNorm.includes(cNorm) || cNorm.includes(sNorm)) return true;
      // Levenshtein distance for typo tolerance (within 2 chars for short words)
      if (cNorm.length <= 8) return levenshtein(sNorm, cNorm) <= 1;
      if (cNorm.length <= 15) return levenshtein(sNorm, cNorm) <= 2;
      return false;
    }

    case 'anagram':
      // Sort letters and compare
      return s.replace(/\s/g,'').split('').sort().join('') ===
             c.replace(/\s/g,'').split('').sort().join('');

    default:
      return s === c;
  }
}

/**
 * Levenshtein distance for fuzzy short-answer matching
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

module.exports = { calculateScore, checkAnswer };
