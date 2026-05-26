const ConflictLog = require('../models/ConflictLog');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const AuditLog = require('../models/AuditLog');
const TimetableEditor = require('../services/timetableEditor');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { schoolId: school?._id, sessionId: session?._id };
};

/**
 * GET /api/timetable/:timetableId/conflicts
 * Enhanced: supports filtering by type, severity, teacher, class, day, resolved
 */
exports.getConflicts = async (req, res, next) => {
  try {
    const filter = { timetable: req.params.timetableId };

    // Optional filters
    if (req.query.type) filter.type = req.query.type;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.day) filter.day = req.query.day;
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.resolved === 'true') filter.isResolved = true;
    else if (req.query.resolved === 'false') filter.isResolved = false;
    else filter.isResolved = false; // Default: show unresolved

    if (req.query.classId) filter.classes = req.query.classId;

    const conflicts = await ConflictLog.find(filter)
      .populate('teacher', 'name color department')
      .populate('classes', 'name grade section')
      .populate('subject', 'name shortName color')
      .populate('room', 'name capacity')
      .populate('blocks', 'day periods subject teacher')
      .populate('suggestedFixes.targetTeacher', 'name color department')
      .populate('suggestedFixes.targetRoom', 'name capacity')
      .sort({ severity: 1, createdAt: -1 });

    // Group by groupId if requested
    if (req.query.grouped === 'true') {
      const grouped = {};
      for (const c of conflicts) {
        const gid = c.groupId || c._id.toString();
        if (!grouped[gid]) grouped[gid] = { groupId: gid, conflicts: [], severity: c.severity };
        grouped[gid].conflicts.push(c);
      }
      return res.json({ success: true, count: conflicts.length, groups: Object.values(grouped), data: conflicts });
    }

    res.json({ success: true, count: conflicts.length, data: conflicts });
  } catch (err) { next(err); }
};

/**
 * PUT /api/timetable/:timetableId/conflicts/:conflictId/resolve
 * Manually resolve a single conflict with a reason
 */
exports.resolveConflict = async (req, res, next) => {
  try {
    const { reason, fixAction } = req.body;
    const conflict = await ConflictLog.findById(req.params.conflictId);
    if (!conflict) return res.status(404).json({ success: false, error: 'Conflict not found' });
    if (conflict.isResolved) return res.status(400).json({ success: false, error: 'Conflict already resolved' });

    conflict.isResolved = true;
    conflict.resolvedAt = new Date();
    conflict.resolution = reason || `Manually resolved${fixAction ? ': ' + fixAction : ''}`;
    await conflict.save();

    // Audit log
    const { schoolId } = await getScope();
    await AuditLog.create({
      school: schoolId,
      action: 'conflict_resolve',
      entityType: 'conflict',
      entityId: conflict._id,
      entityName: conflict.title,
      source: 'manual',
      user: req.user?._id,
      userName: req.user?.name,
      userRole: req.user?.role,
      oldValue: { isResolved: false },
      newValue: { isResolved: true, resolution: conflict.resolution },
      reason,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent']
    });

    res.json({ success: true, data: conflict });
  } catch (err) { next(err); }
};

/**
 * POST /api/timetable/:timetableId/conflicts/:conflictId/auto-fix
 * Apply a suggested fix to the timetable
 */
