#!/usr/bin/env node
/**
 * Dedicated BullMQ Generation Worker
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Runs timetable generation in a SEPARATE process from Express.
 * This prevents heavy CPU work from blocking HTTP requests.
 *
 * Usage:
 *   node workers/generationWorker.js
 *   npm run worker:generation
 *
 * Requires:
 *   REDIS_URL env var (defaults to redis://localhost:6379)
 *   MONGODB_URI env var
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Worker } = require('bullmq');
const mongoose = require('mongoose');

// ── Configuration ──
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/school_timetable';
const GENERATION_TIMEOUT_MS = parseInt(process.env.GENERATION_TIMEOUT_MS) || 5 * 60 * 1000;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 1;
const QUEUE_NAME = 'timetable-generation';

// ── Parse Redis URL into IORedis-compatible connection object ──
function parseRedisConnection(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
      maxRetriesPerRequest: null, // Required by BullMQ
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

// ── MongoDB Connection ──
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[Worker] ✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('[Worker] ❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

// ── Load models (must be after mongoose connect) ──
function loadModels() {
  require('../models/GeneratedTimetable');
  require('../models/LessonBlock');
  require('../models/ConflictLog');
  require('../models/TimetableSnapshot');
  require('../models/AuditLog');
  require('../models/School');
  require('../models/AcademicSession');
  require('../models/Teacher');
  require('../models/Class');
  require('../models/Subject');
  require('../models/Room');
  require('../models/SubjectRequirement');
  require('../models/SubjectCombinationRule');
  require('../models/PeriodStructure');
  require('../models/CanTeach');
  require('../models/ReservedPeriodRule');
  require('../models/StudentGroup');
  require('../models/SoftPreference');
  require('../models/CustomRule');
}

// ── Generation Handler ──
async function processGenerationJob(job) {
  const { schoolId, sessionId, options = {} } = job.data;
  const startTime = Date.now();

  console.log(`[Worker] 🔧 Processing job ${job.id} for school=${schoolId} session=${sessionId}`);

  // Update progress: initializing
  await job.updateProgress({ stage: 'initializing', percent: 0 });

  const SchedulerEngine = require('../services/schedulerEngine');
  const TimetableSnapshot = mongoose.model('TimetableSnapshot');
  const GeneratedTimetable = mongoose.model('GeneratedTimetable');
  const AuditLog = mongoose.model('AuditLog');

  const engine = new SchedulerEngine(schoolId, sessionId);
  engine.generationOptions = options;

  // Hook engine progress to BullMQ job progress
  engine.onProgress = async (stage, percent) => {
    // Check for cancellation via job's data (set by cancel API)
    const freshJob = await job.queue?.getJob(job.id);
    if (freshJob?.data?.cancelled) {
      throw new Error('Generation cancelled by user');
    }
    await job.updateProgress({ stage, percent });
  };

  // Race between generation and timeout
  let timeoutTimer;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new Error(`Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s`));
    }, GENERATION_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      engine.generate(),
      timeoutPromise
    ]);
    clearTimeout(timeoutTimer);

    await job.updateProgress({ stage: 'saving', percent: 95 });

    // ── Create snapshot after successful generation ──
    if (result.timetableId) {
      try {
        const LessonBlock = mongoose.model('LessonBlock');
        const blocks = await LessonBlock.find({ timetable: result.timetableId }).lean();
        const lastSnap = await TimetableSnapshot.findOne({ timetable: result.timetableId })
          .sort({ version: -1 }).select('version');
        const version = (lastSnap?.version || 0) + 1;

        await TimetableSnapshot.create({
          timetable: result.timetableId,
          school: schoolId,
          session: sessionId,
          version,
          label: `Auto v${version} (generation)`,
          description: `Automatic snapshot after generation job ${job.id}`,
          snapshotData: blocks.map(b => ({
            type: b.type, subject: b.subject, teacher: b.teacher, room: b.room,
            classes: b.classes, day: b.day, periods: b.periods, studentGroup: b.studentGroup,
            isLocked: b.isLocked, combinationRule: b.combinationRule,
            consecutiveGroupId: b.consecutiveGroupId, consecutivePosition: b.consecutivePosition,
            priorityWeight: b.priorityWeight
          })),
          stats: {
            totalBlocks: result.totalBlocks || blocks.length,
            placedBlocks: (result.totalBlocks || blocks.length) - (result.unplaced || 0),
            qualityScore: result.score || 0,
            generationTimeMs: result.timeMs || (Date.now() - startTime)
          },
          isPublished: false
        });
        console.log(`[Worker] 📸 Snapshot v${version} created for timetable ${result.timetableId}`);
      } catch (snapErr) {
        console.warn(`[Worker] ⚠️ Snapshot creation failed (non-fatal):`, snapErr.message);
      }

      // ── Audit log for successful generation ──
      try {
        await AuditLog.create({
          school: schoolId,
          session: sessionId,
          action: 'generate',
          entityType: 'timetable',
          entityId: result.timetableId,
          entityName: `Generation Job ${job.id}`,
          source: 'system_action',
          newValue: {
            totalBlocks: result.totalBlocks,
            unplaced: result.unplaced,
            score: result.score,
            timeMs: result.timeMs
          },
          sourceModule: 'Scheduling'
        });
      } catch (auditErr) {
        console.warn(`[Worker] ⚠️ Audit log failed (non-fatal):`, auditErr.message);
      }
    }

    await job.updateProgress({ stage: 'complete', percent: 100 });

    const elapsed = Date.now() - startTime;
    console.log(`[Worker] ✅ Job ${job.id} completed in ${elapsed}ms — timetable=${result.timetableId}, score=${result.score}`);

    // Return serializable result
    return {
      timetableId: result.timetableId,
      status: result.status,
      totalBlocks: result.totalBlocks,
      unplaced: result.unplaced,
      conflicts: result.conflicts,
      score: result.score,
      diagnostics: result.diagnostics,
      timeMs: result.timeMs || elapsed
    };
  } catch (err) {
    clearTimeout(timeoutTimer);

    // Log failed generation
    try {
      await AuditLog.create({
        school: schoolId,
        session: sessionId,
        action: 'generate',
        entityType: 'timetable',
        entityName: `Generation Job ${job.id} — FAILED`,
        source: 'system_action',
        reason: err.message,
        sourceModule: 'Scheduling'
      });
    } catch { /* non-fatal */ }

    console.error(`[Worker] ❌ Job ${job.id} failed:`, err.message);
    throw err; // BullMQ will mark the job as failed
  }
}

