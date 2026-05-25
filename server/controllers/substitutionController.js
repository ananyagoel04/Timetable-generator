const Substitution = require('../models/Substitution');
const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const CanTeach = require('../models/CanTeach');
const GeneratedTimetable = require('../models/GeneratedTimetable');

exports.getSubstitutions = async (req, res, next) => {
  try {
    const schoolId = req.schoolId || (await School.findOne())?._id;
    const subs = await Substitution.find({ school: schoolId })
      .populate('originalTeacher substituteTeacher class subject')
      .sort({ date: -1 });
    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) { next(err); }
};

exports.createSubstitution = async (req, res, next) => {
  try {
    const schoolId = req.schoolId || (await School.findOne())?._id;
    const sub = await Substitution.create({ ...req.body, school: schoolId });
    const populated = await sub.populate('originalTeacher substituteTeacher class subject');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

exports.updateSubstitution = async (req, res, next) => {
  try {
    const sub = await Substitution.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('originalTeacher substituteTeacher class subject');
    if (!sub) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};

// ── ITEM #27: Enhanced teacher replacement suggestion logic ──
// Returns available teachers RANKED by suitability score
exports.getAvailable = async (req, res, next) => {
  try {
    const { day, period, subjectId, classId, originalTeacherId } = req.query;
    if (!day || !period) return res.status(400).json({ success: false, error: 'day and period required' });

    const schoolId = req.schoolId || (await School.findOne())?._id;
    const tt = await GeneratedTimetable.findOne({ school: schoolId, status: { $in: ['draft', 'published'] } }).sort({ createdAt: -1 });
    if (!tt) return res.json({ success: true, count: 0, data: [] });

    // Find teachers who ARE busy at this day+period
    const busyBlocks = await LessonBlock.find({
      timetable: tt._id, day, periods: parseInt(period),
      type: { $nin: ['reserved', 'free'] }
    }).select('teacher');

    const busyTeacherIds = new Set(busyBlocks.map(b => b.teacher).filter(Boolean).map(String));

    // Exclude original teacher
    if (originalTeacherId) busyTeacherIds.add(originalTeacherId);

    const allTeachers = await Teacher.find({
      school: schoolId, status: 'active',
      _id: { $nin: [...busyTeacherIds] }
    }).populate('capabilities.subject');

    // Load canTeach records for subject matching
    const canTeachRecords = subjectId
      ? await CanTeach.find({ school: schoolId, subject: subjectId, isActive: true })
      : [];
    const canTeachTeacherIds = new Set(canTeachRecords.map(ct => ct.teacher.toString()));

    // Count today's load for each teacher
    const todayBlocks = await LessonBlock.find({
      timetable: tt._id, day,
      teacher: { $in: allTeachers.map(t => t._id) },
      type: { $nin: ['reserved', 'free'] }
    }).select('teacher periods');

    const teacherDayLoad = {};
    for (const b of todayBlocks) {
      const tid = b.teacher.toString();
      teacherDayLoad[tid] = (teacherDayLoad[tid] || 0) + b.periods.length;
    }

    // Count weekly substitution load
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const recentSubs = await Substitution.find({
      school: schoolId,
      date: { $gte: weekStart },
      status: { $in: ['approved', 'completed'] },
      substituteTeacher: { $in: allTeachers.map(t => t._id) }
    });
    const subLoad = {};
    for (const s of recentSubs) {
      const tid = s.substituteTeacher.toString();
      subLoad[tid] = (subLoad[tid] || 0) + 1;
    }

    // Score and rank
    const ranked = allTeachers.map(t => {
      let score = 50; // Base score
      const reasons = [];

      // +30 if can teach this subject
      if (subjectId && canTeachTeacherIds.has(t._id.toString())) {
        score += 30;
        reasons.push('Can teach this subject');
      }

      // +20 if subject is in their capabilities
      if (subjectId && t.capabilities?.some(c => c.subject?._id?.toString() === subjectId)) {
        score += 20;
        reasons.push('Has capability for this subject');
      }

      // -10 for each existing period today (avoid overloading)
      const dayLoad = teacherDayLoad[t._id.toString()] || 0;
      score -= dayLoad * 10;
      if (dayLoad > 0) reasons.push(`Already teaching ${dayLoad} periods today`);

      // -5 per substitution this week (spread the load)
      const weekSubs = subLoad[t._id.toString()] || 0;
      score -= weekSubs * 5;
      if (weekSubs > 0) reasons.push(`${weekSubs} substitutions this week`);

      // +10 if same department as original teacher
      if (originalTeacherId && t.department) {
        const orig = allTeachers.find(ot => ot._id.toString() === originalTeacherId);
        if (orig?.department === t.department) {
          score += 10;
          reasons.push('Same department');
        }
      }

      // Penalty if they're already near max periods
      if (t.maxPeriodsPerDay && dayLoad >= t.maxPeriodsPerDay - 1) {
        score -= 20;
        reasons.push('Near daily limit');
      }

      // Check unavailability
      const unavail = t.unavailableSlots?.find(u => u.day === day);
      if (unavail?.periods?.includes(parseInt(period))) {
        score = -100;
        reasons.push('Marked as unavailable for this slot');
      }

      return {
        ...t.toObject(),
        suitabilityScore: Math.max(0, Math.min(100, score)),
        reasons,
        todayLoad: dayLoad,
        weekSubstitutions: weekSubs
      };
    })
    .filter(t => t.suitabilityScore > 0)
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    res.json({ success: true, count: ranked.length, data: ranked });
  } catch (err) { next(err); }
};
