const LessonBlock = require('../models/LessonBlock');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const Substitution = require('../models/Substitution');
const Absence = require('../models/Absence');
const Subject = require('../models/Subject');
const Room = require('../models/Room');

const getScope = async (req) => {
  const schoolId = req?.schoolId || (await School.findOne())?._id;
  const sessionId = req?.sessionId || (await AcademicSession.findOne({ school: schoolId, isCurrent: true }))?._id;
  return { schoolId, sessionId };
};

const DAYS_ORDER = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 };

// Day-wise: all classes for a given day (with total vs assigned period counts)
exports.getDayWiseReport = async (req, res, next) => {
  try {
    const { timetableId, day } = req.query;
    if (!timetableId || !day) return res.status(400).json({ success: false, error: 'timetableId and day required' });

    const { schoolId, sessionId } = await getScope(req);
    const classes = await Class.find({ school: schoolId, session: sessionId, isActive: true }).sort({ grade: 1, section: 1 });

    // Get period structure to calculate total schedulable periods
    const PeriodStructure = require('../models/PeriodStructure');
    const periodStructure = await PeriodStructure.findOne({ school: schoolId, status: 'active' });
    const totalSchedulablePeriods = periodStructure
      ? periodStructure.timeslots.filter(ts => ts.isSchedulable).length
      : 8;

    const blocks = await LessonBlock.find({ timetable: timetableId, day })
      .populate('subject teacher room classes').sort({ 'periods': 1 });

    // Group by class
    const report = classes.map(cls => {
      const classBlocks = blocks.filter(b => b.classes.some(c => (c._id || c).toString() === cls._id.toString()));
      const assignedPeriods = classBlocks.filter(b => b.type !== 'reserved').length;
      return {
        class: { _id: cls._id, name: cls.name, grade: cls.grade, section: cls.section },
        totalSchedulablePeriods,
        assignedPeriods,
        coveragePercent: Math.round((assignedPeriods / totalSchedulablePeriods) * 100),
        periods: classBlocks.map(b => ({
          period: b.periods[0],
          type: b.type,
          subject: b.subject ? { _id: b.subject._id, name: b.subject.name, color: b.subject.color, shortName: b.subject.shortName } : null,
          teacher: b.teacher ? { _id: b.teacher._id, name: b.teacher.name, shortName: b.teacher.shortName } : null,
          room: b.room ? { _id: b.room._id, name: b.room.name } : null,
          isLocked: b.isLocked
        })).sort((a, b) => a.period - b.period)
      };
    });

    const totalAssigned = report.reduce((s, r) => s + r.assignedPeriods, 0);
    const totalCapacity = report.reduce((s, r) => s + r.totalSchedulablePeriods, 0);

    res.json({
      success: true,
      data: {
        day, classCount: classes.length, report,
        summary: {
          totalSchedulablePeriods,
          totalAssignedAcrossClasses: totalAssigned,
          totalCapacityAcrossClasses: totalCapacity,
          overallCoverage: totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0
        }
      }
    });
  } catch (err) { next(err); }
};

// Class weekly: full week for one class
exports.getClassWeeklyReport = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const cls = await Class.findById(classId);
    if (!cls) return res.status(404).json({ success: false, error: 'Class not found' });

    const blocks = await LessonBlock.find({ timetable: timetableId, classes: classId })
      .populate('subject teacher room').sort({ day: 1, 'periods': 1 });

    // Group by day
    const days = {};
    blocks.forEach(b => {
      if (!days[b.day]) days[b.day] = [];
      days[b.day].push({
        period: b.periods[0], type: b.type,
        subject: b.subject ? { _id: b.subject._id, name: b.subject.name, color: b.subject.color, code: b.subject.code } : null,
        teacher: b.teacher ? { _id: b.teacher._id, name: b.teacher.name } : null,
        room: b.room ? { _id: b.room._id, name: b.room.name } : null,
        isLocked: b.isLocked, studentGroup: b.studentGroup
      });
    });

    // Sort each day's periods
    Object.values(days).forEach(arr => arr.sort((a, b) => a.period - b.period));

    const maxPeriod = Math.max(8, ...blocks.map(b => Math.max(...b.periods)));
    res.json({ success: true, data: { class: { _id: cls._id, name: cls.name, grade: cls.grade, section: cls.section }, maxPeriod, schedule: days } });
  } catch (err) { next(err); }
};

