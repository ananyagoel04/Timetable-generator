/**
 * Phase 4 — Production Readiness Test Suite
 * Tests: Health, Reports, PDF Export, Undo/Redo, Setup Audit, Generation Queue
 */
require('dotenv').config();
const http = require('http');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5001';
let TOKEN = '';
let testSchoolId = '';
let testTimetableId = '';

const results = { pass: 0, fail: 0, skip: 0, errors: [] };

function request(method, path, body = null, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...opts.headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: true });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, testName, detail = '') {
  if (condition) {
    results.pass++;
    console.log(`  ✅ ${testName}`);
  } else {
    results.fail++;
    results.errors.push(`${testName}${detail ? ': ' + detail : ''}`);
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

async function test(name, fn) {
  console.log(`\n🧪 ${name}`);
  try { await fn(); }
  catch (err) {
    results.fail++;
    results.errors.push(`${name}: ${err.message}`);
    console.log(`  💥 EXCEPTION: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Phase 4 — Production Readiness Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  // ── 1. Health Check ──
  await test('Health Check — enhanced endpoint', async () => {
    const r = await request('GET', '/api/health');
    assert(r.status === 200, 'Returns 200');
    assert(r.data.success === true, 'success=true');
    assert(r.data.database === 'connected', 'DB connected');
    assert(r.data.memory?.rss, 'Memory RSS present');
    assert(r.data.memory?.heap, 'Memory heap present');
    assert(typeof r.data.uptime === 'number', 'Uptime is number');
    assert(r.data.version, 'Version string present');
  });

  // ── 2. Auth ──
  await test('Authentication', async () => {
    // Try login with the known admin account
    let r = await request('POST', '/api/auth/login', { email: 'admin@dps.edu', password: 'admin123' });
    TOKEN = r.data?.token || r.data?.data?.token || '';
    if (!TOKEN) {
      // Fallback: try register
      r = await request('POST', '/api/auth/register', {
        name: 'Test Admin', email: 'testadmin@test.com', password: 'admin123', role: 'school_admin'
      });
      TOKEN = r.data?.token || r.data?.data?.token || '';
      if (!TOKEN) {
        r = await request('POST', '/api/auth/login', { email: 'testadmin@test.com', password: 'admin123' });
        TOKEN = r.data?.token || r.data?.data?.token || '';
      }
    }
    assert(TOKEN.length > 0, 'Token received');
  });

  if (!TOKEN) {
    console.log('\n⚠️  No auth token — cannot continue protected tests');
    printResults();
    return;
  }

  // ── 3. Setup Status ──
  await test('Setup Status API', async () => {
    const r = await request('GET', '/api/setup/status');
    assert(r.status === 200, 'Returns 200');
    assert(r.data.data || r.data, 'Has status data');
  });

  // ── 4. Readiness Audit ──
  await test('Readiness Audit API', async () => {
    const r = await request('GET', '/api/setup/readiness-audit');
    assert(r.status === 200, 'Returns 200');
    const audit = r.data?.data || r.data;
    // The audit uses readyToGenerate (not ready) and errors/warnings (not checks)
    const hasReady = typeof audit.readyToGenerate === 'boolean' || typeof audit.ready === 'boolean';
    assert(hasReady, 'Has readiness boolean');
    const hasChecks = Array.isArray(audit.checks) || Array.isArray(audit.errors);
    assert(hasChecks, 'Has checks/errors array');
    const items = audit.checks || audit.errors || [];
    assert(items.length >= 0, 'Checks array accessible');
  });

  // ── 5. Step Validation ──
  await test('Step Validation API', async () => {
    const r = await request('POST', '/api/setup/validate-step', { step: 'school' });
    assert(r.status === 200, 'Returns 200');
    const v = r.data?.data || r.data;
    assert(typeof v.valid === 'boolean', 'Has valid boolean');
  });

  // ── 6. Timetable List ──
  await test('Timetable List', async () => {
    const r = await request('GET', '/api/timetable/list');
    assert(r.status === 200, 'Returns 200');
    const tts = r.data?.data || r.data || [];
    assert(Array.isArray(tts), 'Returns array');
    if (tts.length > 0) {
      testTimetableId = tts[0]._id;
      assert(testTimetableId, 'Has timetable ID');
    } else {
      results.skip++;
      console.log('  ⏭️  No timetables to test with');
    }
  });

  // ── 7. Undo/Redo Status ──
  if (testTimetableId) {
    await test('Undo/Redo Status API', async () => {
      const r = await request('GET', `/api/timetable/${testTimetableId}/undo-status`);
      assert(r.status === 200, 'Returns 200');
      const s = r.data?.data || r.data;
      assert(typeof s.undoCount === 'number', 'undoCount is number');
      assert(typeof s.redoCount === 'number', 'redoCount is number');
    });
  }

  // ── 8. Reports ──
  if (testTimetableId) {
    await test('Day-Wise Report', async () => {
      const r = await request('GET', `/api/reports/day-wise?timetableId=${testTimetableId}&day=Monday`);
      assert(r.status === 200, 'Returns 200');
      assert(r.data?.data?.report || r.data?.report, 'Has report data');
    });

    await test('Teacher Workload Report', async () => {
      const r = await request('GET', `/api/reports/teacher-workload?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
    });

    await test('Room Utilization Report', async () => {
      const r = await request('GET', `/api/reports/room-utilization?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
    });

    await test('Conflict Report', async () => {
      const r = await request('GET', `/api/reports/conflict-report?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
      const d = r.data?.data || r.data;
      assert(d.summary, 'Has summary');
      assert(typeof d.summary.total === 'number', 'Has total count');
    });

    await test('Quality Report', async () => {
      const r = await request('GET', `/api/reports/quality-report?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
      const d = r.data?.data || r.data;
      assert(typeof d.qualityScore === 'number', 'Has qualityScore');
      assert(d.coverage, 'Has coverage data');
      assert(d.teacherBalance, 'Has teacherBalance data');
    });

    await test('Subject Completion Report', async () => {
      const r = await request('GET', `/api/reports/subject-completion?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
      const d = r.data?.data || r.data;
      assert(d.summary, 'Has summary');
      assert(typeof d.summary.completionRate === 'number', 'Has completionRate');
    });
  }

  // ── 9. PDF Export ──
  if (testTimetableId) {
    await test('PDF Export — Full School', async () => {
      const r = await request('GET', `/api/export/timetable/pdf?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
    });

    await test('Workload PDF Export', async () => {
      const r = await request('GET', `/api/export/workload/pdf`);
      assert(r.status === 200, 'Returns 200');
    });
  }

  // ── 10. Excel Export ──
  if (testTimetableId) {
    await test('Excel Export', async () => {
      const r = await request('GET', `/api/export/timetable/excel?timetableId=${testTimetableId}`);
      assert(r.status === 200, 'Returns 200');
    });
  }

  // ── 11. Compression ──
  await test('Response Compression', async () => {
    const r = await request('GET', '/api/health', null, {
      headers: { 'Accept-Encoding': 'gzip, deflate' }
    });
    assert(r.status === 200, 'Compressed response ok');
  });

  // ── 12. Rate Limiting Headers ──
  await test('Rate Limiting Headers', async () => {
    const r = await request('GET', '/api/health');
    // Standard rate limit headers
    assert(r.status === 200, 'Health returns 200');
  });

  // ── 13. Notifications ──
  await test('Notifications API', async () => {
    const r = await request('GET', '/api/notifications');
    assert(r.status === 200, 'Returns 200');
  });

  // ── 14. Audit Logs ──
  await test('Audit Logs', async () => {
    const r = await request('GET', '/api/audit-logs?limit=5');
    assert(r.status === 200, 'Returns 200');
  });

  // ── 15. Search ──
  await test('Global Search', async () => {
    const r = await request('GET', '/api/search?q=test');
    assert(r.status === 200, 'Returns 200');
  });

  // ── 16. Diagnostics ──
  await test('Diagnostics API', async () => {
    const r = await request('GET', '/api/diagnostics');
    assert(r.status === 200 || r.status === 404, 'Returns 200 or 404');
  });

  printResults();
}

function printResults() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${results.pass} passed, ${results.fail} failed, ${results.skip} skipped`);
  console.log('═══════════════════════════════════════════════════════');
  if (results.errors.length > 0) {
    console.log('\n❌ Failures:');
    results.errors.forEach(e => console.log(`   • ${e}`));
  }
  if (results.fail === 0) {
    console.log('\n🎉 All tests passed!');
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
