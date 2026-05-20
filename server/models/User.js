const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['platform_owner', 'platform_support', 'platform_developer', 'platform_qa',
           'deployment_manager', 'school_owner', 'school_admin', 'principal',
           'timetable_manager', 'teacher', 'office_staff', 'viewer'],
    default: 'school_admin'
  },
  // Multi-school membership
  schools: [{
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    role: { type: String, default: 'school_admin' },
    permissions: [{
      type: String,
      enum: ['view_timetable', 'generate_timetable', 'edit_setup', 'manage_teachers',
             'manage_rules', 'approve_substitutions', 'publish_timetable', 'view_audit',
             'manage_users', 'manage_school', 'export_reports', 'edit_timetable',
             'manage_absences', 'manage_replacements']
    }],
    isActive: { type: Boolean, default: true }
  }],
  // Active context
  activeSchool: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  activeSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
  // Platform-level support access
  supportAccess: {
    isImpersonating: { type: Boolean, default: false },
    impersonatedSchool: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    impersonatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    impersonationExpiry: { type: Date },
    accessReason: { type: String, trim: true }
  },
  platformPermissions: [{
    type: String,
    enum: ['impersonate_school', 'view_all_audit', 'manage_schools', 'debug_access', 'deploy', 'view_metrics']
  }],
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  refreshToken: { type: String, select: false }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
