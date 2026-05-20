const mongoose = require('mongoose');

const customRuleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  ruleType: { type: String, enum: ['hard', 'soft', 'preference', 'warning', 'custom'], required: true },
  category: { type: String, enum: ['system_default', 'school_configurable', 'developer_custom'], default: 'school_configurable' },
  priority: { type: Number, default: 50, min: 1, max: 100 }, // higher = more important
  weight: { type: Number, default: 1.0, min: 0, max: 10 },   // soft rule scoring weight
  appliesToScope: {
    classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
    days: [String],
    periods: [Number]
  },
  config: { type: mongoose.Schema.Types.Mixed, default: {} }, // Flexible JSON config
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('CustomRule', customRuleSchema);
