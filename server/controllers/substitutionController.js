const Substitution = require('../models/Substitution');
const LessonBlock = require('../models/LessonBlock');
const Teacher = require('../models/Teacher');
const School = require('../models/School');
const GeneratedTimetable = require('../models/GeneratedTimetable');

exports.getSubstitutions = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const subs = await Substitution.find({ school: school?._id })
      .populate('originalTeacher substituteTeacher class subject')
      .sort({ date: -1 });
    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) { next(err); }
};

exports.createSubstitution = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const sub = await Substitution.create({ ...req.body, school: school._id });
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

// Get available substitute teachers for a given day/period using LessonBlock
exports.getAvailable = async (req, res, next) => {
  try {
    const { day, period } = req.query;
    if (!day || !period) return res.status(400).json({ success: false, error: 'day and period required' });

    const school = await School.findOne();
    // Find the latest active timetable
    const tt = await GeneratedTimetable.findOne({ school: school?._id, status: { $in: ['draft', 'published'] } }).sort({ createdAt: -1 });
    if (!tt) return res.json({ success: true, count: 0, data: [] });

    // Find teachers who ARE busy at this day+period
    const busyBlocks = await LessonBlock.find({
      timetable: tt._id, day, periods: parseInt(period),
      type: { $nin: ['reserved', 'free'] }
    }).select('teacher');

    const busyTeacherIds = busyBlocks.map(b => b.teacher).filter(Boolean).map(String);
    const availableTeachers = await Teacher.find({
      school: school._id,
      _id: { $nin: busyTeacherIds },
      status: 'active'
    }).populate('capabilities.subject');

    res.json({ success: true, count: availableTeachers.length, data: availableTeachers });
  } catch (err) { next(err); }
};
