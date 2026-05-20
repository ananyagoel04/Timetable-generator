const express = require('express');
const router = express.Router();
const { getAbsences, createAbsence, updateAbsence, deleteAbsence } = require('../controllers/absenceController');

router.route('/').get(getAbsences).post(createAbsence);
router.route('/:id').put(updateAbsence).delete(deleteAbsence);

module.exports = router;
