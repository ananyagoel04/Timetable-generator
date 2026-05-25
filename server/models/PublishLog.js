const mongoose = require('mongoose');

const publishLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedTimetable', required: true },
  version: { type: Number, required: true },
  action: { type: String, enum: ['publish', 'unpublish', 'republish', 'archive'], required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedByName: { type: String },
  // Snapshot at publish time
  stats: {
    totalBlocks: { type: Number },
    conflicts: { type: Number },
    score: { type: Number },
    classes: { type: Number },
    teachers: { type: Number }
  },
  notes: { type: String, trim: true },
  previousVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'PublishLog' }
}, { timestamps: true });

publishLogSchema.index({ school: 1, session: 1, createdAt: -1 });

module.exports = mongoose.model('PublishLog', publishLogSchema);
