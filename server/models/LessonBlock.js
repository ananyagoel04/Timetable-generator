const mongoose = require('mongoose');

// A LessonBlock is the core scheduling unit — assigned to a timeslot
const lessonBlockSchema = new mongoose.Schema({
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  type: {
    type: String,
    enum: ['normal', 'double_period', 'lab', 'activity', 'club', 'reserved',
           'combined_class', 'split_group', 'substitution', 'locked_manual', 'free'],
    required: true
  },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  // Which classes/groups this block serves
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  studentGroup: { type: String, trim: true }, // for split-group blocks
  // When this block is scheduled
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  periods: [{ type: Number, required: true }], // [3] for single, [5,6] for double period
  // Related combination rule (if any)
  combinationRule: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectCombinationRule' },
  // Status
  isLocked: { type: Boolean, default: false },
  isManualOverride: { type: Boolean, default: false },
  isTemporary: { type: Boolean, default: false }, // for substitutions/daily adjustments
  // Scoring
  softRuleScore: { type: Number, default: 0 },
  warnings: [{ type: String }],
  // Linked blocks (for double periods, parallel split groups)
  linkedBlockId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' }
}, { timestamps: true });

lessonBlockSchema.index({ timetable: 1, day: 1, 'periods': 1 });
lessonBlockSchema.index({ timetable: 1, teacher: 1, day: 1 });
lessonBlockSchema.index({ timetable: 1, room: 1, day: 1 });

module.exports = mongoose.model('LessonBlock', lessonBlockSchema);
