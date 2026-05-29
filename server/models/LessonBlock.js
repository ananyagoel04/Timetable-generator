const mongoose = require('mongoose');

// A LessonBlock is the core scheduling unit — assigned to a timeslot
const lessonBlockSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  type: {
    type: String,
    enum: ['normal', 'double_period', 'triple_lab', 'lab', 'activity', 'club', 'reserved',
           'combined_class', 'split_group', 'substitution', 'locked_manual', 'free'],
    required: true
  },
  // Duration in periods (1=single, 2=double, 3=triple lab, etc.)
  duration: { type: Number, default: 1, min: 1, max: 4 },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  // Which classes/groups this block serves
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  studentGroup: { type: String, trim: true },
  // When this block is scheduled
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  periods: [{ type: Number, required: true }],
  // Related combination rule (if any)
  combinationRule: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectCombinationRule' },
  // Which period structure this block belongs to
  periodStructure: { type: mongoose.Schema.Types.ObjectId, ref: 'PeriodStructure' },
  // Status
  isLocked: { type: Boolean, default: false },
  isManualOverride: { type: Boolean, default: false },
  isTemporary: { type: Boolean, default: false },
  overrideExpiry: { type: Date },
  // Manual timetable fields
  source: { type: String, enum: ['auto', 'manual', 'copied', 'substitution', 'replacement'], default: 'auto' },
  manuallyCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  manualReason: { type: String, trim: true },
  forceWithWarning: { type: Boolean, default: false },
  validationStatus: { type: String, enum: ['allowed', 'warning', 'blocked', 'unchecked'], default: 'unchecked' },
  warningCodes: [{ type: String }],
  isDraft: { type: Boolean, default: false },
  parentBlockId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' },
  // Scoring
  softRuleScore: { type: Number, default: 0 },
  warnings: [{ type: String }],
  // Linked blocks (for double periods, parallel split groups)
  linkedBlockId: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' },
  // Consecutive period grouping (DEPRECATED — use periods[] array with duration instead)
  consecutiveGroupId: { type: mongoose.Schema.Types.ObjectId },
  consecutivePosition: { type: Number },
  // Group context (for split-group scheduling)
  groupContext: {
    studentGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentGroup' },
    groupName: { type: String, trim: true },
    isParallel: { type: Boolean, default: false }
  },
  // Combined context (for combined-class blocks)
  combinedContext: {
    isCombined: { type: Boolean, default: false },
    primaryClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    combinationRule: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectCombinationRule' }
  },
  // Scheduling metadata
  priorityWeight: { type: Number, default: 50 },
  generationSeed: { type: String, trim: true },
  // Scalar period fields for safe compound indexing (MongoDB disallows multikey on 2 arrays)
  periodStart: { type: Number },
  periodEnd: { type: Number },
  // Edit history for post-generation modifications
  editHistory: [{
    action: { type: String, required: true }, // 'move', 'swap', 'reassign_teacher', 'reassign_room', 'lock', 'unlock'
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, trim: true }
  }]
}, { timestamps: true });

// Pre-save hook: auto-compute periodStart/periodEnd from periods[] array
lessonBlockSchema.pre('save', function (next) {
  if (this.periods && this.periods.length > 0) {
    this.periodStart = Math.min(...this.periods);
    this.periodEnd = Math.max(...this.periods);
  }
  next();
});

// Pre-insertMany hook: auto-compute periodStart/periodEnd for bulk inserts
lessonBlockSchema.pre('insertMany', function (next, docs) {
  for (const doc of docs) {
    if (doc.periods && doc.periods.length > 0) {
      doc.periodStart = Math.min(...doc.periods);
      doc.periodEnd = Math.max(...doc.periods);
    }
  }
  next();
});

// ═══ SAFE INDEXES — no compound index mixes two array fields ═══
// Per-timetable lookups (periods is array but classes is not in these)
lessonBlockSchema.index({ timetable: 1, teacher: 1, day: 1 });
lessonBlockSchema.index({ timetable: 1, room: 1, day: 1 });
lessonBlockSchema.index({ timetable: 1, classes: 1, day: 1 });
lessonBlockSchema.index({ timetable: 1, day: 1, periodStart: 1 }); // replaces { timetable, day, periods }
// School-scoped clash detection (uses scalar periodStart, NOT array periods)
lessonBlockSchema.index({ school: 1, timetable: 1, teacher: 1, day: 1, periodStart: 1 }); // teacher clash
lessonBlockSchema.index({ school: 1, timetable: 1, room: 1, day: 1, periodStart: 1 });    // room clash
lessonBlockSchema.index({ school: 1, timetable: 1, day: 1, periodStart: 1 });             // general slot lookup
// Filtering indexes
lessonBlockSchema.index({ timetable: 1, type: 1 }); // block type filtering
lessonBlockSchema.index({ timetable: 1, source: 1 }); // manual vs auto filtering

module.exports = mongoose.model('LessonBlock', lessonBlockSchema);
