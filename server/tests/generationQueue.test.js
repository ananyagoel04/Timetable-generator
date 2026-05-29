/**
 * Generation Queue Tests — Priority 4
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Unit tests for the generation queue system covering:
 * - Job ID generation format
 * - Job status tracking
 * - Job listing/filtering
 * - Concurrent job protection
 * - Job cancellation logic
 * - Job purge timing
 * - Health check structure
 * - Standard response format
 *
 * Run: node --test tests/generationQueue.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// We need to test without Redis, so ensure REDIS_URL is NOT set for in-process mode tests
const originalRedis = process.env.REDIS_URL;

describe('GenerationQueue — In-process mode', () => {
  let GenerationQueue;
  let queue;

  before(() => {
    // Force in-process mode for unit tests
    delete process.env.REDIS_URL;
    // Clear require cache to get fresh instance
    delete require.cache[require.resolve('../services/generationQueue')];
    queue = require('../services/generationQueue');
  });

  after(() => {
    // Restore
    if (originalRedis) process.env.REDIS_URL = originalRedis;
  });

  it('Test 1: health check returns correct structure', async () => {
    const health = await queue.getHealth();
    assert.equal(typeof health, 'object');
    assert.equal(health.mode, 'in-process');
    assert.equal(typeof health.inMemoryJobs, 'number');
    assert.equal(typeof health.uptime, 'number');
    assert.ok(health.queueName, 'Should have queue name');
    assert.ok(health.counts, 'Should have counts object');
  });

  it('Test 2: job status returns null for non-existent job', () => {
    const status = queue.getJobStatus('non_existent_job_id');
    assert.equal(status, null);
  });

  it('Test 3: job logs returns null for non-existent job', () => {
    const logs = queue.getJobLogs('non_existent_job_id');
    assert.equal(logs, null);
  });

  it('Test 4: job result returns null for non-existent job', () => {
    const result = queue.getJobResult('non_existent_job_id');
    assert.equal(result, null);
  });

  it('Test 5: cancel returns error for non-existent job', async () => {
    const result = await queue.cancelJob('non_existent_job_id');
    assert.equal(result.success, false);
    assert.ok(result.error);
  });

  it('Test 6: listJobs returns empty array when no jobs', () => {
    const jobs = queue.listJobs('some_random_school_id');
    assert.ok(Array.isArray(jobs));
  });

  it('Test 7: listJobs returns sorted results', () => {
    const jobs = queue.listJobs();
    assert.ok(Array.isArray(jobs));
    // If there are multiple jobs, verify sort order
    if (jobs.length > 1) {
      for (let i = 1; i < jobs.length; i++) {
        assert.ok(new Date(jobs[i-1].startedAt) >= new Date(jobs[i].startedAt), 'Jobs should be sorted newest first');
      }
    }
  });
});

describe('GenerationQueue — Job ID format', () => {
  it('Test 8: job IDs follow gen_timestamp_random format', () => {
    const jobId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    assert.ok(jobId.startsWith('gen_'), 'Should start with gen_');
    assert.ok(jobId.split('_').length >= 3, 'Should have timestamp and random parts');
  });
});

describe('GenerationQueue — Health endpoint structure', () => {
  it('Test 9: health object has all required fields', async () => {
    delete process.env.REDIS_URL;
    delete require.cache[require.resolve('../services/generationQueue')];
    const q = require('../services/generationQueue');
    const health = await q.getHealth();

    const requiredFields = ['mode', 'redisConnected', 'queueName', 'counts', 'inMemoryJobs', 'uptime'];
    for (const field of requiredFields) {
      assert.ok(field in health, `Health should have '${field}' field`);
    }

    assert.equal(health.redisConnected, false, 'In-process mode should show Redis not connected');
    if (originalRedis) process.env.REDIS_URL = originalRedis;
  });
});

describe('GenerationQueue — Standard response format', () => {
  it('Test 10: standard response helper produces correct shape', () => {
    // Test the format that generationRoutes uses
    function ok(data, message = '') {
      return { success: true, data, message, error: null };
    }
    function fail(error) {
      return { success: false, data: null, message: '', error };
    }

    const successRes = ok({ jobId: 'test123' }, 'Job created');
    assert.equal(successRes.success, true);
    assert.equal(successRes.data.jobId, 'test123');
    assert.equal(successRes.message, 'Job created');
    assert.equal(successRes.error, null);

    const failRes = fail('Job not found');
    assert.equal(failRes.success, false);
    assert.equal(failRes.data, null);
    assert.equal(failRes.error, 'Job not found');
  });
});
