// ============================================================
// Credits Routes — Balance, History, Usage Stats
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');

// ─── GET BALANCE ───
router.get('/balance', requireAuth, async (req, res) => {
  const user = await db('users')
    .where({ id: req.user.id })
    .select('credits', 'free_price_checks', 'plan', 'credits_reset_at')
    .first();
  res.json(user);
});

// ─── GET TRANSACTION HISTORY ───
router.get('/history', requireAuth, async (req, res) => {
  const { limit = 50, offset = 0, type } = req.query;
  
  let query = db('credit_transactions')
    .where({ user_id: req.user.id })
    .orderBy('created_at', 'desc')
    .limit(limit).offset(offset);
  
  if (type) query = query.where({ type });
  
  res.json(await query);
});

// ─── GET USAGE STATS (current month) ───
router.get('/stats', requireAuth, async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const stats = await db('credit_transactions')
    .where({ user_id: req.user.id, type: 'usage' })
    .where('created_at', '>=', startOfMonth.toISOString())
    .select(db.raw(`
      COUNT(*) as total_transactions,
      ABS(SUM(amount)) as total_credits_used,
      COUNT(CASE WHEN reference_type = 'tool' THEN 1 END) as tool_uses,
      COUNT(CASE WHEN reference_type = 'report' THEN 1 END) as report_uses
    `))
    .first();
  
  res.json(stats);
});

module.exports = router;
