const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { getSubstitutions, createSubstitution, updateSubstitution, getAvailable } = require('../controllers/substitutionController');

router.get('/available', authorize('manage_absences', 'approve_substitutions'), getAvailable);
router.route('/')
  .get(authorize('view_timetable', 'approve_substitutions'), getSubstitutions)
  .post(authorize('approve_substitutions', 'manage_absences'), createSubstitution);
router.route('/:id')
  .put(authorize('approve_substitutions'), updateSubstitution);

module.exports = router;
