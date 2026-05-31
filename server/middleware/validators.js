const { body, param, query, validationResult } = require('express-validator');

// ═══════════════════════════════════════════════════════════════════
// Shared error handler — returns 422 on validation failure
// ═══════════════════════════════════════════════════════════════════
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: e.value
      }))
    });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════
// Common field-level validators (reusable building blocks)
// ═══════════════════════════════════════════════════════════════════
const isMongoId = (field) =>
  param(field).isMongoId().withMessage(`${field} must be a valid ID`);

const requiredString = (field, label, min = 1, max = 200) => [
  body(field).trim().notEmpty().withMessage(`${label} is required`),
  body(field).isLength({ min, max }).withMessage(`${label} must be ${min}-${max} characters`)
];

const optionalString = (field, label, max = 200) =>
  body(field).optional().trim().isLength({ max }).withMessage(`${label} max ${max} characters`);

const requiredEmail = (field = 'email') =>
  body(field).trim().isEmail().normalizeEmail().withMessage('Valid email required');

const optionalEmail = (field = 'email') =>
  body(field).optional().trim().isEmail().normalizeEmail().withMessage('Valid email required');

const positiveInt = (field, label) =>
  body(field).optional().isInt({ min: 0 }).withMessage(`${label} must be a non-negative integer`).toInt();

const requiredPositiveInt = (field, label) =>
  body(field).isInt({ min: 1 }).withMessage(`${label} must be a positive integer`).toInt();

const mongoIdBody = (field, label) =>
  body(field).isMongoId().withMessage(`${label} must be a valid ID`);

const optionalMongoId = (field, label) =>
  body(field).optional().isMongoId().withMessage(`${label} must be a valid ID`);

// ═══════════════════════════════════════════════════════════════════
// AUTH validators
// ═══════════════════════════════════════════════════════════════════
const validateRegister = [
  ...requiredString('name', 'Name', 2, 100),
  requiredEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidation
];

const validateLogin = [
  requiredEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation
];

const validateForgotPassword = [
  requiredEmail(),
  handleValidation
];

const validateResetPassword = [
  requiredEmail(),
  body('resetToken').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidation
];

