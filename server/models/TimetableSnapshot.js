const mongoose = require('mongoose');

const timetableSnapshotSchema = new mongoose.Schema({
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  version: { type: Number, required: true },
  label: { type: String, trim: true, default: '' },
  description: { type: String, trim: true },
  // Complete block dump for rollback
  snapshotData: [{
    type: { type: String },
    subject: { type: mongoose.Schema.Types.ObjectId },
    teacher: { type: mongoose.Schema.Types.ObjectId },
    room: { type: mongoose.Schema.Types.ObjectId },
    classes: [{ type: mongoose.Schema.Types.ObjectId }],
    day: String,
    periods: [Number],
    studentGroup: String,
    isLocked: Boolean,
    combinationRule: { type: mongoose.Schema.Types.ObjectId },
    consecutiveGroupId: { type: mongoose.Schema.Types.ObjectId },
    consecutivePosition: Number,
    priorityWeight: Number
  }],
  stats: {
    totalBlocks: Number,
    placedBlocks: Number,
    unplacedBlocks: Number,
    hardConflicts: Number,
    qualityScore: Number,
    generationTimeMs: Number
  },
  isPublished: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

timetableSnapshotSchema.index({ timetable: 1, version: -1 });
timetableSnapshotSchema.index({ school: 1, createdAt: -1 });

module.exports = mongoose.model('TimetableSnapshot', timetableSnapshotSchema);
