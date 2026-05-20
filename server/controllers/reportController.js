const LessonBlock = require('../models/LessonBlock');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { schoolId: school?._id, sessionId: session?._id };
};

const DAYS_ORDER = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 };

// Day-wise: all classes for a given day
exports.getDayWiseReport = async (req, res, next) => {
  try {
    const { timetableId, day } = req.query;
    if (!timetableId || !day) return res.status(400).json({ success: false, error: 'timetableId and day required' });

    const { schoolId, sessionId } = await getScope();
    const classes = await Class.find({ school: schoolId, session: sessionId, isActive: true }).sort({ grade: 1, section: 1 });

    const blocks = await LessonBlock.find({ timetable: timetableId, day })
      .populate('subject teacher room classes').sort({ 'periods': 1 });

    // Group by class
    const report = classes.map(cls => {
      const classBlocks = blocks.filter(b => b.classes.some(c => (c._id || c).toString() === cls._id.toString()));
      return {
        class: { _id: cls._id, name: cls.name, grade: cls.grade, section: cls.section },
        periods: classBlocks.map(b => ({
          period: b.periods[0],
          type: b.type,
          subject: b.subject ? { _id: b.subject._id, name: b.subject.name, color: b.subject.color } : null,
          teacher: b.teacher ? { _id: b.teacher._id, name: b.teacher.name } : null,
          room: b.room ? { _id: b.room._id, name: b.room.name } : null,
          isLocked: b.isLocked
        })).sort((a, b) => a.period - b.period)
      };
    });

    res.json({ success: true, data: { day, classCount: classes.length, report } });
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

    const { schoolId, sessionId } = await getScope();
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
