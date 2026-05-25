const express = require('express');
const router = express.Router();
const { platformOnly } = require('../middleware/auth');
const { getSystemHealth, getSchedulerHistory, getTimetableDiagnostics, getApiStats } = require('../controllers/diagnosticsController');

// All diagnostics routes are platform-only
router.get('/health', platformOnly, getSystemHealth);
router.get('/scheduler', platformOnly, getSchedulerHistory);
router.get('/timetable/:id', platformOnly, getTimetableDiagnostics);
router.get('/api-stats', platformOnly, getApiStats);

module.exports = router;
