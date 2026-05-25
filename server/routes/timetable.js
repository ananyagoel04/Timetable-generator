const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  validateGenerateTimetable, validateBlockMove, validateBlockSwap,
  validateReassignTeacher, validateReassignRoom, validateParamId
} = require('../middleware/validators');
const tc = require('../controllers/timetableController');

// Generation & listing
router.post('/generate', authorize('generate_timetable'), validateGenerateTimetable, tc.generate);
router.get('/list', authorize('view_timetable'), tc.getTimetables);
router.get('/stats', authorize('view_timetable'), tc.getStats);

// Timetable data (read)
router.get('/:timetableId/blocks', authorize('view_timetable'), tc.getTimetableBlocks);
router.get('/:timetableId/class/:classId', authorize('view_timetable'), tc.getClassBlocks);
router.get('/:timetableId/teacher/:teacherId', authorize('view_timetable'), tc.getTeacherBlocks);
router.get('/:timetableId/conflicts', authorize('view_timetable'), tc.getConflicts);
router.put('/:timetableId/publish', authorize('publish_timetable'), tc.publishTimetable);

// Block editing (requires edit_timetable)
router.put('/block/:id', authorize('edit_timetable'), ...validateParamId, tc.updateBlock);
router.post('/swap', authorize('edit_timetable'), validateBlockSwap, tc.swapBlocks);
router.put('/block/:id/lock', authorize('edit_timetable'), ...validateParamId, tc.lockBlock);
router.put('/block/:id/unlock', authorize('edit_timetable'), ...validateParamId, tc.unlockBlock);

// Enhanced editing
router.put('/block/:id/move', authorize('edit_timetable'), validateBlockMove, tc.moveBlock);
router.post('/block/:id/validate-move', authorize('edit_timetable'), ...validateParamId, tc.validateMove);
router.put('/block/:id/reassign-teacher', authorize('edit_timetable'), validateReassignTeacher, tc.reassignTeacher);
router.put('/block/:id/reassign-room', authorize('edit_timetable'), validateReassignRoom, tc.reassignRoom);
router.get('/block/:id/edit-history', authorize('view_timetable'), ...validateParamId, tc.getEditHistory);

module.exports = router;
