# TriviaNight — Live Event App for 120+ Players

A full-stack, real-time trivia night platform built for in-person events.
Supports 120+ concurrent players, host dashboard, live leaderboard, and multiple question types.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Real-time | Socket.IO |
| Database | PostgreSQL (or Firebase) |
| Auth | JWT (host) |
| Deployment | Docker / Railway / Render |

---

## Quick Start (Local)

```bash
# 1. Clone and install
git clone https://github.com/yourname/trivia-night
cd trivia-night

# Install backend deps
cd server && npm install

# Install frontend deps
cd ../client && npm install

# 2. Set up PostgreSQL
# Create a database called trivia_night
createdb trivia_night
cd ../server
psql trivia_night < schema.sql

# 3. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your DB credentials and JWT secret

# 4. Run everything
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev

# App runs at:
#   Frontend: http://localhost:5173
#   Backend:  http://localhost:3001
```

---

## Folder Structure

```
trivia-night/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── player/        # Player join, question, results screens
│   │   │   ├── host/          # Host dashboard, question editor, controls
│   │   │   ├── leaderboard/   # Large-screen leaderboard
│   │   │   └── shared/        # Timer, score display, common UI
│   │   ├── hooks/             # useSocket, useGame, useTimer
│   │   ├── pages/             # Route-level components
│   │   ├── store/             # Zustand state management
│   │   └── utils/             # QR code, CSV export, helpers
│   └── package.json
│
├── server/                    # Node.js backend
│   ├── routes/                # REST API routes
│   ├── sockets/               # Socket.IO event handlers
│   ├── models/                # DB models
│   ├── middleware/            # Auth, rate limiting
│   ├── schema.sql             # PostgreSQL schema
│   └── package.json
│
├── docker-compose.yml         # Full local stack
└── README.md
```

---

## Deployment

### Option A — Local Wi-Fi (School / Community Center)
```bash
# Find your machine's local IP
ipconfig getifaddr en0   # macOS
hostname -I              # Linux

# Set in server/.env:
CLIENT_URL=http://192.168.1.X:5173

# Players join via: http://192.168.1.X:5173
# Or generate a QR code pointing to that URL
```

### Option B — Cloud (Railway / Render)
```bash
# Push to GitHub, connect to Railway or Render
# Set environment variables in their dashboard
# Railway auto-detects Node.js and deploys from package.json
```

### Option C — Docker
```bash
docker-compose up --build
# Runs frontend, backend, and postgres in containers
```

---

## Environment Variables

```env
# server/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/trivia_night
JWT_SECRET=your_super_secret_key_here
PORT=3001
CLIENT_URL=http://localhost:5173
MAX_PLAYERS=120
```

---

## Features Checklist

- [x] Player join with game code + name + optional team
- [x] QR code join system
- [x] Multiple choice, true/false, short answer, image, audio, anagram
- [x] Countdown timer with speed-based bonus scoring
- [x] Answer lock on submit or timer expiry
- [x] One active session per player (anti-cheat)
- [x] Randomized answer order
- [x] Host dashboard with live response feed
- [x] Host controls: start/end round, reveal answers, manual bonus points
- [x] Media upload: images, audio, video
- [x] Music round + picture round + Final Jeopardy wager
- [x] Animated leaderboard with rank change indicators
- [x] Streak bonus system
- [x] Live audience polls
- [x] Random team generator
- [x] CSV score export
- [x] Automatic tiebreaker questions
- [x] Achievement badges
- [x] Dark mode
- [x] Mobile responsive
- [x] Graceful reconnect handling
