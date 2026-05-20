const express = require('express');
const router = express.Router();
const sc = require('../controllers/setupController');

// School
router.get('/school', sc.getSchool);
router.put('/school', sc.updateSchool);

// Sessions
router.get('/sessions', sc.getSessions);
router.post('/sessions', sc.createSession);
router.put('/sessions/:id', sc.updateSession);

// Period Structure (single - backward compat)
router.get('/period-structure', sc.getPeriodStructure);
router.put('/period-structure/:id', sc.updatePeriodStructure);

// Period Structures (multi)
router.get('/period-structures', sc.getPeriodStructures);
router.post('/period-structures', sc.createPeriodStructure);
router.post('/period-structures/:id/clone', sc.clonePeriodStructure);
router.put('/period-structures/:id/assign', sc.assignPeriodStructure);
router.put('/period-structures/:id', sc.updatePeriodStructure);
router.delete('/period-structures/:id', sc.deletePeriodStructure);

// Soft Preferences
router.get('/preferences', sc.getPreferences);
router.post('/preferences', sc.createPreference);
router.put('/preferences/:id', sc.updatePreference);
router.delete('/preferences/:id', sc.deletePreference);

module.exports = router;
