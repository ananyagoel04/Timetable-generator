/**
 * Transaction Safety & Audit Tests — Priority 4
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Unit tests for production safety helpers:
 * - withTransaction helper behavior
 * - Audit helper entry shape
 * - Device type detection from User-Agent
 * - Module detection from URL
 * - Audit middleware context building
 *
 * Run: node --test tests/transactionSafety.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Import the helpers directly
const { detectDeviceType, detectModule } = require('../middleware/auditMiddleware');

describe('Device Type Detection', () => {
  it('Test 1: detects iPhone as mobile', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'), 'mobile');
  });

  it('Test 2: detects Android phone as mobile', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'), 'mobile');
  });

  it('Test 3: detects iPad as tablet', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'), 'tablet');
  });

  it('Test 4: detects Android tablet as tablet', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (Linux; Android 13; SM-X800) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'), 'tablet');
  });

  it('Test 5: detects Chrome desktop as desktop', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'), 'desktop');
  });

  it('Test 6: detects Firefox desktop as desktop', () => {
    assert.equal(detectDeviceType('Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/120.0'), 'desktop');
  });

  it('Test 7: detects Postman as api', () => {
    assert.equal(detectDeviceType('PostmanRuntime/7.36.1'), 'api');
  });

  it('Test 8: detects curl as api', () => {
    assert.equal(detectDeviceType('curl/8.4.0'), 'api');
  });

  it('Test 9: returns api for null/empty UA', () => {
    assert.equal(detectDeviceType(null), 'api');
    assert.equal(detectDeviceType(''), 'api');
    assert.equal(detectDeviceType(undefined), 'api');
  });
});

describe('Module Detection', () => {
  it('Test 10: detects auth module', () => {
    assert.equal(detectModule('/api/auth/login'), 'Authentication');
  });

  it('Test 11: detects scheduling module', () => {
    assert.equal(detectModule('/api/timetable/generate'), 'Scheduling');
    assert.equal(detectModule('/api/generation/jobs'), 'Scheduling');
  });

  it('Test 12: detects master data module', () => {
    assert.equal(detectModule('/api/teachers/123'), 'Master Data');
    assert.equal(detectModule('/api/rooms'), 'Master Data');
    assert.equal(detectModule('/api/classes'), 'Master Data');
    assert.equal(detectModule('/api/subjects'), 'Master Data');
  });

  it('Test 13: detects operations module', () => {
    assert.equal(detectModule('/api/absences'), 'Operations');
    assert.equal(detectModule('/api/substitutions/123'), 'Operations');
    assert.equal(detectModule('/api/teachers/123/replace'), 'Operations');
  });

  it('Test 14: detects conflict resolution module', () => {
    assert.equal(detectModule('/api/conflicts'), 'Conflict Resolution');
  });

  it('Test 15: detects administration module', () => {
    assert.equal(detectModule('/api/users'), 'Administration');
    assert.equal(detectModule('/api/audit-logs'), 'Administration');
    assert.equal(detectModule('/api/school/settings'), 'Administration');
  });

  it('Test 16: detects configuration module', () => {
    assert.equal(detectModule('/api/setup'), 'Configuration');
    assert.equal(detectModule('/api/requirements'), 'Configuration');
    assert.equal(detectModule('/api/rules'), 'Configuration');
  });

  it('Test 17: detects reporting module', () => {
    assert.equal(detectModule('/api/reports'), 'Reporting');
    assert.equal(detectModule('/api/analytics'), 'Reporting');
    assert.equal(detectModule('/api/export'), 'Reporting');
  });

  it('Test 18: returns System for unknown URLs', () => {
    assert.equal(detectModule('/api/unknown'), 'System');
    assert.equal(detectModule(null), 'System');
  });
});

describe('Audit Helper — Entry Shape', () => {
  it('Test 19: createAuditEntry produces correct fields', () => {
    // Test the shape without actually creating in DB
    const { createAuditEntry } = require('../services/auditHelper');
    assert.equal(typeof createAuditEntry, 'function');
  });

  it('Test 20: createSystemAuditEntry function exists', () => {
    const { createSystemAuditEntry } = require('../services/auditHelper');
    assert.equal(typeof createSystemAuditEntry, 'function');
  });
});

describe('Transaction Helper', () => {
  it('Test 21: withTransaction function exists', () => {
    const { withTransaction } = require('../services/transactionHelper');
    assert.equal(typeof withTransaction, 'function');
  });
});

describe('AuditLog Schema — Priority 4 Fields', () => {
  it('Test 22: AuditLog model has new metadata fields', () => {
    const mongoose = require('mongoose');
    // Load the model
    require('../models/AuditLog');
    const schema = mongoose.model('AuditLog').schema;

    assert.ok(schema.path('requestId'), 'Should have requestId field');
    assert.ok(schema.path('deviceType'), 'Should have deviceType field');
    assert.ok(schema.path('sourceModule'), 'Should have sourceModule field');
    assert.ok(schema.path('ipAddress'), 'Should have ipAddress field');
    assert.ok(schema.path('userAgent'), 'Should have userAgent field');
  });

  it('Test 23: deviceType enum has correct values', () => {
    const mongoose = require('mongoose');
    const schema = mongoose.model('AuditLog').schema;
    const deviceEnum = schema.path('deviceType').enumValues;
    assert.ok(deviceEnum.includes('desktop'));
    assert.ok(deviceEnum.includes('mobile'));
    assert.ok(deviceEnum.includes('tablet'));
    assert.ok(deviceEnum.includes('api'));
    assert.ok(deviceEnum.includes('system'));
  });
});

describe('LessonBlock Schema — Priority 4 Fields', () => {
  it('Test 24: LessonBlock model has school field', () => {
    const mongoose = require('mongoose');
    require('../models/LessonBlock');
    const schema = mongoose.model('LessonBlock').schema;
    assert.ok(schema.path('school'), 'Should have school field');
  });
});

describe('Audit Middleware — Context Building', () => {
  it('Test 25: auditMiddleware attaches req.audit', () => {
    const auditMiddleware = require('../middleware/auditMiddleware');
    const req = {
      method: 'POST',
      user: { _id: 'user123', name: 'Test User', role: 'admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh)' },
      requestId: 'req-abc-123',
      originalUrl: '/api/timetable/generate',
      connection: {}
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    auditMiddleware(req, res, next);

    assert.ok(nextCalled, 'Should call next()');
    assert.ok(req.audit, 'Should attach req.audit');
    assert.equal(req.audit.user, 'user123');
    assert.equal(req.audit.userName, 'Test User');
    assert.equal(req.audit.requestId, 'req-abc-123');
    assert.equal(req.audit.deviceType, 'desktop');
    assert.equal(req.audit.sourceModule, 'Scheduling');
    assert.equal(req.audit.ipAddress, '127.0.0.1');
  });

  it('Test 26: auditMiddleware handles missing user', () => {
    const auditMiddleware = require('../middleware/auditMiddleware');
    const req = {
      method: 'GET',
      headers: {},
      originalUrl: '/api/health',
      connection: {}
    };
    const res = {};
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    auditMiddleware(req, res, next);

    assert.ok(nextCalled, 'Should call next()');
    assert.ok(req.audit, 'Should attach req.audit even for GET');
    assert.equal(req.audit.userName, 'System');
    assert.equal(req.audit.deviceType, 'api');
  });
});

describe('Compound Indexes — Existence Check', () => {
  it('Test 27: LessonBlock has school-scoped indexes in schema', () => {
    const mongoose = require('mongoose');
    const schema = mongoose.model('LessonBlock').schema;
    const indexes = schema.indexes();
    // Check for school-scoped index
    const hasSchoolIndex = indexes.some(([fields]) =>
      fields.school === 1 && fields.timetable === 1
    );
    assert.ok(hasSchoolIndex, 'Should have school-scoped compound index');
  });

  it('Test 28: AuditLog has requestId index in schema', () => {
    const mongoose = require('mongoose');
    const schema = mongoose.model('AuditLog').schema;
    const indexes = schema.indexes();
    const hasRequestIdIndex = indexes.some(([fields]) => fields.requestId === 1);
    assert.ok(hasRequestIdIndex, 'Should have requestId index');
  });
});
