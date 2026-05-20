const mongoose = require('mongoose');

const teacherReplacementSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  originalTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  replacementType: { type: String, enum: ['full', 'partial', 'subject_wise', 'class_wise', 'temporary', 'permanent'], required: true },
  durationType: { type: String, enum: ['temporary', 'permanent'], default: 'temporary' },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date }, // null for permanent
  reason: { type: String, trim: true },
  // What is being replaced
  assignments: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    newTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    weeklyPeriods: { type: Number }
  }],
  // Impact tracking
  affectedBlocks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LessonBlock' }],
  workloadImpact: {
    originalTeacherBefore: { type: Number, default: 0 },
    originalTeacherAfter: { type: Number, default: 0 },
    newTeachersImpact: [{ teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }, before: Number, after: Number }]
  },
  status: { type: String, enum: ['draft', 'previewing', 'approved', 'applied', 'reverted'], default: 'draft' },
  appliedAt: { type: Date },
  appliedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TeacherReplacement', teacherReplacementSchema);
