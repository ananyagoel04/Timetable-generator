require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const ensureIndexes = require('./config/indexes');
const errorHandler = require('./middleware/errorHandler');
const { protect, scopeToSchool, requireSchoolContext } = require('./middleware/auth');
const auditLogger = require('./middleware/auditLogger');
const auditMiddleware = require('./middleware/auditMiddleware');

connectDB().then(async () => {
  // Ensure database indexes after connection is established
  ensureIndexes().catch(err => console.warn('Index creation warning:', err.message));
  // Seed system roles & permissions (idempotent)
  const { seedSystemData } = require('./controllers/roleController');
  seedSystemData().catch(err => console.warn('Role seed warning:', err.message));
});

const app = express();

// ── Security headers ──
app.use(helmet({ contentSecurityPolicy: false }));

// ── Response compression ──
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// ── CORS origin restrictions ──
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else if (process.env.NODE_ENV !== 'production') cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Request ID for tracing ──
const crypto = require('crypto');
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

// ── Rate Limiting (FIXED: separated auth login vs general API) ──
// Strict limiter: ONLY for login / register / forgot-password / reset-password
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API limiter: generous limit for normal authenticated usage
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600,
  message: { success: false, error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ── PUBLIC routes (no auth required) ──
const mongoose = require('mongoose');
app.get('/api/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    success: dbState === 1,
    message: 'TimeCraft Advanced API running',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: dbStatus[dbState] || 'unknown',
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    }
  });
});

// Auth routes — mounted with general apiLimiter; authLimiter applied inside auth.js to login/register only
app.use('/api/auth', apiLimiter, require('./routes/auth')(authLimiter));

// ── Protected API routes: auth + school scope + audit ──
app.use('/api', apiLimiter, protect, scopeToSchool, auditMiddleware, auditLogger);



// Protected data routes
app.use('/api/setup', require('./routes/setup'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/absences', require('./routes/absences'));
app.use('/api/substitutions', require('./routes/substitutions'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/search', require('./routes/search'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
app.use('/api/users', require('./routes/users'));
app.use('/api/requirements', require('./routes/requirements'));
app.use('/api/can-teach', require('./routes/canTeach'));
app.use('/api/export', require('./routes/export'));
app.use('/api/platform', require('./routes/platform'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/generation', require('./routes/generationRoutes'));

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// ── Graceful shutdown ──
const gracefulShutdown = (signal) => {
  console.log(`\n📴 ${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('   HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('   MongoDB connection closed');
    } catch (e) { /* ignore */ }
    try {
      const generationQueue = require('./services/generationQueue');
      await generationQueue.cleanup();
      console.log('   Generation queue cleaned up');
    } catch (e) { /* ignore */ }
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });

  // Force kill after 10s
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection safety net
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
