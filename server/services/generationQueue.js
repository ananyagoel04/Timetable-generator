/**
 * Generation Queue Abstraction
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Production: BullMQ queue (REDIS_URL configured) — jobs processed by workers/generationWorker.js
 * Development: In-process fallback (setImmediate) — works without Redis
 *
 * Priority 4 changes:
 *   - BullMQ mode only ENQUEUES jobs (worker runs in separate process)
 *   - Added getHealth() for queue health monitoring
 *   - Added standard JSON response format
 *   - Preserved all in-process mode behavior for local dev
 */
const SchedulerEngine = require('./schedulerEngine');

// In-memory job store for tracking (both modes)
const _jobs = new Map();

// Auto-purge interval (every 10 minutes)
let _purgeInterval = null;

const GENERATION_TIMEOUT_MS = parseInt(process.env.GENERATION_TIMEOUT_MS) || 5 * 60 * 1000;
const JOB_RETENTION_MS = parseInt(process.env.JOB_RETENTION_MS) || 60 * 60 * 1000;
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
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

class GenerationQueue {
  constructor() {
    this.useRedis = !!process.env.REDIS_URL;
    this.queue = null;
    this.queueEvents = null;

    if (this.useRedis) {
      this._initBullMQ();
    }

    // Start auto-purge
    if (!_purgeInterval) {
      _purgeInterval = setInterval(() => this._purgeOldJobs(), 10 * 60 * 1000);
      if (_purgeInterval.unref) _purgeInterval.unref();
    }
  }

  /**
   * Initialize BullMQ Queue (producer-only in Express process).
   * The Worker runs in workers/generationWorker.js as a separate process.
   */
  async _initBullMQ() {
    try {
      const { Queue, QueueEvents } = require('bullmq');
      const connection = parseRedisConnection(process.env.REDIS_URL);

      this.queue = new Queue(QUEUE_NAME, { connection });

      // QueueEvents for tracking job progress/completion/failure in Express process
      this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });

      this.queueEvents.on('progress', ({ jobId, data }) => {
        const existing = _jobs.get(jobId);
        if (existing) {
          existing.progress = data.percent || existing.progress;
          existing.stage = data.stage || existing.stage;
          existing.logs.push({ ts: new Date().toISOString(), stage: data.stage, percent: data.percent });
        }
      });

