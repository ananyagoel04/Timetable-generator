const express = require('express');
const router = express.Router();
const { getSubstitutions, createSubstitution, updateSubstitution, getAvailable } = require('../controllers/substitutionController');

router.get('/available', getAvailable);
router.route('/').get(getSubstitutions).post(createSubstitution);
router.route('/:id').put(updateSubstitution);

module.exports = router;
