// server/routes/players.js
const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/players/:gameId/leaderboard — public leaderboard endpoint
router.get('/:gameId/leaderboard', async (req, res) => {
  const result = await db.query(
    `SELECT id, name, team_name, score, streak, avatar_color,
            RANK() OVER (ORDER BY score DESC) as rank
     FROM players WHERE game_id = $1
     ORDER BY score DESC LIMIT 50`,
    [req.params.gameId]
  );
  res.json(result.rows);
});

// POST /api/players/:id/bonus — manually award bonus (host)
router.post('/:id/bonus', requireAuth, async (req, res) => {
  const { points, reason, gameId } = req.body;
  await db.query('UPDATE players SET score = score + $1 WHERE id = $2', [points, req.params.id]);
  await db.query(
    'INSERT INTO bonus_points (game_id, player_id, points, reason) VALUES ($1, $2, $3, $4)',
    [gameId, req.params.id, points, reason || 'Host bonus']
  );
  res.json({ success: true });
});

module.exports = router;
