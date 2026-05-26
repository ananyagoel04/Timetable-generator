/**
 * Audit Middleware — attaches audit context to every mutating request.
 * Controllers can access `req.audit` to include user/IP/module metadata
 * when creating AuditLog entries.
 *
 * Usage in controllers:
 *   const { user, userName, userRole, ipAddress, userAgent, module } = req.audit;
 */
module.exports = function auditMiddleware(req, res, next) {
  // Only attach for mutating methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    req.audit = {
      user: req.user?._id || null,
      userName: req.user?.name || 'System',
      userRole: req.user?.role || 'unknown',
      ipAddress: req.ip || req.connection?.remoteAddress || '',
      userAgent: req.headers?.['user-agent'] || '',
      module: detectModule(req.originalUrl),
      timestamp: new Date()
    };
  }
  next();
};

/**
 * Auto-detect module from URL path
 */
function detectModule(url) {
  if (!url) return 'System';
  if (url.includes('/auth')) return 'Authentication';
  if (url.includes('/timetable') || url.includes('/generator')) return 'Scheduling';
  if (url.includes('/teacher') || url.includes('/class') || url.includes('/subject') || url.includes('/room')) return 'Master Data';
  if (url.includes('/absence') || url.includes('/substitut') || url.includes('/replace')) return 'Operations';
  if (url.includes('/conflict')) return 'Conflict Resolution';
  if (url.includes('/user') || url.includes('/audit') || url.includes('/setting') || url.includes('/school')) return 'Administration';
  if (url.includes('/setup') || url.includes('/period') || url.includes('/requirement') || url.includes('/rule') || url.includes('/combination')) return 'Configuration';
  return 'System';
}
