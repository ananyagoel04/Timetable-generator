const express = require('express');
const router = express.Router();
const { authorize, isPlatformRole } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

router.get('/', authorize('view_audit'), async (req, res, next) => {
  try {
    const { action, entityType, module: auditModule, source, userId, from, to, limit = 50, page = 1 } = req.query;

    // Visibility rules:
    // Platform users: see ALL logs across all schools (can optionally filter by school)
    // School owner/admin: see all logs for their school
    // Teacher/other: see only their own logs + logs of their school-scoped subordinates
    const isPlatform = isPlatformRole(req.user?.role);

    const filter = {};

    if (isPlatform) {
      // Platform users see ALL logs across all schools
      if (req.query.school) filter.school = req.query.school;
      // No school filter = global view
    } else {
      // School users MUST be scoped to their school
      if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
      filter.school = req.schoolId;

      // Non-admin school users see only their own logs
      const membership = req.user?.schools?.find(s =>
        s.school?.toString() === req.schoolId && s.isActive
      );
      const isSchoolAdmin = membership?.role === 'school_owner' || membership?.role === 'school_admin' ||
                            req.user?.role === 'principal' || req.user?.role === 'timetable_manager';

      if (!isSchoolAdmin) {
        filter.user = req.user._id;
      }
    }

    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (source) filter.source = source;
    if (userId) filter.user = userId;

    // Module mapping
    if (auditModule) {
      if (auditModule === 'Authentication') filter.action = { $in: ['login', 'logout', 'failed_login'] };
      else if (auditModule === 'Scheduling') filter.entityType = { $in: ['timetable', 'LessonBlock', 'lesson_block'] };
      else if (auditModule === 'Master Data') filter.entityType = { $in: ['teacher', 'class', 'subject', 'room'] };
      else if (auditModule === 'Operations') filter.entityType = { $in: ['absence', 'substitution', 'replacement'] };
      else if (auditModule === 'System') filter.entityType = { $in: ['rule', 'user', 'settings', 'school'] };
    }

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
      AuditLog.find(filter)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);

    const mappedLogs = logs.map(l => {
      const obj = l.toObject ? l.toObject() : l;
      return {
        ...obj,
        userName: obj.performedBy?.name || obj.userName || 'System',
        userRole: obj.performedBy?.role || obj.userRole || '',
        userEmail: obj.performedBy?.email || ''
      };
    });

    res.json({
      success: true,
      count: mappedLogs.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: mappedLogs
    });
  } catch (err) { next(err); }
});

module.exports = router;
