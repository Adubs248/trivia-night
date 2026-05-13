const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// GET /api/questions/round/:roundId — all questions in a round
router.get('/round/:roundId', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT * FROM questions WHERE round_id = $1 ORDER BY sort_order',
    [req.params.roundId]
  );
  res.json(result.rows);
});

// POST /api/questions — create a question
router.post('/', requireAuth, async (req, res) => {
  const { roundId, gameId, questionType, questionText, options, correctAnswer,
          points, timerSeconds, speedBonus, explanation, sortOrder, mediaUrl, mediaType } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO questions
         (round_id, game_id, question_type, question_text, options, correct_answer,
          points, timer_seconds, speed_bonus, explanation, sort_order, media_url, media_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [roundId, gameId, questionType || 'multiple_choice', questionText,
       JSON.stringify(options || []), correctAnswer,
       points || 100, timerSeconds || 30, speedBonus !== false,
       explanation || '', sortOrder || 0, mediaUrl || null, mediaType || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create question.' });
  }
});

// PATCH /api/questions/:id — update a question
router.patch('/:id', requireAuth, async (req, res) => {
  const fields = ['question_text', 'options', 'correct_answer', 'points',
                  'timer_seconds', 'speed_bonus', 'explanation', 'sort_order',
                  'media_url', 'media_type', 'question_type'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const field of fields) {
    const camel = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camel] !== undefined) {
      updates.push(`${field} = $${i++}`);
      values.push(field === 'options' ? JSON.stringify(req.body[camel]) : req.body[camel]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update.' });
  values.push(req.params.id);
  await db.query(`UPDATE questions SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.json({ success: true });
});

// DELETE /api/questions/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// POST /api/questions/bulk — import many questions at once (from JSON)
router.post('/bulk', requireAuth, async (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'questions must be an array.' });
  const inserted = [];
  for (const q of questions) {
    const r = await db.query(
      `INSERT INTO questions
         (round_id, game_id, question_type, question_text, options, correct_answer,
          points, timer_seconds, explanation, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [q.roundId, q.gameId, q.question_type, q.question_text,
       JSON.stringify(q.options || []), q.correct_answer,
       q.points || 100, q.timer_seconds || 30, q.explanation || '', q.sort_order || 0]
    );
    inserted.push(r.rows[0].id);
  }
  res.json({ inserted: inserted.length, ids: inserted });
});

module.exports = router;
