const express = require('express');
const router = express.Router();
const generationQueue = require('../services/generationQueue');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const auth = require('../middleware/auth');

/**
 * Dedicated Generation Job API Routes
 * POST   /api/generation/jobs          → Create new generation job
 * GET    /api/generation/jobs           → List all jobs for school
 * GET    /api/generation/jobs/:id       → Get job status + progress
 * POST   /api/generation/jobs/:id/cancel → Cancel running job
 * GET    /api/generation/jobs/:id/logs  → Get generation log entries
 * GET    /api/generation/jobs/:id/result → Get generation result
 */

// Create a new generation job
router.post('/jobs', auth, async (req, res) => {
  try {
    const schoolId = req.user.school;
    const sessionId = req.body.sessionId || req.user.activeSession;
    if (!schoolId || !sessionId) {
      return res.status(400).json({ error: 'schoolId and sessionId required' });
    }

    const result = await generationQueue.addJob(schoolId, sessionId, {
      lockedBlockIds: req.body.lockedBlockIds || [],
      keepLockedBlocks: req.body.keepLockedBlocks || false,
      requireTeacherForActivities: req.body.requireTeacherForActivities !== false // default true
    });
    if (!result.success) {
      return res.status(409).json({
        error: result.error,
        existingJobId: result.existingJobId
      });
    }

    res.status(201).json({
      success: true,
      jobId: result.jobId,
      message: 'Generation job started'
    });
  } catch (err) {
    console.error('[GenerationRoutes] Create job error:', err);
    res.status(500).json({ error: 'Failed to create generation job' });
  }
});

// List locked blocks from latest published timetable (for pre-generation UI)
router.get('/locked-blocks', auth, async (req, res) => {
  try {
    const schoolId = req.user.school;
    const sessionId = req.query.sessionId || req.user.activeSession;
    const latestPublished = await GeneratedTimetable.findOne({
      school: schoolId,
      session: sessionId,
      status: 'published'
    }).sort({ publishedAt: -1 });

    if (!latestPublished) {
      return res.json({ lockedBlocks: [], timetableId: null });
    }

    const lockedBlocks = await LessonBlock.find({
      timetable: latestPublished._id,
      isLocked: true
    }).populate('subject teacher room classes').lean();

    res.json({
      lockedBlocks: lockedBlocks.map(lb => ({
        _id: lb._id,
        type: lb.type,
        subject: lb.subject ? { _id: lb.subject._id, name: lb.subject.name } : null,
        teacher: lb.teacher ? { _id: lb.teacher._id, name: lb.teacher.name } : null,
        room: lb.room ? { _id: lb.room._id, name: lb.room.name } : null,
        classes: lb.classes?.map(c => ({ _id: c._id || c, name: c.name || '' })) || [],
        day: lb.day,
        periods: lb.periods,
        duration: lb.duration || lb.periods?.length || 1,
        studentGroup: lb.studentGroup || null
      })),
      timetableId: latestPublished._id,
      timetableName: latestPublished.name
    });
  } catch (err) {
    console.error('[GenerationRoutes] Locked blocks error:', err);
    res.status(500).json({ error: 'Failed to fetch locked blocks' });
  }
});

// List all jobs for the school
router.get('/jobs', auth, async (req, res) => {
  try {
    const schoolId = req.user.school;
    const jobs = generationQueue.listJobs(schoolId);
    res.json({ jobs });
  } catch (err) {
    console.error('[GenerationRoutes] List jobs error:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

// Get job status and progress
router.get('/jobs/:id', auth, async (req, res) => {
  try {
    const status = generationQueue.getJobStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(status);
  } catch (err) {
    console.error('[GenerationRoutes] Job status error:', err);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Cancel a running job
router.post('/jobs/:id/cancel', auth, async (req, res) => {
  try {
    const result = await generationQueue.cancelJob(req.params.id);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    res.json({ success: true, message: 'Job cancellation requested' });
  } catch (err) {
    console.error('[GenerationRoutes] Cancel job error:', err);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Get generation log entries
router.get('/jobs/:id/logs', auth, async (req, res) => {
  try {
    const logs = generationQueue.getJobLogs(req.params.id);
    if (!logs) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ logs });
  } catch (err) {
    console.error('[GenerationRoutes] Job logs error:', err);
    res.status(500).json({ error: 'Failed to get job logs' });
  }
});

// Get generation result
router.get('/jobs/:id/result', auth, async (req, res) => {
  try {
    const result = generationQueue.getJobResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Job result not available' });
    }
    res.json({ result });
  } catch (err) {
    console.error('[GenerationRoutes] Job result error:', err);
    res.status(500).json({ error: 'Failed to get job result' });
  }
});

module.exports = router;
