// ============================================================
// Credits Middleware — Check & Deduct AI Credits
// ============================================================

const db = require('../config/database');
const { getCreditCost } = require('../config/plans');
const { logger } = require('../utils/logger');

/**
 * Check if user has enough credits for a feature
 * Usage: requireCredits('price-check')
 */
function requireCredits(featureId) {
  return async (req, res, next) => {
    const cost = getCreditCost(featureId);
    if (cost === 0) return next();

    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    // Special case: free price checks for Starter plan
    if (featureId === 'price-check' && user.plan === 'free' && user.freePriceChecks > 0) {
      req.creditSource = 'free-check';
      return next();
    }

    // Check credits
    if (user.credits < cost) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: cost,
        available: user.credits,
        feature: featureId
      });
    }

    req.creditCost = cost;
    req.creditSource = 'credits';
    next();
  };
}

/**
 * Deduct credits after successful operation
 * Call this AFTER the AI operation succeeds
 */
async function deductCredits(userId, featureId, description, referenceId) {
  const cost = getCreditCost(featureId);
  if (cost === 0) return;

  const user = await db('users').where({ id: userId }).first();

  // Free price check path
  if (featureId === 'price-check' && user.plan === 'free' && user.free_price_checks > 0) {
    await db('users')
      .where({ id: userId })
      .decrement('free_price_checks', 1);

    await db('credit_transactions').insert({
      user_id: userId,
      type: 'usage',
      amount: 0,
      balance_after: user.credits,
      description: `Free Price Check — ${description}`,
      reference_type: 'tool',
      reference_id: referenceId
    });

    logger.info(`Free check used: user=${userId}, remaining=${user.free_price_checks - 1}`);
    return;
  }

  // Standard credit deduction
  await db('users')
    .where({ id: userId })
    .decrement('credits', cost);

  await db('credit_transactions').insert({
    user_id: userId,
    type: 'usage',
    amount: -cost,
    balance_after: user.credits - cost,
    description: description,
    reference_type: featureId.includes('-') ? 'tool' : 'report',
    reference_id: referenceId
  });

  logger.info(`Credits deducted: user=${userId}, cost=${cost}, feature=${featureId}, remaining=${user.credits - cost}`);
}

module.exports = { requireCredits, deductCredits };
