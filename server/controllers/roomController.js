const Room = require('../models/Room');
const School = require('../models/School');

exports.getRooms = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const rooms = await Room.find({ school: school?._id }).sort({ roomNumber: 1 });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) { next(err); }
};
exports.getRoom = async (req, res, next) => {
  try {
    const r = await Room.findById(req.params.id);
    if (!r) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
};
exports.createRoom = async (req, res, next) => {
  try {
    const school = await School.findOne();
    const r = await Room.create({ ...req.body, school: school._id });
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
};
exports.updateRoom = async (req, res, next) => {
  try {
    const r = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
};
exports.deleteRoom = async (req, res, next) => {
  try { await Room.findByIdAndDelete(req.params.id); res.json({ success: true, data: {} }); }
  catch (err) { next(err); }
};
