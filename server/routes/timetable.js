const express = require('express');
const router = express.Router();
const tc = require('../controllers/timetableController');

router.post('/generate', tc.generate);
router.get('/list', tc.getTimetables);
router.get('/stats', tc.getStats);
router.get('/:timetableId/blocks', tc.getTimetableBlocks);
router.get('/:timetableId/class/:classId', tc.getClassBlocks);
router.get('/:timetableId/teacher/:teacherId', tc.getTeacherBlocks);
router.put('/block/:id', tc.updateBlock);
router.post('/swap', tc.swapBlocks);
router.put('/block/:id/lock', tc.lockBlock);
router.put('/block/:id/unlock', tc.unlockBlock);
router.get('/:timetableId/conflicts', tc.getConflicts);
router.put('/:timetableId/publish', tc.publishTimetable);

module.exports = router;
