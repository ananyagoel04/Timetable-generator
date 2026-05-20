const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const School = require('../models/School');

router.get('/', async (req, res, next) => {
  try {
    const school = await School.findOne();
    const { action, entityType, user, from, to, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (school) filter.school = school._id;
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (user) filter.user = user;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).populate('user affectedTeacher affectedClass affectedRoom').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AuditLog.countDocuments(filter)
    ]);
    res.json({ success: true, count: logs.length, total, page: parseInt(page), data: logs });
  } catch (err) { next(err); }
});

module.exports = router;
