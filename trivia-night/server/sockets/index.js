/**
 * server/sockets/index.js
 * All Socket.IO real-time event logic
 *
 * Event flow:
 *   Player:  join_game → submit_answer → request_leaderboard
 *   Host:    host_join → start_question → lock_answers →
 *            reveal_answers → award_bonus → end_round →
 *            start_tiebreaker
 *   System:  disconnect → reconnect
 */

const db = require('../db');
const { calculateScore } = require('../utils/scoring');
const { checkAchievements } = require('../utils/achievements');

// In-memory game state for speed (persisted to DB async)
// Structure: { [gameCode]: { players: {}, currentQuestion: {}, timer: null } }
const gameState = {};

function registerSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ==========================================
    // PLAYER: Join a game room
    // ==========================================
    socket.on('join_game', async ({ gameCode, playerName, teamName }, callback) => {
      try {
        // Look up game
        const game = await db.query(
          'SELECT * FROM games WHERE code = $1 AND status != $2',
          [gameCode.toUpperCase(), 'finished']
        );
        if (!game.rows.length) {
          return callback({ error: 'Game not found or already finished.' });
        }
        const gameRow = game.rows[0];

        // Check player count
        const countRes = await db.query(
          'SELECT COUNT(*) FROM players WHERE game_id = $1 AND is_active = true',
          [gameRow.id]
        );
        const count = parseInt(countRes.rows[0].count);
        const maxPlayers = gameRow.settings?.maxPlayers || 120;
        if (count >= maxPlayers) {
          return callback({ error: `Game is full (${maxPlayers} players max).` });
        }

        // Check for duplicate name (anti-cheat: one session per name)
        const existing = await db.query(
          'SELECT * FROM players WHERE game_id = $1 AND LOWER(name) = LOWER($2)',
          [gameRow.id, playerName]
        );

        let player;
        if (existing.rows.length) {
          // Reconnect — update socket_id
          player = existing.rows[0];
          await db.query(
            'UPDATE players SET socket_id = $1, is_active = true WHERE id = $2',
            [socket.id, player.id]
          );

          // Kick old socket if still connected
          const oldSocket = io.sockets.sockets.get(player.socket_id);
          if (oldSocket && oldSocket.id !== socket.id) {
            oldSocket.emit('session_taken', { message: 'Your session was taken over from another device.' });
            oldSocket.disconnect();
          }
        } else {
          // New player
          const colors = ['#7c6af5','#40c4a0','#f0c040','#f05060','#60a4f0','#f070c0'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          const insertRes = await db.query(
            `INSERT INTO players (game_id, name, team_name, avatar_color, socket_id)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [gameRow.id, playerName, teamName || null, color, socket.id]
          );
          player = insertRes.rows[0];
        }

        // Join socket room
        socket.join(gameCode);
        socket.data = { gameCode, playerId: player.id, gameId: gameRow.id };

        // Notify host of new player count
        const newCount = parseInt(countRes.rows[0].count) + (existing.rows.length ? 0 : 1);
        io.to(`host:${gameCode}`).emit('player_count_update', { count: newCount });

        // If question is currently active, send it to reconnecting player
        const state = gameState[gameCode];
        if (state?.currentQuestion) {
          socket.emit('question_start', {
            question: sanitizeQuestion(state.currentQuestion),
            timeRemaining: state.timeRemaining,
          });
        }

        callback({
          success: true,
          player: {
            id: player.id,
            name: player.name,
            teamName: player.team_name,
            score: player.score,
            avatarColor: player.avatar_color,
          },
          game: { title: gameRow.title, code: gameRow.code },
        });

      } catch (err) {
        console.error('join_game error:', err);
        callback({ error: 'Failed to join game.' });
      }
    });

    // ==========================================
    // HOST: Join host room for a game
    // ==========================================
    socket.on('host_join', async ({ gameCode, token }, callback) => {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const game = await db.query(
          'SELECT * FROM games WHERE code = $1 AND host_id = $2',
          [gameCode, decoded.hostId]
        );
        if (!game.rows.length) return callback({ error: 'Unauthorized.' });

        socket.join(`host:${gameCode}`);
        socket.data = { gameCode, isHost: true, gameId: game.rows[0].id };

        callback({ success: true, game: game.rows[0] });
      } catch (err) {
        callback({ error: 'Auth failed.' });
      }
    });

    // ==========================================
    // HOST: Start a question
    // ==========================================
    socket.on('start_question', async ({ questionId, gameCode }, callback) => {
      try {
        if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });

        const qRes = await db.query('SELECT * FROM questions WHERE id = $1', [questionId]);
        if (!qRes.rows.length) return callback({ error: 'Question not found.' });

        const question = qRes.rows[0];
        const timerSeconds = question.timer_seconds || 30;

        // Update question status
        await db.query('UPDATE questions SET status = $1 WHERE id = $2', ['active', questionId]);

        // Store in memory for reconnects
        if (!gameState[gameCode]) gameState[gameCode] = {};
        gameState[gameCode].currentQuestion = question;
        gameState[gameCode].timeRemaining = timerSeconds;
        gameState[gameCode].questionStartedAt = Date.now();
        gameState[gameCode].answers = {};

        // Broadcast to all players (without revealing correct answer)
        io.to(gameCode).emit('question_start', {
          question: sanitizeQuestion(question),
          timeRemaining: timerSeconds,
        });

        // Start server-side countdown (for auto-lock)
        clearTimeout(gameState[gameCode].timer);
        gameState[gameCode].timer = setTimeout(async () => {
          await lockQuestionAnswers(io, gameCode, questionId);
        }, timerSeconds * 1000);

        // Tick timer to host every second
        let remaining = timerSeconds;
        gameState[gameCode].timerTick = setInterval(() => {
          remaining--;
          gameState[gameCode].timeRemaining = remaining;
          io.to(gameCode).emit('timer_tick', { remaining });
          io.to(`host:${gameCode}`).emit('timer_tick', { remaining });
          if (remaining <= 0) clearInterval(gameState[gameCode].timerTick);
        }, 1000);

        callback({ success: true });
      } catch (err) {
        console.error('start_question error:', err);
        callback({ error: 'Failed to start question.' });
      }
    });

    // ==========================================
    // PLAYER: Submit answer
    // ==========================================
    socket.on('submit_answer', async ({ questionId, answerText }, callback) => {
      try {
        const { playerId, gameId, gameCode } = socket.data || {};
        if (!playerId) return callback({ error: 'Not in a game.' });

        const state = gameState[gameCode];
        if (!state?.currentQuestion || state.currentQuestion.id !== questionId) {
          return callback({ error: 'No active question.' });
        }

        // Check not already answered
        const existing = await db.query(
          'SELECT id FROM answers WHERE question_id = $1 AND player_id = $2',
          [questionId, playerId]
        );
        if (existing.rows.length) {
          return callback({ error: 'Already answered.' });
        }

        // Check question still active
        const qRes = await db.query('SELECT status, correct_answer, points, timer_seconds FROM questions WHERE id = $1', [questionId]);
        const question = qRes.rows[0];
        if (question.status === 'locked' || question.status === 'revealed') {
          return callback({ error: 'Time is up!' });
        }

        // Calculate score
        const timeTakenMs = Date.now() - state.questionStartedAt;
        const { isCorrect, pointsAwarded, speedBonus } = calculateScore({
          answerText,
          correctAnswer: question.correct_answer,
          questionType: state.currentQuestion.question_type,
          basePoints: question.points,
          timerSeconds: question.timer_seconds,
          timeTakenMs,
          speedBonusEnabled: state.currentQuestion.speed_bonus,
        });

        // Save answer
        await db.query(
          `INSERT INTO answers (game_id, question_id, player_id, answer_text, is_correct, points_awarded, time_taken_ms, speed_bonus_pts)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [gameId, questionId, playerId, answerText, isCorrect, pointsAwarded, timeTakenMs, speedBonus]
        );

        // Update player score and streak
        if (isCorrect) {
          await db.query(
            'UPDATE players SET score = score + $1, streak = streak + 1 WHERE id = $2',
            [pointsAwarded, playerId]
          );
        } else {
          await db.query('UPDATE players SET streak = 0 WHERE id = $1', [playerId]);
        }

        // Track in memory for host live view
        if (!state.answers) state.answers = {};
        const playerRes = await db.query('SELECT name FROM players WHERE id = $1', [playerId]);
        state.answers[playerId] = {
          name: playerRes.rows[0]?.name,
          answer: answerText,
          isCorrect,
          pointsAwarded,
        };

        // Notify host of new answer (live feed)
        io.to(`host:${gameCode}`).emit('player_answered', {
          playerId,
          playerName: playerRes.rows[0]?.name,
          answerText,
          isCorrect,
          pointsAwarded,
          totalAnswered: Object.keys(state.answers).length,
        });

        // Check achievements
        const playerFull = await db.query('SELECT * FROM players WHERE id = $1', [playerId]);
        const newBadges = await checkAchievements(playerFull.rows[0], { isCorrect, timeTakenMs });
        if (newBadges.length) {
          socket.emit('achievement_unlocked', { badges: newBadges });
        }

        callback({ success: true, isCorrect, pointsAwarded });

      } catch (err) {
        console.error('submit_answer error:', err);
        callback({ error: 'Failed to submit answer.' });
      }
    });

    // ==========================================
    // HOST: Lock answers (early or manual)
    // ==========================================
    socket.on('lock_answers', async ({ questionId, gameCode }, callback) => {
      if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });
      await lockQuestionAnswers(io, gameCode, questionId);
      callback({ success: true });
    });

    // ==========================================
    // HOST: Reveal answers
    // ==========================================
    socket.on('reveal_answers', async ({ questionId, gameCode }, callback) => {
      try {
        if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });

        const qRes = await db.query('SELECT * FROM questions WHERE id = $1', [questionId]);
        const question = qRes.rows[0];

        await db.query('UPDATE questions SET status = $1 WHERE id = $2', ['revealed', questionId]);

        // Broadcast full question with correct answer to players
        io.to(gameCode).emit('answer_revealed', {
          questionId,
          correctAnswer: question.correct_answer,
          explanation: question.explanation,
        });

        // Update leaderboard after every reveal
        const lb = await getLeaderboard(socket.data.gameId);
        io.to(gameCode).emit('leaderboard_update', { leaderboard: lb });
        io.to(`host:${gameCode}`).emit('leaderboard_update', { leaderboard: lb });

        callback({ success: true });
      } catch (err) {
        callback({ error: 'Failed to reveal answers.' });
      }
    });

    // ==========================================
    // HOST: Award bonus points manually
    // ==========================================
    socket.on('award_bonus', async ({ gameCode, playerId, points, reason }, callback) => {
      try {
        if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });

        const gameRes = await db.query('SELECT id FROM games WHERE code = $1', [gameCode]);
        const gameId = gameRes.rows[0].id;

        await db.query(
          'INSERT INTO bonus_points (game_id, player_id, points, reason) VALUES ($1, $2, $3, $4)',
          [gameId, playerId, points, reason]
        );
        await db.query('UPDATE players SET score = score + $1 WHERE id = $2', [points, playerId]);

        // Notify player
        io.to(gameCode).emit('bonus_awarded', { playerId, points, reason });
        callback({ success: true });
      } catch (err) {
        callback({ error: 'Failed to award bonus.' });
      }
    });

    // ==========================================
    // HOST: End round + push updated leaderboard
    // ==========================================
    socket.on('end_round', async ({ roundId, gameCode }, callback) => {
      try {
        if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });

        await db.query('UPDATE rounds SET status = $1 WHERE id = $2', ['finished', roundId]);

        // Build and broadcast leaderboard
        const lb = await getLeaderboard(socket.data.gameId);
        io.to(gameCode).emit('leaderboard_update', { leaderboard: lb, roundId });
        io.to(`host:${gameCode}`).emit('leaderboard_update', { leaderboard: lb, roundId });

        callback({ success: true, leaderboard: lb });
      } catch (err) {
        callback({ error: 'Failed to end round.' });
      }
    });

    // ==========================================
    // PLAYER: Request current leaderboard
    // ==========================================
    socket.on('request_leaderboard', async (_, callback) => {
      try {
        const lb = await getLeaderboard(socket.data?.gameId);
        callback({ success: true, leaderboard: lb });
      } catch (err) {
        callback({ error: 'Failed to fetch leaderboard.' });
      }
    });

    // ==========================================
    // HOST: Broadcast audience poll
    // ==========================================
    socket.on('start_poll', async ({ pollId, gameCode }, callback) => {
      if (!socket.data?.isHost) return callback({ error: 'Not authorized.' });
      const pollRes = await db.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (!pollRes.rows.length) return callback({ error: 'Poll not found.' });

      await db.query('UPDATE polls SET is_active = true WHERE id = $1', [pollId]);
      io.to(gameCode).emit('poll_started', { poll: pollRes.rows[0] });
      callback({ success: true });
    });

    // ==========================================
    // PLAYER: Submit poll vote
    // ==========================================
    socket.on('submit_poll_vote', async ({ pollId, option }) => {
      await db.query(
        `UPDATE polls SET responses = jsonb_set(
          responses,
          ARRAY[$1],
          (COALESCE(responses->$1, '0')::int + 1)::text::jsonb
        ) WHERE id = $2`,
        [option, pollId]
      );
      const pollRes = await db.query('SELECT responses FROM polls WHERE id = $1', [pollId]);
      const gameCode = socket.data?.gameCode;
      if (gameCode) io.to(`host:${gameCode}`).emit('poll_update', { pollId, responses: pollRes.rows[0].responses });
    });

    // ==========================================
    // DISCONNECT: Mark player inactive
    // ==========================================
    socket.on('disconnect', async () => {
      const { playerId, gameCode } = socket.data || {};
      if (playerId) {
        await db.query('UPDATE players SET is_active = false WHERE id = $1', [playerId]);
        // Give a 30s grace period before fully marking disconnected
        setTimeout(async () => {
          const check = await db.query('SELECT socket_id FROM players WHERE id = $1', [playerId]);
          if (check.rows[0]?.socket_id === socket.id) {
            // Still disconnected
            const countRes = await db.query(
              'SELECT COUNT(*) FROM players WHERE game_id = (SELECT game_id FROM players WHERE id = $1) AND is_active = true',
              [playerId]
            );
            io.to(`host:${gameCode}`).emit('player_disconnected', {
              playerId,
              activeCount: parseInt(countRes.rows[0].count),
            });
          }
        }, 30000);
      }
    });

  }); // end io.on('connection')

} // end registerSocketHandlers


// ==========================================
// HELPERS
// ==========================================

// Strip correct_answer before sending to players
function sanitizeQuestion(q) {
  const { correct_answer, ...safe } = q;
  // Randomize multiple choice option order
  if (safe.options && Array.isArray(safe.options)) {
    safe.options = safe.options.sort(() => Math.random() - 0.5);
  }
  return safe;
}

async function lockQuestionAnswers(io, gameCode, questionId) {
  await db.query('UPDATE questions SET status = $1 WHERE id = $2', ['locked', questionId]);
  clearInterval(gameState[gameCode]?.timerTick);
  clearTimeout(gameState[gameCode]?.timer);
  io.to(gameCode).emit('question_locked', { questionId });
  io.to(`host:${gameCode}`).emit('question_locked', { questionId });
}

async function getLeaderboard(gameId, limit = 20) {
  if (!gameId) return [];
  const res = await db.query(
    `SELECT p.id, p.name, p.team_name, p.score, p.streak, p.avatar_color,
            RANK() OVER (ORDER BY p.score DESC) AS rank
     FROM players p
     WHERE p.game_id = $1
     ORDER BY p.score DESC
     LIMIT $2`,
    [gameId, limit]
  );
  return res.rows;
}


module.exports = registerSocketHandlers;
