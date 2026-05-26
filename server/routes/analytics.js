const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.get('/dashboard', ctrl.getDashboardAnalytics);
router.get('/teacher-heatmap', ctrl.getTeacherHeatmap);
router.get('/room-efficiency', ctrl.getRoomEfficiency);
router.get('/subject-heatmap', ctrl.getSubjectHeatmap);
router.get('/ai-recommendations', ctrl.getAIRecommendations);
router.get('/generation-history', ctrl.getGenerationHistory);

module.exports = router;
