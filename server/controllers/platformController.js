const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const AcademicSession = require('../models/AcademicSession');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const mongoose = require('mongoose');

// GET /api/platform/schools — list all schools (platform only)
exports.getSchools = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [schools, total] = await Promise.all([
      School.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      School.countDocuments(filter)
    ]);

    // Enrich with session and timetable counts
    const enriched = await Promise.all(schools.map(async s => {
      const obj = s.toObject();
      obj.sessionCount = await AcademicSession.countDocuments({ school: s._id });
      obj.timetableCount = await GeneratedTimetable.countDocuments({ school: s._id });
      obj.userCount = await User.countDocuments({ 'schools.school': s._id });
      return obj;
    }));

    res.json({ success: true, count: enriched.length, total, data: enriched });
  } catch (err) { next(err); }
};

/**
 * POST /api/platform/schools — create a new school with admin user and session.
 * 
 * This is the unified endpoint for creating any new school.
 * Creates: School + AcademicSession + Admin User (if email provided).
 * Does NOT create: teachers, classes, subjects, rooms, requirements, timetables.
 * 
 * Payload:
 * {
 *   name: "School Name",
 *   code: "SCH001",
 *   address: "...",
 *   phone: "...",
 *   email: "school@example.com",
 *   adminName: "Admin Name",
 *   adminEmail: "admin@school.com",
 *   adminPassword: "password123",
 *   session: { name: "2026-27", startDate: "...", endDate: "..." }
 * }
 */
exports.createSchool = async (req, res, next) => {
  try {
    const { adminName, adminEmail, adminPassword, session: sessionData, ...schoolData } = req.body;

    // Create school
    const school = await School.create(schoolData);

    // Create academic session (use provided session data or defaults)
    const sessionName = sessionData?.name || `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`;
    const startDate = sessionData?.startDate || new Date(`${new Date().getFullYear()}-04-01`);
    const endDate = sessionData?.endDate || new Date(`${new Date().getFullYear() + 1}-03-31`);

    const session = await AcademicSession.create({
      school: school._id,
      name: sessionName,
      startDate,
      endDate,
      isCurrent: true,
      status: 'active'
    });

    let adminResult = null;

    // Create school admin user if email provided
    if (adminEmail) {
      // Check for duplicate
      const existing = await User.findOne({ email: adminEmail.toLowerCase() });
      if (existing) {
        return res.status(400).json({ success: false, error: `Admin email "${adminEmail}" already exists. School was created but admin user was not.`, data: { school, session } });
      }

      // Generate password if not provided
      const crypto = require('crypto');
      const tempPassword = adminPassword || crypto.randomBytes(6).toString('base64url').slice(0, 12);

      const allPermissions = [
        'view_timetable', 'generate_timetable', 'edit_setup', 'manage_teachers',
        'manage_rules', 'approve_substitutions', 'publish_timetable', 'view_audit',
        'manage_users', 'manage_school', 'export_reports', 'edit_timetable',
        'manage_absences', 'manage_replacements'
      ];

      const adminUser = new User({
        name: adminName || 'School Admin',
        email: adminEmail.toLowerCase(),
        password: tempPassword,
        role: 'school_admin',
        isActive: true,
        activeSchool: school._id,
        activeSession: session._id,
        schools: [{
          school: school._id,
          role: 'school_admin',
          permissions: allPermissions,
          isActive: true
        }]
      });
      await adminUser.save();

      adminResult = {
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        tempPassword: tempPassword,
        role: 'school_admin'
      };

      // Audit log
      await AuditLog.create({
        school: school._id,
        action: 'user_create',
        entityType: 'user',
        entityId: adminUser._id,
        source: 'platform',
        user: req.user?._id,
        newValue: { email: adminUser.email, role: 'school_admin', schoolName: school.name }
      });
    }

    await AuditLog.create({
      school: school._id,
      action: 'school_create',
      entityType: 'school',
      entityId: school._id,
      source: 'platform',
      user: req.user?._id,
      newValue: { name: school.name, code: school.code, hasAdmin: !!adminResult }
    });

    res.status(201).json({
      success: true,
      data: { school, session, admin: adminResult },
      message: 'School created successfully'
    });
  } catch (err) { next(err); }
};

// PUT /api/platform/schools/:id — update school
exports.updateSchool = async (req, res, next) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
};

// PUT /api/platform/schools/:id/deactivate — soft-delete school
exports.deactivateSchool = async (req, res, next) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
    if (!school) return res.status(404).json({ success: false, error: 'School not found' });
    res.json({ success: true, data: school });
  } catch (err) { next(err); }
};

// GET /api/platform/users — list platform-level users
exports.getPlatformUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {
      role: { $in: ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager'] }
    };
    if (role) filter.role = role;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password -refreshToken').sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    res.json({ success: true, count: users.length, total, data: users });
  } catch (err) { next(err); }
};

// GET /api/platform/audit-logs — global audit log viewer
exports.getGlobalAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, school, from, to, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (school) filter.school = school;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('user', 'name email role').populate('school', 'name')
        .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);

    res.json({ success: true, count: logs.length, total, data: logs });
  } catch (err) { next(err); }
};

// GET /api/platform/stats — platform-wide statistics
exports.getPlatformStats = async (req, res, next) => {
  try {
    const [schoolCount, userCount, timetableCount, recentAudit] = await Promise.all([
      School.countDocuments(),
      User.countDocuments(),
      GeneratedTimetable.countDocuments(),
      AuditLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
    ]);

    // DB stats
    const dbStats = await mongoose.connection.db.stats();

    res.json({
      success: true,
      data: {
        schools: schoolCount,
        users: userCount,
        timetables: timetableCount,
        auditLogsLast24h: recentAudit,
        database: {
          collections: dbStats.collections,
          dataSize: `${(dbStats.dataSize / (1024 * 1024)).toFixed(2)} MB`,
          storageSize: `${(dbStats.storageSize / (1024 * 1024)).toFixed(2)} MB`,
          indexes: dbStats.indexes
        },
        serverUptime: process.uptime(),
        memoryUsage: {
          rss: `${(process.memoryUsage().rss / (1024 * 1024)).toFixed(2)} MB`,
          heapUsed: `${(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)} MB`
        }
      }
    });
  } catch (err) { next(err); }
};
