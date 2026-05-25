const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateSubject, validateParamId } = require('../middleware/validators');
const { getSubjects, getSubject, createSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');

router.route('/')
  .get(authorize('view_timetable', 'edit_setup'), getSubjects)
  .post(authorize('edit_setup'), validateCreateSubject, createSubject);

router.route('/:id')
  .get(authorize('view_timetable', 'edit_setup'), ...validateParamId, getSubject)
  .put(authorize('edit_setup'), ...validateParamId, updateSubject)
  .delete(authorize('edit_setup'), ...validateParamId, deleteSubject);

module.exports = router;
