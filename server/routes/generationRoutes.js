const express = require('express');
const router = express.Router();
const generationQueue = require('../services/generationQueue');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');

/**
 * Dedicated Generation Job API Routes
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * POST   /api/generation/jobs              → Create new generation job
 * GET    /api/generation/jobs              → List all jobs for school
 * GET    /api/generation/jobs/:id          → Get job status + progress
 * POST   /api/generation/jobs/:id/cancel   → Cancel running job
 * GET    /api/generation/jobs/:id/logs     → Get generation log entries
 * GET    /api/generation/jobs/:id/result   → Get generation result
 * GET    /api/generation/health            → Queue health check
 * GET    /api/generation/locked-blocks     → List locked blocks for pre-generation
 *
 * Auth is already applied globally in server.js via protect + scopeToSchool.
 * All responses use standard format: { success, data, message, error }
 */

// ── Helper: Standard response wrapper ──
function ok(res, data, message = '', status = 200) {
  return res.status(status).json({ success: true, data, message, error: null });
}
function fail(res, error, status = 400) {
  return res.status(status).json({ success: false, data: null, message: '', error });
}

// ── Queue Health Check ──
router.get('/health', async (req, res) => {
  try {
    const health = await generationQueue.getHealth();
    ok(res, health, 'Generation queue health');
  } catch (err) {
    console.error('[GenerationRoutes] Health check error:', err);
    fail(res, 'Failed to check queue health', 500);
  }
});

// ── Create a new generation job ──
router.post('/jobs', async (req, res) => {
  try {
    const schoolId = req.user.school;
    const sessionId = req.body.sessionId || req.user.activeSession;
    if (!schoolId || !sessionId) {
      return fail(res, 'schoolId and sessionId required');
    }

    const result = await generationQueue.addJob(schoolId, sessionId, {
      lockedBlockIds: req.body.lockedBlockIds || [],
      keepLockedBlocks: req.body.keepLockedBlocks || false,
      requireTeacherForActivities: req.body.requireTeacherForActivities !== false
    });

    if (!result.success) {
      return fail(res, result.error, 409);
    }

    ok(res, { jobId: result.jobId }, 'Generation job started', 201);
  } catch (err) {
    console.error('[GenerationRoutes] Create job error:', err);
    fail(res, 'Failed to create generation job', 500);
  }
});

// ── List locked blocks from latest published timetable ──
router.get('/locked-blocks', async (req, res) => {
  try {
    const schoolId = req.user.school;
    const sessionId = req.query.sessionId || req.user.activeSession;
    const latestPublished = await GeneratedTimetable.findOne({
      school: schoolId,
      session: sessionId,
      status: 'published'
    }).sort({ publishedAt: -1 });

    if (!latestPublished) {
      return ok(res, { lockedBlocks: [], timetableId: null, timetableName: null });
    }

    const lockedBlocks = await LessonBlock.find({
      timetable: latestPublished._id,
      isLocked: true
    }).populate('subject teacher room classes').lean();

    ok(res, {
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
    fail(res, 'Failed to fetch locked blocks', 500);
  }
});

// ── List all jobs for the school ──
router.get('/jobs', async (req, res) => {
  try {
    const schoolId = req.user.school;
    const jobs = generationQueue.listJobs(schoolId);
    ok(res, { jobs }, `${jobs.length} jobs found`);
  } catch (err) {
    console.error('[GenerationRoutes] List jobs error:', err);
    fail(res, 'Failed to list jobs', 500);
  }
});

// ── Get job status and progress ──
router.get('/jobs/:id', async (req, res) => {
  try {
    const status = generationQueue.getJobStatus(req.params.id);
    if (!status) {
      return fail(res, 'Job not found', 404);
    }
    ok(res, status);
  } catch (err) {
    console.error('[GenerationRoutes] Job status error:', err);
    fail(res, 'Failed to get job status', 500);
  }
});

// ── Cancel a running job ──
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const result = await generationQueue.cancelJob(req.params.id);
    if (!result.success) {
      return fail(res, result.error, 404);
    }
    ok(res, null, 'Job cancellation requested');
  } catch (err) {
    console.error('[GenerationRoutes] Cancel job error:', err);
    fail(res, 'Failed to cancel job', 500);
  }
});

// ── Get generation log entries ──
router.get('/jobs/:id/logs', async (req, res) => {
  try {
    const logs = generationQueue.getJobLogs(req.params.id);
    if (!logs) {
      return fail(res, 'Job not found', 404);
    }
    ok(res, { logs }, `${logs.length} log entries`);
  } catch (err) {
    console.error('[GenerationRoutes] Job logs error:', err);
    fail(res, 'Failed to get job logs', 500);
  }
});

// ── Get generation result ──
router.get('/jobs/:id/result', async (req, res) => {
  try {
    const result = generationQueue.getJobResult(req.params.id);
    if (!result) {
      return fail(res, 'Job result not available', 404);
    }
    ok(res, { result });
  } catch (err) {
    console.error('[GenerationRoutes] Job result error:', err);
    fail(res, 'Failed to get job result', 500);
  }
});

module.exports = router;
