const express = require('express');
const router = express.Router();
const { authorize, requireSchoolContext } = require('../middleware/auth');
const sc = require('../controllers/sessionController');

// All session routes require school context
router.use(requireSchoolContext);

// List sessions for current school
router.get('/', authorize('view_timetable', 'edit_setup'), sc.getSessions);

// Get current active session
router.get('/current', authorize('view_timetable', 'edit_setup'), sc.getCurrentSession);

// Create new session
router.post('/', authorize('edit_setup', 'manage_school'), sc.createSession);

// Update session
router.put('/:id', authorize('edit_setup', 'manage_school'), sc.updateSession);

// Activate session
router.put('/:id/activate', authorize('edit_setup', 'manage_school'), sc.activateSession);

// Archive session
router.put('/:id/archive', authorize('edit_setup', 'manage_school'), sc.archiveSession);

// Copy setup from source session
router.post('/:id/copy-setup', authorize('edit_setup', 'manage_school'), sc.copySessionSetup);

module.exports = router;
