const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { getSubstitutions, createSubstitution, updateSubstitution, getAvailable, getDailySheet, approveSubstitution } = require('../controllers/substitutionController');

router.get('/available', authorize('manage_absences', 'approve_substitutions'), getAvailable);
router.get('/daily/:date', authorize('view_timetable', 'approve_substitutions'), getDailySheet);
router.route('/')
  .get(authorize('view_timetable', 'approve_substitutions'), getSubstitutions)
  .post(authorize('approve_substitutions', 'manage_absences'), createSubstitution);
router.post('/:id/approve', authorize('approve_substitutions'), approveSubstitution);
router.route('/:id')
  .put(authorize('approve_substitutions'), updateSubstitution);

module.exports = router;
