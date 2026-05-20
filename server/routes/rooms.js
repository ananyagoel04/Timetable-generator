const express = require('express');
const router = express.Router();
const { getRooms, getRoom, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');

router.route('/').get(getRooms).post(createRoom);
router.route('/:id').get(getRoom).put(updateRoom).delete(deleteRoom);

module.exports = router;
