const mongoose = require('mongoose');

const manualOverrideSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  lessonBlock: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock', required: true },
  overrideType: { type: String, enum: ['move', 'swap', 'reassign_teacher', 'reassign_room', 'delete', 'add', 'lock', 'unlock'], required: true },
  // Before state
  before: {
    day: { type: String },
    period: { type: Number },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }]
  },
  // After state
  after: {
    day: { type: String },
    period: { type: Number },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }]
  },
  reason: { type: String, trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String },
  isReverted: { type: Boolean, default: false },
  revertedAt: { type: Date },
  revertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

manualOverrideSchema.index({ school: 1, timetable: 1, createdAt: -1 });
manualOverrideSchema.index({ lessonBlock: 1 });

module.exports = mongoose.model('ManualOverride', manualOverrideSchema);
