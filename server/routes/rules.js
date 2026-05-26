const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const rc = require('../controllers/rulesController');

// Subject Requirements
router.post('/requirements/bulk', authorize('edit_setup', 'manage_rules'), rc.bulkCreateRequirements);
router.put('/requirements/bulk', authorize('edit_setup', 'manage_rules'), rc.bulkUpdateRequirements);
router.post('/requirements/clone', authorize('edit_setup', 'manage_rules'), rc.cloneRequirements);
router.get('/requirements/workload', authorize('view_timetable', 'manage_rules'), rc.getWorkloadSummary);

router.get('/requirements', authorize('view_timetable', 'manage_rules'), rc.getRequirements);
router.post('/requirements', authorize('edit_setup', 'manage_rules'), rc.createRequirement);
router.put('/requirements/:id', authorize('edit_setup', 'manage_rules'), rc.updateRequirement);
router.delete('/requirements/:id', authorize('edit_setup', 'manage_rules'), rc.deleteRequirement);

// Combination Rules
router.get('/combinations', authorize('view_timetable', 'manage_rules'), rc.getCombinationRules);
router.post('/combinations', authorize('manage_rules'), rc.createCombinationRule);
router.put('/combinations/:id', authorize('manage_rules'), rc.updateCombinationRule);
router.delete('/combinations/:id', authorize('manage_rules'), rc.deleteCombinationRule);

// Reserved Period Rules
router.get('/reserved', authorize('view_timetable', 'manage_rules'), rc.getReservedRules);
router.post('/reserved', authorize('manage_rules'), rc.createReservedRule);
router.put('/reserved/:id', authorize('manage_rules'), rc.updateReservedRule);
router.delete('/reserved/:id', authorize('manage_rules'), rc.deleteReservedRule);

// Custom Rules
router.get('/custom', authorize('view_timetable', 'manage_rules'), rc.getCustomRules);
router.post('/custom', authorize('manage_rules'), rc.createCustomRule);

// Soft Preferences (alias for custom rules — fixes 404 on frontend)
router.get('/soft-preferences', authorize('view_timetable', 'manage_rules'), rc.getCustomRules);

module.exports = router;

