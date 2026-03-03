// ============================================================
// Module Routes — Save/Load/List costing module analyses
// 13 modules: should-cost, tool-cost, mhr, landed-cost, tco, 
// make-buy, capex, epc, roi, cbs, vave, commodity-index, volume-discount
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { deductCredits } = require('../middleware/credits');
const { callClaudeJSON, buildMultimodalContent } = require('../utils/ai');
const db = require('../config/database');
const { canAccess, PLANS } = require('../config/plans');

// ─── SAVE ANALYSIS ───
router.post('/save', requireAuth, async (req, res) => {
  const { moduleId, inputName, inputData, resultData, resultValue } = req.body;
  
  if (!moduleId || !inputData) {
    return res.status(400).json({ error: 'moduleId and inputData are required' });
  }

  // Check history limit
  const plan = PLANS[req.user.plan];
  if (plan.features.historyLimit > 0) {
    const count = await db('module_analyses')
      .where({ user_id: req.user.id })
      .count('id as count')
      .first();
    if (count.count >= plan.features.historyLimit) {
      return res.status(403).json({ error: 'History limit reached. Upgrade for unlimited.' });
    }
  }

  const [analysis] = await db('module_analyses').insert({
    user_id: req.user.id,
    module_id: moduleId,
    input_name: inputName || `${moduleId} — ${new Date().toLocaleDateString('en-IN')}`,
    input_data: inputData,
    result_data: resultData || null,
    result_value: resultValue || null
  }).returning('*');

  res.status(201).json(analysis);
});

// ─── AI EXTRACTION (Pro+ only) ───
router.post('/ai-extract', requireAuth, async (req, res) => {
  if (!canAccess(req.user.plan, 'aiExtraction')) {
    return res.status(403).json({ error: 'AI extraction requires Pro plan' });
  }

  const { moduleId, files, prompt } = req.body;
  const creditId = (moduleId === 'should-cost' || moduleId === 'tool-cost') 
    ? `${moduleId}-ai` : 'module-ai-extraction';
  
  const cost = require('../config/plans').getCreditCost(creditId);
  const user = await db('users').where({ id: req.user.id }).first();
  if (user.credits < cost) {
    return res.status(402).json({ error: 'Insufficient credits', required: cost });
  }

  try {
    const content = buildMultimodalContent(
      prompt || `Extract all manufacturing data, BOM, specifications, dimensions, materials, and process requirements from this document. Return structured JSON.`,
      files
    );

    const { result } = await callClaudeJSON(null, [{ role: 'user', content }]);
    
    await deductCredits(req.user.id, creditId, `AI Extract — ${moduleId}`);
    
    res.json({ extracted: result });
  } catch (err) {
    res.status(500).json({ error: 'AI extraction failed: ' + err.message });
  }
});

// ─── LIST USER'S ANALYSES ───
router.get('/list', requireAuth, async (req, res) => {
  const { moduleId, limit = 50, offset = 0 } = req.query;
  
  let query = db('module_analyses')
    .where({ user_id: req.user.id })
    .orderBy('created_at', 'desc')
    .limit(limit).offset(offset)
    .select('id', 'module_id', 'input_name', 'result_value', 'is_starred', 'created_at');
  
  if (moduleId) query = query.where({ module_id: moduleId });
  
  res.json(await query);
});

// ─── GET SINGLE ANALYSIS ───
router.get('/:id', requireAuth, async (req, res) => {
  const analysis = await db('module_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .first();
  if (!analysis) return res.status(404).json({ error: 'Not found' });
  res.json(analysis);
});

// ─── UPDATE (star/rename/notes) ───
router.patch('/:id', requireAuth, async (req, res) => {
  const { inputName, isStarred, notes } = req.body;
  const updates = {};
  if (inputName !== undefined) updates.input_name = inputName;
  if (isStarred !== undefined) updates.is_starred = isStarred;
  if (notes !== undefined) updates.notes = notes;
  
  await db('module_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .update(updates);
  
  res.json({ message: 'Updated' });
});

// ─── DELETE ───
router.delete('/:id', requireAuth, async (req, res) => {
  await db('module_analyses')
    .where({ id: req.params.id, user_id: req.user.id })
    .del();
  res.json({ message: 'Deleted' });
});

module.exports = router;