// Teacher weekly: full week for one teacher
exports.getTeacherWeeklyReport = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    const blocks = await LessonBlock.find({ timetable: timetableId, teacher: teacherId })
      .populate('subject room classes').sort({ day: 1, 'periods': 1 });

    const days = {};
    blocks.forEach(b => {
      if (!days[b.day]) days[b.day] = [];
      days[b.day].push({
        period: b.periods[0], type: b.type,
        subject: b.subject ? { _id: b.subject._id, name: b.subject.name, color: b.subject.color } : null,
        classes: b.classes.map(c => ({ _id: c._id, name: c.name })),
        room: b.room ? { _id: b.room._id, name: b.room.name } : null,
        isLocked: b.isLocked
      });
    });
    Object.values(days).forEach(arr => arr.sort((a, b) => a.period - b.period));

    const totalPeriods = blocks.filter(b => b.type !== 'reserved').length;
    const maxPeriod = Math.max(8, ...blocks.map(b => Math.max(...b.periods)));
    res.json({ success: true, data: { teacher: { _id: teacher._id, name: teacher.name, department: teacher.department }, totalPeriods, maxPeriod, schedule: days } });
  } catch (err) { next(err); }
};

// Full school report: all classes, all days
exports.getFullSchoolReport = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const { schoolId, sessionId } = await getScope(req);
    const classes = await Class.find({ school: schoolId, session: sessionId, isActive: true }).sort({ grade: 1, section: 1 });
    const blocks = await LessonBlock.find({ timetable: timetableId })
      .populate('subject teacher room classes').sort({ day: 1, 'periods': 1 });

    const report = classes.map(cls => {
      const classBlocks = blocks.filter(b => b.classes.some(c => (c._id || c).toString() === cls._id.toString()));
      const schedule = {};
      classBlocks.forEach(b => {
        if (!schedule[b.day]) schedule[b.day] = [];
        schedule[b.day].push({
          period: b.periods[0], type: b.type,
          subject: b.subject?.name, teacher: b.teacher?.name, room: b.room?.name,
          color: b.subject?.color
        });
      });
      Object.values(schedule).forEach(arr => arr.sort((a, b) => a.period - b.period));
      return { class: { _id: cls._id, name: cls.name }, schedule };
    });

    res.json({ success: true, data: { classCount: classes.length, report } });
  } catch (err) { next(err); }
};

// Export configuration
exports.getExportConfig = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        pageSizes: ['A4', 'A3', 'Letter', 'Legal'],
        orientations: ['Portrait', 'Landscape'],
        colorModes: ['Colorful', 'Black & White', 'High Contrast'],
        nameFormats: ['Full Name', 'Short Name', 'Print Alias']
      }
    });
  } catch (err) { next(err); }
};

// Period-wise day report: detailed period breakdown for a day
exports.getPeriodWiseReport = async (req, res, next) => {
  try {
    const { day, timetableId } = req.query;
    if (!timetableId || !day) return res.status(400).json({ success: false, error: 'timetableId and day required' });

    const { schoolId, sessionId } = await getScope(req);
    const blocks = await LessonBlock.find({ timetable: timetableId, day })
      .populate('subject', 'name code color shortName')
      .populate('teacher', 'name shortName printAlias department')
      .populate('room', 'name roomNumber')
      .populate('classes', 'name grade section')
      .sort({ 'periods': 1 });

    // Group by period number
    const periodMap = {};
    blocks.forEach(b => {
      const pNum = b.periods[0];
      if (!periodMap[pNum]) periodMap[pNum] = [];
      periodMap[pNum].push({
        type: b.type,
        subject: b.subject,
        teacher: b.teacher,
        room: b.room,
        classes: b.classes,
        isLocked: b.isLocked,
        consecutiveGroupId: b.consecutiveGroupId,
        studentGroup: b.studentGroup
      });
    });

    const maxPeriod = Math.max(1, ...Object.keys(periodMap).map(Number));
    const periods = [];
    for (let p = 1; p <= maxPeriod; p++) {
      periods.push({
        periodNumber: p,
        entries: periodMap[p] || [],
        entryCount: (periodMap[p] || []).length
      });
    }

    res.json({ success: true, data: { day, maxPeriod, periods } });
  } catch (err) { next(err); }
};

