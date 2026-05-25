const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateCanTeach, validateParamId } = require('../middleware/validators');
const ct = require('../controllers/canTeachController');

// List all (with query filters)
router.get('/', authorize('view_timetable', 'manage_teachers'), ct.list);

// Matrix view (teachers × subjects)
router.get('/matrix', authorize('view_timetable', 'manage_teachers'), ct.matrix);

// Find eligible replacements
router.get('/eligible', authorize('manage_absences', 'manage_replacements', 'approve_substitutions'), ct.findEligibleReplacements);

// Sync from teacher capabilities
router.post('/sync-capabilities', authorize('manage_teachers'), ct.syncFromCapabilities);

// Bulk create/update
router.post('/bulk', authorize('manage_teachers'), ct.bulkUpsert);

// CRUD
router.post('/', authorize('manage_teachers'), validateCreateCanTeach, ct.create);
router.get('/teacher/:teacherId', authorize('view_timetable', 'manage_teachers'), ct.getByTeacher);
router.get('/subject/:subjectId', authorize('view_timetable', 'manage_teachers'), ct.getBySubject);
router.put('/:id', authorize('manage_teachers'), ...validateParamId, ct.update);
router.delete('/:id', authorize('manage_teachers'), ...validateParamId, ct.remove);

module.exports = router;
