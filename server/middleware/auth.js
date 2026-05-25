const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

// Platform-level roles that bypass school permission checks
const PLATFORM_ROLES = ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'];

/**
 * Check if a role is a platform-level role
 */
const isPlatformRole = (role) => PLATFORM_ROLES.includes(role);

/**
 * Protect routes - verify JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, error: 'Not authorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ success: false, error: 'User not found or inactive' });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Token invalid or expired' });
  }
};

/**
 * Check if user has specific permission(s) for active school.
 * Platform-level roles (owner, support, developer, qa, deployment) bypass all permission checks.
 * School owner bypasses school-level permission checks.
 */
exports.authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authorized' });

    // Platform-level roles bypass permission checks
    if (isPlatformRole(req.user.role)) return next();

    const activeSchoolId = req.schoolId || req.user.activeSchool?.toString();
    const membership = req.user.schools?.find(s =>
      s.school?.toString() === activeSchoolId && s.isActive
    );
    if (!membership) return res.status(403).json({ success: false, error: 'No access to this school' });

    // School owner bypasses permission checks
    if (membership.role === 'school_owner') return next();

    const hasPermission = permissions.some(p => membership.permissions?.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: `Missing permission: ${permissions.join(' or ')}` });
    }

    next();
  };
};

/**
 * Restrict route to platform-level users only
 */
exports.platformOnly = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Not authorized' });
  if (!isPlatformRole(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Platform-level access required' });
  }
  next();
};

/**
 * Inject school/session scope from headers or user context.
 * This runs on ALL protected routes and sets req.schoolId / req.sessionId.
 */
exports.scopeToSchool = (req, res, next) => {
  const schoolId = req.headers['x-school-id'] || req.user?.activeSchool;
  const sessionId = req.headers['x-session-id'] || req.user?.activeSession;
  if (schoolId) req.schoolId = schoolId.toString();
  if (sessionId) req.sessionId = sessionId.toString();
  next();
};

/**
 * Require school context - rejects requests without school scope.
 * Use on data routes that MUST have a school context.
 * Platform users are exempt (they can query cross-school).
 */
exports.requireSchoolContext = (req, res, next) => {
  if (isPlatformRole(req.user?.role)) return next();
  if (!req.schoolId) {
    return res.status(400).json({ success: false, error: 'School context required. Set X-School-Id header or select an active school.' });
  }
  next();
};

exports.JWT_SECRET = JWT_SECRET;
exports.isPlatformRole = isPlatformRole;
exports.PLATFORM_ROLES = PLATFORM_ROLES;