// Replacement report: supports single date OR date range (from/to), plus optional teacher filter
exports.getReplacementReport = async (req, res, next) => {
  try {
    const { date, from, to, teacherId } = req.query;
    if (!date && !from) return res.status(400).json({ success: false, error: 'date or from/to required' });

    const { schoolId } = await getScope(req);

    let startDate, endDate;
    if (from && to) {
      startDate = new Date(from); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(to); endDate.setHours(23, 59, 59, 999);
    } else {
      const d = date || from;
      startDate = new Date(d); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(d); endDate.setHours(23, 59, 59, 999);
    }

    const subFilter = { school: schoolId, date: { $gte: startDate, $lte: endDate } };
    const absFilter = { school: schoolId, date: { $gte: startDate, $lte: endDate } };
    if (teacherId) {
      subFilter.$or = [{ originalTeacher: teacherId }, { substituteTeacher: teacherId }];
      absFilter.teacher = teacherId;
    }

    // Get substitutions
    const substitutions = await Substitution.find(subFilter)
      .populate('originalTeacher', 'name shortName department')
      .populate('substituteTeacher', 'name shortName department')
      .populate('class', 'name grade section')
      .populate('subject', 'name code color')
      .sort({ date: 1, period: 1 });

    // Get absences
    const absences = await Absence.find(absFilter)
      .populate('teacher', 'name shortName department')
      .populate('affectedBlocks.class', 'name')
      .populate('affectedBlocks.subject', 'name')
      .populate('affectedBlocks.substituteTeacher', 'name shortName')
      .sort({ date: 1 });

    const unresolvedCount = absences.reduce((sum, a) =>
      sum + a.affectedBlocks.filter(b => b.replacementStatus === 'unresolved').length, 0
    );

    // Group by date for multi-day range
    const dateGroups = {};
    absences.forEach(a => {
      const key = new Date(a.date).toISOString().split('T')[0];
      if (!dateGroups[key]) dateGroups[key] = { absences: 0, resolved: 0, unresolved: 0 };
      dateGroups[key].absences++;
      if (a.status === 'resolved') dateGroups[key].resolved++;
      else dateGroups[key].unresolved++;
    });

    res.json({
      success: true,
      data: {
        dateRange: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0] },
        date: date || from,
        substitutions,
        absences,
        totalReplacements: substitutions.length,
        unresolvedCount,
        dateGroups,
        summary: {
          totalAbsences: absences.length,
          fullyResolved: absences.filter(a => a.status === 'resolved').length,
          partiallyResolved: absences.filter(a => a.status === 'partial').length,
          unresolved: absences.filter(a => a.status === 'active').length
        }
      }
    });
  } catch (err) { next(err); }
};

// ── ITEM #29: Teacher Workload Report ──
exports.getTeacherWorkloadReport = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const { schoolId, sessionId } = await getScope(req);
    const teachers = await Teacher.find({ school: schoolId, session: sessionId, status: 'active' }).sort({ name: 1 });
    const blocks = await LessonBlock.find({ timetable: timetableId, teacher: { $ne: null }, type: { $nin: ['reserved'] } })
      .populate('subject classes');

    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const report = teachers.map(t => {
      const tBlocks = blocks.filter(b => b.teacher.toString() === t._id.toString());
      const dayLoads = {};
      const subjectBreakdown = {};
      for (const b of tBlocks) {
        dayLoads[b.day] = (dayLoads[b.day] || 0) + b.periods.length;
        const subjName = b.subject?.name || 'Unknown';
        subjectBreakdown[subjName] = (subjectBreakdown[subjName] || 0) + b.periods.length;
      }
      const totalPeriods = Object.values(dayLoads).reduce((s, v) => s + v, 0);
      const utilization = t.maxPeriodsPerWeek > 0 ? Math.round((totalPeriods / t.maxPeriodsPerWeek) * 100) : 0;
      return {
        teacher: { _id: t._id, name: t.name, shortName: t.shortName, department: t.department },
        maxPerDay: t.maxPeriodsPerDay, maxPerWeek: t.maxPeriodsPerWeek,
        totalPeriods, utilization,
        dayLoads, subjectBreakdown,
        status: utilization > 100 ? 'overloaded' : utilization > 80 ? 'optimal' : utilization > 50 ? 'moderate' : 'underutilized'
      };
    });

    const overloaded = report.filter(r => r.status === 'overloaded').length;
    const underutilized = report.filter(r => r.status === 'underutilized').length;
    const avgUtil = report.length > 0 ? Math.round(report.reduce((s, r) => s + r.utilization, 0) / report.length) : 0;

    res.json({
      success: true,
      data: {
        report,
        summary: { totalTeachers: teachers.length, overloaded, underutilized, avgUtilization: avgUtil }
      }
    });
  } catch (err) { next(err); }
};

