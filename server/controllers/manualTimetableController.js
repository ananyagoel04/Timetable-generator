/**
 * Manual Timetable Controller — Handles all manual timetable API endpoints.
 */
const manualService = require('../services/timetable/ManualTimetableService');
const suggestionService = require('../services/timetable/ManualSuggestionService');
const validator = require('../services/timetable/ManualLessonValidator');
const GeneratedTimetable = require('../models/GeneratedTimetable');

// GET /api/timetable/manual/list
exports.listManualTimetables = async (req, res, next) => {
  try {
    const timetables = await GeneratedTimetable.find({
      school: req.schoolId,
      session: req.sessionId,
      creationMode: { $in: ['manual', 'copied'] }
    })
    .sort({ updatedAt: -1 })
    .select('name status creationMode manualCompletenessScore validationSummary createdBy createdAt updatedAt stats')
    .populate('createdBy', 'name email')
    .lean();
    
    res.json({ success: true, data: timetables });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/create
exports.create = async (req, res, next) => {
  try {
    const { name, scope, sourceTimetableId, mode } = req.body;
    const schoolId = req.schoolId;
    const sessionId = req.sessionId;
    const userId = req.user._id;

    let result;
    if (mode === 'copy' && sourceTimetableId) {
      result = await manualService.cloneExisting({ sourceTimetableId, schoolId, sessionId, name, userId });
    } else {
      result = await manualService.createBlank({ schoolId, sessionId, name, userId, scope });
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// GET /api/timetable/manual/:timetableId
exports.getDetails = async (req, res, next) => {
  try {
    const result = await manualService.getTimetableDetails({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/:timetableId/validate-lesson
exports.validateLesson = async (req, res, next) => {
  try {
    const result = await validator.validate({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      lesson: req.body
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/:timetableId/lesson
exports.addLesson = async (req, res, next) => {
  try {
    const result = await manualService.addLesson({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      lesson: req.body,
      force: req.body.force || false
    });
    const status = result.success ? 201 : 409;
    res.status(status).json({ success: result.success, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/lesson/:blockId
exports.updateLesson = async (req, res, next) => {
  try {
    const result = await manualService.updateLesson({
      timetableId: req.params.timetableId,
      blockId: req.params.blockId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      updates: req.body
    });
    res.json({ success: result.success, data: result });
  } catch (err) { next(err); }
};

// DELETE /api/timetable/manual/:timetableId/lesson/:blockId
exports.deleteLesson = async (req, res, next) => {
  try {
    const result = await manualService.deleteLesson({
      timetableId: req.params.timetableId,
      blockId: req.params.blockId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/lesson/:blockId/move
exports.moveLesson = async (req, res, next) => {
  try {
    const { newDay, newPeriod } = req.body;
    const result = await manualService.moveLesson({
      timetableId: req.params.timetableId,
      blockId: req.params.blockId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      newDay,
      newPeriod
    });
    res.json({ success: result.success, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/swap
exports.swapLessons = async (req, res, next) => {
  try {
    const { blockIdA, blockIdB } = req.body;
    const result = await manualService.swapLessons({
      timetableId: req.params.timetableId,
      blockIdA,
      blockIdB,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/lesson/:blockId/lock
exports.lockLesson = async (req, res, next) => {
  try {
    const result = await manualService.lockLesson({
      timetableId: req.params.timetableId,
      blockId: req.params.blockId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      lock: true
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/lesson/:blockId/unlock
exports.unlockLesson = async (req, res, next) => {
  try {
    const result = await manualService.lockLesson({
      timetableId: req.params.timetableId,
      blockId: req.params.blockId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      lock: false
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// PUT /api/timetable/manual/:timetableId/save-draft
exports.saveDraft = async (req, res, next) => {
  try {
    const result = await manualService.saveDraft({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/:timetableId/publish
exports.publish = async (req, res, next) => {
  try {
    const result = await manualService.publish({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/:timetableId/validate-full
exports.validateFull = async (req, res, next) => {
  try {
    const result = await manualService.validateFull({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// GET /api/timetable/manual/:timetableId/suggestions
exports.getSuggestions = async (req, res, next) => {
  try {
    const { classId, subjectId, teacherId, day, period, type } = req.query;
    const timetableId = req.params.timetableId;
    const schoolId = req.schoolId;
    const sessionId = req.sessionId;

    const [teachers, rooms, availablePeriods, subjectProgress] = await Promise.all([
      classId && subjectId ? suggestionService.suggestTeachers({ schoolId, sessionId, timetableId, classId, subjectId, day, period: period ? Number(period) : undefined }) : [],
      day && period ? suggestionService.suggestRooms({ schoolId, timetableId, day, period: Number(period), type }) : [],
      classId && subjectId ? suggestionService.suggestPeriods({ schoolId, sessionId, timetableId, classId, subjectId, teacherId }) : [],
      classId ? suggestionService.getSubjectLoadProgress({ schoolId, sessionId, timetableId, classId }) : []
    ]);

    let teacherWorkload = null;
    if (teacherId) {
      teacherWorkload = await suggestionService.getTeacherWorkload({ timetableId, teacherId });
    }

    res.json({
      success: true,
      data: { teachers, rooms, availablePeriods, subjectProgress, teacherWorkload }
    });
  } catch (err) { next(err); }
};

// POST /api/timetable/manual/:timetableId/bulk-assign
exports.bulkAssign = async (req, res, next) => {
  try {
    const result = await manualService.bulkAssign({
      timetableId: req.params.timetableId,
      schoolId: req.schoolId,
      sessionId: req.sessionId,
      userId: req.user._id,
      assignment: req.body
    });
    res.json({
      success: true,
      data: result,
      message: `Bulk assignment completed: ${result.summary.created} created, ${result.summary.conflicts} conflicts`,
      error: null
    });
  } catch (err) { next(err); }
};
