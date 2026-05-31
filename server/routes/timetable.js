const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  validateGenerateTimetable, validateBlockMove, validateBlockSwap,
  validateReassignTeacher, validateReassignRoom, validateParamId
} = require('../middleware/validators');
const tc = require('../controllers/timetableController');
const cc = require('../controllers/conflictController');

// Generation & listing
router.post('/generate', authorize('generate_timetable'), validateGenerateTimetable, tc.generate);
router.post('/generate-sync', authorize('generate_timetable'), validateGenerateTimetable, tc.generateSync);
router.get('/job/:jobId', authorize('generate_timetable'), tc.getJobStatus);
router.get('/list', authorize('view_timetable'), tc.getTimetables);
router.get('/stats', authorize('view_timetable'), tc.getStats);

// Timetable data (read)
router.get('/:timetableId/blocks', authorize('view_timetable'), tc.getTimetableBlocks);
router.get('/:timetableId/class/:classId', authorize('view_timetable'), tc.getClassBlocks);
router.get('/:timetableId/teacher/:teacherId', authorize('view_timetable'), tc.getTeacherBlocks);
router.put('/:timetableId/publish', authorize('publish_timetable'), tc.publishTimetable);
router.put('/:timetableId/unpublish', authorize('publish_timetable'), tc.unpublishTimetable);
router.put('/:timetableId/rename', authorize('edit_timetable'), tc.renameTimetable);

// Conflict management (enhanced)
router.get('/:timetableId/conflicts', authorize('view_timetable'), cc.getConflicts);
router.put('/:timetableId/conflicts/:conflictId/resolve', authorize('edit_timetable'), cc.resolveConflict);
router.post('/:timetableId/conflicts/:conflictId/auto-fix', authorize('edit_timetable'), cc.autoFixConflict);
router.post('/:timetableId/conflicts/batch-resolve', authorize('edit_timetable'), cc.batchResolve);
router.post('/:timetableId/conflicts/revalidate', authorize('edit_timetable'), cc.revalidate);

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

// Undo / Redo
router.post('/:timetableId/undo', authorize('edit_timetable'), tc.undo);
router.post('/:timetableId/redo', authorize('edit_timetable'), tc.redo);
router.get('/:timetableId/undo-status', authorize('edit_timetable'), tc.getUndoStatus);

// Snapshots / Version History
router.post('/:timetableId/snapshot', authorize('edit_timetable'), tc.createSnapshot);
router.get('/:timetableId/snapshots', authorize('view_timetable'), tc.listSnapshots);
router.post('/:timetableId/rollback/:snapshotId', authorize('edit_timetable'), tc.rollbackToSnapshot);
router.get('/:timetableId/compare/:snapshotId', authorize('view_timetable'), tc.compareSnapshot);

// Delete timetable (transactional, with password verification)
router.delete('/:timetableId', authorize('edit_timetable'), tc.deleteTimetable);

module.exports = router;
