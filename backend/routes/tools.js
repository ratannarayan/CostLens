// ============================================================
// AI Commercial Tools Routes
// price-check | contract-analyzer | rfq-comparator | negotiation-brief
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { requireCredits, deductCredits } = require('../middleware/credits');
const { callClaudeJSON, buildMultimodalContent } = require('../utils/ai');
const { logger } = require('../utils/logger');
const db = require('../config/database');

// ─── TOOL PROMPTS (same as frontend, but server-side for security) ───
const TOOL_PROMPTS = {
  'price-check': `You are a senior cost engineer and procurement analyst with 25+ years experience in Indian manufacturing. Analyze the quoted price for this item.
Consider: material cost (weight × market rate for the grade/material), conversion cost (process complexity, cycle time, MHR), overhead (power, factory, quality), logistics, and reasonable margin (8-12% for standard, 15-20% for specialized).
Use India-specific benchmarks: steel ₹55-75/kg, aluminum ₹220-280/kg, CNC MHR ₹800-1500/hr, VMC ₹600-1000/hr.

RESPOND ONLY WITH VALID JSON (no markdown, no explanation):
{
  "verdict": "REASONABLE|HIGH|VERY HIGH|LOW",
  "confidence": "High|Medium|Low",
  "quotedPrice": number,
  "fairPriceRange": {"low": number, "high": number},
  "costBreakdown": [{"component":"Raw Material","estimate":"₹XX","basis":"weight × rate"},{"component":"Conversion","estimate":"₹XX","basis":"process × MHR"},...],
  "keyObservations": ["observation1","observation2"],
  "suggestedActions": ["action1","action2"],
  "negotiationTip": "specific tactical tip"
}`,

  'contract-analyzer': `You are a senior procurement legal advisor reviewing a supplier contract for a manufacturing company. Analyze every clause.

RESPOND ONLY WITH VALID JSON:
{
  "contractSummary": {"parties":"","type":"","tenure":"","value":"","effectiveDate":"","expiryDate":""},
  "overallRisk": "Low|Medium|High|Critical",
  "favorableClauses": [{"clause":"title","detail":"what it says","benefit":"why it's good for buyer"}],
  "riskyAndUnfavorableClauses": [{"clause":"title","detail":"what it says","severity":"High|Medium|Low","risk":"what could go wrong","amendment":"suggested rewording"}],
  "missingCriticalClauses": [{"clause":"title","importance":"Critical|High|Medium","risk":"what happens without it","suggestedText":"recommended clause text"}],
  "topRecommendations": ["rec1","rec2","rec3"]
}`,

  'rfq-comparator': `You are a senior procurement manager evaluating RFQ responses. Normalize all quotations into a comparable format. Evaluate both commercially and technically.

RESPOND ONLY WITH VALID JSON:
{
  "rfqSummary": {"itemDescription":"","totalVendors":0,"evaluationDate":""},
  "priceAnalysis": {"lowestPrice":"","averagePrice":"","priceSpread":"","l1Vendor":""},
  "vendors": [{"name":"","unitPrice":0,"leadTimeDays":0,"paymentTerms":"","warranty":"","deliveryTerms":"","validity":"","keyDeviations":[]}],
  "technoCommercialRanking": [{"rank":1,"vendor":"","score":0,"rationale":""}],
  "recommendation": {"bestValue":"vendor name","rationale":"why"},
  "negotiationStrategy": ["point1","point2"]
}`,

  'negotiation-brief': `You are a McKinsey procurement strategy consultant preparing a negotiation brief. Build a comprehensive, actionable strategy.

RESPOND ONLY WITH VALID JSON:
{
  "briefTitle": "Negotiation Strategy — [Supplier]",
  "supplierAssessment": {"profile":"","dependencyLevel":"High|Medium|Low","alternativesAvailable":"","marketPosition":""},
  "leverageAnalysis": [{"point":"leverage point","strength":"Strong|Medium|Weak","howToUse":"tactical advice"}],
  "strategy": {"approach":"","openingPosition":"","targetPrice":"","walkAway":""},
  "concessionPlan": [{"give":"what to offer","get":"what to demand in return","sequence":"when to play this"}],
  "talkingPoints": [{"point":"","supportingData":"","expectedResponse":"","rebuttal":""}],
  "redLines": ["do not concede X","do not concede Y"],
  "riskMitigation": "Plan B description"
}`
};

