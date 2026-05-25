const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateCreateRoom, validateParamId } = require('../middleware/validators');
const { getRooms, getRoom, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');

router.route('/')
  .get(authorize('view_timetable', 'edit_setup'), getRooms)
  .post(authorize('edit_setup'), validateCreateRoom, createRoom);

router.route('/:id')
  .get(authorize('view_timetable', 'edit_setup'), ...validateParamId, getRoom)
  .put(authorize('edit_setup'), ...validateParamId, updateRoom)
  .delete(authorize('edit_setup'), ...validateParamId, deleteRoom);

module.exports = router;
