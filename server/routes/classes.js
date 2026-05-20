const express = require('express');
const router = express.Router();
const { getClasses, getClass, createClass, updateClass, deleteClass } = require('../controllers/classController');

router.route('/').get(getClasses).post(createClass);
router.route('/:id').get(getClass).put(updateClass).delete(deleteClass);

module.exports = router;
