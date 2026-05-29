/**
 * ManualLessonValidator — Validates lesson placement for the manual timetable builder.
 * 
 * Returns { status: 'allowed'|'warning'|'blocked', messages: [...] }
 */
const LessonBlock = require('../../models/LessonBlock');
const SubjectRequirement = require('../../models/SubjectRequirement');
const PeriodStructure = require('../../models/PeriodStructure');
const CanTeach = require('../../models/CanTeach');
const Room = require('../../models/Room');
const Teacher = require('../../models/Teacher');

class ManualLessonValidator {
  /**
   * Validate a lesson placement.
   * @param {Object} params
   * @param {string} params.timetableId
   * @param {string} params.schoolId
   * @param {string} params.sessionId
   * @param {Object} params.lesson - { classId, subjectId, teacherId, roomId, day, period, duration, type }
   * @param {string} [params.excludeBlockId] - Block ID to exclude from conflict checks (for moves/updates)
   * @returns {{ status: 'allowed'|'warning'|'blocked', messages: Array<{type, message, code}> }}
   */
  async validate(params) {
    const { timetableId, schoolId, sessionId, lesson, excludeBlockId } = params;
    const { classId, subjectId, teacherId, roomId, day, period, duration = 1, type = 'normal' } = lesson;
    const messages = [];
    const periods = Array.from({ length: duration }, (_, i) => period + i);

    // 1. Period/Break validity check
    const breakCheck = await this._checkPeriodValidity(schoolId, sessionId, day, periods);
    if (breakCheck) messages.push(breakCheck);

    // 2. Teacher conflict check
    if (teacherId) {
      const teacherConflict = await this._checkTeacherConflict(timetableId, teacherId, day, periods, excludeBlockId);
      if (teacherConflict) messages.push(teacherConflict);
    }

    // 3. Class conflict check
    if (classId) {
      const classConflict = await this._checkClassConflict(timetableId, classId, day, periods, excludeBlockId);
      if (classConflict) messages.push(classConflict);
    }

    // 4. Room conflict check
    if (roomId) {
      const roomConflict = await this._checkRoomConflict(timetableId, roomId, day, periods, excludeBlockId);
      if (roomConflict) messages.push(roomConflict);
    }

    // 5. Room capacity check
    if (roomId && classId) {
      const capacityCheck = await this._checkRoomCapacity(roomId, classId);
      if (capacityCheck) messages.push(capacityCheck);
    }

    // 6. Teacher capability check
    if (teacherId && subjectId) {
      const capCheck = await this._checkTeacherCapability(schoolId, sessionId, teacherId, subjectId);
      if (capCheck) messages.push(capCheck);
    }

    // 7. Teacher workload check
    if (teacherId) {
      const workload = await this._checkTeacherWorkload(timetableId, teacherId, day, excludeBlockId);
      if (workload) messages.push(workload);
    }

    // 8. Subject daily/weekly load check
    if (subjectId && classId) {
      const loadChecks = await this._checkSubjectLoad(timetableId, schoolId, sessionId, classId, subjectId, day, duration, excludeBlockId);
      messages.push(...loadChecks);
    }

    // Determine overall status
    const hasBlocked = messages.some(m => m.type === 'blocked');
    const hasWarning = messages.some(m => m.type === 'warning');
    const status = hasBlocked ? 'blocked' : hasWarning ? 'warning' : 'allowed';

    if (status === 'allowed' && messages.length === 0) {
      messages.push({ type: 'info', message: 'No conflicts found. This lesson can be added.', code: 'OK' });
    }

    return { status, messages };
  }

  async _checkPeriodValidity(schoolId, sessionId, day, periods) {
    try {
      const ps = await PeriodStructure.findOne({ school: schoolId, session: sessionId, status: 'active' });
      if (!ps) return null;

      const daySlots = day === 'Saturday' && ps.saturdayConfig?.enabled
        ? ps.saturdayConfig.timeslots
        : ps.timeslots;

      for (const p of periods) {
        const slot = daySlots?.find(s => s.slotNumber === p);
        if (slot && (slot.type === 'break' || slot.type === 'lunch')) {
          return { type: 'blocked', message: `Period ${p} is a ${slot.type} slot (${slot.label}) and cannot contain a normal lesson.`, code: 'BREAK_SLOT' };
        }
        if (!slot || !slot.isSchedulable) {
          return { type: 'blocked', message: `Period ${p} is not schedulable on ${day}.`, code: 'UNSCHEDULABLE' };
        }
      }
    } catch { /* skip */ }
    return null;
  }

  async _checkTeacherConflict(timetableId, teacherId, day, periods, excludeBlockId) {
    const query = {
      timetable: timetableId,
      teacher: teacherId,
      day,
      periods: { $in: periods }
    };
    if (excludeBlockId) query._id = { $ne: excludeBlockId };

    const conflict = await LessonBlock.findOne(query)
      .populate('classes', 'grade section')
      .populate('subject', 'name');

    if (conflict) {
      const className = conflict.classes?.[0] ? `Class ${conflict.classes[0].grade}-${conflict.classes[0].section}` : 'another class';
      return {
        type: 'blocked',
        message: `This teacher is already teaching ${className} (${conflict.subject?.name || 'a subject'}) in period ${conflict.periods.join(',')} on ${day}.`,
        code: 'TEACHER_CONFLICT'
      };
    }
    return null;
  }

  async _checkClassConflict(timetableId, classId, day, periods, excludeBlockId) {
    const query = {
      timetable: timetableId,
      classes: classId,
      day,
      periods: { $in: periods }
    };
    if (excludeBlockId) query._id = { $ne: excludeBlockId };

    const conflict = await LessonBlock.findOne(query)
      .populate('subject', 'name')
      .populate('teacher', 'name');

    if (conflict) {
      return {
        type: 'blocked',
        message: `This class already has ${conflict.subject?.name || 'a lesson'} with ${conflict.teacher?.name || 'a teacher'} in this period.`,
        code: 'CLASS_CONFLICT'
      };
    }
    return null;
  }

