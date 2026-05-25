const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const AuditLog = require('../models/AuditLog');
const { protect, JWT_SECRET } = require('../middleware/auth');
const { validateRegister, validateLogin, validateForgotPassword, validateResetPassword, validateSwitchSchool } = require('../middleware/validators');

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email, password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, error: 'Email already registered' });

    // Auto-attach to school
    const school = await School.findOne();
    const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });

    const user = await User.create({
      name, email, password, role: role || 'school_admin',
      schools: school ? [{ school: school._id, role: role || 'school_admin', permissions: ['view_timetable','generate_timetable','edit_setup','manage_teachers','manage_rules','approve_substitutions','publish_timetable','view_audit','manage_users','manage_school','export_reports','edit_timetable','manage_absences','manage_replacements'] }] : [],
      activeSchool: school?._id, activeSession: session?._id
    });

    const token = signToken(user._id);
    await AuditLog.create({ school: school?._id, user: user._id, userName: name, userRole: role, action: 'login', entityType: 'user', source: 'system_action' });

    res.status(201).json({ success: true, data: { token, user: { _id: user._id, name: user.name, email: user.email, role: user.role, activeSchool: user.activeSchool, activeSession: user.activeSession, schools: user.schools } } });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

    const user = await User.findOne({ email, isActive: true }).select('+password').populate('schools.school');
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLog.create({ userName: email, action: 'failed_login', entityType: 'user', source: 'system_action' });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save({ validateModifiedOnly: true });

    const token = signToken(user._id);
    await AuditLog.create({ school: user.activeSchool, user: user._id, userName: user.name, userRole: user.role, action: 'login', entityType: 'user', source: 'system_action' });

    res.json({ success: true, data: { token, user: { _id: user._id, name: user.name, email: user.email, role: user.role, activeSchool: user.activeSchool, activeSession: user.activeSession, schools: user.schools } } });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).populate('schools.school activeSchool activeSession');
  res.json({ success: true, data: user });
});

// PUT /api/auth/switch-school
router.put('/switch-school', protect, validateSwitchSchool, async (req, res, next) => {
  try {
    const { schoolId, sessionId } = req.body;
    const user = await User.findById(req.user._id);
    const hasMembership = user.schools.some(s => s.school.toString() === schoolId && s.isActive);
    if (!hasMembership && !['platform_owner','platform_support'].includes(user.role)) {
      return res.status(403).json({ success: false, error: 'No access to this school' });
    }
    user.activeSchool = schoolId;
    if (sessionId) user.activeSession = sessionId;
    await user.save();
    await AuditLog.create({ school: schoolId, user: user._id, userName: user.name, action: 'school_switch', entityType: 'user', source: 'manual' });
    res.json({ success: true, data: { activeSchool: schoolId, activeSession: user.activeSession } });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh — Refresh token rotation (item #12)
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: 'Refresh token required' });
    const user = await User.findOne({ refreshToken }).select('+refreshToken');
    if (!user || !user.isActive) return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    // Rotate tokens
    const newAccessToken = signToken(user._id);
    const crypto = require('crypto');
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    user.refreshToken = newRefreshToken;
    await user.save({ validateModifiedOnly: true });
    res.json({ success: true, data: { token: newAccessToken, refreshToken: newRefreshToken } });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — Generate reset token (item #11)
router.post('/forgot-password', validateForgotPassword, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.json({ success: true, message: 'If account exists, reset token generated' }); // Don't leak
    // Generate time-limited reset token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const bcrypt = require('bcryptjs');
    user.passwordResetToken = await bcrypt.hash(resetToken, 10);
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save({ validateModifiedOnly: true });
    // In production: send email with reset link. For dev: return token.
    const response = { success: true, message: 'Password reset token generated (30 min validity)' };
    if (process.env.NODE_ENV === 'development') response.resetToken = resetToken;
    res.json(response);
  } catch (err) { next(err); }
});

// POST /api/auth/reset-password
router.post('/reset-password', validateResetPassword, async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) return res.status(400).json({ success: false, error: 'Email, resetToken, and newPassword required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    const user = await User.findOne({ email, isActive: true }).select('+passwordResetToken');
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }
    if (user.passwordResetExpires < new Date()) {
      return res.status(400).json({ success: false, error: 'Reset token has expired' });
    }
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(resetToken, user.passwordResetToken);
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid reset token' });
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    await AuditLog.create({ user: user._id, userName: user.name, action: 'update', entityType: 'user', source: 'manual', reason: 'Password reset' });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

module.exports = router;

