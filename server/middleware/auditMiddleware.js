/**
 * Audit Middleware — attaches audit context to every mutating request.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Controllers can access `req.audit` to include user/IP/module metadata
 * when creating AuditLog entries.
 *
 * Priority 4: Added requestId, deviceType, sourceModule, school/session.
 *
 * Usage in controllers:
 *   const { user, userName, userRole, ipAddress, userAgent, requestId,
 *           deviceType, sourceModule, school, sessionId } = req.audit;
 */
module.exports = function auditMiddleware(req, res, next) {
  // Attach audit context for all requests (not just mutating)
  // so that GET-triggered audit entries also have context
  req.audit = {
    user: req.user?._id || null,
    userName: req.user?.name || 'System',
    userRole: req.user?.role || 'unknown',
    school: req.schoolId || req.user?.activeSchool || null,
    sessionId: req.user?.activeSession || null,
    ipAddress: req.ip || req.connection?.remoteAddress || '',
    userAgent: req.headers?.['user-agent'] || '',
    requestId: req.requestId || null,
    deviceType: detectDeviceType(req.headers?.['user-agent']),
    sourceModule: detectModule(req.originalUrl),
    source: 'api',
    timestamp: new Date()
  };
  next();
};

/**
 * Detect device type from User-Agent string.
 * Returns: 'mobile', 'tablet', 'desktop', or 'api'
 */
function detectDeviceType(ua) {
  if (!ua) return 'api';
  const lower = ua.toLowerCase();

  // API clients / bots
  if (lower.includes('postman') || lower.includes('insomnia') || lower.includes('curl') || lower.includes('httpie')) {
    return 'api';
  }

  // Mobile patterns
  if (/iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|opera mobi/i.test(lower)) {
    return 'mobile';
  }

  // Tablet patterns
  if (/ipad|android(?!.*mobile)|tablet|kindle|silk/i.test(lower)) {
    return 'tablet';
  }

  // Desktop (anything with a desktop browser UA)
  if (/mozilla|chrome|safari|firefox|edge|opera/i.test(lower)) {
    return 'desktop';
  }

  return 'api';
}

/**
 * Auto-detect module from URL path.
 */
function detectModule(url) {
  if (!url) return 'System';
  if (url.includes('/auth')) return 'Authentication';
  if (url.includes('/generation') || url.includes('/generator')) return 'Scheduling';
  // Operations must be checked BEFORE master data (teacher/class) to catch /teachers/:id/replace
  if (url.includes('/absence') || url.includes('/substitut') || url.includes('/replace')) return 'Operations';
  if (url.includes('/conflict')) return 'Conflict Resolution';
  if (url.includes('/timetable')) return 'Scheduling';
  if (url.includes('/teacher') || url.includes('/class') || url.includes('/subject') || url.includes('/room')) return 'Master Data';
  if (url.includes('/user') || url.includes('/audit') || url.includes('/setting') || url.includes('/school')) return 'Administration';
  if (url.includes('/setup') || url.includes('/period') || url.includes('/requirement') || url.includes('/rule') || url.includes('/combination')) return 'Configuration';
  if (url.includes('/report') || url.includes('/analytics') || url.includes('/export')) return 'Reporting';
  if (url.includes('/notification')) return 'Notifications';
  return 'System';
}

// Export helpers for testing
module.exports.detectDeviceType = detectDeviceType;
module.exports.detectModule = detectModule;