// ── ITEM #29: Subject Distribution Report ──
exports.getSubjectDistributionReport = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const { schoolId, sessionId } = await getScope(req);
    const subjects = await Subject.find({ school: schoolId, session: sessionId, isActive: true }).sort({ name: 1 });
    const classes = await Class.find({ school: schoolId, session: sessionId, isActive: true }).sort({ grade: 1 });
    const blocks = await LessonBlock.find({ timetable: timetableId, subject: { $ne: null } }).populate('classes');

    const report = subjects.map(s => {
      const sBlocks = blocks.filter(b => b.subject.toString() === s._id.toString());
      const classBreakdown = {};
      for (const b of sBlocks) {
        for (const c of b.classes) {
          const cid = (c._id || c).toString();
          const cls = classes.find(cl => cl._id.toString() === cid);
          if (cls) classBreakdown[cls.name] = (classBreakdown[cls.name] || 0) + b.periods.length;
        }
      }
      return {
        subject: { _id: s._id, name: s.name, code: s.code, color: s.color },
        totalPeriodsSchoolWide: sBlocks.reduce((s, b) => s + b.periods.length, 0),
        classesCount: Object.keys(classBreakdown).length,
        classBreakdown
      };
    });

    res.json({ success: true, data: { report, totalSubjects: subjects.length, totalClasses: classes.length } });
  } catch (err) { next(err); }
};

// ── ITEM #29: Room Utilization Report ──
exports.getRoomUtilizationReport = async (req, res, next) => {
  try {
    const { timetableId } = req.query;
    if (!timetableId) return res.status(400).json({ success: false, error: 'timetableId required' });

    const { schoolId } = await getScope(req);
    const school = await School.findById(schoolId);
    const rooms = await Room.find({ school: schoolId }).sort({ name: 1 });
    const blocks = await LessonBlock.find({ timetable: timetableId, room: { $ne: null } });

    const workingDays = school?.settings?.workingDays || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const periodsPerDay = school?.settings?.defaultPeriodsPerDay || 8;
    const totalSlotsPerWeek = workingDays.length * periodsPerDay;

    const report = rooms.map(r => {
      const rBlocks = blocks.filter(b => b.room.toString() === r._id.toString());
      const usedSlots = rBlocks.reduce((s, b) => s + b.periods.length, 0);
      const utilization = totalSlotsPerWeek > 0 ? Math.round((usedSlots / totalSlotsPerWeek) * 100) : 0;
      return {
        room: { _id: r._id, name: r.name, type: r.type, capacity: r.capacity },
        usedSlots, totalSlots: totalSlotsPerWeek, utilization,
        status: utilization > 80 ? 'high' : utilization > 40 ? 'moderate' : 'low'
      };
    });

    const avgUtil = report.length > 0 ? Math.round(report.reduce((s, r) => s + r.utilization, 0) / report.length) : 0;
    res.json({
      success: true,
      data: { report, summary: { totalRooms: rooms.length, avgUtilization: avgUtil, highUsage: report.filter(r => r.status === 'high').length } }
    });
  } catch (err) { next(err); }
};
