const mongoose = require('mongoose');

/**
 * CanTeach — structured teacher eligibility mappings
 * Defines which teachers can teach which subjects for which classes/streams/sections
 * with priority and role configurations.
 */
const canTeachSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },

  // Eligibility scope — empty array = eligible for ALL
  eligibleClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  eligibleStreams: [{ type: String, trim: true }],   // e.g., ['Science', 'Commerce']
  eligibleSections: [{ type: String, trim: true }],  // e.g., ['A', 'B']

  // Role & priority
  role: {
    type: String,
    enum: ['primary', 'secondary', 'fallback'],
    default: 'primary'
  },
  priority: { type: Number, default: 5, min: 1, max: 10 }, // 10 = highest priority

  // Optional per-subject constraints
  maxPeriodsForThis: { type: Number, min: 0 },     // Max periods/week for THIS subject
  preferMorning: { type: Boolean, default: false },
  preferAfternoon: { type: Boolean, default: false },

  // Status
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true }
}, { timestamps: true });

// Compound index for efficient lookups
canTeachSchema.index({ school: 1, session: 1, teacher: 1, subject: 1 });
canTeachSchema.index({ school: 1, session: 1, subject: 1, role: 1 });
canTeachSchema.index({ school: 1, session: 1, teacher: 1, isActive: 1 });

/**
 * Static: find eligible teachers for a given subject + class + stream
 * Returns sorted by role priority then by priority field
 */
canTeachSchema.statics.findEligible = async function(opts) {
  const { schoolId, sessionId, subjectId, classId, stream, section, activeOnly = true } = opts;
  
  const filter = { school: schoolId, session: sessionId, subject: subjectId };
  if (activeOnly) filter.isActive = true;

  let mappings = await this.find(filter)
    .populate('teacher', 'name shortName department status maxPeriodsPerDay maxPeriodsPerWeek capabilities unavailableSlots')
    .populate('subject', 'name code type')
    .sort({ role: 1, priority: -1 });

  // Filter by class eligibility
  if (classId) {
    mappings = mappings.filter(m => 
      m.eligibleClasses.length === 0 || m.eligibleClasses.some(c => c.toString() === classId.toString())
    );
  }

  // Filter by stream eligibility
  if (stream) {
    mappings = mappings.filter(m =>
      m.eligibleStreams.length === 0 || m.eligibleStreams.includes(stream)
    );
  }

  // Filter by section eligibility
  if (section) {
    mappings = mappings.filter(m =>
      m.eligibleSections.length === 0 || m.eligibleSections.includes(section)
    );
  }

  // Filter out inactive teachers
  mappings = mappings.filter(m => m.teacher && m.teacher.status === 'active');

  // Sort: primary > secondary > fallback, then by priority desc
  const roleOrder = { primary: 0, secondary: 1, fallback: 2 };
  mappings.sort((a, b) => {
    const roleCompare = (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
    if (roleCompare !== 0) return roleCompare;
    return (b.priority || 5) - (a.priority || 5);
  });

  return mappings;
};

/**
 * Static: score a teacher for replacement suitability
 * Higher score = better candidate
 */
canTeachSchema.statics.scoreForReplacement = function(mapping, currentDayLoad, maxPerDay) {
  let score = 0;
  
  // Role weight
  if (mapping.role === 'primary') score += 30;
  else if (mapping.role === 'secondary') score += 20;
  else score += 10;

  // Priority weight (1-10 scaled to 0-20)
  score += (mapping.priority || 5) * 2;

  // Workload balance — prefer teachers with lighter load
  const loadPercent = currentDayLoad / (maxPerDay || 6);
  score += Math.round((1 - loadPercent) * 15);

  return score;
};

module.exports = mongoose.model('CanTeach', canTeachSchema);
