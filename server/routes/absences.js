const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/absenceController');

router.get('/', authorize('view_timetable', 'manage_absences'), ctrl.getAbsences);
router.get('/unresolved', authorize('manage_absences', 'edit_timetable'), ctrl.getUnresolvedPeriods);
// suggest-substitutes MUST be before /:id to prevent Express treating it as an ObjectId
router.get('/suggest-substitutes', authorize('manage_absences', 'view_timetable'), require('./absencesSuggestSubstitutes'));
router.post('/', authorize('manage_absences'), ctrl.createAbsence);
router.post('/bulk', authorize('manage_absences'), ctrl.createBulkAbsence);
router.get('/:id', authorize('view_timetable', 'manage_absences'), ctrl.getAbsenceDetail);
router.put('/:id/cancel', authorize('manage_absences'), ctrl.cancelAbsence);
router.put('/:id/resolve', authorize('manage_absences', 'edit_timetable'), ctrl.manualResolve);

// Get available teachers for a specific period/day (for manual replacement assignment)
router.get('/:id/available-teachers/:blockIndex', authorize('manage_absences', 'edit_timetable'), async (req, res, next) => {
  try {
    const Absence = require('../models/Absence');
    const Teacher = require('../models/Teacher');
    const LessonBlock = require('../models/LessonBlock');
    const GeneratedTimetable = require('../models/GeneratedTimetable');

    const absence = await Absence.findOne({ _id: req.params.id, school: req.schoolId });
    if (!absence) return res.status(404).json({ success: false, error: 'Absence not found' });

    const blockIndex = parseInt(req.params.blockIndex);
    if (blockIndex < 0 || blockIndex >= absence.affectedBlocks.length) {
      return res.status(400).json({ success: false, error: 'Invalid block index' });
    }

    const block = absence.affectedBlocks[blockIndex];
    const activeTimetable = await GeneratedTimetable.findOne({
      school: req.schoolId, status: { $in: ['published', 'draft'] }
    }).sort({ createdAt: -1 });

    const allTeachers = await Teacher.find({
      school: req.schoolId, status: 'active', _id: { $ne: absence.teacher }
    }).select('name shortName department maxPeriodsPerDay maxPeriodsPerWeek capabilities');

    const available = [];
    for (const t of allTeachers) {
      let isBusy = false;
      if (activeTimetable) {
        const busyBlock = await LessonBlock.findOne({
          timetable: activeTimetable._id, teacher: t._id,
          day: block.day, periods: block.period,
          type: { $nin: ['reserved', 'free'] }
        });
        if (busyBlock) isBusy = true;
      }

      const unavail = t.unavailableSlots?.find(u => u.day === block.day);
      if (unavail && unavail.periods?.includes(block.period)) isBusy = true;

      let dailyCount = 0;
      if (activeTimetable) {
        dailyCount = await LessonBlock.countDocuments({
          timetable: activeTimetable._id, teacher: t._id,
          day: block.day, type: { $nin: ['reserved', 'free'] }
        });
      }

      const canTeachSubject = t.capabilities?.some(c =>
        (c.subject?._id || c.subject)?.toString() === block.subject?.toString()
      );

      available.push({
        _id: t._id, name: t.name, shortName: t.shortName,
        department: t.department, isBusy, dailyPeriods: dailyCount,
        maxPeriodsPerDay: t.maxPeriodsPerDay || 6,
        canTeachSubject: !!canTeachSubject,
        workloadWarning: dailyCount >= (t.maxPeriodsPerDay || 6) - 1,
        recommended: !isBusy && canTeachSubject && dailyCount < (t.maxPeriodsPerDay || 6)
      });
    }

    available.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return a.dailyPeriods - b.dailyPeriods;
    });

    res.json({ success: true, data: available });
  } catch (err) { next(err); }
});

module.exports = router;
