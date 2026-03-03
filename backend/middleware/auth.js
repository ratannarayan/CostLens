// ============================================================
// Authentication Middleware — JWT verification
// ============================================================

const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Require authentication — rejects if no valid token
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch fresh user data
    const user = await db('users')
      .where({ id: decoded.userId })
      .first();
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      plan: user.plan,
      credits: user.credits,
      freePriceChecks: user.free_price_checks
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Optional authentication — continues even without token
 * Sets req.user if valid token present, null otherwise
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db('users').where({ id: decoded.userId }).first();
      if (user) {
        req.user = {
          id: user.id, email: user.email, name: user.name,
          plan: user.plan, credits: user.credits,
          freePriceChecks: user.free_price_checks
        };
      }
    }
  } catch {
    // Silent fail — continue without auth
  }
  next();
}

/**
 * Require specific plan level
 */
function requirePlan(...allowedPlans) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedPlans.includes(req.user.plan)) {
      return res.status(403).json({
        error: 'Plan upgrade required',
        currentPlan: req.user.plan,
        requiredPlans: allowedPlans
      });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requirePlan };
