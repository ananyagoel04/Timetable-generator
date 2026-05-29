const mongoose = require('mongoose');

const generatedTimetableSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, default: 'Timetable v1', trim: true },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['generating', 'draft', 'review', 'published', 'archived', 'failed', 'validating', 'ready'], default: 'draft' },
  generatedAt: { type: Date },
  publishedAt: { type: Date },
  publishedBy: { type: String },
  // Manual timetable fields
  creationMode: { type: String, enum: ['auto', 'manual', 'copied', 'imported'], default: 'auto' },
  sourceTimetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  manualCompletenessScore: { type: Number, default: 0, min: 0, max: 100 },
  validationSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  lastValidatedAt: { type: Date },
  // Generation stats
  stats: {
    totalBlocks: { type: Number, default: 0 },
    placedBlocks: { type: Number, default: 0 },
    unplacedBlocks: { type: Number, default: 0 },
    hardConflicts: { type: Number, default: 0 },
    softRuleScore: { type: Number, default: 0 },
    generationTimeMs: { type: Number, default: 0 }
  },
  // Unplaced items log
  unplacedItems: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    reason: { type: String }
  }],
  // Structured diagnostics from generation engine
  diagnostics: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

generatedTimetableSchema.index({ school: 1, session: 1, status: 1, createdAt: -1 });
generatedTimetableSchema.index({ school: 1, creationMode: 1 });

module.exports = mongoose.model('GeneratedTimetable', generatedTimetableSchema);
