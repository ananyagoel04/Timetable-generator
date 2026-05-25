const Room = require('../models/Room');

exports.getRooms = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const rooms = await Room.find({ school: req.schoolId }).sort({ roomNumber: 1 });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) { next(err); }
};

exports.getRoom = async (req, res, next) => {
  try {
    const r = await Room.findOne({ _id: req.params.id, school: req.schoolId });
    if (!r) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
};

exports.createRoom = async (req, res, next) => {
  try {
    if (!req.schoolId) return res.status(400).json({ success: false, error: 'School context required' });
    const r = await Room.create({ ...req.body, school: req.schoolId });
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
};

exports.updateRoom = async (req, res, next) => {
  try {
    const r = await Room.findOneAndUpdate(
      { _id: req.params.id, school: req.schoolId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!r) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
};

exports.deleteRoom = async (req, res, next) => {
  try {
    const result = await Room.findOneAndDelete({ _id: req.params.id, school: req.schoolId });
    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
