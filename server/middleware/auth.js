const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'timecraft-secret-key-2025';

// Protect routes - verify JWT token
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

// Check if user has specific permission for active school
exports.authorize = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authorized' });

    // Platform-level roles bypass permission checks
    if (['platform_owner', 'platform_support'].includes(req.user.role)) return next();

    const activeSchoolId = req.user.activeSchool?.toString();
    const membership = req.user.schools?.find(s => s.school?.toString() === activeSchoolId && s.isActive);
    if (!membership) return res.status(403).json({ success: false, error: 'No access to this school' });

    // School owner bypasses permission checks
    if (membership.role === 'school_owner') return next();

    const hasPermission = permissions.some(p => membership.permissions?.includes(p));
    if (!hasPermission) return res.status(403).json({ success: false, error: `Missing permission: ${permissions.join(' or ')}` });

    next();
  };
};

// Inject school/session scope from user context
exports.scopeToSchool = (req, res, next) => {
  const schoolId = req.headers['x-school-id'] || req.user?.activeSchool;
  const sessionId = req.headers['x-session-id'] || req.user?.activeSession;
  if (schoolId) req.schoolId = schoolId;
  if (sessionId) req.sessionId = sessionId;
  next();
};

exports.JWT_SECRET = JWT_SECRET;
