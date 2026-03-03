// ============================================================
// Report Routes — Upload data, AI analysis, expert review
// 8 reports: spend, price-variance, inventory-health, 
// supplier-scorecard, category-opportunity, cost-reduction-tracker,
// savings-validation, supplier-risk
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { deductCredits } = require('../middleware/credits');
const { callClaudeJSON } = require('../utils/ai');
const { canAccess, getCreditCost } = require('../config/plans');
const db = require('../config/database');
const { logger } = require('../utils/logger');

// ─── REPORT PROMPTS ───
// NOTE: Full prompts with JSON schemas are in the frontend (cl-v9.jsx ReportRunner).
// Server mirrors the same prompts. Keep in sync.
const REPORT_SYSTEM_PROMPT = `You are a senior procurement analytics consultant. Analyze the uploaded ERP/procurement data and produce a comprehensive report.

RESPOND ONLY WITH VALID JSON matching this schema:
{
  "title": "Report Title",
  "executiveSummary": ["finding1", "finding2", "finding3"],
  "keyMetrics": [{"metric":"name","value":"₹X","trend":"up|down|stable"}],
  "findings": [{"rank":1,"finding":"text","impact":"₹X","action":"what to do"}],
  "riskAreas": [{"risk":"text","severity":"High|Medium|Low","recommendation":"text","impact":"₹X"}],
  "recommendations": [{"recommendation":"text","timeline":"Immediate|30 days|90 days","expectedImpact":"₹X","effort":"Low|Medium|High"}],
  "quickWins": [{"action":"text","effort":"Low","impact":"₹X"}],
  "negotiationPoints": ["ammunition point 1","ammunition point 2"]
}`;

// ─── RUN AI REPORT ───
router.post('/run/:reportId', requireAuth, async (req, res) => {
  const { reportId } = req.params;
  
  // Check plan access
  if (!canAccess(req.user.plan, 'reports')) {
    return res.status(403).json({ error: 'Reports require Pro plan', upgrade: true });
  }

  // Check credits
  const cost = getCreditCost(reportId);
  const user = await db('users').where({ id: req.user.id }).first();
  if (user.credits < cost) {
    return res.status(402).json({ error: 'Insufficient credits', required: cost, available: user.credits });
  }

  const { mappedData, dataSummary, notes } = req.body;
  if (!mappedData) {
    return res.status(400).json({ error: 'mappedData (cleaned CSV) is required' });
  }

  try {
    const preview = mappedData.length > 80000 ? mappedData.slice(0, 80000) + '\n...[truncated]' : mappedData;
    
    const { result } = await callClaudeJSON(REPORT_SYSTEM_PROMPT, [{
      role: 'user',
      content: `Report type: ${reportId}\nData summary: ${dataSummary || 'N/A'}\nNotes: ${notes || 'None'}\n\n[STRUCTURED DATA — columns mapped and validated]\n${preview}`
    }]);

    // Save report
    const [report] = await db('report_analyses').insert({
      user_id: req.user.id,
      report_id: reportId,
      mapped_data: mappedData.slice(0, 500000), // Cap storage
      notes,
      ai_result: result,
      ai_credits_used: cost
    }).returning('id');

    // Deduct credits
    await deductCredits(req.user.id, reportId, `Report: ${reportId}`, report.id);

    logger.info(`Report run: ${reportId}, user=${req.user.email}`);
    res.json({ result, reportId: report.id });
  } catch (err) {
    logger.error(`Report error (${reportId}):`, err);
    res.status(500).json({ error: 'Report generation failed: ' + err.message });
  }
});

// ─── GENERATE REPORT SMART ACTION EMAIL ───
router.post('/email/:reportId', requireAuth, async (req, res) => {
  const { reportId } = req.params;
  const { emailType, result } = req.body;

  const user = await db('users').where({ id: req.user.id }).first();
  if (user.credits < 1) {
    return res.status(402).json({ error: 'Need 1 credit for email draft' });
  }

  try {
    const ctx = JSON.stringify({
      report: reportId,
      findings: result.executiveSummary,
      metrics: result.keyMetrics,
      recommendations: result.recommendations,
      quickWins: result.quickWins,
      risks: result.riskAreas
    });

    // Email prompts — same as frontend RPT_ACTIONS in cl-v9.jsx
    const prompt = `You are a senior procurement professional. Draft a professional email.
Type: ${emailType}
Report: ${reportId}
Analysis data: ${ctx}
RESPOND ONLY VALID JSON: {"subject":"email subject","body":"email body with \\n for line breaks"}`;

    const { result: emailResult } = await callClaudeJSON(null, [
      { role: 'user', content: prompt }
    ], { maxTokens: 2000, temperature: 0.3 });

    await deductCredits(req.user.id, 'smart-email', `Report email: ${emailType}`);
    
    res.json({ email: emailResult });
  } catch (err) {
    res.status(500).json({ error: 'Email draft failed: ' + err.message });
  }
});

// ─── REQUEST EXPERT REVIEW ───
router.post('/expert-request/:id', requireAuth, async (req, res) => {
  const report = await db('report_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .first();
  
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.expert_requested) return res.status(400).json({ error: 'Expert review already requested' });

  // TODO: Create Razorpay payment order for expert review
  // Prices: spend=₹15K, scorecard=₹25K, etc.
  
  await db('report_analyses')
    .where({ id: req.params.id })
    .update({
      expert_requested: true,
      expert_status: 'pending',
      expert_requested_at: db.fn.now()
    });

  // TODO: Send notification email to expert team
  
  res.json({ message: 'Expert review requested', status: 'pending' });
});

// ─── LIST USER'S REPORTS ───
router.get('/list', requireAuth, async (req, res) => {
  const reports = await db('report_analyses')
    .where({ user_id: req.user.id })
    .orderBy('created_at', 'desc')
    .select('id', 'report_id', 'ai_credits_used', 'expert_requested', 'expert_status', 'created_at');
  res.json(reports);
});

// ─── GET SINGLE REPORT ───
router.get('/:id', requireAuth, async (req, res) => {
  const report = await db('report_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .first();
  if (!report) return res.status(404).json({ error: 'Not found' });
  res.json(report);
});

module.exports = router;
