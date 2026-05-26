/**
 * Generation Queue Abstraction
 * Default: in-process (setImmediate) — works without Redis
 * Optional: BullMQ when REDIS_URL is configured
 *
 * Component 6 enhancements:
 *   - onProgress callback hookup in in-process mode
 *   - Cancellation token support
 *   - Generation timeout (5 min max)
 *   - Structured log array with timestamps
 *   - Auto-purge old jobs (1 hour retention)
 *   - Enhanced BullMQ worker with stalled recovery
 */
const SchedulerEngine = require('./schedulerEngine');

// In-memory job store for tracking
const _jobs = new Map();

// Auto-purge interval (every 10 minutes)
let _purgeInterval = null;

const GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const JOB_RETENTION_MS = 60 * 60 * 1000; // 1 hour

class GenerationQueue {
  constructor() {
    this.useRedis = !!process.env.REDIS_URL;
    this.queue = null;
    this.worker = null;

    if (this.useRedis) {
      this._initBullMQ();
    }

    // Start auto-purge
    if (!_purgeInterval) {
      _purgeInterval = setInterval(() => this._purgeOldJobs(), 10 * 60 * 1000);
      if (_purgeInterval.unref) _purgeInterval.unref(); // Don't prevent process exit
    }
  }

  async _initBullMQ() {
    try {
      const { Queue, Worker } = require('bullmq');
      const connection = { url: process.env.REDIS_URL };

      this.queue = new Queue('timetable-generation', { connection });

      this.worker = new Worker('timetable-generation', async (job) => {
        const { schoolId, sessionId } = job.data;
        const engine = new SchedulerEngine(schoolId, sessionId);

        // Hook engine progress to BullMQ job progress
        engine.onProgress = (stage, percent) => {
          job.updateProgress({ stage, percent });
          const jobData = _jobs.get(job.id);
          if (jobData) {
            jobData.progress = percent;
            jobData.stage = stage;
            jobData.logs.push({ ts: new Date().toISOString(), stage, percent });
          }
        };

        // Check cancellation between stages
        const originalProgress = engine.onProgress;
        engine.onProgress = (stage, percent) => {
          const jobData = _jobs.get(job.id);
          if (jobData?.cancelled) {
            throw new Error('Generation cancelled by user');
          }
          originalProgress(stage, percent);
        };

        await job.updateProgress({ stage: 'starting', percent: 0 });
        const result = await engine.generate();
        await job.updateProgress({ stage: 'complete', percent: 100 });

        // Store result
        _jobs.set(job.id, {
          ..._jobs.get(job.id),
          status: 'completed', progress: 100, stage: 'complete',
          result: {
            timetableId: result.timetableId,
            status: result.status,
            totalBlocks: result.totalBlocks,
            unplaced: result.unplaced,
            conflicts: result.conflicts,
            score: result.score,
            timeMs: result.timeMs
          },
          completedAt: new Date()
        });

        return result;
      }, {
        connection,
        concurrency: 1,
        limiter: { max: 1, duration: 5000 },
        stalledInterval: 30000, // Check for stalled jobs every 30s
        maxStalledCount: 2 // Allow 2 stalls before marking as failed
      });

      this.worker.on('failed', (job, err) => {
        const existing = _jobs.get(job.id) || {};
        _jobs.set(job.id, {
          ...existing,
          status: 'failed', error: err.message,
          failedAt: new Date()
        });
        existing.logs?.push({ ts: new Date().toISOString(), stage: 'failed', error: err.message });
      });

      this.worker.on('progress', (job, progress) => {
        const existing = _jobs.get(job.id) || {};
        _jobs.set(job.id, {
          ...existing,
          progress: progress.percent || progress,
          stage: progress.stage || existing.stage
        });
      });

      this.worker.on('stalled', (jobId) => {
        console.warn(`[GenerationQueue] Job ${jobId} stalled — will retry`);
        const existing = _jobs.get(jobId) || {};
        existing.logs?.push({ ts: new Date().toISOString(), stage: 'stalled', message: 'Job stalled, retrying...' });
      });

      console.log('🔴 BullMQ generation queue initialized with Redis');
    } catch (err) {
      console.warn('⚠️  BullMQ not available, falling back to in-process queue:', err.message);
      this.useRedis = false;
    }
  }

  async addJob(schoolId, sessionId, options = {}) {
    // Concurrent generation protection
    for (const [id, job] of _jobs.entries()) {
      if (job.schoolId === schoolId.toString() && job.status === 'running') {
        return { success: false, error: 'A generation job is already running for this school', existingJobId: id };
      }
    }

    const jobId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (this.useRedis && this.queue) {
      const bullJob = await this.queue.add('generate', { schoolId, sessionId }, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 }
      });
      _jobs.set(bullJob.id, {
        jobId: bullJob.id, schoolId: schoolId.toString(),
        status: 'queued', progress: 0, stage: 'queued',
        startedAt: new Date(), logs: [{ ts: new Date().toISOString(), stage: 'queued', percent: 0 }],
        cancelled: false
      });
      return { success: true, jobId: bullJob.id };
    }

    // ── In-process mode with full progress/cancellation/timeout ──
    const jobData = {
      jobId, schoolId: schoolId.toString(),
      status: 'running', progress: 0, stage: 'starting',
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
          await job.remove();
        }
      } catch (e) { /* ignore */ }
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
   * Auto-purge completed/failed jobs older than retention period.
   */
  _purgeOldJobs() {
    const now = Date.now();
    for (const [id, job] of _jobs.entries()) {
      const doneAt = job.completedAt || job.failedAt;
      if (doneAt && (now - new Date(doneAt).getTime()) > JOB_RETENTION_MS) {
        _jobs.delete(id);
      }
    }
  }

  async cleanup() {
    if (_purgeInterval) {
      clearInterval(_purgeInterval);
      _purgeInterval = null;
    }
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}

// Singleton
const generationQueue = new GenerationQueue();
module.exports = generationQueue;
