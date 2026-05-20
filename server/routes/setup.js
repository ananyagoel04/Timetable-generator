const express = require('express');
const router = express.Router();
const { getSchool, updateSchool, getSessions, createSession, updateSession, getPeriodStructure, updatePeriodStructure } = require('../controllers/setupController');

router.get('/school', getSchool);
router.put('/school', updateSchool);
router.get('/sessions', getSessions);
router.post('/sessions', createSession);
router.put('/sessions/:id', updateSession);
router.get('/period-structure', getPeriodStructure);
router.put('/period-structure/:id', updatePeriodStructure);

module.exports = router;
