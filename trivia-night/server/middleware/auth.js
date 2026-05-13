const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided.' });
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.hostId = decoded.hostId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = requireAuth;
