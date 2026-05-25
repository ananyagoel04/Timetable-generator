const Subject = require('../models/Subject');

exports.getSubjects = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const filter = { school: req.schoolId };
    if (req.sessionId) filter.session = req.sessionId;
    const subjects = await Subject.find(filter).sort({ name: 1 });
    res.json({ success: true, count: subjects.length, data: subjects });
  } catch (err) { next(err); }
};

exports.getSubject = async (req, res, next) => {
  try {
    const s = await Subject.findOne({ _id: req.params.id, school: req.schoolId });
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
};

exports.createSubject = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const s = await Subject.create({
      ...req.body,
      school: req.schoolId,
      session: req.sessionId || req.body.session
    });
    res.status(201).json({ success: true, data: s });
  } catch (err) { next(err); }
};

exports.updateSubject = async (req, res, next) => {
  try {
    const s = await Subject.findOneAndUpdate(
      { _id: req.params.id, school: req.schoolId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!s) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: s });
  } catch (err) { next(err); }
};

exports.deleteSubject = async (req, res, next) => {
  try {
    const result = await Subject.findOneAndDelete({ _id: req.params.id, school: req.schoolId });
    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
