const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const mc = require('../controllers/manualTimetableController');

// List all manual timetables for current school/session
router.get('/list', authorize('view_timetable'), mc.listManualTimetables);

// Create a new manual timetable (blank or clone)
router.post('/create', authorize('generate_timetable'), mc.create);

// Get manual timetable details with all blocks
router.get('/:timetableId', authorize('view_timetable'), mc.getDetails);

// Validate a lesson before adding (dry-run)
router.post('/:timetableId/validate-lesson', authorize('edit_timetable'), mc.validateLesson);

// Add a lesson manually
router.post('/:timetableId/lesson', authorize('edit_timetable'), mc.addLesson);

// Update a lesson
router.put('/:timetableId/lesson/:blockId', authorize('edit_timetable'), mc.updateLesson);

// Delete a lesson
router.delete('/:timetableId/lesson/:blockId', authorize('edit_timetable'), mc.deleteLesson);

// Move a lesson to a different day/period
router.put('/:timetableId/lesson/:blockId/move', authorize('edit_timetable'), mc.moveLesson);

// Swap two lessons
router.put('/:timetableId/swap', authorize('edit_timetable'), mc.swapLessons);

// Lock a lesson
router.put('/:timetableId/lesson/:blockId/lock', authorize('edit_timetable'), mc.lockLesson);

// Unlock a lesson
router.put('/:timetableId/lesson/:blockId/unlock', authorize('edit_timetable'), mc.unlockLesson);

// Save draft
router.put('/:timetableId/save-draft', authorize('edit_timetable'), mc.saveDraft);

// Publish manual timetable
router.post('/:timetableId/publish', authorize('publish_timetable'), mc.publish);

// Full validation
router.post('/:timetableId/validate-full', authorize('edit_timetable'), mc.validateFull);

// Bulk assign lessons across multiple days
router.post('/:timetableId/bulk-assign', authorize('edit_timetable'), mc.bulkAssign);

// Get suggestions (teachers, rooms, periods, progress)
router.get('/:timetableId/suggestions', authorize('view_timetable'), mc.getSuggestions);

module.exports = router;
