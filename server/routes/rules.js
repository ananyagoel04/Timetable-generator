const express = require('express');
const router = express.Router();
const rc = require('../controllers/rulesController');

// Subject Requirements
router.get('/requirements', rc.getRequirements);
router.post('/requirements', rc.createRequirement);
router.put('/requirements/:id', rc.updateRequirement);
router.delete('/requirements/:id', rc.deleteRequirement);

// Combination Rules
router.get('/combinations', rc.getCombinationRules);
router.post('/combinations', rc.createCombinationRule);
router.put('/combinations/:id', rc.updateCombinationRule);
router.delete('/combinations/:id', rc.deleteCombinationRule);

// Reserved Period Rules
router.get('/reserved', rc.getReservedRules);
router.post('/reserved', rc.createReservedRule);
router.put('/reserved/:id', rc.updateReservedRule);
router.delete('/reserved/:id', rc.deleteReservedRule);

// Custom Rules
router.get('/custom', rc.getCustomRules);
router.post('/custom', rc.createCustomRule);

module.exports = router;
