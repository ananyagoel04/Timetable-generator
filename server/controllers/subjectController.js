const Subject = require('../models/Subject');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

exports.getSubjects = async (req, res, next) => {
  try {
    const scope = await getScope();
    const subjects = await Subject.find({ school: scope.school, session: scope.session }).sort({ name: 1 });
    res.json({ success: true, count: subjects.length, data: subjects });
  } catch (err) { next(err); }
};
exports.getSubject = async (req, res, next) => {
  try {
    const s = await Subject.findById(req.params.id);
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
};
exports.createSubject = async (req, res, next) => {
  try {
    const scope = await getScope();
    const s = await Subject.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
};
exports.updateSubject = async (req, res, next) => {
  try {
    const s = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
};
exports.deleteSubject = async (req, res, next) => {
  try { await Subject.findByIdAndDelete(req.params.id); res.json({ success: true, data: {} }); }
  catch (err) { next(err); }
};
