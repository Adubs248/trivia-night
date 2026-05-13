-- TriviaNight Database Schema
-- PostgreSQL

-- =============================================
-- GAMES
-- =============================================
CREATE TABLE IF NOT EXISTS games (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(6) UNIQUE NOT NULL,       -- e.g. "XYZABC"
  host_id     UUID NOT NULL,
  title       VARCHAR(255) NOT NULL DEFAULT 'Trivia Night',
  status      VARCHAR(20) NOT NULL DEFAULT 'lobby',
  -- status: lobby | active | paused | finished
  settings    JSONB NOT NULL DEFAULT '{}',
  -- {
  --   speedBonus: true,
  --   streakBonus: true,
  --   penaltyForWrong: false,
  --   maxPlayers: 120,
  --   defaultTimerSeconds: 30,
  --   defaultPointsPerQ: 100
  -- }
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HOSTS (authenticated game masters)
-- =============================================
CREATE TABLE IF NOT EXISTS hosts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLAYERS
-- =============================================
CREATE TABLE IF NOT EXISTS players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  team_name     VARCHAR(100),
  avatar_color  VARCHAR(7) DEFAULT '#7c6af5',
  socket_id     VARCHAR(100),               -- current socket connection
  is_active     BOOLEAN DEFAULT TRUE,
  score         INTEGER DEFAULT 0,
  streak        INTEGER DEFAULT 0,          -- consecutive correct answers
  badges        JSONB DEFAULT '[]',
  joined_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROUNDS
-- =============================================
CREATE TABLE IF NOT EXISTS rounds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  round_type    VARCHAR(30) NOT NULL DEFAULT 'standard',
  -- round_type: standard | picture | music | final_jeopardy | poll
  sort_order    INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'pending',
  -- status: pending | active | revealing | finished
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- QUESTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id        UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  question_type   VARCHAR(30) NOT NULL DEFAULT 'multiple_choice',
  -- question_type: multiple_choice | true_false | short_answer
  --                image | audio | video | anagram | poll
  question_text   TEXT NOT NULL,
  media_url       VARCHAR(500),             -- image/audio/video URL
  media_type      VARCHAR(20),             -- image | audio | video
  options         JSONB,
  -- For multiple choice: [{"letter":"A","text":"Jupiter"},{"letter":"B","text":"Saturn"}]
  correct_answer  VARCHAR(500),            -- "B" or "Saturn" for short answer
  points          INTEGER DEFAULT 100,
  timer_seconds   INTEGER DEFAULT 30,
  speed_bonus     BOOLEAN DEFAULT TRUE,    -- faster answers = more points
  explanation     TEXT,                    -- shown after answer reveal
  status          VARCHAR(20) DEFAULT 'pending',
  -- status: pending | active | locked | revealed
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ANSWERS (player responses)
-- =============================================
CREATE TABLE IF NOT EXISTS answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  answer_text     VARCHAR(500),
  is_correct      BOOLEAN,
  points_awarded  INTEGER DEFAULT 0,
  time_taken_ms   INTEGER,                 -- milliseconds to answer
  speed_bonus_pts INTEGER DEFAULT 0,
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id, player_id)          -- one answer per player per question
);

-- =============================================
-- ROUND SCORES (aggregated per round)
-- =============================================
CREATE TABLE IF NOT EXISTS round_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_id    UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score       INTEGER DEFAULT 0,
  rank        INTEGER,
  UNIQUE (round_id, player_id)
);

-- =============================================
-- BONUS POINTS (manually awarded by host)
-- =============================================
CREATE TABLE IF NOT EXISTS bonus_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL,
  reason      VARCHAR(255),
  awarded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACHIEVEMENTS / BADGES
-- =============================================
CREATE TABLE IF NOT EXISTS achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  badge_type  VARCHAR(50) NOT NULL,
  -- badge_type: first_correct | perfect_round | speed_demon | hot_streak
  --             comeback_kid | night_owl | final_boss
  earned_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- POLLS (audience polls, separate from scored Qs)
-- =============================================
CREATE TABLE IF NOT EXISTS polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,             -- ["Option A", "Option B", ...]
  responses   JSONB DEFAULT '{}',         -- {"Option A": 42, "Option B": 31}
  is_active   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES for performance at 120 players
-- =============================================
CREATE INDEX IF NOT EXISTS idx_players_game_id     ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_socket_id   ON players(socket_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_player_id   ON answers(player_id);
CREATE INDEX IF NOT EXISTS idx_questions_round_id  ON questions(round_id);
CREATE INDEX IF NOT EXISTS idx_rounds_game_id      ON rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_games_code          ON games(code);

-- =============================================
-- SAMPLE DATA
-- =============================================
INSERT INTO hosts (email, password_hash, display_name)
VALUES ('host@example.com', '$2b$10$placeholder_hash', 'Demo Host');

-- Sample game (code: DEMO01)
INSERT INTO games (code, host_id, title, settings)
SELECT 'DEMO01', id, 'Friday Night Trivia', '{
  "speedBonus": true,
  "streakBonus": true,
  "penaltyForWrong": false,
  "maxPlayers": 120,
  "defaultTimerSeconds": 30,
  "defaultPointsPerQ": 100
}'::jsonb
FROM hosts WHERE email = 'host@example.com';
