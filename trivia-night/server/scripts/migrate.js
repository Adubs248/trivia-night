const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Running migrations...');

  const tables = [
    `CREATE TABLE IF NOT EXISTS hosts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS games (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(6) UNIQUE NOT NULL,
      host_id UUID NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Trivia Night',
      status VARCHAR(20) NOT NULL DEFAULT 'lobby',
      settings JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      team_name VARCHAR(100),
      avatar_color VARCHAR(7) DEFAULT '#7c6af5',
      socket_id VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      score INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      badges JSONB DEFAULT '[]',
      joined_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS rounds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      round_type VARCHAR(30) NOT NULL DEFAULT 'standard',
      sort_order INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      question_type VARCHAR(30) NOT NULL DEFAULT 'multiple_choice',
      question_text TEXT NOT NULL,
      media_url VARCHAR(500),
      media_type VARCHAR(20),
      options JSONB,
      correct_answer VARCHAR(500),
      points INTEGER DEFAULT 100,
      timer_seconds INTEGER DEFAULT 30,
      speed_bonus BOOLEAN DEFAULT TRUE,
      explanation TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS answers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      answer_text VARCHAR(500),
      is_correct BOOLEAN,
      points_awarded INTEGER DEFAULT 0,
      time_taken_ms INTEGER,
      speed_bonus_pts INTEGER DEFAULT 0,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (question_id, player_id)
    )`,
    `CREATE TABLE IF NOT EXISTS bonus_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      reason VARCHAR(255),
      awarded_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS achievements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      badge_type VARCHAR(50) NOT NULL,
      earned_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS polls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      responses JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id)`,
    `CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id)`,
    `CREATE INDEX IF NOT EXISTS idx_questions_round_id ON questions(round_id)`,
    `CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON rounds(game_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_code ON games(code)`,
  ];

  for (const sql of [...tables, ...indexes]) {
    try {
      await pool.query(sql);
      const name = sql.match(/(?:TABLE|INDEX)[^(]+?(\w+)\s*[\(\n]/)?.[1] || '?';
      console.log(`✅ ${name}`);
    } catch (err) {
      console.error(`❌ Failed:`, err.message);
    }
  }

  await pool.end();
  console.log('Migration complete.');
}

migrate();
