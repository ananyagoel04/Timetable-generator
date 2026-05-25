const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto'); // Built-in node module

exports.getUsers = async (req, res, next) => {
  try {
    const schoolId = req.query.school || req.user?.activeSchool;
    let filter = {};
    if (schoolId) {
      filter = { 'schools.school': schoolId };
    }
    
    const users = await User.find(filter).populate('schools.school', 'name');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) { next(err); }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const schoolId = req.query.school || req.user?.activeSchool;

    // Check if user exists
    let existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    let schoolRef;
    if (schoolId) {
      schoolRef = await School.findById(schoolId);
    } else {
      schoolRef = await School.findOne();
    }

    const newUser = new User({
      name,
      email,
      password, // Mongoose pre-save hook handles hashing
      role: role || 'teacher',
      permissions: permissions || {},
      isActive: true,
      activeSchool: schoolRef ? schoolRef._id : undefined,
      schools: schoolRef ? [{ school: schoolRef._id, role: role || 'teacher', isPrimary: true }] : []
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
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.name = name || user.name;
    user.email = email || user.email;
    if (role) user.role = role;
    if (permissions) user.permissions = { ...user.permissions, ...permissions };

    await user.save();

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
};

exports.toggleUserActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();

    await AuditLog.create({
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

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    user.password = newPassword;
    await user.save(); // triggers pre-save hook

    await AuditLog.create({
      action: 'update',
      entityType: 'user',
      entityId: user._id,
      source: 'manual',
      newValue: { password: 'reset' }
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
};
