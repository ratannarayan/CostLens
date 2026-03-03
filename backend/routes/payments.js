// ============================================================
// Payments Routes — Razorpay subscription & one-time payments
// ============================================================

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../config/database');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { PLANS } = require('../config/plans');
const { logger } = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ─── CREATE SUBSCRIPTION ORDER ───
router.post('/subscribe', requireAuth, async (req, res) => {
  const { planId, billing = 'monthly' } = req.body;
  const plan = PLANS[planId];
  if (!plan || plan.monthlyPrice === 0) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const amount = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice;

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100,    // Razorpay expects paise
      currency: 'INR',
      receipt: `costlens_${req.user.id}_${planId}_${Date.now()}`,
      notes: {
        userId: req.user.id,
        planId,
        billing
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      plan: plan.name,
      billing
    });
  } catch (err) {
    logger.error('Razorpay order error:', err);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// ─── VERIFY PAYMENT & ACTIVATE PLAN ───
router.post('/verify', requireAuth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billing } = req.body;

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  const plan = PLANS[planId];
  const expiresAt = new Date();
  if (billing === 'annual') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 1);

  // Activate plan
  await db('users').where({ id: req.user.id }).update({
    plan: planId,
    credits: plan.monthlyCredits,
    credits_reset_at: expiresAt,
    plan_expires_at: expiresAt,
    billing_cycle: billing,
    stripe_customer_id: razorpay_payment_id // Reusing field for Razorpay
  });

  // Log credit allocation
  await db('credit_transactions').insert({
    user_id: req.user.id,
    type: 'allocation',
    amount: plan.monthlyCredits,
    balance_after: plan.monthlyCredits,
    description: `${plan.name} plan activated — ${billing}`,
    reference_type: 'subscription'
  });

  logger.info(`Plan activated: user=${req.user.email}, plan=${planId}, billing=${billing}`);

  res.json({
    message: 'Plan activated successfully',
    plan: planId,
    credits: plan.monthlyCredits,
    expiresAt
  });
});

// ─── RAZORPAY WEBHOOK ───
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = JSON.stringify(req.body);
  
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body.event;
  logger.info(`Razorpay webhook: ${event}`);

  // Handle subscription events
  switch (event) {
    case 'payment.captured':
      // Payment successful — already handled in /verify
      break;
    case 'payment.failed':
      // TODO: Notify user, maybe downgrade plan
      break;
    case 'subscription.charged':
      // Monthly renewal — refresh credits
      // TODO: Implement
      break;
    case 'subscription.cancelled':
      // TODO: Downgrade to free plan
      break;
  }

  res.json({ status: 'ok' });
});

// ─── CREATE EXPERT REVIEW PAYMENT ───
router.post('/expert-review', requireAuth, async (req, res) => {
  const { reportId, amount } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `expert_${req.user.id}_${reportId}_${Date.now()}`,
      notes: { userId: req.user.id, reportId, type: 'expert-review' }
    });

    res.json({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

module.exports = router;
