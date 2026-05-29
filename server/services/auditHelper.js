/**
 * Audit Helper — Reusable audit log creation with full metadata
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Creates AuditLog entries with all production-grade metadata fields
 * including requestId, deviceType, sourceModule, IP, user-agent.
 *
 * Supports optional MongoDB session for transactional audit logging.
 *
 * Usage:
 *   const { createAuditEntry } = require('./auditHelper');
 *   await createAuditEntry({
 *     req,                    // Express request object (for metadata)
 *     session,                // MongoDB session (optional, for transactions)
 *     action: 'move',
 *     entityType: 'lesson_block',
 *     entityId: block._id,
 *     entityName: 'Math - 10A',
 *     oldValue: { day: 'Monday', periods: [1] },
 *     newValue: { day: 'Tuesday', periods: [3] },
 *     reason: 'Resolve teacher conflict'
 *   });
 */
const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry with full metadata.
 * @param {Object} opts
 * @param {Object} opts.req - Express request (provides audit context)
 * @param {Object} [opts.session] - MongoDB session for transactional writes
 * @param {string} opts.action - Action enum value
 * @param {string} opts.entityType - Entity type enum value
 * @param {ObjectId|string} [opts.entityId] - Entity ID
 * @param {string} [opts.entityName] - Human-readable entity name
 * @param {*} [opts.oldValue] - Previous state
 * @param {*} [opts.newValue] - New state
 * @param {string} [opts.reason] - Reason for the action
 * @param {ObjectId|string} [opts.schoolId] - Override school ID
 * @param {ObjectId|string} [opts.sessionId] - Academic session override
 * @param {string} [opts.sourceOverride] - Override source (default: from audit middleware)
 */
async function createAuditEntry(opts) {
  const {
    req, session, action, entityType, entityId, entityName,
    oldValue, newValue, reason, schoolId, sessionId, sourceOverride
  } = opts;

  const audit = req?.audit || {};

  const entry = {
    school: schoolId || audit.school || req?.schoolId || req?.user?.activeSchool,
    session: sessionId || audit.sessionId || req?.user?.activeSession,
    user: audit.user || req?.user?._id,
    userName: audit.userName || req?.user?.name || 'System',
    userRole: audit.userRole || req?.user?.role || 'system',
    action,
    entityType,
    entityId: entityId || undefined,
    entityName: entityName || undefined,
    source: sourceOverride || audit.source || 'manual',
    oldValue: oldValue || undefined,
    newValue: newValue || undefined,
    reason: reason || undefined,
    // Production metadata
    ipAddress: audit.ipAddress || req?.ip || '',
    userAgent: audit.userAgent || req?.headers?.['user-agent'] || '',
    requestId: audit.requestId || req?.requestId || undefined,
    deviceType: audit.deviceType || 'api',
    sourceModule: audit.sourceModule || 'System',
  };

  // Remove undefined values to keep documents clean
  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }

  try {
    if (session) {
      // Transactional write
      return await AuditLog.create([entry], { session });
    }
    return await AuditLog.create(entry);
  } catch (err) {
    // Audit logging should never break the primary operation
    console.error('[AuditHelper] Audit log creation failed (non-fatal):', err.message);
    return null;
  }
}

/**
 * Create a system-level audit entry (no request context).
 * Used by workers, cron jobs, and system processes.
 */
async function createSystemAuditEntry({ schoolId, sessionId, action, entityType, entityId, entityName, oldValue, newValue, reason, sourceModule, session }) {
  const entry = {
    school: schoolId,
    session: sessionId,
    action,
    entityType,
    entityId,
    entityName,
    source: 'system_action',
    oldValue,
    newValue,
    reason,
    sourceModule: sourceModule || 'System',
    userName: 'System',
    userRole: 'system',
    deviceType: 'system'
  };

  for (const key of Object.keys(entry)) {
    if (entry[key] === undefined) delete entry[key];
  }

  try {
    if (session) return await AuditLog.create([entry], { session });
    return await AuditLog.create(entry);
  } catch (err) {
    console.error('[AuditHelper] System audit log failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { createAuditEntry, createSystemAuditEntry };
