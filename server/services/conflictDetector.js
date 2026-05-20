const TimetableSlot = require('../models/TimetableSlot');

/**
 * Conflict Detector Service
 * Scans the timetable for scheduling conflicts
 */
class ConflictDetector {
  /**
   * Detect all conflicts in the current timetable
   */
  static async detectAll(version = 'v1') {
    const slots = await TimetableSlot.find({ timetableVersion: version, isBreak: false })
      .populate('class teacher subject room');

    const conflicts = [];
    let conflictId = 1;

    // Group slots by day+period for comparison
    const slotMap = {};
    for (const slot of slots) {
      const key = `${slot.day}_${slot.period}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push(slot);
    }

    for (const [timeKey, timeSlots] of Object.entries(slotMap)) {
      const [day, period] = timeKey.split('_');

      // 1. Teacher clash detection
      const teacherMap = {};
      for (const slot of timeSlots) {
        if (!slot.teacher) continue;
        const tid = slot.teacher._id.toString();
        if (!teacherMap[tid]) teacherMap[tid] = [];
        teacherMap[tid].push(slot);
      }
      for (const [tid, teacherSlots] of Object.entries(teacherMap)) {
        if (teacherSlots.length > 1) {
          conflicts.push({
            id: `conflict_${conflictId++}`,
            type: 'teacher_clash',
            severity: 'high',
            day,
            period: parseInt(period),
            teacher: teacherSlots[0].teacher,
            slots: teacherSlots.map(s => ({
              slotId: s._id,
              class: s.class,
              subject: s.subject,
              room: s.room
            })),
            message: `${teacherSlots[0].teacher.name} is assigned to ${teacherSlots.length} classes at ${day} Period ${period}`
          });
        }
      }

      // 2. Room clash detection
      const roomMap = {};
      for (const slot of timeSlots) {
        if (!slot.room) continue;
        const rid = slot.room._id.toString();
        if (!roomMap[rid]) roomMap[rid] = [];
        roomMap[rid].push(slot);
      }
      for (const [rid, roomSlots] of Object.entries(roomMap)) {
        if (roomSlots.length > 1) {
          conflicts.push({
            id: `conflict_${conflictId++}`,
            type: 'room_clash',
            severity: 'medium',
            day,
            period: parseInt(period),
            room: roomSlots[0].room,
            slots: roomSlots.map(s => ({
              slotId: s._id,
              class: s.class,
              teacher: s.teacher,
              subject: s.subject
            })),
            message: `Room ${roomSlots[0].room.name} is double-booked at ${day} Period ${period}`
          });
        }
      }
    }

    // 3. Teacher overload detection (per day)
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const teacherDayLoad = {};
    for (const slot of slots) {
      if (!slot.teacher) continue;
      const tid = slot.teacher._id.toString();
      const key = `${tid}_${slot.day}`;
      if (!teacherDayLoad[key]) {
        teacherDayLoad[key] = { teacher: slot.teacher, day: slot.day, count: 0, max: slot.teacher.maxPeriodsPerDay || 6 };
      }
      teacherDayLoad[key].count++;
    }
    for (const [key, data] of Object.entries(teacherDayLoad)) {
      if (data.count > data.max) {
        conflicts.push({
          id: `conflict_${conflictId++}`,
          type: 'teacher_overload',
          severity: 'low',
          day: data.day,
          teacher: data.teacher,
          currentLoad: data.count,
          maxLoad: data.max,
          message: `${data.teacher.name} has ${data.count} periods on ${data.day} (max: ${data.max})`
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if a specific slot change would create conflicts
   */
  static async checkSlotConflict(day, period, teacherId, roomId, excludeSlotId = null, version = 'v1') {
    const conflicts = [];
    const query = { day, period: parseInt(period), timetableVersion: version, isBreak: false };
    if (excludeSlotId) query._id = { $ne: excludeSlotId };

    // Check teacher clash
    if (teacherId) {
      const teacherClash = await TimetableSlot.findOne({ ...query, teacher: teacherId }).populate('class subject');
      if (teacherClash) {
        conflicts.push({
          type: 'teacher_clash',
          message: `Teacher already assigned to ${teacherClash.class?.name} for ${teacherClash.subject?.name} at this time`
        });
      }
    }

    // Check room clash
    if (roomId) {
      const roomClash = await TimetableSlot.findOne({ ...query, room: roomId }).populate('class teacher');
      if (roomClash) {
        conflicts.push({
          type: 'room_clash',
          message: `Room already occupied by ${roomClash.class?.name} with ${roomClash.teacher?.name} at this time`
        });
      }
    }

    return conflicts;
  }
}

module.exports = ConflictDetector;