const validateSwitchSchool = [
  mongoIdBody('schoolId', 'School ID'),
  optionalMongoId('sessionId', 'Session ID'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// TEACHER validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateTeacher = [
  ...requiredString('name', 'Teacher name', 2, 100),
  optionalString('shortName', 'Short name', 10),
  optionalString('department', 'Department', 100),
  optionalEmail('email'),
  positiveInt('maxPeriodsPerDay', 'Max periods per day'),
  positiveInt('maxPeriodsPerWeek', 'Max periods per week'),
  handleValidation
];

const validateUpdateTeacher = [
  isMongoId('id'),
  optionalString('name', 'Teacher name', 100),
  optionalString('shortName', 'Short name', 10),
  optionalString('department', 'Department', 100),
  optionalEmail('email'),
  positiveInt('maxPeriodsPerDay', 'Max periods per day'),
  positiveInt('maxPeriodsPerWeek', 'Max periods per week'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// CLASS validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateClass = [
  body('grade').isInt({ min: -3, max: 12 }).withMessage('Grade must be between -3 (Nursery) and 12'),
  ...requiredString('section', 'Section', 1, 5),
  body('stream').optional().isIn(['none', 'science', 'commerce', 'humanities', 'arts']).withMessage('Invalid stream'),
  positiveInt('studentCount', 'Student count'),
  optionalMongoId('periodStructure', 'Period Structure'),
  optionalMongoId('classTeacher', 'Class Teacher'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// SUBJECT validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateSubject = [
  ...requiredString('name', 'Subject name', 2, 100),
  ...requiredString('code', 'Subject code', 1, 10),
  body('type').optional().isIn(['academic', 'physical', 'co_curricular', 'activity', 'lab']).withMessage('Invalid subject type'),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a hex value like #FF5733'),
  positiveInt('maxPerDay', 'Max per day'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// ROOM validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateRoom = [
  ...requiredString('name', 'Room name', 1, 100),
  optionalString('roomNumber', 'Room number', 20),
  body('type').optional().isIn(['classroom', 'lab', 'hall', 'special', 'playground', 'library']).withMessage('Invalid room type'),
  positiveInt('capacity', 'Capacity'),
  positiveInt('floor', 'Floor'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// SUBJECT REQUIREMENT validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateRequirement = [
  mongoIdBody('class', 'Class'),
  mongoIdBody('subject', 'Subject'),
  mongoIdBody('teacher', 'Teacher'),
  requiredPositiveInt('periodsPerWeek', 'Periods per week'),
  body('allowDoublePeriod').optional().isBoolean().withMessage('allowDoublePeriod must be boolean'),
  body('consecutivePreference').optional().isIn(['none', 'preferred', 'required']).withMessage('Invalid consecutive preference'),
  positiveInt('consecutiveCount', 'Consecutive count'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// CAN TEACH validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateCanTeach = [
  mongoIdBody('teacher', 'Teacher'),
  mongoIdBody('subject', 'Subject'),
  body('eligibilityType').optional().isIn(['primary', 'secondary', 'substitute_only', 'replacement_only']).withMessage('Invalid eligibility type'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be 1-10'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// ABSENCE validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateAbsence = [
  mongoIdBody('teacher', 'Teacher'),
  body('date').isISO8601().withMessage('Valid date required (ISO8601)'),
  body('type').isIn(['full_day', 'partial', 'multi_day']).withMessage('Type must be full_day, partial, or multi_day'),
  optionalString('reason', 'Reason', 500),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// SUBSTITUTION validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateSubstitution = [
  mongoIdBody('originalTeacher', 'Original teacher'),
  mongoIdBody('substituteTeacher', 'Substitute teacher'),
  body('date').isISO8601().withMessage('Valid date required'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// TIMETABLE validators
// ═══════════════════════════════════════════════════════════════════
const validateGenerateTimetable = [
  optionalString('name', 'Timetable name', 200),
  handleValidation
];

const validateBlockMove = [
  isMongoId('id'),
  body('day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']).withMessage('Invalid day'),
  body('period').isInt({ min: 1, max: 15 }).withMessage('Period must be between 1 and 15'),
  handleValidation
];

const validateBlockSwap = [
  mongoIdBody('blockAId', 'Block A'),
  mongoIdBody('blockBId', 'Block B'),
  handleValidation
];

const validateReassignTeacher = [
  isMongoId('id'),
  mongoIdBody('newTeacherId', 'New teacher'),
  handleValidation
];

const validateReassignRoom = [
  isMongoId('id'),
  mongoIdBody('newRoomId', 'New room'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// USER validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateUser = [
  ...requiredString('name', 'Name', 2, 100),
  requiredEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn([
    'platform_owner', 'platform_support', 'platform_developer', 'platform_qa', 'deployment_manager',
    'school_owner', 'school_admin', 'principal', 'timetable_manager', 'office_staff', 'teacher', 'viewer'
  ]).withMessage('Invalid role'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// CUSTOM RULE validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateCustomRule = [
  ...requiredString('name', 'Rule name', 2, 200),
  body('ruleType').isIn([
    'avoid_day', 'require_before_period', 'require_after_period',
    'max_per_day', 'avoid_consecutive', 'prefer_period_range',
    'teacher_day_off', 'room_restriction', 'subject_spread'
  ]).withMessage('Invalid rule type'),
  body('priority').optional().isIn(['hard', 'soft']).withMessage('Priority must be hard or soft'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// PERIOD STRUCTURE validators
// ═══════════════════════════════════════════════════════════════════
const validateCreatePeriodStructure = [
  ...requiredString('name', 'Structure name', 2, 100),
  body('timeslots').isArray({ min: 1 }).withMessage('At least one timeslot required'),
  body('timeslots.*.label').notEmpty().withMessage('Each timeslot needs a label'),
  body('timeslots.*.slotNumber').isInt({ min: 1 }).withMessage('Slot number must be positive'),
  body('timeslots.*.startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM format'),
  body('timeslots.*.endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM format'),
  body('timeslots.*.type').isIn(['period', 'break', 'lunch', 'assembly']).withMessage('Invalid slot type'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// SETUP validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateSchool = [
  ...requiredString('name', 'School name', 2, 200),
  optionalString('code', 'School code', 20),
  optionalEmail('email'),
  optionalString('phone', 'Phone', 20),
  optionalString('address', 'Address', 500),
  handleValidation
];

const validateCreateSession = [
  ...requiredString('name', 'Session name', 2, 50),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// SEARCH / QUERY validators
// ═══════════════════════════════════════════════════════════════════
const validateSearchQuery = [
  query('q').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Search query must be 2-100 chars'),
  handleValidation
];

const validatePagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be ≥ 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100').toInt(),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// COMBINATION RULE validators
// ═══════════════════════════════════════════════════════════════════
const validateCreateCombination = [
  ...requiredString('name', 'Rule name', 2, 200),
  mongoIdBody('subject', 'Subject'),
  body('classes').isArray({ min: 2 }).withMessage('At least 2 classes required for combination'),
  body('classes.*').isMongoId().withMessage('Each class must be a valid ID'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// EXPORT validators
// ═══════════════════════════════════════════════════════════════════
const validateExportRequest = [
  query('format').optional().isIn(['pdf', 'excel', 'csv']).withMessage('Format must be pdf, excel, or csv'),
  query('timetableId').optional().isMongoId().withMessage('timetableId must be a valid ID'),
  handleValidation
];

// ═══════════════════════════════════════════════════════════════════
// Param ID validator (generic)
// ═══════════════════════════════════════════════════════════════════
const validateParamId = [
  isMongoId('id'),
  handleValidation
];

module.exports = {
  handleValidation,
  // Auth
  validateRegister, validateLogin, validateForgotPassword, validateResetPassword, validateSwitchSchool,
  // CRUD
  validateCreateTeacher, validateUpdateTeacher,
  validateCreateClass,
  validateCreateSubject,
  validateCreateRoom,
  validateCreateRequirement,
  validateCreateCanTeach,
  validateCreateAbsence,
  validateCreateSubstitution,
  validateCreateUser,
  validateCreateCustomRule,
  validateCreatePeriodStructure,
  validateCreateSchool, validateCreateSession,
  validateCreateCombination,
  // Timetable
  validateGenerateTimetable, validateBlockMove, validateBlockSwap,
  validateReassignTeacher, validateReassignRoom,
  // Query
  validateSearchQuery, validatePagination, validateExportRequest,
  // Generic
  validateParamId,
};
