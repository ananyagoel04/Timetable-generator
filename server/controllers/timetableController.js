const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const ConflictLog = require('../models/ConflictLog');
const SchedulerEngine = require('../services/schedulerEngine');
const TimetableEditor = require('../services/timetableEditor');
const GenerationJob = require('../services/engine/GenerationJob');
const School = require('../models/School');
const { withTransaction } = require('../services/transactionHelper');
const { createAuditEntry } = require('../services/auditHelper');

// NOTE: All controller functions use req.schoolId and req.sessionId injected
// by the protect + scopeToSchool middleware chain. The old getScope() function
// used School.findOne() without a filter and always returned the first school
// in the database — this was a critical multi-tenant isolation bug.

// Cache editor instances so undo/redo stacks persist across HTTP requests
const _editorCache = new Map();
function _getEditor(timetableId) {
  const key = timetableId.toString();
  if (!_editorCache.has(key)) {
    _editorCache.set(key, new TimetableEditor(timetableId));
    // Evict oldest if cache grows too large
    if (_editorCache.size > 20) {
      const firstKey = _editorCache.keys().next().value;
      _editorCache.delete(firstKey);
    }
  }
  return _editorCache.get(key);
}


// Background generation — returns immediately with jobId
exports.generate = async (req, res, next) => {
  try {
    const schoolId = req.schoolId;
    const sessionId = req.sessionId;
    if (!schoolId || !sessionId) return res.status(400).json({ success: false, error: 'School or session not configured' });

    const job = new GenerationJob(schoolId, sessionId);
    job.start();

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: 'started',
        message: 'Timetable generation started in background. Poll /api/timetable/job/:jobId for progress.'
      }
    });
  } catch (err) { next(err); }
};

