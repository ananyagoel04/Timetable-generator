const Class = require('../models/Class');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');

const getScope = async () => {
  const school = await School.findOne();
  const session = await AcademicSession.findOne({ school: school?._id, isCurrent: true });
  return { school: school?._id, session: session?._id };
};

exports.getClasses = async (req, res, next) => {
  try {
    const scope = await getScope();
    const classes = await Class.find({ school: scope.school, session: scope.session })
      .populate('classTeacher roomPreference').sort({ grade: 1, section: 1 });
    res.json({ success: true, count: classes.length, data: classes });
  } catch (err) { next(err); }
};
exports.getClass = async (req, res, next) => {
  try {
    const c = await Class.findById(req.params.id).populate('classTeacher roomPreference');
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
};
exports.createClass = async (req, res, next) => {
  try {
    const scope = await getScope();
    const c = await Class.create({ ...req.body, ...scope });
    res.status(201).json({ success: true, data: c });
  } catch (err) { next(err); }
};
exports.updateClass = async (req, res, next) => {
  try {
    const c = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: c });
  } catch (err) { next(err); }
};
exports.deleteClass = async (req, res, next) => {
  try { await Class.findByIdAndDelete(req.params.id); res.json({ success: true, data: {} }); }
  catch (err) { next(err); }
};
