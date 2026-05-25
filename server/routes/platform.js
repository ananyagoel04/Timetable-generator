const express = require('express');
const router = express.Router();
const { platformOnly } = require('../middleware/auth');
const pc = require('../controllers/platformController');

// All platform routes require platform-level access
router.use(platformOnly);

// Schools management
router.get('/schools', pc.getSchools);
router.post('/schools', pc.createSchool);
router.put('/schools/:id', pc.updateSchool);
router.put('/schools/:id/deactivate', pc.deactivateSchool);

// Platform users
router.get('/users', pc.getPlatformUsers);

// Global audit logs
router.get('/audit-logs', pc.getGlobalAuditLogs);

// Platform stats & diagnostics
router.get('/stats', pc.getPlatformStats);

module.exports = router;
