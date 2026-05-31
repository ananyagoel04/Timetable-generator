const express = require('express');
const router = express.Router();
const { authorize, platformOnly } = require('../middleware/auth');
const sc = require('../controllers/setupController');
const seedCtrl = require('../controllers/seedController');

// School
router.get('/school', authorize('view_timetable', 'edit_setup', 'manage_school'), sc.getSchool);
router.put('/school', authorize('edit_setup', 'manage_school'), sc.updateSchool);

// Sessions
router.get('/sessions', authorize('view_timetable', 'edit_setup'), sc.getSessions);
router.post('/sessions', authorize('edit_setup', 'manage_school'), sc.createSession);
router.put('/sessions/:id', authorize('edit_setup', 'manage_school'), sc.updateSession);
router.put('/sessions/:id/activate', authorize('edit_setup', 'manage_school'), sc.activateSession);
router.put('/sessions/:id/archive', authorize('edit_setup', 'manage_school'), sc.archiveSession);
router.post('/sessions/:id/copy-setup', authorize('edit_setup', 'manage_school'), sc.copySessionSetup);

// Period Structure (single - backward compat)
router.get('/period-structure', authorize('view_timetable', 'edit_setup'), sc.getPeriodStructure);
router.put('/period-structure/:id', authorize('edit_setup'), sc.updatePeriodStructure);

// Period Structures (multi)
router.get('/period-structures', authorize('view_timetable', 'edit_setup'), sc.getPeriodStructures);
router.post('/period-structures', authorize('edit_setup'), sc.createPeriodStructure);
router.post('/period-structures/:id/clone', authorize('edit_setup'), sc.clonePeriodStructure);
router.put('/period-structures/:id/assign', authorize('edit_setup'), sc.assignPeriodStructure);
router.put('/period-structures/:id', authorize('edit_setup'), sc.updatePeriodStructure);
router.delete('/period-structures/:id', authorize('edit_setup'), sc.deletePeriodStructure);

// Soft Preferences
router.get('/preferences', authorize('view_timetable', 'manage_rules'), sc.getPreferences);
router.post('/preferences', authorize('manage_rules'), sc.createPreference);
router.put('/preferences/:id', authorize('manage_rules'), sc.updatePreference);
router.delete('/preferences/:id', authorize('manage_rules'), sc.deletePreference);

// Setup Status (fixes 404 on frontend setup-wizard check)
router.get('/status', authorize('view_timetable', 'edit_setup', 'manage_school'), sc.getSetupStatus);

// Readiness Audit (deep validation)
router.get('/readiness-audit', authorize('edit_setup', 'manage_school'), sc.getReadinessAudit);

// Validate Step
router.post('/validate-step', authorize('edit_setup', 'manage_school'), sc.validateStep);

// Seed Data — platform/developer ONLY, disabled in production
router.post('/seed', platformOnly, (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, error: 'Seed operations are disabled in production' });
  }
  next();
}, seedCtrl.seedData);


module.exports = router;

