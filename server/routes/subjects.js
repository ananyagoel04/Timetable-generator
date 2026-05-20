const express = require('express');
const router = express.Router();
const { getSubjects, getSubject, createSubject, updateSubject, deleteSubject } = require('../controllers/subjectController');

router.route('/').get(getSubjects).post(createSubject);
router.route('/:id').get(getSubject).put(updateSubject).delete(deleteSubject);

module.exports = router;
