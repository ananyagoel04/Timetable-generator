/**
 * GET /absences/suggest-substitutes — Enterprise 7-tier fallback substitute suggestion
 * Extracted as a standalone middleware to avoid route-order issues with /:id.
 */
const Teacher = require('../models/Teacher');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const CanTeach = require('../models/CanTeach');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

module.exports = async (req, res, next) => {
  try {
    const { teacherId, day, period, subjectId } = req.query;
    if (!teacherId) {
      return res.status(400).json({ success: false, error: 'teacherId query parameter is required' });
    }

    const schoolId = req.schoolId || req.user?.activeSchool;
    const session = await AcademicSession.findOne({ school: schoolId, isCurrent: true });

    const activeTimetable = await GeneratedTimetable.findOne({
      school: schoolId, status: { $in: ['published', 'draft'] }
    }).sort({ createdAt: -1 });

    const absentTeacher = await Teacher.findById(teacherId);
    if (!absentTeacher) {
      return res.json({ success: true, suggestions: [], unresolved: true, reason: 'Teacher not found' });
    }

    const allTeachers = await Teacher.find({
      school: schoolId, session: session?._id, status: 'active', _id: { $ne: teacherId }
    }).select('name shortName department maxPeriodsPerDay maxPeriodsPerWeek capabilities unavailableSlots');

    const queryDay = day || 'Monday';
    const queryPeriod = period ? parseInt(period) : 1;
    const suggestions = [];

    for (const candidate of allTeachers) {
      let isBusy = false;
      if (activeTimetable) {
        const busyBlock = await LessonBlock.findOne({
          timetable: activeTimetable._id, teacher: candidate._id,
          day: queryDay, periods: queryPeriod,
          type: { $nin: ['reserved', 'free'] }
        });
        if (busyBlock) isBusy = true;
      }

      const unavail = candidate.unavailableSlots?.find(u => u.day === queryDay);
      if (unavail && unavail.periods?.includes(queryPeriod)) isBusy = true;

      let dailyCount = 0;
      if (activeTimetable) {
        dailyCount = await LessonBlock.countDocuments({
          timetable: activeTimetable._id, teacher: candidate._id,
          day: queryDay, type: { $nin: ['reserved', 'free'] }
        });
      }

      const atMaxLoad = dailyCount >= (candidate.maxPeriodsPerDay || 6);

      let tier = 7;
      let tierLabel = 'supervised_study_fallback';
      let score = 0;

      const canTeachSubject = subjectId ? candidate.capabilities?.some(c =>
        (c.subject?._id || c.subject)?.toString() === subjectId
      ) : false;
      const sameDept = candidate.department === absentTeacher.department;

      if (!isBusy && canTeachSubject && !atMaxLoad) {
        const isPrimary = candidate.capabilities?.some(c =>
          (c.subject?._id || c.subject)?.toString() === subjectId && c.proficiency === 'primary'
        );
        tier = 1; tierLabel = 'same_subject_teacher';
        score = 90 + (isPrimary ? 10 : 0) - dailyCount * 2;
      } else if (!isBusy && !atMaxLoad && subjectId) {
        const hasCanTeach = await CanTeach.findOne({
          school: schoolId, session: session?._id, teacher: candidate._id, subject: subjectId
        });
        if (hasCanTeach) {
          tier = 2; tierLabel = 'canteach_capable';
          score = 70 + (hasCanTeach.priority || 0) * 2 - dailyCount * 2;
        } else if (sameDept) {
          tier = 3; tierLabel = 'same_department_free'; score = 55 - dailyCount * 2;
        } else {
          tier = 4; tierLabel = 'swap_compatible'; score = 40 - dailyCount * 2;
        }
      } else if (!isBusy && !atMaxLoad) {
        if (sameDept) {
          tier = 3; tierLabel = 'same_department_free'; score = 55 - dailyCount * 2;
        } else {
          tier = 5; tierLabel = 'activity_supervision'; score = 25 - dailyCount;
        }
      } else if (!isBusy && atMaxLoad) {
        tier = 6; tierLabel = 'supervised_study_overload'; score = 10;
      } else {
        continue;
      }

      suggestions.push({
        teacher: { _id: candidate._id, name: candidate.name, shortName: candidate.shortName, department: candidate.department },
        tier, tierLabel, score, isBusy,
        dailyPeriods: dailyCount,
        maxPeriodsPerDay: candidate.maxPeriodsPerDay || 6,
        canTeachSubject, sameDepartment: sameDept,
        workloadWarning: atMaxLoad,
        recommended: tier <= 2
      });
    }

    suggestions.sort((a, b) => a.tier - b.tier || b.score - a.score);
    const hasRecommended = suggestions.some(s => s.recommended);

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 20),
      unresolved: !hasRecommended,
      reason: hasRecommended ? null : (suggestions.length > 0 ? 'No ideal match found. Lower-tier alternatives available.' : 'No suitable teacher available'),
      totalCandidates: suggestions.length,
      query: { teacherId, day: queryDay, period: queryPeriod, subjectId: subjectId || null }
    });
  } catch (err) { next(err); }
};
