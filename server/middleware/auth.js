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
 * 
 * RBAC Rules:
 * - School users: ALWAYS use their own school from user.activeSchool. 
 *   Ignores any X-Selected-School-Id header (prevents cross-school spoofing).
 *   X-Session-Id header is accepted for session switching within own school.
 * - Platform users: Must use X-Selected-School-Id header for school-scoped APIs.
 *   Falls back to X-School-Id for backward compat.
 *   X-Session-Id header accepted for session context.
 */
exports.scopeToSchool = (req, res, next) => {
  if (isPlatformRole(req.user?.role)) {
    // Platform user: use selected school header
    const selectedSchool = req.headers['x-selected-school-id'] || req.headers['x-school-id'];
    if (selectedSchool) req.schoolId = selectedSchool.toString();
    // Session from header
    const sessionId = req.headers['x-session-id'];
    if (sessionId) req.sessionId = sessionId.toString();
  } else {
    // School user: ALWAYS use own school — never trust headers for school
    const schoolId = req.user?.activeSchool;
    if (schoolId) req.schoolId = schoolId.toString();
    // Session: allow header override within own school, fallback to activeSession
    const sessionId = req.headers['x-session-id'] || req.user?.activeSession;
    if (sessionId) req.sessionId = sessionId.toString();
  }
  next();
};

/**
 * Require school context - rejects requests without school scope.
 * Use on data routes that MUST have a school context.
 * Platform users are NOT exempt — they must select a school first.
 */
exports.requireSchoolContext = (req, res, next) => {
  if (!req.schoolId) {
    if (isPlatformRole(req.user?.role)) {
      return res.status(400).json({ 
        success: false, 
        error: 'SELECT_SCHOOL_REQUIRED',
        message: 'Please select a school before accessing school-scoped data.'
      });
    }
    return res.status(400).json({ success: false, error: 'School context required. Set X-School-Id header or select an active school.' });
  }
  next();
};

/**
 * Require session context - rejects requests without session scope.
 * Use on routes that need a specific session (reports, generator, requirements).
 */
exports.requireSessionContext = (req, res, next) => {
  if (!req.sessionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Session context required. Select an active session.'
    });
  }
  next();
};

exports.JWT_SECRET = JWT_SECRET;
exports.isPlatformRole = isPlatformRole;
exports.PLATFORM_ROLES = PLATFORM_ROLES;
