const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateTeacher, validateUpdateTeacher, validateParamId } = require('../middleware/validators');
const { getTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher } = require('../controllers/teacherController');
const { previewReplacement, applyReplacement, getWorkload } = require('../controllers/replacementController');

router.route('/')
  .get(authorize('view_timetable', 'manage_teachers'), getTeachers)
  .post(authorize('manage_teachers'), validateCreateTeacher, createTeacher);

router.route('/:id')
  .get(authorize('view_timetable', 'manage_teachers'), ...validateParamId, getTeacher)
  .put(authorize('manage_teachers'), validateUpdateTeacher, updateTeacher)
  .delete(authorize('manage_teachers'), ...validateParamId, deleteTeacher);

// Replacement workflow
router.post('/:id/replace/preview', authorize('manage_replacements'), previewReplacement);
router.post('/:id/replace', authorize('manage_replacements'), applyReplacement);
router.get('/:id/workload', authorize('view_timetable', 'manage_teachers'), getWorkload);

module.exports = router;
