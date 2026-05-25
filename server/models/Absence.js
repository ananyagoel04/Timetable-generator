const mongoose = require('mongoose');

const affectedBlockSchema = new mongoose.Schema({
  lessonBlock: { type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' },
  period: { type: Number },
  day: { type: String },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  replacementStatus: {
    type: String,
    enum: ['replaced', 'unresolved', 'manual'],
    default: 'unresolved'
  },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
}, { _id: false });

const absenceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  absenceType: { type: String, enum: ['full_day', 'selected_periods', 'date_range'], default: 'full_day' },
  date: { type: Date, required: true },
  endDate: { type: Date }, // for date_range
  affectedPeriods: [{ type: Number }], // for selected_periods
  reason: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['active', 'resolved', 'partial', 'cancelled'],
    default: 'active'
  },
  // Auto-generated daily adjustment (legacy)
  dailyAdjustment: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyAdjustment' },
  // Detailed affected blocks with replacement tracking
  affectedBlocks: [affectedBlockSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  autoReplacementAttempted: { type: Boolean, default: false }
}, { timestamps: true });

absenceSchema.index({ school: 1, teacher: 1, date: 1 });
absenceSchema.index({ school: 1, status: 1, date: -1 });

module.exports = mongoose.model('Absence', absenceSchema);