      this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
        const existing = _jobs.get(jobId);
        if (existing) {
          let result;
          try { result = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue; } catch { result = returnvalue; }
          existing.status = 'completed';
          existing.progress = 100;
          existing.stage = 'complete';
          existing.completedAt = new Date();
          existing.result = result;
          existing.logs.push({ ts: new Date().toISOString(), stage: 'complete', percent: 100 });
        }
      });

      this.queueEvents.on('failed', ({ jobId, failedReason }) => {
        const existing = _jobs.get(jobId);
        if (existing) {
          existing.status = existing.cancelled ? 'cancelled' : 'failed';
          existing.error = failedReason;
          existing.failedAt = new Date();
          existing.logs.push({ ts: new Date().toISOString(), stage: existing.status, error: failedReason });
        }
      });

      this.queueEvents.on('stalled', ({ jobId }) => {
        console.warn(`[GenerationQueue] Job ${jobId} stalled — worker will retry`);
        const existing = _jobs.get(jobId);
        if (existing) {
          existing.logs.push({ ts: new Date().toISOString(), stage: 'stalled', message: 'Job stalled, worker retrying...' });
        }
      });

      console.log('🔴 BullMQ generation queue initialized (producer-only, worker runs separately)');
    } catch (err) {
      console.warn('⚠️  BullMQ not available, falling back to in-process queue:', err.message);
      this.useRedis = false;
    }
  }

  /**
   * Add a new generation job.
   * BullMQ mode: Enqueues to Redis (processed by external worker).
   * In-process mode: Runs generation in setImmediate (dev fallback).
   */
  async addJob(schoolId, sessionId, options = {}) {
    // Concurrent generation protection
    for (const [id, job] of _jobs.entries()) {
      if (job.schoolId === schoolId.toString() && job.status === 'running') {
        return { success: false, error: 'A generation job is already running for this school', existingJobId: id };
      }
    }

    const jobId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (this.useRedis && this.queue) {
      try {
        const bullJob = await this.queue.add('generate', {
          schoolId: schoolId.toString(),
          sessionId: sessionId.toString(),
          options,
          cancelled: false
        }, {
          jobId,
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { age: 3600, count: 50 },
          removeOnFail: { age: 86400, count: 100 }
        });

        _jobs.set(bullJob.id, {
          jobId: bullJob.id,
          schoolId: schoolId.toString(),
          status: 'running',
          progress: 0,
          stage: 'queued',
          startedAt: new Date(),
          logs: [{ ts: new Date().toISOString(), stage: 'queued', percent: 0 }],
          cancelled: false,
          result: null
        });

        return { success: true, jobId: bullJob.id };
      } catch (err) {
        console.warn('[GenerationQueue] BullMQ enqueue failed, falling back to in-process:', err.message);
        // Fall through to in-process mode
      }
    }

    // ── In-process mode with full progress/cancellation/timeout ──
    const jobData = {
      jobId,
      schoolId: schoolId.toString(),
      status: 'running',
      progress: 0,
      stage: 'starting',
      startedAt: new Date(),
      logs: [{ ts: new Date().toISOString(), stage: 'starting', percent: 0 }],
      cancelled: false,
      result: null
    };
    _jobs.set(jobId, jobData);

    setImmediate(async () => {
      let timeoutTimer = null;
      try {
        const engine = new SchedulerEngine(schoolId, sessionId);
        engine.generationOptions = options || {};

        // Hook progress callback
        engine.onProgress = (stage, percent) => {
          const job = _jobs.get(jobId);
          if (!job) return;

          // Check cancellation token
          if (job.cancelled) {
            throw new Error('Generation cancelled by user');
          }

          job.progress = percent;
          job.stage = stage;
          job.logs.push({ ts: new Date().toISOString(), stage, percent });
        };

        // Set generation timeout
        const timeoutPromise = new Promise((_, reject) => {
          timeoutTimer = setTimeout(() => {
            reject(new Error(`Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s`));
          }, GENERATION_TIMEOUT_MS);
        });

        // Race between generation and timeout
        const result = await Promise.race([
          engine.generate(),
          timeoutPromise
        ]);

        clearTimeout(timeoutTimer);

        const job = _jobs.get(jobId);
        if (job && !job.cancelled) {
          job.status = 'completed';
          job.progress = 100;
          job.stage = 'complete';
          job.completedAt = new Date();
          job.result = {
            timetableId: result.timetableId,
            status: result.status,
            totalBlocks: result.totalBlocks,
            unplaced: result.unplaced,
            conflicts: result.conflicts,
            score: result.score,
            diagnostics: result.diagnostics,
            timeMs: result.timeMs
          };
          job.logs.push({ ts: new Date().toISOString(), stage: 'complete', percent: 100 });
        }
      } catch (err) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        const job = _jobs.get(jobId);
        if (job) {
          job.status = job.cancelled ? 'cancelled' : 'failed';
          job.error = err.message;
          job.failedAt = new Date();
          job.logs.push({ ts: new Date().toISOString(), stage: job.status, error: err.message });
        }
      }
    });

    return { success: true, jobId };
  }

  getJobStatus(jobId) {
    const job = _jobs.get(jobId);
    if (!job) return null;
    return {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      error: job.error,
      result: job.result,
      logCount: job.logs?.length || 0
    };
  }

  getJobLogs(jobId) {
    const job = _jobs.get(jobId);
    if (!job) return null;
    return job.logs || [];
  }

  getJobResult(jobId) {
    const job = _jobs.get(jobId);
    if (!job) return null;
    return job.result || null;
  }

  async cancelJob(jobId) {
    if (this.useRedis && this.queue) {
      try {
        const job = await this.queue.getJob(jobId);
        if (job) {
          // Signal cancellation via job data update
          await job.updateData({ ...job.data, cancelled: true });
          // Try to remove if still waiting
          const state = await job.getState();
          if (state === 'waiting' || state === 'delayed') {
            await job.remove();
          }
        }
      } catch (e) {
        console.warn('[GenerationQueue] BullMQ cancel error:', e.message);
      }
    }

    const job = _jobs.get(jobId);
    if (job) {
      job.cancelled = true;
      job.status = 'cancelled';
      job.logs?.push({ ts: new Date().toISOString(), stage: 'cancelled', message: 'Cancelled by user' });
      return { success: true };
    }
    return { success: false, error: 'Job not found' };
  }

  listJobs(schoolId) {
    const results = [];
    for (const [id, job] of _jobs.entries()) {
      if (!schoolId || job.schoolId === schoolId.toString()) {
        results.push({
          jobId: job.jobId,
          status: job.status,
          progress: job.progress,
          stage: job.stage,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
          error: job.error,
          hasResult: !!job.result
        });
      }
    }
    return results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  /**
   * Queue health check — production monitoring.
   */
  async getHealth() {
    const health = {
      mode: this.useRedis ? 'bullmq' : 'in-process',
      redisConnected: false,
      queueName: QUEUE_NAME,
      counts: { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 },
      inMemoryJobs: _jobs.size,
      uptime: process.uptime()
    };

    if (this.useRedis && this.queue) {
      try {
        const counts = await this.queue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed');
        health.counts = counts;
        health.redisConnected = true;
      } catch (err) {
        health.redisConnected = false;
        health.redisError = err.message;
      }
    }

    return health;
  }

  /**
   * Auto-purge completed/failed jobs older than retention period.
   */
  _purgeOldJobs() {
    const now = Date.now();
    let purged = 0;
    for (const [id, job] of _jobs.entries()) {
      const doneAt = job.completedAt || job.failedAt;
      if (doneAt && (now - new Date(doneAt).getTime()) > JOB_RETENTION_MS) {
        _jobs.delete(id);
        purged++;
      }
    }
    if (purged > 0) console.log(`[GenerationQueue] Purged ${purged} old jobs`);
  }

  async cleanup() {
    if (_purgeInterval) {
      clearInterval(_purgeInterval);
      _purgeInterval = null;
    }
    if (this.queueEvents) await this.queueEvents.close();
    if (this.queue) await this.queue.close();
  }
}

// Singleton
const generationQueue = new GenerationQueue();
module.exports = generationQueue;
