const mongoose = require('mongoose');

const conflictLogSchema = new mongoose.Schema({
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  type: {
    type: String,
    enum: ['teacher_clash', 'room_clash', 'class_clash', 'teacher_overload', 'room_capacity',
           'missing_teacher', 'missing_room', 'subject_shortage', 'rule_violation',
           'capability_mismatch', 'unavailable_slot', 'unassigned_lesson'],
    required: true
  },
  severity: { type: String, enum: ['critical', 'high', 'medium', 'low', 'warning'], default: 'medium' },
  day: { type: String },
  period: { type: Number },
  // Entities involved
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  blocks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' }],
  // Human-readable
  title: { type: String, required: true },
  message: { type: String, required: true },
  suggestedFix: { type: String },
  // Resolution
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolution: { type: String, trim: true }
}, { timestamps: true });

conflictLogSchema.index({ timetable: 1, type: 1, isResolved: 1 });

module.exports = mongoose.model('ConflictLog', conflictLogSchema);
