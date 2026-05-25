const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { validateSearchQuery } = require('../middleware/validators');
const { globalSearch } = require('../controllers/searchController');

router.get('/', authorize('view_timetable'), validateSearchQuery, globalSearch);

module.exports = router;
