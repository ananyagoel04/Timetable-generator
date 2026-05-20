const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const Class = require('../models/Class');
const AuditLog = require('../models/AuditLog');

class TimetableEditor {
  constructor(timetableId) {
    this.timetableId = timetableId;
  }

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
      if (!teacherFree) { warnings.push('Teacher conflict at target slot'); return { success: false, error: 'Teacher busy at target slot', warnings }; }
    }
    if (block.room) {
      const roomFree = await this._isRoomFree(block.room._id || block.room, newDay, newPeriod, blockId);
      if (!roomFree) warnings.push('Room conflict — will need reassignment');
    }

    // Apply move
    block.day = newDay;
    block.periods = [newPeriod];
    block.isManualOverride = true;
    block.editHistory.push({ action: 'move', before, after: { day: newDay, periods: [newPeriod] }, userId, reason, timestamp: new Date() });
    await block.save();

    await AuditLog.create({ school: block.classes[0]?.school, action: 'timetable_edit', entity: 'LessonBlock', entityId: blockId,
      details: { type: 'move', before, after: { day: newDay, periods: [newPeriod] } }, performedBy: userId });

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings };
  }

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

    // Swap
    blockA.day = beforeB.day; blockA.periods = beforeB.periods;
    blockB.day = beforeA.day; blockB.periods = beforeA.periods;
    blockA.isManualOverride = true; blockB.isManualOverride = true;
    blockA.editHistory.push({ action: 'swap', before: beforeA, after: { day: blockA.day, periods: blockA.periods }, userId, reason });
    blockB.editHistory.push({ action: 'swap', before: beforeB, after: { day: blockB.day, periods: blockB.periods }, userId, reason });
    await blockA.save(); await blockB.save();

    await AuditLog.create({ action: 'timetable_edit', entity: 'LessonBlock', entityId: blockAId,
      details: { type: 'swap', blockA: { before: beforeA, after: { day: blockA.day, periods: blockA.periods } }, blockB: { before: beforeB, after: { day: blockB.day, periods: blockB.periods } } }, performedBy: userId });

    return { success: true, blockA, blockB, warnings };
  }

  async reassignTeacher(blockId, newTeacherId, userId, reason) {
    const block = await LessonBlock.findById(blockId).populate('subject teacher classes');
    if (!block) return { success: false, error: 'Block not found' };

    const newTeacher = await Teacher.findById(newTeacherId);
    if (!newTeacher) return { success: false, error: 'Teacher not found' };

    const warnings = [];
    const before = { teacher: block.teacher?._id || block.teacher };

    // Check capability
    if (block.subject) {
      const subjectId = (block.subject._id || block.subject).toString();
      const canTeach = newTeacher.subjects?.some(s => s.toString() === subjectId) ||
                       newTeacher.capabilities?.some(c => c.subject?.toString() === subjectId);
      if (!canTeach) warnings.push('Teacher may not have capability for this subject');
    }

    // Check availability
    const free = await this._isTeacherFree(newTeacherId, block.day, block.periods[0], blockId);
    if (!free) return { success: false, error: 'Teacher is busy at this slot', warnings };

    block.teacher = newTeacherId;
    block.isManualOverride = true;
    block.editHistory.push({ action: 'reassign_teacher', before, after: { teacher: newTeacherId }, userId, reason });
    await block.save();

    await AuditLog.create({ action: 'timetable_edit', entity: 'LessonBlock', entityId: blockId,
      details: { type: 'reassign_teacher', before, after: { teacher: newTeacherId } }, performedBy: userId });

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings };
  }

  async reassignRoom(blockId, newRoomId, userId, reason) {
    const block = await LessonBlock.findById(blockId).populate('room classes');
    if (!block) return { success: false, error: 'Block not found' };

    const newRoom = await Room.findById(newRoomId);
    if (!newRoom) return { success: false, error: 'Room not found' };

    const warnings = [];
    const before = { room: block.room?._id || block.room };

    // Check capacity
    const totalStudents = block.classes.reduce((sum, c) => sum + (c.studentCount || 30), 0);
    if (newRoom.capacity < totalStudents) warnings.push(`Room capacity (${newRoom.capacity}) is less than class size (${totalStudents})`);

    // Check availability
    const free = await this._isRoomFree(newRoomId, block.day, block.periods[0], blockId);
    if (!free) return { success: false, error: 'Room is occupied at this slot', warnings };

    block.room = newRoomId;
    block.isManualOverride = true;
    block.editHistory.push({ action: 'reassign_room', before, after: { room: newRoomId }, userId, reason });
    await block.save();

    const populated = await LessonBlock.findById(blockId).populate('subject teacher room classes');
    return { success: true, block: populated, warnings };
  }

  async validateMove(blockId, newDay, newPeriod) {
    const block = await LessonBlock.findById(blockId);
    if (!block) return { valid: false, conflicts: ['Block not found'], warnings: [] };
    if (block.isLocked) return { valid: false, conflicts: ['Block is locked'], warnings: [] };

    const conflicts = []; const warnings = [];
    const classIds = block.classes;

    const classFree = await this._isClassSlotFree(classIds, newDay, newPeriod, blockId);
    if (!classFree) conflicts.push('Target slot occupied for this class');

    if (block.teacher) {
      const teacherFree = await this._isTeacherFree(block.teacher, newDay, newPeriod, blockId);
      if (!teacherFree) conflicts.push('Teacher is busy at target slot');
    }
    if (block.room) {
      const roomFree = await this._isRoomFree(block.room, newDay, newPeriod, blockId);
      if (!roomFree) warnings.push('Room is occupied — will need reassignment');
    }
    if (block.combinationRule) warnings.push('This is a combined-class block — all linked classes will be affected');
    if (block.linkedBlockId) warnings.push('This block is linked to another — check linked block compatibility');

    return { valid: conflicts.length === 0, conflicts, warnings };
  }

  async getEditHistory(blockId) {
    const block = await LessonBlock.findById(blockId).select('editHistory').populate('editHistory.userId', 'name email');
    if (!block) return [];
    return (block.editHistory || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // --- Helpers ---
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
