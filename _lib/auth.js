const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { unauthorized, forbidden } = require('./response');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

/**
 * Hash a plain password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain password with hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Extract token from request (cookie or Authorization header)
 */
function getTokenFromRequest(req) {
  // Prefer cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  // Fallback to Bearer header
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

/**
 * Auth middleware – attaches req.user
 */
async function authMiddleware(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return unauthorized(res, 'Authentication required');
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return unauthorized(res, 'Invalid or expired token');
  }

  try {
    const User = require('../models/User');
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return unauthorized(res, 'User not found');
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return unauthorized(res, 'Authentication failed');
  }
}

/**
 * Optional auth – attaches req.user if token present, otherwise continues
 */
async function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return next();
  }
  const decoded = verifyToken(token);
  if (decoded && decoded.userId) {
    try {
      const User = require('../models/User');
      const user = await User.findById(decoded.userId).select('-passwordHash');
      if (user) req.user = user;
    } catch {
      // ignore
    }
  }
  next();
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getTokenFromRequest,
  authMiddleware,
  optionalAuth
};
