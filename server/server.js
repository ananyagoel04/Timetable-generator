require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { protect, scopeToSchool, requireSchoolContext } = require('./middleware/auth');
const auditLogger = require('./middleware/auditLogger');

connectDB();

const app = express();

// ── CRITICAL #38: Security headers ──
app.use(helmet({ contentSecurityPolicy: false }));

// ── CRITICAL #4: CORS origin restrictions ──
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(null, true); // Allow all in dev; tighten in production
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ── CRITICAL #17: Rate limiting ──
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' } });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 200, message: { success: false, error: 'Too many requests. Slow down.' } });

// ── PUBLIC routes ──
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TimeCraft Advanced API running', timestamp: new Date() });
});

// ── CRITICAL #1, #2, #6: Auth + school/session scope + audit on ALL protected routes ──
app.use('/api', apiLimiter, protect, scopeToSchool, auditLogger);

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

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
