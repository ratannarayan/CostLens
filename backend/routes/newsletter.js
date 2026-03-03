const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

// POST /api/newsletter/subscribe
router.post('/subscribe', optionalAuth, async (req, res) => {
  try {
    const { email, source } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await db('newsletter_subscribers')
      .where({ email: normalizedEmail })
      .first();

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Re-subscribe
        await db('newsletter_subscribers')
          .where({ email: normalizedEmail })
          .update({
            status: 'active',
            resubscribed_at: db.fn.now(),
            source: source || existing.source
          });
        return res.json({ message: 'Welcome back! You have been re-subscribed.', resubscribed: true });
      }
      return res.json({ message: 'You are already subscribed!', already_subscribed: true });
    }

    // New subscriber
    await db('newsletter_subscribers').insert({
      email: normalizedEmail,
      user_id: req.user?.id || null,
      source: source || 'website',
      status: 'active',
      subscribed_at: db.fn.now()
    });

    // If user is logged in, link subscriber to user
    if (req.user) {
      await db('users')
        .where({ id: req.user.id })
        .update({ newsletter_subscribed: true });
    }

    res.status(201).json({ message: 'Successfully subscribed to The Procurement Edge!', subscribed: true });

  } catch (error) {
    console.error('Newsletter subscribe error:', error);
    res.status(500).json({ error: 'Subscription failed. Please try again.' });
  }
});

// POST /api/newsletter/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const updated = await db('newsletter_subscribers')
      .where({ email: email.toLowerCase().trim() })
      .update({
        status: 'unsubscribed',
        unsubscribed_at: db.fn.now()
      });

    if (!updated) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ message: 'You have been unsubscribed. We are sorry to see you go!' });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/newsletter/stats (admin only — for your dashboard)
router.get('/stats', async (req, res) => {
  try {
    const total = await db('newsletter_subscribers').where({ status: 'active' }).count('* as count').first();
    const thisMonth = await db('newsletter_subscribers')
      .where({ status: 'active' })
      .where('subscribed_at', '>=', db.raw("date_trunc('month', now())"))
      .count('* as count').first();
    const sources = await db('newsletter_subscribers')
      .where({ status: 'active' })
      .groupBy('source')
      .select('source')
      .count('* as count');

    res.json({
      total_subscribers: parseInt(total.count),
      new_this_month: parseInt(thisMonth.count),
      by_source: sources
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
