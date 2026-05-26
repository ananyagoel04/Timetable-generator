const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const Class = require('../models/Class');
const CanTeach = require('../models/CanTeach');
const AuditLog = require('../models/AuditLog');

class TimetableEditor {
  constructor(timetableId) {
    this.timetableId = timetableId;
    // In-memory undo/redo stacks (per-session; not persisted across server restarts)
    this._undoStack = [];
    this._redoStack = [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // MOVE BLOCK
  // ═══════════════════════════════════════════════════════════════════
  async moveBlock(blockId, newDay, newPeriod, userId, reason) {
    const block = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    if (!block) return { success: false, error: 'Block not found' };
    if (block.isLocked) return { success: false, error: 'Block is locked' };

    const warnings = [];
    const before = { day: block.day, periods: [...block.periods] };

    // Validate target slot
    const classIds = block.classes.map(c => c._id || c);
    const classFree = await this._isClassSlotFree(classIds, newDay, newPeriod, blockId);
    if (!classFree) return { success: false, error: 'Target slot occupied for this class' };

    if (block.teacher) {
      const teacherFree = await this._isTeacherFree(block.teacher._id || block.teacher, newDay, newPeriod, blockId);
      if (!teacherFree) return { success: false, error: 'Teacher busy at target slot', warnings };
    }
    if (block.room) {
      const roomFree = await this._isRoomFree(block.room._id || block.room, newDay, newPeriod, blockId);
      if (!roomFree) warnings.push('Room conflict — will need reassignment');
    }

    // Consecutive group warning
    if (block.consecutiveGroupId) {
      warnings.push('This block is part of a consecutive sequence. Moving it will break continuity.');
    }

    // Save undo state
    this._pushUndo('move', blockId, before);

    // Apply move
    block.day = newDay;
    block.periods = [newPeriod];
    block.isManualOverride = true;
    block.editHistory.push({
      action: 'move', before, after: { day: newDay, periods: [newPeriod] },
      userId, reason, timestamp: new Date()
    });
    await block.save();

    await this._createAuditLog(block, 'move', before, { day: newDay, periods: [newPeriod] }, userId);

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings, canUndo: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SWAP BLOCKS
  // ═══════════════════════════════════════════════════════════════════
  async swapBlocks(blockAId, blockBId, userId, reason) {
    const [blockA, blockB] = await Promise.all([
      LessonBlock.findById(blockAId).populate('subject teacher room classes'),
      LessonBlock.findById(blockBId).populate('subject teacher room classes')
    ]);
    if (!blockA || !blockB) return { success: false, error: 'Block not found' };
    if (blockA.isLocked || blockB.isLocked) return { success: false, error: 'Cannot swap locked blocks' };

    const warnings = [];
    const beforeA = { day: blockA.day, periods: [...blockA.periods] };
    const beforeB = { day: blockB.day, periods: [...blockB.periods] };

    // Validate teacher conflicts after swap
    if (blockA.teacher) {
      const tid = (blockA.teacher._id || blockA.teacher).toString();
      const conflict = await LessonBlock.findOne({
        timetable: this.timetableId, teacher: tid, day: blockB.day, periods: { $in: blockB.periods },
        _id: { $nin: [blockAId, blockBId] }
      });
      if (conflict) warnings.push(`Teacher ${blockA.teacher.name || tid} has conflict at ${blockB.day} P${blockB.periods[0]}`);
    }
    if (blockB.teacher) {
      const tid = (blockB.teacher._id || blockB.teacher).toString();
      const conflict = await LessonBlock.findOne({
        timetable: this.timetableId, teacher: tid, day: blockA.day, periods: { $in: blockA.periods },
        _id: { $nin: [blockAId, blockBId] }
      });
      if (conflict) warnings.push(`Teacher ${blockB.teacher.name || tid} has conflict at ${blockA.day} P${blockA.periods[0]}`);
    }

    if (blockA.consecutiveGroupId || blockB.consecutiveGroupId) {
      warnings.push('One or both blocks are part of a consecutive sequence. Swapping may break continuity.');
    }

    // Save undo state
    this._pushUndo('swap', blockAId, beforeA, blockBId, beforeB);

    // Swap
    blockA.day = beforeB.day; blockA.periods = beforeB.periods;
    blockB.day = beforeA.day; blockB.periods = beforeA.periods;
    blockA.isManualOverride = true; blockB.isManualOverride = true;
    blockA.editHistory.push({ action: 'swap', before: beforeA, after: { day: blockA.day, periods: blockA.periods }, userId, reason });
    blockB.editHistory.push({ action: 'swap', before: beforeB, after: { day: blockB.day, periods: blockB.periods }, userId, reason });
    await blockA.save(); await blockB.save();

    await AuditLog.create({
      action: 'manual_edit', entityType: 'LessonBlock', entityId: blockAId,
      details: { type: 'swap', blockA: { before: beforeA, after: { day: blockA.day, periods: blockA.periods } }, blockB: { before: beforeB, after: { day: blockB.day, periods: blockB.periods } } },
      performedBy: userId
    });

    return { success: true, blockA, blockB, warnings, canUndo: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // REASSIGN TEACHER
  // ═══════════════════════════════════════════════════════════════════
  async reassignTeacher(blockId, newTeacherId, userId, reason) {
    const block = await LessonBlock.findById(blockId).populate('subject teacher classes');
    if (!block) return { success: false, error: 'Block not found' };

    const newTeacher = await Teacher.findById(newTeacherId);
    if (!newTeacher) return { success: false, error: 'Teacher not found' };

    const warnings = [];
    const before = { teacher: block.teacher?._id || block.teacher };

    // Check CanTeach capability
    if (block.subject) {
      const subjectId = (block.subject._id || block.subject).toString();
      const classId = block.classes?.[0]?._id?.toString();
      const canTeachMapping = await CanTeach.findOne({
        teacher: newTeacherId, subject: subjectId, isActive: true
      });
      const hasLegacyCap = newTeacher.capabilities?.some(c =>
        (c.subject?._id || c.subject)?.toString() === subjectId
      );
      if (!canTeachMapping && !hasLegacyCap) {
        warnings.push('Teacher does not have CanTeach capability for this subject');
      }
    }

    // Check availability
    const free = await this._isTeacherFree(newTeacherId, block.day, block.periods[0], blockId);
    if (!free) return { success: false, error: 'Teacher is busy at this slot', warnings };

    this._pushUndo('reassign_teacher', blockId, before);

    block.teacher = newTeacherId;
    block.isManualOverride = true;
    block.editHistory.push({
      action: 'reassign_teacher', before, after: { teacher: newTeacherId },
      userId, reason
    });
    await block.save();

    await this._createAuditLog(block, 'reassign_teacher', before, { teacher: newTeacherId }, userId);

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings, canUndo: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // REASSIGN ROOM
  // ═══════════════════════════════════════════════════════════════════
  async reassignRoom(blockId, newRoomId, userId, reason) {
    const block = await LessonBlock.findById(blockId).populate('room classes');
    if (!block) return { success: false, error: 'Block not found' };

    const newRoom = await Room.findById(newRoomId);
    if (!newRoom) return { success: false, error: 'Room not found' };

    const warnings = [];
    const before = { room: block.room?._id || block.room };

    const totalStudents = block.classes.reduce((sum, c) => sum + (c.studentCount || 30), 0);
    if (newRoom.capacity < totalStudents) {
      warnings.push(`Room capacity (${newRoom.capacity}) is less than class size (${totalStudents})`);
    }

    const free = await this._isRoomFree(newRoomId, block.day, block.periods[0], blockId);
    if (!free) return { success: false, error: 'Room is occupied at this slot', warnings };

    this._pushUndo('reassign_room', blockId, before);

    block.room = newRoomId;
    block.isManualOverride = true;
    block.editHistory.push({
      action: 'reassign_room', before, after: { room: newRoomId },
      userId, reason
    });
    await block.save();

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings, canUndo: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOCK / UNLOCK
  // ═══════════════════════════════════════════════════════════════════
  async lockBlock(blockId, userId) {
    const block = await LessonBlock.findById(blockId);
    if (!block) return { success: false, error: 'Block not found' };
    block.isLocked = true;
    block.editHistory.push({ action: 'lock', before: { isLocked: false }, after: { isLocked: true }, userId, timestamp: new Date() });
    await block.save();

    await this._createAuditLog(block, 'lock', { isLocked: false }, { isLocked: true }, userId);
    return { success: true, block };
  }

  async unlockBlock(blockId, userId) {
    const block = await LessonBlock.findById(blockId);
    if (!block) return { success: false, error: 'Block not found' };
    block.isLocked = false;
    block.editHistory.push({ action: 'unlock', before: { isLocked: true }, after: { isLocked: false }, userId, timestamp: new Date() });
    await block.save();

    await this._createAuditLog(block, 'unlock', { isLocked: true }, { isLocked: false }, userId);
    return { success: true, block };
  }

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATE MOVE (Preview conflicts without applying)
  // ═══════════════════════════════════════════════════════════════════
  async validateMove(blockId, newDay, newPeriod) {
    const block = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    if (!block) return { valid: false, conflicts: ['Block not found'], warnings: [] };
    if (block.isLocked) return { valid: false, conflicts: ['Block is locked'], warnings: [] };

    const conflicts = []; const warnings = [];
    const classIds = block.classes.map(c => c._id || c);

    const classFree = await this._isClassSlotFree(classIds, newDay, newPeriod, blockId);
    if (!classFree) conflicts.push('Target slot occupied for this class');

    if (block.teacher) {
      const teacherFree = await this._isTeacherFree(block.teacher._id || block.teacher, newDay, newPeriod, blockId);
      if (!teacherFree) conflicts.push('Teacher is busy at target slot');
    }
    if (block.room) {
      const roomFree = await this._isRoomFree(block.room._id || block.room, newDay, newPeriod, blockId);
      if (!roomFree) warnings.push('Room is occupied — will need reassignment');
    }
    if (block.combinationRule) warnings.push('This is a combined-class block — all linked classes will be affected');
    if (block.linkedBlockId) warnings.push('This block is linked to another — check linked block compatibility');
    if (block.consecutiveGroupId) {
      const groupBlocks = await LessonBlock.find({
        timetable: this.timetableId, consecutiveGroupId: block.consecutiveGroupId,
        _id: { $ne: blockId }
      });
      warnings.push(`This block is part of a consecutive group (${groupBlocks.length + 1} blocks). Moving it will break continuity.`);
    }

    return { valid: conflicts.length === 0, conflicts, warnings };
  }

  // ═══════════════════════════════════════════════════════════════════
  // UNDO / REDO
  // ═══════════════════════════════════════════════════════════════════
  async undo(userId) {
    if (this._undoStack.length === 0) return { success: false, error: 'Nothing to undo' };
    const action = this._undoStack.pop();

    if (action.type === 'move') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentState = { day: block.day, periods: [...block.periods] };
      block.day = action.before.day;
      block.periods = action.before.periods;
      block.editHistory.push({ action: 'undo_move', before: currentState, after: action.before, userId, timestamp: new Date() });
      await block.save();
      this._redoStack.push({ ...action, before: currentState });
    } else if (action.type === 'swap') {
      const [blockA, blockB] = await Promise.all([
        LessonBlock.findById(action.blockId),
        LessonBlock.findById(action.blockBId)
      ]);
      if (!blockA || !blockB) return { success: false, error: 'Blocks no longer exist' };
      const currentA = { day: blockA.day, periods: [...blockA.periods] };
      const currentB = { day: blockB.day, periods: [...blockB.periods] };
      blockA.day = action.before.day; blockA.periods = action.before.periods;
      blockB.day = action.beforeB.day; blockB.periods = action.beforeB.periods;
      await blockA.save(); await blockB.save();
      this._redoStack.push({ ...action, before: currentA, beforeB: currentB });
    } else if (action.type === 'reassign_teacher') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentTeacher = block.teacher;
      block.teacher = action.before.teacher;
      block.editHistory.push({ action: 'undo_reassign_teacher', before: { teacher: currentTeacher }, after: action.before, userId, timestamp: new Date() });
      await block.save();
      this._redoStack.push({ ...action, before: { teacher: currentTeacher } });
    } else if (action.type === 'reassign_room') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentRoom = block.room;
      block.room = action.before.room;
      block.editHistory.push({ action: 'undo_reassign_room', before: { room: currentRoom }, after: action.before, userId, timestamp: new Date() });
      await block.save();
      this._redoStack.push({ ...action, before: { room: currentRoom } });
    }

    return { success: true, undoRemaining: this._undoStack.length, redoAvailable: this._redoStack.length };
  }

  async redo(userId) {
    if (this._redoStack.length === 0) return { success: false, error: 'Nothing to redo' };
    const action = this._redoStack.pop();

    if (action.type === 'move') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentState = { day: block.day, periods: [...block.periods] };
      // Redo = apply the original "after" state (the before in redo entry is the current state before undo)
      // We need to move to where it was before undo reversed it
      block.day = action.before.day;
      block.periods = action.before.periods;
      block.editHistory.push({ action: 'redo_move', before: currentState, after: action.before, userId, timestamp: new Date() });
      await block.save();
      this._undoStack.push({ ...action, before: currentState });
    } else if (action.type === 'swap') {
      const [blockA, blockB] = await Promise.all([
        LessonBlock.findById(action.blockId),
        LessonBlock.findById(action.blockBId)
      ]);
      if (!blockA || !blockB) return { success: false, error: 'Blocks no longer exist' };
      const currentA = { day: blockA.day, periods: [...blockA.periods] };
      const currentB = { day: blockB.day, periods: [...blockB.periods] };
      blockA.day = action.before.day; blockA.periods = action.before.periods;
      blockB.day = action.beforeB.day; blockB.periods = action.beforeB.periods;
      await blockA.save(); await blockB.save();
      this._undoStack.push({ ...action, before: currentA, beforeB: currentB });
    } else if (action.type === 'reassign_teacher') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentTeacher = block.teacher;
      block.teacher = action.before.teacher;
      await block.save();
      this._undoStack.push({ ...action, before: { teacher: currentTeacher } });
    } else if (action.type === 'reassign_room') {
      const block = await LessonBlock.findById(action.blockId);
      if (!block) return { success: false, error: 'Block no longer exists' };
      const currentRoom = block.room;
      block.room = action.before.room;
      await block.save();
      this._undoStack.push({ ...action, before: { room: currentRoom } });
    }

    return { success: true, undoRemaining: this._undoStack.length, redoAvailable: this._redoStack.length };
  }

  getUndoStatus() {
    const lastAction = this._undoStack.length > 0 ? this._undoStack[this._undoStack.length - 1] : null;
    const lastRedo = this._redoStack.length > 0 ? this._redoStack[this._redoStack.length - 1] : null;
    return {
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
      lastUndoAction: lastAction ? lastAction.type : null,
      lastRedoAction: lastRedo ? lastRedo.type : null
    };
  }

  async getEditHistory(blockId) {
    const block = await LessonBlock.findById(blockId).select('editHistory');
    if (!block) return [];
    return (block.editHistory || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════
  _pushUndo(type, blockId, before, blockBId, beforeB) {
    this._undoStack.push({ type, blockId, before, blockBId, beforeB });
    this._redoStack = []; // Clear redo on new action
    // Limit undo stack
    if (this._undoStack.length > 50) this._undoStack.shift();
  }

  async _createAuditLog(block, actionType, before, after, userId) {
    try {
      const schoolId = block.classes?.[0]?.school || block.classes?.[0];
      await AuditLog.create({
        school: schoolId, action: 'manual_edit', entityType: 'LessonBlock',
        entityId: block._id,
        details: { type: actionType, before, after },
        performedBy: userId
      });
    } catch (e) { /* non-critical */ }
  }

  async _isTeacherFree(teacherId, day, period, excludeBlockId) {
    const conflict = await LessonBlock.findOne({
      timetable: this.timetableId, teacher: teacherId, day, periods: period,
      _id: { $ne: excludeBlockId }, type: { $ne: 'reserved' }
    });
    return !conflict;
  }

  async _isRoomFree(roomId, day, period, excludeBlockId) {
    const conflict = await LessonBlock.findOne({
      timetable: this.timetableId, room: roomId, day, periods: period,
      _id: { $ne: excludeBlockId }, type: { $ne: 'reserved' }
    });
    return !conflict;
  }

  async _isClassSlotFree(classIds, day, period, excludeBlockId) {
    const conflict = await LessonBlock.findOne({
      timetable: this.timetableId, classes: { $in: classIds }, day, periods: period,
      _id: { $ne: excludeBlockId }, type: { $nin: ['reserved', 'free'] }
    });
    return !conflict;
  }
}

module.exports = TimetableEditor;

