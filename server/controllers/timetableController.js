const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const ConflictLog = require('../models/ConflictLog');
const SchedulerEngine = require('../services/schedulerEngine');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { schoolId: school?._id, sessionId: session?._id };
};

exports.generate = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope();
    if (!schoolId || !sessionId) return res.status(400).json({ success: false, error: 'School or session not configured' });
    const engine = new SchedulerEngine(schoolId, sessionId);
    const result = await engine.generate();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.getTimetables = async (req, res, next) => {
  try {
    const { schoolId } = await getScope();
    const timetables = await GeneratedTimetable.find({ school: schoolId }).sort({ createdAt: -1 });
    res.json({ success: true, data: timetables });
  } catch (err) { next(err); }
};

exports.getTimetableBlocks = async (req, res, next) => {
  try {
    const blocks = await LessonBlock.find({ timetable: req.params.timetableId })
      .populate('subject teacher room classes').sort({ day: 1, 'periods': 1 });
    res.json({ success: true, count: blocks.length, data: blocks });
  } catch (err) { next(err); }
};

exports.getClassBlocks = async (req, res, next) => {
  try {
    const blocks = await LessonBlock.find({ timetable: req.params.timetableId, classes: req.params.classId })
      .populate('subject teacher room classes').sort({ day: 1, 'periods': 1 });
    res.json({ success: true, count: blocks.length, data: blocks });
  } catch (err) { next(err); }
};

exports.getTeacherBlocks = async (req, res, next) => {
  try {
    const blocks = await LessonBlock.find({ timetable: req.params.timetableId, teacher: req.params.teacherId })
      .populate('subject room classes').sort({ day: 1, 'periods': 1 });
    res.json({ success: true, count: blocks.length, data: blocks });
  } catch (err) { next(err); }
};

exports.updateBlock = async (req, res, next) => {
  try {
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    if (block.isLocked && !req.body.force) return res.status(400).json({ success: false, error: 'Block is locked. Set force=true to override.' });
    Object.assign(block, req.body);
    await block.save();
    const populated = await LessonBlock.findById(block._id).populate('subject teacher room classes');
    res.json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.swapBlocks = async (req, res, next) => {
  try {
    const { blockAId, blockBId } = req.body;
    const blockA = await LessonBlock.findById(blockAId);
    const blockB = await LessonBlock.findById(blockBId);
    if (!blockA || !blockB) return res.status(404).json({ success: false, error: 'Block not found' });
    if (blockA.isLocked || blockB.isLocked) return res.status(400).json({ success: false, error: 'Cannot swap locked blocks' });

    // Swap day and periods
    const tmpDay = blockA.day; const tmpPeriods = [...blockA.periods];
    blockA.day = blockB.day; blockA.periods = blockB.periods;
    blockB.day = tmpDay; blockB.periods = tmpPeriods;
    await blockA.save(); await blockB.save();

    res.json({ success: true, data: { blockA, blockB } });
  } catch (err) { next(err); }
};

exports.lockBlock = async (req, res, next) => {
  try {
    const block = await LessonBlock.findByIdAndUpdate(req.params.id, { isLocked: true }, { new: true });
    res.json({ success: true, data: block });
  } catch (err) { next(err); }
};

exports.unlockBlock = async (req, res, next) => {
  try {
    const block = await LessonBlock.findByIdAndUpdate(req.params.id, { isLocked: false }, { new: true });
    res.json({ success: true, data: block });
  } catch (err) { next(err); }
};

exports.getConflicts = async (req, res, next) => {
  try {
    const conflicts = await ConflictLog.find({ timetable: req.params.timetableId })
      .populate('teacher classes subject room').sort({ severity: 1 });
    res.json({ success: true, count: conflicts.length, data: conflicts });
  } catch (err) { next(err); }
};

exports.publishTimetable = async (req, res, next) => {
  try {
    const tt = await GeneratedTimetable.findById(req.params.timetableId);
    if (!tt) return res.status(404).json({ success: false, error: 'Timetable not found' });
    // Archive others
    await GeneratedTimetable.updateMany({ school: tt.school, _id: { $ne: tt._id }, status: 'published' }, { status: 'archived' });
    tt.status = 'published'; tt.publishedAt = new Date(); tt.publishedBy = 'admin';
    await tt.save();
    res.json({ success: true, data: tt });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const { schoolId, sessionId } = await getScope();
    const Teacher = require('../models/Teacher');
    const Class = require('../models/Class');
    const Subject = require('../models/Subject');
    const Room = require('../models/Room');
    const SubjectRequirement = require('../models/SubjectRequirement');
    const SubjectCombinationRule = require('../models/SubjectCombinationRule');
    const Absence = require('../models/Absence');

    const [teachers, classes, subjects, rooms, requirements, combRules, absences, timetables] = await Promise.all([
      Teacher.countDocuments({ school: schoolId, session: sessionId, status: 'active' }),
      Class.countDocuments({ school: schoolId, session: sessionId, isActive: true }),
      Subject.countDocuments({ school: schoolId, session: sessionId, isActive: true }),
      Room.countDocuments({ school: schoolId, isAvailable: true }),
      SubjectRequirement.countDocuments({ school: schoolId, session: sessionId }),
      SubjectCombinationRule.countDocuments({ school: schoolId, session: sessionId, isActive: true }),
      Absence.countDocuments({ school: schoolId, status: 'pending' }),
      GeneratedTimetable.findOne({ school: schoolId, status: { $in: ['draft', 'published', 'review'] } }).sort({ createdAt: -1 })
    ]);

    let conflicts = 0, blocks = 0;
    if (timetables) {
      conflicts = await ConflictLog.countDocuments({ timetable: timetables._id, isResolved: false });
      blocks = await LessonBlock.countDocuments({ timetable: timetables._id, type: { $ne: 'reserved' } });
    }

    res.json({ success: true, data: { teachers, classes, subjects, rooms, requirements, combinationRules: combRules, pendingAbsences: absences, scheduledBlocks: blocks, conflicts, latestTimetable: timetables?.status || 'none' } });
  } catch (err) { next(err); }
};
