// dotenv not needed on Railway — env vars are injected natively
// require('dotenv').config(); // uncomment for local development
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const questionRoutes = require('./routes/questions');
const playerRoutes = require('./routes/players');
const mediaRoutes = require('./routes/media');
const registerSocketHandlers = require('./sockets');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  pingTimeout: 20000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiter);
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/media', mediaRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_req, res) => res.json({ 
  status: 'ok', 
  players: io.engine.clientsCount,
  dbUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.slice(0, 35) + '...' : 'NOT SET',
  nodeEnv: process.env.NODE_ENV || 'not set',
}));

// ---- Serve React build ----
// Check multiple paths since Railway working directory can vary
const possiblePaths = [
  path.join(__dirname, '../client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
];

console.log('cwd:', process.cwd());
console.log('__dirname:', __dirname);
possiblePaths.forEach(p => console.log('Checking:', p, '->', fs.existsSync(p) ? 'EXISTS' : 'missing'));

const clientBuild = possiblePaths.find(p => fs.existsSync(p));

if (clientBuild) {
  console.log('Serving React from:', clientBuild);
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientBuild, 'index.html'));
    }
  });
} else {
  console.warn('WARNING: React build not found. Checked:', possiblePaths);
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.status(404).send('Frontend not built. Check Railway build logs.');
    }
  });
}

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log('TriviaNight running on port', PORT);
});

module.exports = { app, io };
