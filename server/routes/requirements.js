const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateRequirement, validateParamId } = require('../middleware/validators');
const rc = require('../controllers/requirementController');

router.get('/', authorize('view_timetable', 'edit_setup'), rc.getAll);
router.post('/', authorize('edit_setup'), validateCreateRequirement, rc.create);
router.put('/:id', authorize('edit_setup'), ...validateParamId, rc.update);
router.delete('/:id', authorize('edit_setup'), ...validateParamId, rc.remove);

// Bulk operations
router.post('/bulk', authorize('edit_setup'), rc.bulkSave);
router.post('/clone', authorize('edit_setup'), rc.clone);

// Analytics
router.get('/workload-summary', authorize('view_timetable', 'edit_setup'), rc.workloadSummary);
router.get('/balancing', authorize('view_timetable', 'edit_setup'), rc.balancingSuggestions);

module.exports = router;
