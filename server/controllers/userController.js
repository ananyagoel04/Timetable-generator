const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto'); // Built-in node module
const { isPlatformRole, PLATFORM_ROLES } = require('../middleware/auth');

/**
 * Helper: verify target user belongs to requesting admin's school.
 * Returns { allowed: true } or { allowed: false, status, error }.
 */
const verifySchoolOwnership = (reqUser, targetUser, schoolId) => {
  if (isPlatformRole(reqUser?.role)) return { allowed: true };
  if (!schoolId) return { allowed: false, status: 400, error: 'School context required' };
  // Block modifying platform users
  if (isPlatformRole(targetUser?.role)) {
    return { allowed: false, status: 403, error: 'Cannot modify platform users' };
  }
  // Target user must belong to same school
  const targetInSchool = targetUser?.schools?.some(s =>
    s.school?.toString() === schoolId.toString()
  );
  if (!targetInSchool) {
    return { allowed: false, status: 403, error: 'User does not belong to your school' };
  }
  return { allowed: true };
};

exports.getUsers = async (req, res, next) => {
  try {
    const isPlatform = isPlatformRole(req.user?.role);
    let filter = {};

    if (isPlatform) {
      // Platform users: MUST use selected school context for school-scoped user list
      const schoolId = req.schoolId || req.query.school;
      if (schoolId) {
        // Show only users belonging to the selected school, excluding platform users
        filter = {
          'schools.school': schoolId,
          role: { $nin: PLATFORM_ROLES }
        };
      } else {
        // No school selected — return empty (platform users are in /api/platform/users)
        return res.json({ success: true, count: 0, data: [] });
      }
    } else {
      // School users MUST be scoped to their own school only
      const schoolId = req.schoolId || req.user?.activeSchool;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'School context required' });
      }
      // RBAC: exclude platform-level users from school admin view
      filter = {
        'schools.school': schoolId,
        role: { $nin: PLATFORM_ROLES }
      };

      // Non-admin school users see only themselves
      const membership = req.user?.schools?.find(s =>
        s.school?.toString() === schoolId.toString() && s.isActive
      );
      const isSchoolAdmin = membership?.role === 'school_owner' || membership?.role === 'school_admin' ||
                            req.user?.role === 'school_admin';
      if (!isSchoolAdmin) {
        filter._id = req.user._id;
      }
    }

    const users = await User.find(filter)
      .select('-password')
      .populate('schools.school', 'name');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const schoolId = req.schoolId || req.query.school || req.user?.activeSchool;

    // Check if user exists
    let existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    // Block school admin from creating platform roles
    if (!isPlatformRole(req.user?.role) && isPlatformRole(role)) {
      return res.status(403).json({ success: false, error: 'Cannot create platform-level users' });
    }

    let schoolRef;
    if (schoolId) {
      schoolRef = await School.findById(schoolId);
    } else if (req.schoolId) {
      schoolRef = await School.findById(req.schoolId);
    }

    const allPerms = permissions && Array.isArray(permissions) ? permissions :
      ['view_timetable', 'edit_setup', 'manage_teachers', 'manage_rules'];

    const newUser = new User({
      name,
      email,
      password, // Mongoose pre-save hook handles hashing
      role: role || 'teacher',
      isActive: true,
      activeSchool: schoolRef ? schoolRef._id : undefined,
      schools: schoolRef ? [{
        school: schoolRef._id,
        role: role || 'teacher',
        permissions: allPerms,
        isActive: true
      }] : []
    });

    await newUser.save();

    await AuditLog.create({
      school: schoolRef ? schoolRef._id : null,
      action: 'user_create',
      entityType: 'user',
      entityId: newUser._id,
      source: 'manual',
      newValue: { email: newUser.email, role: newUser.role }
    });

    // Remove password from response
    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({ success: true, data: userObj });
  } catch (err) { next(err); }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, permissions } = req.body;
    const schoolId = req.schoolId || req.user?.activeSchool;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // RBAC: verify school ownership
    const check = verifySchoolOwnership(req.user, user, schoolId);
    if (!check.allowed) return res.status(check.status).json({ success: false, error: check.error });

    user.name = name || user.name;
    user.email = email || user.email;
    if (role && !isPlatformRole(role)) user.role = role;
    if (permissions) {
      // Update school-level permissions
      const schoolMembership = user.schools?.find(s => s.school?.toString() === schoolId?.toString());
      if (schoolMembership && Array.isArray(permissions)) {
        schoolMembership.permissions = permissions;
      }
    }

    await user.save();

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.toggleUserActive = async (req, res, next) => {
  try {
    const schoolId = req.schoolId || req.user?.activeSchool;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // RBAC: verify school ownership
    const check = verifySchoolOwnership(req.user, user, schoolId);
    if (!check.allowed) return res.status(check.status).json({ success: false, error: check.error });

    user.isActive = !user.isActive;
    await user.save();

    await AuditLog.create({
      school: schoolId || null,
      action: 'update',
      entityType: 'user',
      entityId: user._id,
      source: 'manual',
      oldValue: { isActive: !user.isActive },
      newValue: { isActive: user.isActive }
    });

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const schoolId = req.schoolId || req.user?.activeSchool;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // RBAC: verify school ownership
    const check = verifySchoolOwnership(req.user, user, schoolId);
    if (!check.allowed) return res.status(check.status).json({ success: false, error: check.error });

    user.password = newPassword;
    await user.save(); // triggers pre-save hook

    await AuditLog.create({
      school: schoolId || null,
      action: 'update',
      entityType: 'user',
      entityId: user._id,
      source: 'manual',
      newValue: { password: 'reset' }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
};