// Synchronous generation — for backward compatibility / testing
exports.generateSync = async (req, res, next) => {
  try {
    const schoolId = req.schoolId;
    const sessionId = req.sessionId;
    if (!schoolId || !sessionId) return res.status(400).json({ success: false, error: 'School or session not configured' });
    const engine = new SchedulerEngine(schoolId, sessionId);
    const result = await engine.generate();
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

// Poll job status
exports.getJobStatus = async (req, res, next) => {
  try {
    const job = GenerationJob.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found or expired' });
    res.json({ success: true, data: job.toJSON() });
  } catch (err) { next(err); }
};


exports.getTimetables = async (req, res, next) => {
  try {
    const schoolId = req.schoolId;
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
    const tmpDay = blockA.day; const tmpPeriods = [...blockA.periods];
    blockA.day = blockB.day; blockA.periods = blockB.periods;
    blockB.day = tmpDay; blockB.periods = tmpPeriods;
    await blockA.save(); await blockB.save();
    res.json({ success: true, data: { blockA, blockB } });
  } catch (err) { next(err); }
};

exports.lockBlock = async (req, res, next) => {
  try {
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    block.isLocked = true;
    block.editHistory.push({ action: 'lock', before: { isLocked: false }, after: { isLocked: true }, timestamp: new Date() });
    await block.save();
    res.json({ success: true, data: block });
  } catch (err) { next(err); }
};

exports.unlockBlock = async (req, res, next) => {
  try {
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    block.isLocked = false;
    block.editHistory.push({ action: 'unlock', before: { isLocked: true }, after: { isLocked: false }, timestamp: new Date() });
    await block.save();
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
    const result = await withTransaction(async (session) => {
      const opts = session ? { session } : {};
      const tt = await GeneratedTimetable.findById(req.params.timetableId).session(session);
      if (!tt) return { error: 'Timetable not found', status: 404 };

      // Archive all other published timetables for this school atomically
      await GeneratedTimetable.updateMany(
        { school: tt.school, _id: { $ne: tt._id }, status: 'published' },
        { status: 'archived' },
        opts
      );

      tt.status = 'published';
      tt.publishedAt = new Date();
      tt.publishedBy = req.user?.name || 'admin';
      await tt.save(opts);

      // Audit log inside transaction
      await createAuditEntry({
        req, session,
        action: 'publish',
        entityType: 'timetable',
        entityId: tt._id,
        entityName: tt.name,
        oldValue: { status: 'draft' },
        newValue: { status: 'published' },
        reason: 'Timetable published'
      });

      return { data: tt };
    });

    if (result.error) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
};

exports.unpublishTimetable = async (req, res, next) => {
  try {
    const result = await withTransaction(async (session) => {
      const opts = session ? { session } : {};
      const tt = await GeneratedTimetable.findById(req.params.timetableId).session(session);
      if (!tt) return { error: 'Timetable not found', status: 404 };
      if (tt.status !== 'published') return { error: `Cannot unpublish: status is ${tt.status}`, status: 400 };

      const before = { status: tt.status, publishedAt: tt.publishedAt, publishedBy: tt.publishedBy };
      tt.status = 'draft';
      tt.publishedAt = null;
      tt.publishedBy = null;
      await tt.save(opts);

      await createAuditEntry({
        req, session,
        action: 'unpublish',
        entityType: 'timetable',
        entityId: tt._id,
        entityName: tt.name,
        oldValue: before,
        newValue: { status: 'draft' },
        reason: 'Timetable unpublished (reverted to draft)'
      });

      return { data: tt };
    });

    if (result.error) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, data: result.data });
  } catch (err) { next(err); }
};

exports.renameTimetable = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Name is required' });

    const tt = await GeneratedTimetable.findById(req.params.timetableId);
    if (!tt) return res.status(404).json({ success: false, error: 'Timetable not found' });

    const oldName = tt.name;
    tt.name = name.trim();
    await tt.save();

    await createAuditEntry({
      req,
      action: 'update',
      entityType: 'timetable',
      entityId: tt._id,
      entityName: tt.name,
      oldValue: { name: oldName },
      newValue: { name: tt.name },
      reason: `Timetable renamed from "${oldName}" to "${tt.name}"`
    });

    res.json({ success: true, data: tt });
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const schoolId = req.schoolId;
    const sessionId = req.sessionId;
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

// --- Enhanced editing via TimetableEditor ---
exports.moveBlock = async (req, res, next) => {
  try {
    const { day, period, reason } = req.body;
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    const editor = _getEditor(block.timetable);
    const result = await editor.moveBlock(req.params.id, day, period, req.body.userId, reason);
    res.json(result);
  } catch (err) { next(err); }
};

exports.validateMove = async (req, res, next) => {
  try {
    const { day, period } = req.body;
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    const editor = _getEditor(block.timetable);
    const result = await editor.validateMove(req.params.id, day, period);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.reassignTeacher = async (req, res, next) => {
  try {
    const { teacherId, reason } = req.body;
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    const editor = _getEditor(block.timetable);
    const result = await editor.reassignTeacher(req.params.id, teacherId, req.body.userId, reason);
    res.json(result);
  } catch (err) { next(err); }
};

exports.reassignRoom = async (req, res, next) => {
  try {
    const { roomId, reason } = req.body;
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    const editor = _getEditor(block.timetable);
    const result = await editor.reassignRoom(req.params.id, roomId, req.body.userId, reason);
    res.json(result);
  } catch (err) { next(err); }
};

exports.getEditHistory = async (req, res, next) => {
  try {
    const block = await LessonBlock.findById(req.params.id);
    if (!block) return res.status(404).json({ success: false, error: 'Block not found' });
    const editor = _getEditor(block.timetable);
    const history = await editor.getEditHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};

// ── Undo / Redo / Status ──
exports.undo = async (req, res, next) => {
  try {
    const editor = _getEditor(req.params.timetableId);
    const result = await editor.undo(req.user?._id);
    res.json({ success: result.success, data: result });
  } catch (err) { next(err); }
};

exports.redo = async (req, res, next) => {
  try {
    const editor = _getEditor(req.params.timetableId);
    const result = await editor.redo(req.user?._id);
    res.json({ success: result.success, data: result });
  } catch (err) { next(err); }
};

exports.getUndoStatus = async (req, res, next) => {
  try {
    const editor = _getEditor(req.params.timetableId);
    const status = editor.getUndoStatus();
    res.json({ success: true, data: status });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════════
// SNAPSHOT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
const TimetableSnapshot = require('../models/TimetableSnapshot');

exports.createSnapshot = async (req, res, next) => {
  try {
    const timetable = await GeneratedTimetable.findById(req.params.timetableId);
    if (!timetable) return res.status(404).json({ success: false, error: 'Timetable not found' });

    const blocks = await LessonBlock.find({ timetable: timetable._id }).lean();
    const lastSnapshot = await TimetableSnapshot.findOne({ timetable: timetable._id })
      .sort({ version: -1 }).select('version');

    const version = (lastSnapshot?.version || 0) + 1;
    const snapshot = await TimetableSnapshot.create({
      timetable: timetable._id,
      school: timetable.school,
      session: timetable.session,
      version,
      label: req.body.label || `v${version}`,
      description: req.body.description || '',
      snapshotData: blocks.map(b => ({
        type: b.type, subject: b.subject, teacher: b.teacher, room: b.room,
        classes: b.classes, day: b.day, periods: b.periods, studentGroup: b.studentGroup,
        isLocked: b.isLocked, combinationRule: b.combinationRule,
        consecutiveGroupId: b.consecutiveGroupId, consecutivePosition: b.consecutivePosition,
        priorityWeight: b.priorityWeight
      })),
      stats: {
        totalBlocks: blocks.length,
        placedBlocks: blocks.filter(b => b.type !== 'reserved').length,
        qualityScore: timetable.stats?.softRuleScore || 0,
        generationTimeMs: timetable.stats?.generationTimeMs || 0
      },
      isPublished: timetable.status === 'published',
      createdBy: req.user?._id
    });

    res.status(201).json({ success: true, data: { id: snapshot._id, version, label: snapshot.label } });
  } catch (err) { next(err); }
};

exports.listSnapshots = async (req, res, next) => {
  try {
    const snapshots = await TimetableSnapshot.find({ timetable: req.params.timetableId })
      .sort({ version: -1 })
      .select('version label description stats isPublished createdBy createdAt')
      .populate('createdBy', 'name email');

    res.json({ success: true, data: snapshots });
  } catch (err) { next(err); }
};

exports.rollbackToSnapshot = async (req, res, next) => {
  try {
    const result = await withTransaction(async (session) => {
      const opts = session ? { session } : {};
      const snapshot = await TimetableSnapshot.findById(req.params.snapshotId).session(session);
      if (!snapshot) return { error: 'Snapshot not found', status: 404 };

      // Create a backup snapshot of current state before rollback
      const currentBlocks = await LessonBlock.find({ timetable: snapshot.timetable }).session(session).lean();
      const lastSnap = await TimetableSnapshot.findOne({ timetable: snapshot.timetable })
        .sort({ version: -1 }).select('version').session(session);
      const backupVersion = (lastSnap?.version || 0) + 1;

      await TimetableSnapshot.create([{
        timetable: snapshot.timetable, school: snapshot.school, session: snapshot.session,
        version: backupVersion, label: `Pre-rollback backup (v${backupVersion})`,
        snapshotData: currentBlocks.map(b => ({
          type: b.type, subject: b.subject, teacher: b.teacher, room: b.room,
          classes: b.classes, day: b.day, periods: b.periods, studentGroup: b.studentGroup,
          isLocked: b.isLocked
        })),
        stats: { totalBlocks: currentBlocks.length },
        createdBy: req.user?._id
      }], opts);

      // Delete current blocks and restore from snapshot — atomic
      await LessonBlock.deleteMany({ timetable: snapshot.timetable }, opts);
      const restoredBlocks = snapshot.snapshotData.map(b => ({
        ...b, timetable: snapshot.timetable, school: snapshot.school
      }));
      if (restoredBlocks.length > 0) {
        await LessonBlock.insertMany(restoredBlocks, { ...opts, ordered: false });
      }

      // Update timetable stats
      await GeneratedTimetable.findByIdAndUpdate(
        snapshot.timetable,
        { 'stats.totalBlocks': restoredBlocks.length, status: 'draft' },
        opts
      );

      // Audit log inside transaction
      await createAuditEntry({
        req, session,
        action: 'rollback',
        entityType: 'timetable',
        entityId: snapshot.timetable,
        entityName: `Rollback to v${snapshot.version}`,
        oldValue: { blocks: currentBlocks.length },
        newValue: { blocks: restoredBlocks.length, version: snapshot.version },
        reason: `Rolled back to snapshot v${snapshot.version}`
      });

      return { blocksRestored: restoredBlocks.length, version: snapshot.version };
    });

    if (result.error) return res.status(result.status).json({ success: false, error: result.error });
    res.json({ success: true, message: `Rolled back to v${result.version}`, data: { blocksRestored: result.blocksRestored } });
  } catch (err) { next(err); }
};

exports.compareSnapshot = async (req, res, next) => {
  try {
    const snapshot = await TimetableSnapshot.findById(req.params.snapshotId);
    if (!snapshot) return res.status(404).json({ success: false, error: 'Snapshot not found' });

    const currentBlocks = await LessonBlock.find({ timetable: snapshot.timetable }).lean();
    const snapshotBlocks = snapshot.snapshotData;

    // Build key maps for comparison
    const makeKey = (b) => `${b.day}_${(b.periods||[]).join(',')}_${(b.classes||[]).map(c=>c.toString()).join(',')}`;
    const currentMap = new Map();
    for (const b of currentBlocks) currentMap.set(makeKey(b), b);
    const snapMap = new Map();
    for (const b of snapshotBlocks) snapMap.set(makeKey(b), b);

    const added = [], removed = [], changed = [];
    for (const [key, b] of currentMap) {
      if (!snapMap.has(key)) added.push({ day: b.day, periods: b.periods, type: 'added' });
      else {
        const sb = snapMap.get(key);
        if (b.teacher?.toString() !== sb.teacher?.toString() || b.subject?.toString() !== sb.subject?.toString()) {
          changed.push({ day: b.day, periods: b.periods, type: 'changed' });
        }
      }
    }
    for (const [key] of snapMap) {
      if (!currentMap.has(key)) removed.push({ day: snapMap.get(key).day, periods: snapMap.get(key).periods, type: 'removed' });
    }

    res.json({
      success: true,
      data: {
        snapshotVersion: snapshot.version,
        currentBlocks: currentBlocks.length,
        snapshotBlocks: snapshotBlocks.length,
        added: added.length, removed: removed.length, changed: changed.length,
        details: { added: added.slice(0, 20), removed: removed.slice(0, 20), changed: changed.slice(0, 20) }
      }
    });
  } catch (err) { next(err); }
};
