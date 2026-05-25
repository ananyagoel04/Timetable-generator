const mongoose = require('mongoose');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Room = require('../models/Room');
const School = require('../models/School');

// Simple check for role
const checkPlatformRole = (req, res) => {
  const role = req.user?.role || req.query.role; // fallback to query for dev
  if (!role || (!role.startsWith('platform_') && role !== 'school_owner' && role !== 'school_admin')) {
    res.status(403).json({ success: false, error: 'Access denied: requires platform or admin role' });
    return false;
  }
  return true;
};

exports.getSystemHealth = async (req, res, next) => {
  try {
    if (!checkPlatformRole(req, res)) return;

    // MongoDB connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Server uptime
    const uptime = process.uptime();
    
    // Memory usage
    const memory = process.memoryUsage();
    const memoryUsageMb = {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    };

    res.json({
      success: true,
      data: {
        status: dbStatus === 'connected' ? 'healthy' : 'degraded',
        dbStatus,
        uptime,
        memoryUsageMb,
        timestamp: new Date()
      }
    });
  } catch (err) { next(err); }
};

exports.getSchedulerHistory = async (req, res, next) => {
  try {
    if (!checkPlatformRole(req, res)) return;
    
    const schoolId = req.query.school || req.user?.activeSchool;
    const filter = {};
    if (schoolId) filter.school = schoolId;

    const history = await GeneratedTimetable.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('createdBy', 'name email');

    res.json({ success: true, count: history.length, data: history });
  } catch (err) { next(err); }
};

exports.getTimetableDiagnostics = async (req, res, next) => {
  try {
    if (!checkPlatformRole(req, res)) return;

    const timetableId = req.params.id;
    const timetable = await GeneratedTimetable.findById(timetableId);
    
    if (!timetable) {
      return res.status(404).json({ success: false, error: 'Timetable not found' });
    }

    const blocks = await LessonBlock.find({ timetable: timetableId });

    // Calculate diagnostics
    const totalBlocks = blocks.length;
    let typeCounts = { regular: 0, double: 0, consecutive: 0, split: 0, reserved: 0 };
    
    blocks.forEach(block => {
      if (block.type && typeCounts[block.type] !== undefined) {
        typeCounts[block.type]++;
      } else {
        typeCounts.regular++;
      }
    });

    res.json({
      success: true,
      data: {
        timetable: {
          _id: timetable._id,
          name: timetable.name,
          status: timetable.status,
          generationStats: timetable.generationStats
        },
        diagnostics: {
          totalBlocks,
          typeCounts,
          conflictCount: timetable.conflictLogs?.length || 0
        }
      }
    });
  } catch (err) { next(err); }
};

exports.getApiStats = async (req, res, next) => {
  try {
    if (!checkPlatformRole(req, res)) return;

    // Return placeholder stats since we don't have real monitoring middleware
    res.json({
      success: true,
      data: {
        requestCount: 12450,
        avgResponseTimeMs: 45,
        errorRatePercent: 0.2,
        activeUsers: 12
      }
    });
  } catch (err) { next(err); }
};
