// ============================================================
// CostLens API Server
// Express + PostgreSQL + JWT Auth + Anthropic AI
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { logger } = require('./utils/logger');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── MIDDLEWARE ───
app.use(helmet());
app.use(compression());
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// AI-specific rate limit (tighter)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_PER_MIN) || 10,
  message: { error: 'AI rate limit reached. Please wait a minute.' }
});
app.use('/api/ai/', aiLimiter);

// ─── ROUTES ───
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/modules',  require('./routes/modules'));
app.use('/api/reports',  require('./routes/reports'));
app.use('/api/tools',    require('./routes/tools'));
app.use('/api/credits',  require('./routes/credits'));
app.use('/api/ebooks',   require('./routes/ebooks'));
app.use('/api/uploads',  require('./routes/uploads'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/teams',    require('./routes/teams'));
app.use('/api/analytics',require('./routes/analytics'));
app.use('/api/newsletter',require('./routes/newsletter'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});

// ─── ERROR HANDLING ───
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.method} ${req.originalUrl}`);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── START ───
app.listen(PORT, () => {
  logger.info(`CostLens API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
