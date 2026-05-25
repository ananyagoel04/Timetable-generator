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

// POST /api/platform/schools — create a new school
exports.createSchool = async (req, res, next) => {
  try {
    const school = await School.create(req.body);
    // Auto-create a default academic session
    await AcademicSession.create({
      school: school._id,
      name: `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(2)}`,
      startDate: new Date(`${new Date().getFullYear()}-04-01`),
      endDate: new Date(`${new Date().getFullYear() + 1}-03-31`),
      isCurrent: true,
      status: 'active'
    });
    res.status(201).json({ success: true, data: school });
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
