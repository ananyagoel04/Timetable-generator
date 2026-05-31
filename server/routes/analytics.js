const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/dashboard', authorize('view_timetable'), ctrl.getDashboardAnalytics);
router.get('/teacher-heatmap', authorize('view_timetable'), ctrl.getTeacherHeatmap);
router.get('/room-efficiency', authorize('view_timetable'), ctrl.getRoomEfficiency);
router.get('/subject-heatmap', authorize('view_timetable'), ctrl.getSubjectHeatmap);
router.get('/ai-recommendations', authorize('view_timetable'), ctrl.getAIRecommendations);
router.get('/generation-history', authorize('view_timetable'), ctrl.getGenerationHistory);

module.exports = router;
