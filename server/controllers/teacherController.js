const Teacher = require('../models/Teacher');

exports.getTeachers = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const filter = { school: req.schoolId };
    if (req.sessionId) filter.session = req.sessionId;

    // Optional pagination
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 0;

    let query = Teacher.find(filter).populate('capabilities.subject').sort({ name: 1 });
    if (page > 0 && limit > 0) {
      query = query.skip((page - 1) * limit).limit(limit);
    }
    const teachers = await query;
    const total = (page > 0 && limit > 0) ? await Teacher.countDocuments(filter) : teachers.length;

    res.json({ success: true, count: teachers.length, total, page: page || 1, data: teachers });
  } catch (err) { next(err); }
};


exports.getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({ _id: req.params.id, school: req.schoolId })
      .populate('capabilities.subject');
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.createTeacher = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const teacher = await Teacher.create({
      ...req.body,
      school: req.schoolId,
      session: req.sessionId || req.body.session
    });
    res.status(201).json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.updateTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, school: req.schoolId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: teacher });
  } catch (err) { next(err); }
};

exports.deleteTeacher = async (req, res, next) => {
  try {
    const result = await Teacher.findOneAndDelete({ _id: req.params.id, school: req.schoolId });
    if (!result) return res.status(404).json({ success: false, error: 'Teacher not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
