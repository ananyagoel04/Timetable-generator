const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const rc = require('../controllers/reportController');

// ─── Query-param based report endpoints (test-suite & frontend compatible) ───
router.get('/class-timetable', authorize('view_timetable', 'export_reports'), rc.getClassTimetableReport);
router.get('/teacher-timetable', authorize('view_timetable', 'export_reports'), rc.getTeacherTimetableReport);
router.get('/substitution-report', authorize('view_timetable', 'export_reports'), rc.getSubstitutionReport);

// ─── Existing endpoints ───
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
router.get('/conflict-report', authorize('view_timetable', 'export_reports'), rc.getConflictReport);
router.get('/quality-report', authorize('view_timetable', 'export_reports'), rc.getQualityReport);
router.get('/subject-completion', authorize('view_timetable', 'export_reports'), rc.getSubjectCompletionReport);

// ─── New Priority 6 endpoints ───
router.get('/room-timetable', authorize('view_timetable', 'export_reports'), rc.getRoomTimetableReport);
router.get('/audit-report', authorize('view_audit', 'export_reports'), rc.getAuditReport);
router.get('/published-history', authorize('view_timetable', 'export_reports'), rc.getPublishedHistory);
router.get('/readiness-audit', authorize('view_timetable', 'generate_timetable'), rc.getReadinessAudit);

module.exports = router;
