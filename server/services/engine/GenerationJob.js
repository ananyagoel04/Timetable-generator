const { randomUUID } = require('crypto');

/**
 * GenerationJob — In-process background job for timetable generation.
 *
 * Runs generation asynchronously via setImmediate() so the API handler
 * can return immediately. Progress is tracked in-memory and polled via
 * GET /api/timetable/job/:jobId.
 *
 * No Redis/BullMQ dependency — works for single-server deployments.
 */

// In-memory job store (survives only within process lifetime)
const jobStore = new Map();

class GenerationJob {
  constructor(schoolId, sessionId) {
    this.jobId = randomUUID();
    this.schoolId = schoolId;
    this.sessionId = sessionId;
    this.status = 'pending';   // pending → running → completed | failed
    this.progress = { stage: 'initializing', percent: 0 };
    this.result = null;
    this.error = null;
    this.startedAt = null;
    this.completedAt = null;

    // Register in store
    jobStore.set(this.jobId, this);
  }

  /**
   * Start generation in background.
   * Returns immediately with jobId.
   */
  start() {
    this.status = 'running';
    this.startedAt = Date.now();

    // Run in next tick — non-blocking
    setImmediate(() => this._run());
    return this.jobId;
  }

  async _run() {
    try {
      // Dynamic import to avoid circular dependency
      const SchedulerEngine = require('../schedulerEngine');
      const engine = new SchedulerEngine(this.schoolId, this.sessionId);

      // Hook into engine progress events
      engine.onProgress = (stage, percent) => {
        this.progress = { stage, percent };
      };

      this.result = await engine.generate({ seed: this.jobId });
      this.status = 'completed';
      this.completedAt = Date.now();
    } catch (err) {
      this.status = 'failed';
      this.error = err.message;
      this.completedAt = Date.now();
      console.error(`[GenerationJob ${this.jobId}] Failed:`, err.message);
    }

    // Auto-cleanup old jobs after 1 hour
    setTimeout(() => {
      jobStore.delete(this.jobId);
    }, 3600000);
  }

  /**
   * Get serializable status object.
   */
  toJSON() {
    return {
      jobId: this.jobId,
      status: this.status,
      progress: this.progress,
      result: this.result,
      error: this.error,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      durationMs: this.completedAt ? this.completedAt - this.startedAt : (this.startedAt ? Date.now() - this.startedAt : null)
    };
  }

  /**
   * Look up a job by ID.
   */
  static getJob(jobId) {
    return jobStore.get(jobId) || null;
  }

  /**
   * List all active jobs.
   */
  static listJobs() {
    return Array.from(jobStore.values()).map(j => j.toJSON());
  }
}

module.exports = GenerationJob;
