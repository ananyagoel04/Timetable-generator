const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const rc = require('../controllers/reportController');

router.get('/day-wise', authorize('view_timetable', 'export_reports'), rc.getDayWiseReport);
router.get('/class-weekly/:classId', authorize('view_timetable', 'export_reports'), rc.getClassWeeklyReport);
router.get('/teacher-weekly/:teacherId', authorize('view_timetable', 'export_reports'), rc.getTeacherWeeklyReport);
router.get('/full-school', authorize('view_timetable', 'export_reports'), rc.getFullSchoolReport);
router.get('/export-config', authorize('view_timetable', 'export_reports'), rc.getExportConfig);
router.get('/period-wise', authorize('view_timetable', 'export_reports'), rc.getPeriodWiseReport);
router.get('/replacement-report', authorize('view_timetable', 'export_reports', 'manage_replacements'), rc.getReplacementReport);
router.get('/teacher-workload', authorize('view_timetable', 'export_reports'), rc.getTeacherWorkloadReport);
router.get('/subject-distribution', authorize('view_timetable', 'export_reports'), rc.getSubjectDistributionReport);
router.get('/room-utilization', authorize('view_timetable', 'export_reports'), rc.getRoomUtilizationReport);

module.exports = router;