// ── Start Worker ──
async function main() {
  console.log(`[Worker] 🚀 Starting generation worker...`);
  console.log(`[Worker]    Redis: ${REDIS_URL}`);
  console.log(`[Worker]    MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`[Worker]    Timeout: ${GENERATION_TIMEOUT_MS / 1000}s`);
  console.log(`[Worker]    Concurrency: ${WORKER_CONCURRENCY}`);

  // Connect to MongoDB first
  await connectDB();
  loadModels();

  // Create BullMQ Worker
  const connection = parseRedisConnection(REDIS_URL);

  const worker = new Worker(QUEUE_NAME, processGenerationJob, {
    connection,
    concurrency: WORKER_CONCURRENCY,
    limiter: { max: 1, duration: 2000 },
    stalledInterval: 30000,
    maxStalledCount: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  // ── Event Handlers ──
  worker.on('ready', () => {
    console.log(`[Worker] ✅ Worker ready and listening on queue "${QUEUE_NAME}"`);
  });

  worker.on('active', (job) => {
    console.log(`[Worker] ▶️  Job ${job.id} active — school=${job.data.schoolId}`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] ✅ Job ${job.id} completed — timetable=${result?.timetableId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] ⚠️  Job ${jobId} stalled — will be retried`);
  });

  worker.on('error', (err) => {
    console.error(`[Worker] 🔴 Worker error:`, err.message);
  });

  // ── Graceful Shutdown ──
  const shutdown = async (signal) => {
    console.log(`\n[Worker] 📴 ${signal} received — shutting down...`);
    await worker.close();
    await mongoose.connection.close();
    console.log('[Worker] ✅ Worker shut down cleanly');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('[Worker] ⚠️  Unhandled Rejection:', reason);
  });
}

main().catch(err => {
  console.error('[Worker] 💥 Fatal error:', err);
  process.exit(1);
});