exports.autoFixConflict = async (req, res, next) => {
  try {
    const { fixIndex } = req.body; // Which suggestedFixes entry to apply
    const conflict = await ConflictLog.findById(req.params.conflictId)
      .populate('blocks');
    if (!conflict) return res.status(404).json({ success: false, error: 'Conflict not found' });
    if (conflict.isResolved) return res.status(400).json({ success: false, error: 'Already resolved' });

    const fix = conflict.suggestedFixes?.[fixIndex || 0];
    if (!fix) return res.status(400).json({ success: false, error: 'No fix available at this index' });

    const editor = new TimetableEditor(conflict.timetable);
    let result;

    switch (fix.action) {
      case 'move_to_period': {
        const blockId = conflict.blocks?.[0]?._id || conflict.blocks?.[0];
        if (!blockId) return res.status(400).json({ success: false, error: 'No block to move' });
        result = await editor.moveBlock(
          blockId, fix.targetDay || conflict.day, fix.targetPeriod,
          req.user?._id, `Auto-fix: ${fix.description}`
        );
        break;
      }
      case 'swap_teacher': {
        const blockId = conflict.blocks?.[0]?._id || conflict.blocks?.[0];
        if (!blockId || !fix.targetTeacher) return res.status(400).json({ success: false, error: 'Missing block or target teacher' });
        result = await editor.reassignTeacher(
          blockId, fix.targetTeacher,
          req.user?._id, `Auto-fix: ${fix.description}`
        );
        break;
      }
      case 'change_room': {
        const blockId = conflict.blocks?.[0]?._id || conflict.blocks?.[0];
        if (!blockId || !fix.targetRoom) return res.status(400).json({ success: false, error: 'Missing block or target room' });
        result = await editor.reassignRoom(
          blockId, fix.targetRoom,
          req.user?._id, `Auto-fix: ${fix.description}`
        );
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Unsupported fix action: ${fix.action}` });
    }

    if (result?.success) {
      conflict.isResolved = true;
      conflict.resolvedAt = new Date();
      conflict.resolution = `Auto-fixed: ${fix.action} — ${fix.description}`;
      await conflict.save();

      const { schoolId } = await getScope();
      await AuditLog.create({
        school: schoolId,
        action: 'conflict_resolve',
        entityType: 'conflict',
        entityId: conflict._id,
        entityName: conflict.title,
        source: 'auto',
        user: req.user?._id,
        userName: req.user?.name,
        userRole: req.user?.role,
        newValue: { fix: fix.action, description: fix.description, confidence: fix.confidence },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent']
      });
    }

    res.json({ success: result?.success || false, data: { conflict, fixResult: result } });
  } catch (err) { next(err); }
};

/**
 * POST /api/timetable/:timetableId/conflicts/batch-resolve
 * Batch auto-fix multiple conflicts
 */
exports.batchResolve = async (req, res, next) => {
  try {
    const { conflictIds, autoFix } = req.body;
    if (!conflictIds?.length) return res.status(400).json({ success: false, error: 'conflictIds required' });

    const results = { resolved: 0, failed: 0, errors: [] };

    for (const conflictId of conflictIds) {
      try {
        const conflict = await ConflictLog.findById(conflictId).populate('blocks');
        if (!conflict || conflict.isResolved) { results.failed++; continue; }

        if (autoFix && conflict.suggestedFixes?.length > 0 && conflict.autoResolvable) {
          // Apply the highest-confidence fix
          const bestFix = conflict.suggestedFixes.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
          const editor = new TimetableEditor(conflict.timetable);
          let fixResult;

          try {
            const blockId = conflict.blocks?.[0]?._id || conflict.blocks?.[0];
            if (bestFix.action === 'move_to_period' && blockId) {
              fixResult = await editor.moveBlock(blockId, bestFix.targetDay || conflict.day, bestFix.targetPeriod, req.user?._id, 'Batch auto-fix');
            } else if (bestFix.action === 'swap_teacher' && blockId && bestFix.targetTeacher) {
              fixResult = await editor.reassignTeacher(blockId, bestFix.targetTeacher, req.user?._id, 'Batch auto-fix');
            } else if (bestFix.action === 'change_room' && blockId && bestFix.targetRoom) {
              fixResult = await editor.reassignRoom(blockId, bestFix.targetRoom, req.user?._id, 'Batch auto-fix');
            }
          } catch (e) { /* fix failed — mark manually */ }

          if (fixResult?.success) {
            conflict.isResolved = true;
            conflict.resolvedAt = new Date();
            conflict.resolution = `Batch auto-fixed: ${bestFix.action}`;
            await conflict.save();
            results.resolved++;
            continue;
          }
        }

        // Mark as resolved manually (override)
        conflict.isResolved = true;
        conflict.resolvedAt = new Date();
        conflict.resolution = 'Batch resolved (manual override)';
        await conflict.save();
        results.resolved++;
      } catch (e) {
        results.failed++;
        results.errors.push({ conflictId, error: e.message });
      }
    }

    res.json({ success: true, data: results });
  } catch (err) { next(err); }
};

/**
 * POST /api/timetable/:timetableId/conflicts/revalidate
 * Re-run conflict detection on the timetable
 */
exports.revalidate = async (req, res, next) => {
  try {
    const timetableId = req.params.timetableId;
    const tt = await GeneratedTimetable.findById(timetableId);
    if (!tt) return res.status(404).json({ success: false, error: 'Timetable not found' });

    // Clear existing unresolved conflicts
    await ConflictLog.deleteMany({ timetable: timetableId, isResolved: false });

    // Load all lesson blocks
    const blocks = await LessonBlock.find({ timetable: timetableId, type: { $nin: ['reserved', 'free'] } })
      .populate('subject teacher room classes');

    const newConflicts = [];

    // Build maps
    const teacherSchedule = {};  // `teacherId_day_period` -> blockId
    const roomSchedule = {};     // `roomId_day_period` -> blockId
    const classSchedule = {};    // `classId_day_period` -> blockId
    const teacherDayLoad = {};   // `teacherId_day` -> count

    for (const block of blocks) {
      for (const period of block.periods) {
        // Teacher clash detection
        if (block.teacher) {
          const tid = (block.teacher._id || block.teacher).toString();
          const tKey = `${tid}_${block.day}_${period}`;
          if (teacherSchedule[tKey]) {
            const conflictingBlock = blocks.find(b => b._id.toString() === teacherSchedule[tKey]);
            newConflicts.push({
              timetable: timetableId,
              type: 'teacher_clash',
              severity: 'critical',
              day: block.day,
              period,
              teacher: tid,
              classes: [...(block.classes?.map(c => c._id || c) || [])],
              subject: block.subject?._id || block.subject,
              blocks: [block._id, teacherSchedule[tKey]],
              title: `Teacher Double-Booked`,
              message: `${block.teacher?.name || 'Teacher'} is assigned to two blocks on ${block.day} Period ${period}`,
              suggestedFix: `Move one block to a different period`,
              groupId: `teacher_${tid}_${block.day}`,
              autoResolvable: false
            });
          }
          teacherSchedule[tKey] = block._id.toString();

          // Track daily load
          const dayKey = `${tid}_${block.day}`;
          teacherDayLoad[dayKey] = (teacherDayLoad[dayKey] || 0) + 1;
        }

        // Room clash detection
        if (block.room) {
          const rid = (block.room._id || block.room).toString();
          const rKey = `${rid}_${block.day}_${period}`;
          if (roomSchedule[rKey]) {
            newConflicts.push({
              timetable: timetableId,
              type: 'room_clash',
              severity: 'high',
              day: block.day,
              period,
              room: rid,
              blocks: [block._id, roomSchedule[rKey]],
              title: `Room Double-Booked`,
              message: `${block.room?.name || 'Room'} is assigned to two blocks on ${block.day} Period ${period}`,
              suggestedFix: `Reassign one block to a different room`,
              groupId: `room_${rid}_${block.day}`,
              autoResolvable: true
            });
          }
          roomSchedule[rKey] = block._id.toString();
        }

        // Class clash detection
        for (const cls of (block.classes || [])) {
          const cid = (cls._id || cls).toString();
          const cKey = `${cid}_${block.day}_${period}`;
          if (classSchedule[cKey] && block.type !== 'split_group') {
            newConflicts.push({
              timetable: timetableId,
              type: 'class_clash',
              severity: 'critical',
              day: block.day,
              period,
              classes: [cid],
              blocks: [block._id, classSchedule[cKey]],
              title: `Class Double-Booked`,
              message: `${cls?.name || 'Class'} has two lessons on ${block.day} Period ${period}`,
              suggestedFix: `Move one block to a different period`,
              groupId: `class_${cid}_${block.day}`,
              autoResolvable: false
            });
          }
          classSchedule[cKey] = block._id.toString();
        }
      }
    }

    // Teacher overload detection
    for (const [key, count] of Object.entries(teacherDayLoad)) {
      if (count > 6) {
        const [tid, day] = key.split('_');
        newConflicts.push({
          timetable: timetableId,
          type: 'teacher_overload',
          severity: 'medium',
          day,
          teacher: tid,
          title: `Teacher Overloaded`,
          message: `Teacher has ${count} periods on ${day} (max recommended: 6)`,
          suggestedFix: `Redistribute workload across days`,
          groupId: `overload_${tid}`,
          autoResolvable: false
        });
      }
    }

    // Save new conflicts
    if (newConflicts.length > 0) {
      await ConflictLog.insertMany(newConflicts);
    }

    // Update timetable conflict count
    tt.conflicts = newConflicts.length;
    await tt.save();

    res.json({
      success: true,
      data: {
        totalBlocks: blocks.length,
        conflictsFound: newConflicts.length,
        byType: {
          teacher_clash: newConflicts.filter(c => c.type === 'teacher_clash').length,
          room_clash: newConflicts.filter(c => c.type === 'room_clash').length,
          class_clash: newConflicts.filter(c => c.type === 'class_clash').length,
          teacher_overload: newConflicts.filter(c => c.type === 'teacher_overload').length
        }
      }
    });
  } catch (err) { next(err); }
};
