const mongoose = require('mongoose');

// Dedicated model for tracking what a teacher is CURRENTLY assigned to teach
// (distinct from CanTeach which tracks capability/eligibility)
const teacherAssignmentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  role: { type: String, enum: ['primary', 'secondary', 'substitute', 'temporary'], default: 'primary' },
  periodsPerWeek: { type: Number, min: 1, max: 15 },
  studentGroup: { type: String, trim: true },
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'replaced'], default: 'active' },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  notes: { type: String, trim: true }
}, { timestamps: true });

teacherAssignmentSchema.index({ school: 1, session: 1, teacher: 1, status: 1 });
teacherAssignmentSchema.index({ school: 1, session: 1, class: 1, subject: 1 });

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
