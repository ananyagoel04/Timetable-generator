const express = require('express');
const router = express.Router();
const { platformOnly, authorize } = require('../middleware/auth');
const { getSystemHealth, getSchedulerHistory, getTimetableDiagnostics, getApiStats } = require('../controllers/diagnosticsController');

// Health is accessible to all authenticated users; other diagnostics are platform-only
router.get('/health', getSystemHealth);
router.get('/conflicts', authorize('view_timetable'), require('../controllers/conflictController').getConflicts);
router.get('/scheduler', platformOnly, getSchedulerHistory);
router.get('/timetable/:id', platformOnly, getTimetableDiagnostics);
router.get('/api-stats', platformOnly, getApiStats);

module.exports = router;
