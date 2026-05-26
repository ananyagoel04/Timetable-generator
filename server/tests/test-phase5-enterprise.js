/**
 * Phase 5 — Enterprise SaaS Test Suite
 * Tests: Analytics, Roles, Snapshots, AI Recommendations, Engine Optimization
 */
const http = require('http');

const BASE = 'http://localhost:5001';
let TOKEN = '';
let TIMETABLE_ID = '';
let SNAPSHOT_ID = '';

const results = { passed: 0, failed: 0, skipped: 0 };

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers.Authorization = `Bearer ${TOKEN}`;
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function test(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); results.passed++; }
  else { console.log(`  ❌ ${name}`); results.failed++; }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Phase 5 — Enterprise SaaS Test Suite');
  console.log('═══════════════════════════════════════════════════════\n');

  // Auth
  console.log('🧪 Authentication');
  const auth = await req('POST', '/api/auth/login', { email: 'admin@dps.edu', password: 'admin123' });
  TOKEN = auth.data?.data?.token || auth.data?.token;
  test('Login successful', !!TOKEN);

  // Get timetable ID
  const ttList = await req('GET', '/api/timetable/list');
  TIMETABLE_ID = ttList.data?.data?.[0]?._id;
  test('Has timetable', !!TIMETABLE_ID);

  // ─── Analytics Dashboard ───
  console.log('\n🧪 Analytics Dashboard API');
  const dash = await req('GET', '/api/analytics/dashboard');
  test('Returns 200', dash.status === 200);
  test('Has success', dash.data?.success === true);
  test('Has hasData', dash.data?.data?.hasData !== undefined);
  if (dash.data?.data?.hasData) {
    test('Has qualityScore', typeof dash.data.data.qualityScore === 'number');
    test('Has teacherStats', !!dash.data.data.teacherStats);
    test('Has roomStats', !!dash.data.data.roomStats);
    test('Has totalBlocks', typeof dash.data.data.totalBlocks === 'number');
  }

  // ─── Teacher Heatmap ───
  console.log('\n🧪 Teacher Heatmap API');
  if (TIMETABLE_ID) {
    const heat = await req('GET', `/api/analytics/teacher-heatmap?timetableId=${TIMETABLE_ID}`);
    test('Returns 200', heat.status === 200);
    test('Returns array', Array.isArray(heat.data?.data));
    if (heat.data?.data?.length > 0) {
      test('Has teacher name', !!heat.data.data[0].name);
      test('Has days object', !!heat.data.data[0].days);
      test('Has weeklyTotal', typeof heat.data.data[0].weeklyTotal === 'number');
    }
  }

  // ─── Room Efficiency ───
  console.log('\n🧪 Room Efficiency API');
  if (TIMETABLE_ID) {
    const room = await req('GET', `/api/analytics/room-efficiency?timetableId=${TIMETABLE_ID}`);
    test('Returns 200', room.status === 200);
    test('Returns array', Array.isArray(room.data?.data));
    if (room.data?.data?.length > 0) {
      test('Has room name', !!room.data.data[0].name);
      test('Has utilization %', typeof room.data.data[0].utilization === 'number');
      test('Has overallScore', typeof room.data.data[0].overallScore === 'number');
    }
  }

  // ─── Subject Heatmap ───
  console.log('\n🧪 Subject Heatmap API');
  if (TIMETABLE_ID) {
    const subj = await req('GET', `/api/analytics/subject-heatmap?timetableId=${TIMETABLE_ID}`);
    test('Returns 200', subj.status === 200);
    test('Returns array', Array.isArray(subj.data?.data));
  }

  // ─── AI Recommendations ───
  console.log('\n🧪 AI Recommendations API');
  if (TIMETABLE_ID) {
    const ai = await req('GET', `/api/analytics/ai-recommendations?timetableId=${TIMETABLE_ID}`);
    test('Returns 200', ai.status === 200);
    test('Has recommendations array', Array.isArray(ai.data?.data?.recommendations));
    test('Has summary', !!ai.data?.data?.summary);
    test('Has total count', typeof ai.data?.data?.summary?.total === 'number');
    const recs = ai.data?.data?.recommendations || [];
    if (recs.length > 0) {
      test('Recommendation has type', !!recs[0].type);
      test('Recommendation has priority', !!recs[0].priority);
      test('Recommendation has title', !!recs[0].title);
    }
  }

  // ─── Generation History ───
  console.log('\n🧪 Generation History API');
  const hist = await req('GET', '/api/analytics/generation-history');
  test('Returns 200', hist.status === 200);
  test('Returns array', Array.isArray(hist.data?.data));

  // ─── Roles API ───
  console.log('\n🧪 Roles API');
  const roles = await req('GET', '/api/roles');
  test('Returns 200', roles.status === 200);
  test('Returns array', Array.isArray(roles.data?.data));
  test('Has system roles', roles.data?.data?.some(r => r.isSystem));
  test('Has school_admin role', roles.data?.data?.some(r => r.name === 'school_admin'));

  // ─── Permissions API ───
  console.log('\n🧪 Permissions API');
  const perms = await req('GET', '/api/roles/permissions');
  test('Returns 200', perms.status === 200);
  test('Returns array', Array.isArray(perms.data?.data));
  test('Has view_timetable', perms.data?.data?.some(p => p.code === 'view_timetable'));
  test('Has view_analytics', perms.data?.data?.some(p => p.code === 'view_analytics'));
  test('Has manage_roles', perms.data?.data?.some(p => p.code === 'manage_roles'));
  test('Has manage_snapshots', perms.data?.data?.some(p => p.code === 'manage_snapshots'));

  // ─── Create Custom Role ───
  console.log('\n🧪 Custom Role CRUD');
  const createRole = await req('POST', '/api/roles', {
    displayName: 'Test Vice Principal',
    description: 'Test role for Phase 5',
    permissions: ['view_timetable', 'view_analytics', 'export_reports']
  });
  test('Create returns 201', createRole.status === 201);
  test('Role has _id', !!createRole.data?.data?._id);
  const customRoleId = createRole.data?.data?._id;

  if (customRoleId) {
    // Update
    const updateRole = await req('PUT', `/api/roles/${customRoleId}`, {
      displayName: 'Updated VP',
      permissions: ['view_timetable', 'view_analytics']
    });
    test('Update returns 200', updateRole.status === 200);
    test('Name updated', updateRole.data?.data?.displayName === 'Updated VP');

    // Delete (deactivate)
    const delRole = await req('DELETE', `/api/roles/${customRoleId}`);
    test('Delete returns 200', delRole.status === 200);
  }

  // Cannot modify system role
  const sysRole = roles.data?.data?.find(r => r.isSystem);
  if (sysRole) {
    const updateSys = await req('PUT', `/api/roles/${sysRole._id}`, { displayName: 'Hacked' });
    test('Cannot modify system role', updateSys.status === 403);
  }

  // ─── Snapshot Management ───
  console.log('\n🧪 Timetable Snapshots');
  if (TIMETABLE_ID) {
    const snap = await req('POST', `/api/timetable/${TIMETABLE_ID}/snapshot`, {
      label: 'Phase 5 test snapshot',
      description: 'Automated test snapshot'
    });
    test('Create snapshot 201', snap.status === 201);
    test('Has snapshot version', typeof snap.data?.data?.version === 'number');
    SNAPSHOT_ID = snap.data?.data?.id;

    // List
    const snaps = await req('GET', `/api/timetable/${TIMETABLE_ID}/snapshots`);
    test('List returns 200', snaps.status === 200);
    test('Has snapshots array', Array.isArray(snaps.data?.data));
    test('Snapshot has label', snaps.data?.data?.[0]?.label?.length > 0);

    // Compare
    if (SNAPSHOT_ID) {
      const cmp = await req('GET', `/api/timetable/${TIMETABLE_ID}/compare/${SNAPSHOT_ID}`);
      test('Compare returns 200', cmp.status === 200);
      test('Has comparison data', cmp.data?.data?.snapshotVersion !== undefined);
      test('Has added/removed/changed counts', typeof cmp.data?.data?.added === 'number');
    }
  }

  // ─── Request ID Tracing ───
  console.log('\n🧪 Request ID Tracing');
  const healthRes = await new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: 5001, path: '/api/health', method: 'GET' }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ headers: res.headers, data }));
    });
    r.on('error', reject);
    r.end();
  });
  test('Has x-request-id header', !!healthRes.headers['x-request-id']);

  // ─── Phase 4 Regression ───
  console.log('\n🧪 Phase 4 Regression Checks');
  const health = await req('GET', '/api/health');
  test('Health OK', health.status === 200 && health.data?.success);

  const reports = await req('GET', `/api/reports/quality-report?timetableId=${TIMETABLE_ID}`);
  test('Quality report OK', reports.status === 200);

  const undoStatus = await req('GET', `/api/timetable/${TIMETABLE_ID}/undo-status`);
  test('Undo/redo status OK', undoStatus.status === 200);

  // ─── Summary ───
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (results.failed === 0) {
    console.log('🎉 All Phase 5 tests passed!\n');
  } else {
    console.log(`⚠️  ${results.failed} test(s) failed.\n`);
    process.exit(1);
  }
}

run().catch(err => { console.error('Test runner error:', err); process.exit(1); });
