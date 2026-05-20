const mongoose = require('mongoose');

// DailyAdjustment: temporary changes for a specific day without modifying master timetable
const dailyAdjustmentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  date: { type: Date, required: true },
  absence: { type: mongoose.Schema.Types.ObjectId, ref: 'Absence' },
  // Substitution entries for each affected period
  entries: [{
    originalBlock: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    period: { type: Number, required: true },
    day: { type: String },
    originalTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    // Resolution
    resolution: {
      type: { type: String, enum: ['alternate_teacher', 'free_same_subject', 'other_subject_teacher', 'period_swap', 'activity_move', 'supervised_study', 'unresolved'], default: 'unresolved' },
      substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
      substituteSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
      confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
      reason: { type: String, trim: true }
    },
    status: { type: String, enum: ['suggested', 'approved', 'rejected', 'unresolved'], default: 'suggested' }
  }],
  overallStatus: { type: String, enum: ['draft', 'partially_resolved', 'fully_resolved', 'published'], default: 'draft' },
  publishedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('DailyAdjustment', dailyAdjustmentSchema);
