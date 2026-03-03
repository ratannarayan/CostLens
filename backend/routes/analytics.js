// ============================================================
// Analytics Routes — Track events, get usage stats
// ============================================================

const router = require('express').Router();
const { requireAuth, optionalAuth } = require('../middleware/auth');
const db = require('../config/database');

// ─── TRACK EVENT ───
router.post('/event', optionalAuth, async (req, res) => {
  const { eventName, eventData } = req.body;
  await db('analytics_events').insert({
    user_id: req.user?.id || null,
    event_name: eventName,
    event_data: eventData || {},
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  });
  res.json({ ok: true });
});

// ─── GET DASHBOARD STATS (for logged-in user) ───
router.get('/dashboard', requireAuth, async (req, res) => {
  const userId = req.user.id;
  
  const [moduleCount, reportCount, toolCount, emailCount] = await Promise.all([
    db('module_analyses').where({ user_id: userId }).count('id as count').first(),
    db('report_analyses').where({ user_id: userId }).count('id as count').first(),
    db('tool_analyses').where({ user_id: userId }).count('id as count').first(),
    db('email_drafts').where({ user_id: userId }).count('id as count').first()
  ]);

  res.json({
    totalAnalyses: parseInt(moduleCount.count),
    totalReports: parseInt(reportCount.count),
    totalToolRuns: parseInt(toolCount.count),
    totalEmails: parseInt(emailCount.count)
  });
});

module.exports = router;
