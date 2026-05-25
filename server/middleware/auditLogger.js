const AuditLog = require('../models/AuditLog');

// Map route patterns to action + entityType
const ROUTE_MAP = {
  'POST /api/auth/login': { action: 'login', entityType: 'user' },
  'POST /api/auth/register': { action: 'user_create', entityType: 'user' },
  'POST /api/teachers': { action: 'create', entityType: 'teacher' },
  'PUT /api/teachers': { action: 'update', entityType: 'teacher' },
  'DELETE /api/teachers': { action: 'delete', entityType: 'teacher' },
  'POST /api/subjects': { action: 'create', entityType: 'subject' },
  'PUT /api/subjects': { action: 'update', entityType: 'subject' },
  'DELETE /api/subjects': { action: 'delete', entityType: 'subject' },
  'POST /api/classes': { action: 'create', entityType: 'class' },
  'PUT /api/classes': { action: 'update', entityType: 'class' },
  'DELETE /api/classes': { action: 'delete', entityType: 'class' },
  'POST /api/rooms': { action: 'create', entityType: 'room' },
  'PUT /api/rooms': { action: 'update', entityType: 'room' },
  'DELETE /api/rooms': { action: 'delete', entityType: 'room' },
  'POST /api/requirements': { action: 'subject_load_change', entityType: 'requirement' },
  'PUT /api/requirements': { action: 'subject_load_change', entityType: 'requirement' },
  'DELETE /api/requirements': { action: 'delete', entityType: 'requirement' },
  'POST /api/rules': { action: 'rule_change', entityType: 'custom_rule' },
  'PUT /api/rules': { action: 'rule_change', entityType: 'custom_rule' },
  'DELETE /api/rules': { action: 'delete', entityType: 'custom_rule' },
  'POST /api/timetable/generate': { action: 'generate', entityType: 'timetable' },
  'PUT /api/timetable': { action: 'manual_edit', entityType: 'lesson_block' },
  'POST /api/absences': { action: 'absence_create', entityType: 'absence' },
  'PUT /api/absences': { action: 'update', entityType: 'absence' },
  'POST /api/substitutions': { action: 'substitution_approve', entityType: 'substitution' },
  'PUT /api/substitutions': { action: 'update', entityType: 'substitution' },
  'POST /api/users': { action: 'user_create', entityType: 'user' },
  'PUT /api/users': { action: 'user_update', entityType: 'user' },
  'DELETE /api/users': { action: 'delete', entityType: 'user' },
  'POST /api/can-teach': { action: 'create', entityType: 'teacher' },
  'PUT /api/can-teach': { action: 'update', entityType: 'teacher' },
  'DELETE /api/can-teach': { action: 'delete', entityType: 'teacher' },
  'PUT /api/auth/switch-school': { action: 'school_switch', entityType: 'user' },
};

/**
 * Automatic audit logger middleware. Logs all mutating HTTP requests.
 * Must be placed AFTER auth middleware so req.user is available.
 */
const auditLogger = async (req, res, next) => {
  // Only log mutating requests
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Capture the original res.json to log AFTER the response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Don't block the response — fire and forget
    setImmediate(async () => {
      try {
        if (res.statusCode >= 400) return; // Don't log failed requests

        // Find matching route pattern
        const basePath = req.originalUrl.split('?')[0].replace(/\/[a-f0-9]{24}/g, '');
        const key = `${req.method} ${basePath}`;
        const mapping = ROUTE_MAP[key] || { action: req.method === 'DELETE' ? 'delete' : req.method === 'POST' ? 'create' : 'update', entityType: 'system' };

        const logEntry = {
          school: req.schoolId || req.user?.activeSchool,
          session: req.sessionId || req.user?.activeSession,
          user: req.user?._id,
          userName: req.user?.name,
          userRole: req.user?.role,
          action: mapping.action,
          entityType: mapping.entityType,
          entityId: req.params?.id || body?.data?._id,
          entityName: req.body?.name || body?.data?.name,
          source: 'api',
          newValue: ['POST', 'PUT', 'PATCH'].includes(req.method) ? _sanitize(req.body) : undefined,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('User-Agent'),
        };

        await AuditLog.create(logEntry);
      } catch (err) {
        // Never let audit logging break the app
        console.error('Audit log error (non-critical):', err.message);
      }
    });

    return originalJson(body);
  };

  next();
};

function _sanitize(body) {
  if (!body) return undefined;
  const sanitized = { ...body };
  // Never log passwords
  delete sanitized.password;
  delete sanitized.confirmPassword;
  delete sanitized.currentPassword;
  delete sanitized.newPassword;
  return sanitized;
}

module.exports = auditLogger;
