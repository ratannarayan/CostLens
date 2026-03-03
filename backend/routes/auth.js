// ============================================================
// Auth Routes — Register, Login, Profile, Password Reset
// ============================================================

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { PLANS } = require('../config/plans');
const { logger } = require('../utils/logger');

// ─── REGISTER ───
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(150).required(),
  company: Joi.string().max(255).allow(''),
  designation: Joi.string().max(150).allow(''),
  industry: Joi.string().max(100).allow('')
});

router.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Check existing
    const existing = await db('users').where({ email: value.email.toLowerCase() }).first();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Hash password
    const passwordHash = await bcrypt.hash(value.password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Create user
    const [user] = await db('users').insert({
      email: value.email.toLowerCase(),
      password_hash: passwordHash,
      name: value.name,
      company: value.company || null,
      designation: value.designation || null,
      industry: value.industry || null,
      plan: 'free',
      credits: 0,
      free_price_checks: 2
    }).returning(['id', 'email', 'name', 'company', 'plan', 'credits', 'free_price_checks']);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log analytics
    await db('analytics_events').insert({
      user_id: user.id,
      event_name: 'user_registered',
      event_data: { source: req.body.source || 'direct' }
    });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan,
        credits: user.credits,
        freePriceChecks: user.free_price_checks
      }
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── LOGIN ───
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

router.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await db('users').where({ email: value.email.toLowerCase() }).first();
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const validPassword = await bcrypt.compare(value.password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    // Update login stats
    await db('users').where({ id: user.id }).update({
      last_login_at: db.fn.now(),
      login_count: (user.login_count || 0) + 1
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info(`User login: ${user.email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        plan: user.plan,
        credits: user.credits,
        freePriceChecks: user.free_price_checks,
        designation: user.designation,
        industry: user.industry
      }
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── GET PROFILE ───
router.get('/me', requireAuth, async (req, res) => {
  const user = await db('users')
    .where({ id: req.user.id })
    .select('id', 'email', 'name', 'company', 'designation', 'industry',
            'plan', 'credits', 'free_price_checks', 'created_at', 'last_login_at')
    .first();

  const planConfig = PLANS[user.plan];

  res.json({
    ...user,
    planDetails: {
      name: planConfig.name,
      monthlyCredits: planConfig.monthlyCredits,
      features: planConfig.features
    }
  });
});

// ─── UPDATE PROFILE ───
router.put('/me', requireAuth, async (req, res) => {
  const updateSchema = Joi.object({
    name: Joi.string().min(2).max(150),
    company: Joi.string().max(255).allow(''),
    designation: Joi.string().max(150).allow(''),
    industry: Joi.string().max(100).allow('')
  });

  const { error, value } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  await db('users').where({ id: req.user.id }).update(value);
  res.json({ message: 'Profile updated' });
});

// ─── CHANGE PASSWORD ───
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = await db('users').where({ id: req.user.id }).first();
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  await db('users').where({ id: req.user.id }).update({ password_hash: hash });
  res.json({ message: 'Password changed successfully' });
});

// ─── FORGOT PASSWORD (sends email with reset link) ───
router.post('/forgot-password', async (req, res) => {
  // TODO: Implement with nodemailer
  // 1. Generate reset token (uuid + expiry)
  // 2. Store in password_resets table
  // 3. Send email with APP_URL/reset-password?token=xxx
  res.json({ message: 'If the email exists, a reset link has been sent.' });
});

// ─── VERIFY EMAIL ───
router.post('/verify-email', async (req, res) => {
  // TODO: Implement email verification flow
  res.json({ message: 'Email verification not yet implemented' });
});

module.exports = router;
