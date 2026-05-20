const mongoose = require('mongoose');

const timetableSlotSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  period: { type: Number, required: true, min: 1, max: 8 },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  isLocked: { type: Boolean, default: false },
  isBreak: { type: Boolean, default: false },
  timetableVersion: { type: String, default: 'v1' }
}, { timestamps: true });

// Compound index for unique slot per class/day/period
timetableSlotSchema.index({ class: 1, day: 1, period: 1, timetableVersion: 1 }, { unique: true });
// Indexes for conflict detection
timetableSlotSchema.index({ teacher: 1, day: 1, period: 1, timetableVersion: 1 });
timetableSlotSchema.index({ room: 1, day: 1, period: 1, timetableVersion: 1 });

module.exports = mongoose.model('TimetableSlot', timetableSlotSchema);
