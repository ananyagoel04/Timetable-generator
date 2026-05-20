const mongoose = require('mongoose');

const softPreferenceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['activity', 'workload', 'placement', 'distribution'], required: true },
  type: {
    type: String,
    enum: ['saturday_activity', 'club_period', 'sports', 'supervised_study', 'enrichment',
           'morning_preference', 'afternoon_preference', 'even_distribution', 'lab_after_theory', 'custom'],
    required: true
  },
  isEnabled: { type: Boolean, default: false },
  activation: { type: String, enum: ['auto', 'manual', 'scheduled'], default: 'manual' },
  placement: {
    preferredDay: { type: String },
    preferredPeriods: [{ type: Number }],
    strictMode: { type: Boolean, default: false }
  },
  priority: { type: Number, default: 50, min: 1, max: 100 },
  scope: {
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    grades: [{ type: Number }],
    streams: [{ type: String }]
  },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

softPreferenceSchema.index({ school: 1, type: 1 });

module.exports = mongoose.model('SoftPreference', softPreferenceSchema);
