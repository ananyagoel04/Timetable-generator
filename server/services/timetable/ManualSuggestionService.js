/**
 * ManualSuggestionService — Generates smart suggestions for manual timetable building.
 */
const LessonBlock = require('../../models/LessonBlock');
const SubjectRequirement = require('../../models/SubjectRequirement');
const CanTeach = require('../../models/CanTeach');
const Room = require('../../models/Room');
const Teacher = require('../../models/Teacher');
const PeriodStructure = require('../../models/PeriodStructure');

class ManualSuggestionService {
  /**
   * Suggest available teachers for a class+subject.
   */
  async suggestTeachers({ schoolId, sessionId, timetableId, classId, subjectId, day, period }) {
    // Find teachers that can teach this subject
    const canTeachEntries = await CanTeach.find({
      school: schoolId, session: sessionId, subject: subjectId, isActive: true
    }).populate('teacher', 'name shortName maxPeriodsPerDay maxPeriodsPerWeek');

    const suggestions = [];
    for (const ct of canTeachEntries) {
      if (!ct.teacher) continue;

      // Check if teacher is available at this day/period
      let available = true;
      let conflict = null;
      if (day && period) {
        const existing = await LessonBlock.findOne({
          timetable: timetableId, teacher: ct.teacher._id, day, periods: period
        }).populate('classes', 'grade section');
        if (existing) {
          available = false;
          conflict = `Teaching ${existing.classes?.[0] ? `${existing.classes[0].grade}-${existing.classes[0].section}` : 'another class'}`;
        }
      }

      // Get current daily/weekly load
      const dailyCount = day ? await LessonBlock.countDocuments({ timetable: timetableId, teacher: ct.teacher._id, day }) : 0;
      const weeklyCount = await LessonBlock.countDocuments({ timetable: timetableId, teacher: ct.teacher._id });

      suggestions.push({
        teacherId: ct.teacher._id,
        name: ct.teacher.name,
        shortName: ct.teacher.shortName,
        role: ct.role,
        priority: ct.priority,
        available,
        conflict,
        dailyLoad: dailyCount,
        maxDaily: ct.teacher.maxPeriodsPerDay || 6,
        weeklyLoad: weeklyCount,
        maxWeekly: ct.teacher.maxPeriodsPerWeek || 30
      });
    }

    // Sort: available first, then by priority, then by lower load
    suggestions.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.priority !== b.priority) return (b.priority || 0) - (a.priority || 0);
      return a.weeklyLoad - b.weeklyLoad;
    });

    return suggestions;
  }

  /**
   * Suggest available rooms for a period.
   */
  async suggestRooms({ schoolId, timetableId, day, period, type = 'classroom' }) {
    const rooms = await Room.find({ school: schoolId });

    const suggestions = [];
    for (const room of rooms) {
      let available = true;
      if (day && period) {
        const existing = await LessonBlock.findOne({
          timetable: timetableId, room: room._id, day, periods: period
        });
        available = !existing;
      }

      suggestions.push({
        roomId: room._id,
        name: room.name,
        roomNumber: room.roomNumber,
        type: room.type,
        capacity: room.capacity,
        floor: room.floor,
        available,
        isPreferred: room.type === type
      });
    }

    // Sort: available first, preferred type first, then by name
    suggestions.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return suggestions;
  }

  /**
   * Suggest best available periods for a class+subject.
   */
  async suggestPeriods({ schoolId, sessionId, timetableId, classId, subjectId, teacherId }) {
    const ps = await PeriodStructure.findOne({ school: schoolId, session: sessionId, status: 'active' });
    if (!ps) return [];

    const days = ps.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const suggestions = [];

    for (const day of days) {
      const daySlots = day === 'Saturday' && ps.saturdayConfig?.enabled
        ? ps.saturdayConfig.timeslots
        : ps.timeslots;

      for (const slot of (daySlots || [])) {
        if (!slot.isSchedulable || slot.type === 'break' || slot.type === 'lunch') continue;

        // Check class availability
        const classConflict = await LessonBlock.findOne({
          timetable: timetableId, classes: classId, day, periods: slot.slotNumber
        });

        // Check teacher availability
        let teacherConflict = null;
        if (teacherId) {
          teacherConflict = await LessonBlock.findOne({
            timetable: timetableId, teacher: teacherId, day, periods: slot.slotNumber
          });
        }

        const available = !classConflict && !teacherConflict;

        suggestions.push({
          day,
          period: slot.slotNumber,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available,
          classAvailable: !classConflict,
          teacherAvailable: !teacherConflict
        });
      }
    }

    return suggestions.filter(s => s.available);
  }

  /**
   * Get subject load progress for a class.
   */
  async getSubjectLoadProgress({ schoolId, sessionId, timetableId, classId }) {
    const reqs = await SubjectRequirement.find({
      school: schoolId, session: sessionId, class: classId, isActive: true
    }).populate('subject', 'name code color').populate('teacher', 'name shortName');

    const progress = [];
    for (const req of reqs) {
      const blocks = await LessonBlock.find({
        timetable: timetableId, classes: classId, subject: req.subject?._id
      });
      const assigned = blocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);

      progress.push({
        subjectId: req.subject?._id,
        subjectName: req.subject?.name,
        subjectCode: req.subject?.code,
        color: req.subject?.color,
        teacherName: req.teacher?.name,
        teacherShortName: req.teacher?.shortName,
        required: req.periodsPerWeek,
        assigned,
        remaining: Math.max(0, req.periodsPerWeek - assigned),
        complete: assigned >= req.periodsPerWeek
      });
    }

    return progress.sort((a, b) => b.remaining - a.remaining);
  }

  /**
   * Get teacher workload summary.
   */
  async getTeacherWorkload({ timetableId, teacherId }) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return null;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyLoads = {};
    let totalWeekly = 0;

    for (const day of days) {
      const blocks = await LessonBlock.find({ timetable: timetableId, teacher: teacherId, day });
      const count = blocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);
      dailyLoads[day] = count;
      totalWeekly += count;
    }

    return {
      teacherId: teacher._id,
      name: teacher.name,
      shortName: teacher.shortName,
      dailyLoads,
      weeklyTotal: totalWeekly,
      maxPerDay: teacher.maxPeriodsPerDay || 6,
      maxPerWeek: teacher.maxPeriodsPerWeek || 30,
      overloaded: totalWeekly > (teacher.maxPeriodsPerWeek || 30)
    };
  }
}

module.exports = new ManualSuggestionService();
