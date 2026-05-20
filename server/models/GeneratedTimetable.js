const mongoose = require('mongoose');

const generatedTimetableSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, default: 'Timetable v1', trim: true },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['generating', 'draft', 'review', 'published', 'archived', 'failed'], default: 'draft' },
  generatedAt: { type: Date },
  publishedAt: { type: Date },
  publishedBy: { type: String },
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
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('GeneratedTimetable', generatedTimetableSchema);
