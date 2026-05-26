const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Room = require('../models/Room');
const ConflictLog = require('../models/ConflictLog');
const AIRecommendationEngine = require('../services/engine/AIRecommendationEngine');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * GET /api/analytics/dashboard
 * Aggregated analytics summary for the active school
 */
exports.getDashboardAnalytics = async (req, res, next) => {
  try {
    const schoolId = req.schoolId;
    const timetable = await GeneratedTimetable.findOne({ school: schoolId })
      .sort({ createdAt: -1 });

    if (!timetable) {
      return res.json({ success: true, data: { hasData: false } });
    }

    const blocks = await LessonBlock.find({ timetable: timetable._id, type: { $ne: 'reserved' } });
    const conflicts = await ConflictLog.countDocuments({ timetable: timetable._id });
    const [teachers, classes, rooms] = await Promise.all([
      Teacher.find({ school: schoolId }),
      Class.find({ school: schoolId }),
      Room.find({ school: schoolId })
    ]);

    // Teacher utilization
    const teacherLoads = {};
    for (const b of blocks) {
      if (!b.teacher) continue;
      const tid = b.teacher.toString();
      teacherLoads[tid] = (teacherLoads[tid] || 0) + 1;
    }
    const avgTeacherLoad = teachers.length > 0
      ? Object.values(teacherLoads).reduce((s, v) => s + v, 0) / teachers.length : 0;

    // Room utilization
    const roomUsage = {};
    for (const b of blocks) {
      if (!b.room) continue;
      roomUsage[b.room.toString()] = (roomUsage[b.room.toString()] || 0) + 1;
    }
    const totalRoomSlots = rooms.length * DAYS.length * 8;
    const usedRoomSlots = Object.values(roomUsage).reduce((s, v) => s + v, 0);

    res.json({
      success: true,
      data: {
        hasData: true,
        timetableId: timetable._id,
        timetableStatus: timetable.status,
        qualityScore: timetable.stats?.softRuleScore || 0,
        totalBlocks: blocks.length,
        conflicts,
        teacherStats: {
          total: teachers.length,
          assigned: Object.keys(teacherLoads).length,
          avgLoad: Math.round(avgTeacherLoad * 10) / 10,
          maxLoad: Object.values(teacherLoads).length > 0 ? Math.max(...Object.values(teacherLoads)) : 0,
          minLoad: Object.values(teacherLoads).length > 0 ? Math.min(...Object.values(teacherLoads)) : 0
        },
        roomStats: {
          total: rooms.length,
          used: Object.keys(roomUsage).length,
          utilization: totalRoomSlots > 0 ? Math.round((usedRoomSlots / totalRoomSlots) * 100) : 0
        },
        classStats: {
          total: classes.length
        },
        generatedAt: timetable.generatedAt,
        generationTimeMs: timetable.stats?.generationTimeMs
      }
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/teacher-heatmap?timetableId=X
 * Teacher workload heatmap data (days × periods)
 */
exports.getTeacherHeatmap = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const blocks = await LessonBlock.find({ timetable: timetableId, teacher: { $exists: true } })
      .populate('teacher', 'name shortCode')
      .populate('subject', 'name shortCode');

    const teachers = await Teacher.find({ school: req.schoolId }).select('name shortCode');

    // Build heatmap: teacher → day → period → count
    const heatmap = {};
    for (const t of teachers) {
      const tid = t._id.toString();
      heatmap[tid] = {
        name: t.name,
        shortCode: t.shortCode || t.name.substring(0, 3),
        days: {}
      };
      for (const d of DAYS) {
        heatmap[tid].days[d] = {};
      }
    }

    for (const b of blocks) {
      const tid = b.teacher?._id?.toString() || b.teacher?.toString();
      if (!tid || !heatmap[tid]) continue;
      for (const p of (b.periods || [])) {
        heatmap[tid].days[b.day] = heatmap[tid].days[b.day] || {};
        heatmap[tid].days[b.day][p] = (heatmap[tid].days[b.day][p] || 0) + 1;
      }
    }

    // Calculate daily totals
    for (const tid of Object.keys(heatmap)) {
      heatmap[tid].dailyTotals = {};
      heatmap[tid].weeklyTotal = 0;
      for (const d of DAYS) {
        const dayTotal = Object.values(heatmap[tid].days[d] || {}).reduce((s, v) => s + v, 0);
        heatmap[tid].dailyTotals[d] = dayTotal;
        heatmap[tid].weeklyTotal += dayTotal;
      }
    }

    res.json({ success: true, data: Object.values(heatmap) });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/room-efficiency?timetableId=X
 * Room usage efficiency scores
 */
exports.getRoomEfficiency = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const blocks = await LessonBlock.find({ timetable: timetableId, room: { $exists: true } });
    const rooms = await Room.find({ school: req.schoolId });

    const totalPeriodsPerWeek = DAYS.length * 8; // assume 8 periods max
    const efficiency = rooms.map(room => {
      const rid = room._id.toString();
      const roomBlocks = blocks.filter(b => b.room?.toString() === rid);
      const usedSlots = roomBlocks.length;
      const utilization = Math.round((usedSlots / totalPeriodsPerWeek) * 100);

      // Capacity efficiency: avg students vs capacity
      const avgStudents = roomBlocks.length > 0
        ? Math.round(roomBlocks.reduce((s, b) => s + (b.studentCount || 30), 0) / roomBlocks.length)
        : 0;
      const capacityEfficiency = room.capacity > 0
        ? Math.round((avgStudents / room.capacity) * 100) : 0;

      return {
        roomId: room._id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        usedSlots,
        totalSlots: totalPeriodsPerWeek,
        utilization,
        capacityEfficiency: Math.min(100, capacityEfficiency),
        overallScore: Math.round((utilization * 0.6 + Math.min(100, capacityEfficiency) * 0.4))
      };
    });

    efficiency.sort((a, b) => b.overallScore - a.overallScore);
    res.json({ success: true, data: efficiency });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/subject-heatmap?timetableId=X
 * Subject distribution heatmap across days/periods per class
 */
exports.getSubjectHeatmap = async (req, res, next) => {
  try {
    const { timetableId, classId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const query = { timetable: timetableId, subject: { $exists: true } };
    if (classId) query.classes = classId;

    const blocks = await LessonBlock.find(query)
      .populate('subject', 'name shortCode color')
      .populate('classes', 'name section');

    // Build: subject → day → count
    const subjectDist = {};
    for (const b of blocks) {
      const sid = b.subject?._id?.toString();
      const sName = b.subject?.name || 'Unknown';
      if (!sid) continue;
      if (!subjectDist[sid]) {
        subjectDist[sid] = { name: sName, shortCode: b.subject?.shortCode, color: b.subject?.color, days: {} };
        for (const d of DAYS) subjectDist[sid].days[d] = 0;
      }
      subjectDist[sid].days[b.day] = (subjectDist[sid].days[b.day] || 0) + (b.periods?.length || 1);
    }

    res.json({ success: true, data: Object.values(subjectDist) });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/ai-recommendations?timetableId=X
 * AI-powered scheduling recommendations
 */
exports.getAIRecommendations = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const timetable = await GeneratedTimetable.findById(timetableId);
    if (!timetable) return res.status(404).json({ success: false, error: 'Timetable not found' });

    const [blocks, teachers, classes, rooms] = await Promise.all([
      LessonBlock.find({ timetable: timetableId }),
      Teacher.find({ school: timetable.school }),
      Class.find({ school: timetable.school }),
      Room.find({ school: timetable.school })
    ]);

    const engine = new AIRecommendationEngine({
      placedBlocks: blocks,
      errors: timetable.unplacedItems || [],
      score: { total: timetable.stats?.softRuleScore || 0, factors: {} },
      teachers, classes, rooms
    });

    const result = engine.analyze();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/generation-history
 * Historical generation comparisons
 */
exports.getGenerationHistory = async (req, res, next) => {
  try {
    const timetables = await GeneratedTimetable.find({ school: req.schoolId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('name status stats generatedAt createdAt unplacedItems');

    const history = timetables.map(t => ({
      id: t._id,
      name: t.name,
      status: t.status,
      generatedAt: t.generatedAt || t.createdAt,
      totalBlocks: t.stats?.totalBlocks || 0,
      unplaced: t.stats?.unplacedBlocks || t.unplacedItems?.length || 0,
      conflicts: t.stats?.hardConflicts || 0,
      qualityScore: t.stats?.softRuleScore || 0,
      generationTimeMs: t.stats?.generationTimeMs || 0,
      seed: t.stats?.seed
    }));

    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};