// ─── RUN AI TOOL ───
router.post('/run/:toolId', requireAuth, async (req, res) => {
  const { toolId } = req.params;
  const prompt = TOOL_PROMPTS[toolId];
  if (!prompt) return res.status(400).json({ error: 'Unknown tool: ' + toolId });

  try {
    // Check credits (middleware handles free checks)
    const user = await db('users').where({ id: req.user.id }).first();
    const isFreeCheck = toolId === 'price-check' && user.plan === 'free' && user.free_price_checks > 0;
    
    if (!isFreeCheck) {
      const { getCreditCost } = require('../config/plans');
      const cost = getCreditCost(toolId);
      if (user.credits < cost) {
        return res.status(402).json({ error: 'Insufficient credits', required: cost, available: user.credits });
      }
    }

    // Build AI message
    const { fields, files, notes } = req.body;
    let content;
    
    if (files && files.length > 0) {
      content = buildMultimodalContent(
        prompt + '\n\nAdditional context: ' + (notes || 'None'),
        files.map(f => ({ base64: f.base64, mimeType: f.mimeType, name: f.name, textContent: f.textContent }))
      );
    } else {
      content = prompt + '\n\nItem/Context Data:\n' + JSON.stringify(fields, null, 2) +
        (notes ? '\n\nAdditional notes: ' + notes : '');
    }

    // Call AI
    const { result, usage } = await callClaudeJSON(null, [
      { role: 'user', content }
    ]);

    // Save result
    const [analysis] = await db('tool_analyses').insert({
      user_id: req.user.id,
      tool_id: toolId,
      input_data: fields || {},
      notes: notes || null,
      ai_result: result,
      credits_used: isFreeCheck ? 0 : require('../config/plans').getCreditCost(toolId),
      used_free_check: isFreeCheck
    }).returning('id');

    // Deduct credits
    await deductCredits(req.user.id, toolId,
      `${toolId} — ${fields?.itemDesc || fields?.supplierName || 'analysis'}`,
      analysis.id);

    logger.info(`Tool run: ${toolId}, user=${req.user.email}, tokens=${usage?.output_tokens}`);

    res.json({ result, analysisId: analysis.id });
  } catch (err) {
    logger.error(`Tool error (${toolId}):`, err);
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});

// ─── GENERATE SMART ACTION EMAIL ───
router.post('/email/:toolId', requireAuth, async (req, res) => {
  const { toolId } = req.params;
  const { emailType, result, fields } = req.body;
  
  if (!emailType || !result) {
    return res.status(400).json({ error: 'emailType and result are required' });
  }

  try {
    // Check 1 credit for email
    const user = await db('users').where({ id: req.user.id }).first();
    if (user.credits < 1) {
      return res.status(402).json({ error: 'Need 1 credit for email draft' });
    }

    // Build email prompt based on type
    const emailPrompt = buildEmailPrompt(emailType, toolId, result, fields);
    
    const { result: emailResult } = await callClaudeJSON(null, [
      { role: 'user', content: emailPrompt }
    ], { maxTokens: 2000, temperature: 0.3 });

    // Save email
    const [email] = await db('email_drafts').insert({
      user_id: req.user.id,
      source_type: 'tool',
      email_type: emailType,
      subject: emailResult.subject || emailResult.awardEmail?.subject || '',
      body: emailResult.body || JSON.stringify(emailResult),
      credits_used: 1
    }).returning('id');

    // Deduct credit
    await deductCredits(req.user.id, 'smart-email', `Email: ${emailType}`, email.id);

    res.json({ email: emailResult });
  } catch (err) {
    logger.error(`Email draft error:`, err);
    res.status(500).json({ error: 'Email draft failed: ' + err.message });
  }
});

// ─── GET USER'S TOOL HISTORY ───
router.get('/history', requireAuth, async (req, res) => {
  const { toolId, limit = 20, offset = 0 } = req.query;
  
  let query = db('tool_analyses')
    .where({ user_id: req.user.id })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);
  
  if (toolId) query = query.where({ tool_id: toolId });
  
  const analyses = await query;
  res.json(analyses);
});

// ─── GET SINGLE ANALYSIS ───
router.get('/analysis/:id', requireAuth, async (req, res) => {
  const analysis = await db('tool_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .first();
  
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
  res.json(analysis);
});

// ─── EMAIL PROMPT BUILDER ───
// NOTE: Full prompts are in the frontend JSX (see cl-v9.jsx AIToolRunner component)
// This server-side version mirrors those prompts for security
function buildEmailPrompt(emailType, toolId, result, fields) {
  const ctx = JSON.stringify({ result, fields });
  
  const prompts = {
    'price-reduction': `Draft a professional price reduction request email. Analysis shows price is above market. Include fair range, request revised quotation in 5 days. Context: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":"email with \\n"}`,
    'cbs-request': `Draft CBS (cost breakdown sheet) request to supplier. Item analysis: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":"email with \\n"}`,
    'amendment-request': `Draft contract amendment request citing risky/missing clauses. Analysis: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":"email with \\n"}`,
    'award-letter': `Draft award + regret letters. RFQ analysis: ${ctx}\nRESPOND ONLY VALID JSON: {"awardEmail":{"subject":"","body":"","vendor":""},"regretEmail":{"subject":"","body":"","vendors":""}}`,
    'meeting-request': `Draft negotiation meeting request. Brief: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":"email with \\n"}`,
    'escalation': `Draft management update email. Analysis: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":"email with \\n"}`
  };

  return prompts[emailType] || `Draft a professional procurement email. Context: ${ctx}\nRESPOND ONLY VALID JSON: {"subject":"","body":""}`;
}

module.exports = router;
