const express = require('express');
const router = express.Router();
const tc = require('../controllers/timetableController');

// Generation & listing
router.post('/generate', tc.generate);
router.get('/list', tc.getTimetables);
router.get('/stats', tc.getStats);

// Timetable data
router.get('/:timetableId/blocks', tc.getTimetableBlocks);
router.get('/:timetableId/class/:classId', tc.getClassBlocks);
router.get('/:timetableId/teacher/:teacherId', tc.getTeacherBlocks);
router.get('/:timetableId/conflicts', tc.getConflicts);
router.put('/:timetableId/publish', tc.publishTimetable);

// Block editing (basic)
router.put('/block/:id', tc.updateBlock);
router.post('/swap', tc.swapBlocks);
router.put('/block/:id/lock', tc.lockBlock);
router.put('/block/:id/unlock', tc.unlockBlock);

// Enhanced editing
router.put('/block/:id/move', tc.moveBlock);
router.post('/block/:id/validate-move', tc.validateMove);
router.put('/block/:id/reassign-teacher', tc.reassignTeacher);
router.put('/block/:id/reassign-room', tc.reassignRoom);
router.get('/block/:id/edit-history', tc.getEditHistory);

module.exports = router;