  async _checkRoomConflict(timetableId, roomId, day, periods, excludeBlockId) {
    const query = {
      timetable: timetableId,
      room: roomId,
      day,
      periods: { $in: periods }
    };
    if (excludeBlockId) query._id = { $ne: excludeBlockId };

    const conflict = await LessonBlock.findOne(query);
    if (conflict) {
      const room = await Room.findById(roomId);
      return {
        type: 'blocked',
        message: `${room?.name || 'This room'} is already used in period ${conflict.periods.join(',')} on ${day}.`,
        code: 'ROOM_CONFLICT'
      };
    }
    return null;
  }

  async _checkRoomCapacity(roomId, classId) {
    try {
      const room = await Room.findById(roomId);
      const Class = require('../../models/Class');
      const cls = await Class.findById(classId);
      if (room && cls && cls.studentCount > room.capacity) {
        return {
          type: 'warning',
          message: `${room.name} has capacity ${room.capacity} but class has ${cls.studentCount} students.`,
          code: 'ROOM_CAPACITY'
        };
      }
    } catch { /* skip */ }
    return null;
  }

  async _checkTeacherCapability(schoolId, sessionId, teacherId, subjectId) {
    const canTeach = await CanTeach.findOne({
      school: schoolId, session: sessionId,
      teacher: teacherId, subject: subjectId, isActive: true
    });
    if (!canTeach) {
      const teacher = await Teacher.findById(teacherId);
      const Subject = require('../../models/Subject');
      const subject = await Subject.findById(subjectId);
      return {
        type: 'blocked',
        message: `${teacher?.name || 'This teacher'} is not marked as capable of teaching ${subject?.name || 'this subject'}.`,
        code: 'TEACHER_CAPABILITY'
      };
    }
    return null;
  }

  async _checkTeacherWorkload(timetableId, teacherId, day, excludeBlockId) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return null;

    // Daily load
    const dailyQuery = { timetable: timetableId, teacher: teacherId, day };
    if (excludeBlockId) dailyQuery._id = { $ne: excludeBlockId };
    const dailyBlocks = await LessonBlock.find(dailyQuery);
    const dailyPeriods = dailyBlocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);

    if (dailyPeriods >= (teacher.maxPeriodsPerDay || 6)) {
      return {
        type: 'warning',
        message: `${teacher.name} already has ${dailyPeriods}/${teacher.maxPeriodsPerDay || 6} periods on ${day}. Adding more may overload.`,
        code: 'TEACHER_DAILY_OVERLOAD'
      };
    }

    // Weekly load
    const weeklyQuery = { timetable: timetableId, teacher: teacherId };
    if (excludeBlockId) weeklyQuery._id = { $ne: excludeBlockId };
    const weeklyBlocks = await LessonBlock.find(weeklyQuery);
    const weeklyPeriods = weeklyBlocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);

    if (weeklyPeriods >= (teacher.maxPeriodsPerWeek || 30)) {
      return {
        type: 'warning',
        message: `${teacher.name} has ${weeklyPeriods}/${teacher.maxPeriodsPerWeek || 30} weekly periods assigned. Near max capacity.`,
        code: 'TEACHER_WEEKLY_OVERLOAD'
      };
    }

    return null;
  }

  async _checkSubjectLoad(timetableId, schoolId, sessionId, classId, subjectId, day, duration, excludeBlockId) {
    const messages = [];

    // Get requirement
    const req = await SubjectRequirement.findOne({
      school: schoolId, session: sessionId,
      class: classId, subject: subjectId, isActive: true
    });

    if (!req) return messages; // No requirement defined, allow freely

    // Weekly count
    const weeklyQuery = { timetable: timetableId, classes: classId, subject: subjectId };
    if (excludeBlockId) weeklyQuery._id = { $ne: excludeBlockId };
    const weeklyBlocks = await LessonBlock.find(weeklyQuery);
    const weeklyPeriods = weeklyBlocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);

    if (weeklyPeriods + duration > req.periodsPerWeek) {
      messages.push({
        type: 'warning',
        message: `This subject already has ${weeklyPeriods} of ${req.periodsPerWeek} weekly periods assigned. Adding ${duration} more will exceed the requirement.`,
        code: 'SUBJECT_WEEKLY_EXCESS'
      });
    } else if (weeklyPeriods + duration === req.periodsPerWeek) {
      messages.push({
        type: 'info',
        message: `This will complete the weekly requirement (${req.periodsPerWeek}/${req.periodsPerWeek} periods).`,
        code: 'SUBJECT_WEEKLY_COMPLETE'
      });
    }

    // Daily check — subject max per day
    const Subject = require('../../models/Subject');
    const subject = await Subject.findById(subjectId);
    const maxPerDay = subject?.maxPerDay || 2;

    const dailyQuery = { timetable: timetableId, classes: classId, subject: subjectId, day };
    if (excludeBlockId) dailyQuery._id = { $ne: excludeBlockId };
    const dailyBlocks = await LessonBlock.find(dailyQuery);
    const dailyCount = dailyBlocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);

    if (dailyCount + duration > maxPerDay) {
      messages.push({
        type: 'warning',
        message: `${subject?.name || 'This subject'} already has ${dailyCount} period(s) on ${day}. Max recommended is ${maxPerDay} per day.`,
        code: 'SUBJECT_DAILY_EXCESS'
      });
    }

    return messages;
  }
}

module.exports = new ManualLessonValidator();
