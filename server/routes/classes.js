const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateClass, validateParamId } = require('../middleware/validators');
const { getClasses, getClass, createClass, updateClass, deleteClass } = require('../controllers/classController');

router.route('/')
  .get(authorize('view_timetable', 'edit_setup'), getClasses)
  .post(authorize('edit_setup'), validateCreateClass, createClass);

router.route('/:id')
  .get(authorize('view_timetable', 'edit_setup'), ...validateParamId, getClass)
  .put(authorize('edit_setup'), ...validateParamId, updateClass)
  .delete(authorize('edit_setup'), ...validateParamId, deleteClass);

module.exports = router;
