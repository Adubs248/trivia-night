const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const requireAuth = require('../middleware/auth');
const router = express.Router();

// Store uploads in /uploads directory
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|mp3|wav|ogg|mp4|webm)$/i;
    cb(null, allowed.test(file.originalname));
  },
});

// POST /api/media/upload
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const mediaType = req.file.mimetype.startsWith('image') ? 'image'
    : req.file.mimetype.startsWith('audio') ? 'audio' : 'video';
  res.json({
    url: `/uploads/${req.file.filename}`,
    mediaType,
    originalName: req.file.originalname,
    size: req.file.size,
  });
});

// Serve uploaded files
router.use('/files', express.static(uploadDir));

module.exports = router;
