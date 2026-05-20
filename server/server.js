require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Auth routes (public)
app.use('/api/auth', require('./routes/auth'));

// All other routes (no auth enforced yet — progressive adoption)
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

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TimeCraft Advanced API running', timestamp: new Date() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
