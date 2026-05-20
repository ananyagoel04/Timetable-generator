const express = require('express');
const router = express.Router();
const rc = require('../controllers/reportController');

router.get('/day-wise', rc.getDayWiseReport);
router.get('/class-weekly/:classId', rc.getClassWeeklyReport);
router.get('/teacher-weekly/:teacherId', rc.getTeacherWeeklyReport);
router.get('/full-school', rc.getFullSchoolReport);

module.exports = router;
