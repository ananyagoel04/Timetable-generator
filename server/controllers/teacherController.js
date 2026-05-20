const Teacher = require('../models/Teacher');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

exports.getTeachers = async (req, res, next) => {
  try {
    const scope = await getScope();
    const teachers = await Teacher.find({ school: scope.school, session: scope.session })
      .populate('capabilities.subject').sort({ name: 1 });
    res.json({ success: true, count: teachers.length, data: teachers });
  } catch (err) { next(err); }
};

exports.getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate('capabilities.subject');
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.createTeacher = async (req, res, next) => {
  try {
    const scope = await getScope();
    const teacher = await Teacher.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.deleteTeacher = async (req, res, next) => {
  try {
    await Teacher.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
