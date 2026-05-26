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
  // Structured resolution suggestions
  suggestedFixes: [{
    action: { type: String },        // 'move_to_period', 'swap_teacher', 'change_room', 'split_combined'
    targetDay: { type: String },
    targetPeriod: { type: Number },
    targetTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    targetRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    description: { type: String },
    confidence: { type: Number, min: 0, max: 100 }  // How likely this fix resolves it
  }],
  // Grouping + auto-resolution
  groupId: { type: String, trim: true },       // Group related conflicts together
  autoResolvable: { type: Boolean, default: false },
  // Resolution
  isResolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolution: { type: String, trim: true }
}, { timestamps: true });

conflictLogSchema.index({ timetable: 1, type: 1, isResolved: 1 });
conflictLogSchema.index({ timetable: 1, severity: 1, createdAt: -1 });

module.exports = mongoose.model('ConflictLog', conflictLogSchema);

