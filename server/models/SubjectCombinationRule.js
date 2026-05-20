const mongoose = require('mongoose');

// Universal subject-combination rules: combine multiple classes into one lesson block
const subjectCombinationRuleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  name: { type: String, required: true, trim: true }, // "English combined for Class 11"
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  // Classes/sections/streams that are combined
  appliesTo: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    studentGroup: { type: String, trim: true } // null = whole class
  }],
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  periodsPerWeek: { type: Number, required: true, min: 1, max: 10 },
  preferredDays: [String],
  preferredPeriods: [Number],
  strictness: { type: String, enum: ['must_combine', 'try_combine', 'combine_if_possible'], default: 'must_combine' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SubjectCombinationRule', subjectCombinationRuleSchema);
