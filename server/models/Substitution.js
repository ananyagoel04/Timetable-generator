const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  dailyAdjustment: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyAdjustment' },
  originalTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  substituteTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  date: { type: Date, required: true },
  period: { type: Number, required: true, min: 1, max: 10 },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  notes: { type: String, trim: true, default: '' }
}, { timestamps: true });

substitutionSchema.index({ school: 1, date: -1, status: 1 });
substitutionSchema.index({ school: 1, originalTeacher: 1, date: 1 });

module.exports = mongoose.model('Substitution', substitutionSchema);
