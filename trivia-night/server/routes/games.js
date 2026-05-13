const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// Generate a random 6-char game code
function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// POST /api/games — create a new game
router.post('/', requireAuth, async (req, res) => {
  const { title, settings } = req.body;
  let code, tries = 0;
  // Ensure unique code
  while (tries < 10) {
    code = makeCode();
    const existing = await db.query('SELECT id FROM games WHERE code = $1', [code]);
    if (!existing.rows.length) break;
    tries++;
  }
  try {
    const result = await db.query(
      `INSERT INTO games (code, host_id, title, settings)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, req.hostId, title || 'Trivia Night', JSON.stringify(settings || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create game.' });
  }
});

// GET /api/games — list host's games
router.get('/', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT * FROM games WHERE host_id = $1 ORDER BY created_at DESC',
    [req.hostId]
  );
  res.json(result.rows);
});

// GET /api/games/:code — get game by code (public, for players)
router.get('/:code', async (req, res) => {
  const result = await db.query(
    'SELECT id, code, title, status FROM games WHERE code = $1',
    [req.params.code.toUpperCase()]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Game not found.' });
  res.json(result.rows[0]);
});

// PATCH /api/games/:id/status — update game status (host only)
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const valid = ['lobby', 'active', 'paused', 'finished'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  await db.query(
    'UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2 AND host_id = $3',
    [status, req.params.id, req.hostId]
  );
  res.json({ success: true });
});

// GET /api/games/:id/rounds — get all rounds for a game
router.get('/:id/rounds', requireAuth, async (req, res) => {
  const rounds = await db.query(
    `SELECT r.*, COUNT(q.id)::int as question_count
     FROM rounds r
     LEFT JOIN questions q ON q.round_id = r.id
     WHERE r.game_id = $1
     GROUP BY r.id
     ORDER BY r.sort_order`,
    [req.params.id]
  );
  res.json(rounds.rows);
});

// POST /api/games/:id/rounds — add a round
router.post('/:id/rounds', requireAuth, async (req, res) => {
  const { title, roundType, sortOrder } = req.body;
  const result = await db.query(
    `INSERT INTO rounds (game_id, title, round_type, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.params.id, title, roundType || 'standard', sortOrder || 0]
  );
  res.json(result.rows[0]);
});

// GET /api/games/:id/players — player list with scores
router.get('/:id/players', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT id, name, team_name, score, streak, avatar_color, is_active,
            RANK() OVER (ORDER BY score DESC) as rank
     FROM players WHERE game_id = $1 ORDER BY score DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

// POST /api/games/:id/export — export scores as JSON (client converts to CSV)
router.get('/:id/export', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT p.name, p.team_name, p.score, p.streak,
            RANK() OVER (ORDER BY p.score DESC) as rank
     FROM players p WHERE p.game_id = $1 ORDER BY p.score DESC`,
    [req.params.id]
  );
  res.json(result.rows);
});

module.exports = router;
