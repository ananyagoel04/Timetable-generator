const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateRequirement, validateParamId } = require('../middleware/validators');
const rc = require('../controllers/requirementController');

// ── Subject Requirements (teacher assignments) ──
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

// ── Validation / Readiness ──
router.get('/validation', authorize('view_timetable', 'edit_setup', 'generate_timetable'), rc.validation);

// ── Class-Subject Mappings ──
router.get('/class-subjects', authorize('view_timetable', 'edit_setup'), rc.listClassSubjects);
router.get('/classes/:classId/subjects', authorize('view_timetable', 'edit_setup'), rc.getClassSubjects);
router.post('/class-subjects', authorize('edit_setup'), rc.createClassSubject);
router.put('/class-subjects/:id', authorize('edit_setup'), rc.updateClassSubject);
router.delete('/class-subjects/:id', authorize('edit_setup'), rc.deleteClassSubject);
router.post('/class-subjects/bulk', authorize('edit_setup'), rc.bulkClassSubjects);
router.post('/class-subjects/generate', authorize('edit_setup'), rc.generateClassSubjects);

module.exports = router;
