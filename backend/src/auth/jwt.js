/**
 * JWT middleware for protecting routes
 */

const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return process.env.JWT_SECRET;
}

function getTokenFromRequest(req) {
  return req.cookies?.jwt || req.headers.authorization?.replace('Bearer ', '');
}

/**
 * Generate a JWT for a user
 */
function generateToken(user, options = {}) {
  const {
    tokenType = 'web',
    scopes = ['web'],
    sessionId = null,
    expiresIn = process.env.JWT_EXPIRY || '7d',
  } = options;

  return jwt.sign(
    {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      role: user.role,
      token_type: tokenType,
      scopes,
      session_id: sessionId,
    },
    getJwtSecret(),
    { expiresIn }
  );
}

/**
 * Verify and decode a JWT
 */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Express middleware - require valid JWT in cookie or Authorization header
 */
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    req.authToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Express middleware - require specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { generateToken, verifyToken, requireAuth, requireRole, getJwtSecret, getTokenFromRequest };
