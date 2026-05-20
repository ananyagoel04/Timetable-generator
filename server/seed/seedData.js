require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const PeriodStructure = require('../models/PeriodStructure');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Room = require('../models/Room');
const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const ConflictLog = require('../models/ConflictLog');
const Absence = require('../models/Absence');
const DailyAdjustment = require('../models/DailyAdjustment');
const Substitution = require('../models/Substitution');
const TeacherReplacement = require('../models/TeacherReplacement');
const CustomRule = require('../models/CustomRule');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const seed = async () => {
  await connectDB();
  console.log('🗑️  Clearing all data...');
  await Promise.all([
    School.deleteMany({}), AcademicSession.deleteMany({}), PeriodStructure.deleteMany({}),
    Subject.deleteMany({}), Teacher.deleteMany({}), Class.deleteMany({}), Room.deleteMany({}),
    SubjectRequirement.deleteMany({}), SubjectCombinationRule.deleteMany({}),
    ReservedPeriodRule.deleteMany({}), LessonBlock.deleteMany({}),
    GeneratedTimetable.deleteMany({}), ConflictLog.deleteMany({}),
    Absence.deleteMany({}), DailyAdjustment.deleteMany({}), Substitution.deleteMany({}),
    TeacherReplacement.deleteMany({}), CustomRule.deleteMany({}),
    User.deleteMany({}), AuditLog.deleteMany({})
  ]);

  // 1. School
  const school = await School.create({
    name: 'Delhi Public School', code: 'DPS001',
    address: '123 Education Lane, New Delhi', phone: '011-26543210', email: 'admin@dps.edu',
    settings: {
      defaultPeriodsPerDay: 8, defaultBreakPeriod: 4,
      workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      allowSaturdayActivities: true, maxTeacherContinuousPeriods: 4, maxSameSubjectPerDay: 2,
      classTeacherFirstPeriodPreference: true, activitiesPreferLaterPeriods: true, mathSciencePreferMorning: true
    }
  });
  console.log('✅ School created');

  // 2. Academic Session
  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  // 3. Period Structure
  await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default',
    workingDays: school.settings.workingDays,
    timeslots: [
      { label: 'Period 1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
      { label: 'Period 2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
      { label: 'Period 3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
      { label: 'Break', slotNumber: 4, startTime: '10:00', endTime: '10:20', type: 'break', isSchedulable: false },
      { label: 'Period 4', slotNumber: 5, startTime: '10:20', endTime: '11:00', type: 'period', isSchedulable: true },
      { label: 'Period 5', slotNumber: 6, startTime: '11:00', endTime: '11:40', type: 'period', isSchedulable: true },
      { label: 'Lunch', slotNumber: 7, startTime: '11:40', endTime: '12:20', type: 'lunch', isSchedulable: false },
      { label: 'Period 6', slotNumber: 8, startTime: '12:20', endTime: '13:00', type: 'period', isSchedulable: true },
      { label: 'Period 7', slotNumber: 9, startTime: '13:00', endTime: '13:40', type: 'period', isSchedulable: true },
      { label: 'Period 8', slotNumber: 10, startTime: '13:40', endTime: '14:20', type: 'period', isSchedulable: true },
    ]
  });

  // 4. Subjects
  const S = {};
  const subjectsData = [
    { name: 'Mathematics', code: 'MATH', type: 'theory', category: 'core', defaultPeriodsPerWeek: 5, preferMorning: true, color: '#6366f1' },
    { name: 'English', code: 'ENG', type: 'theory', category: 'core', defaultPeriodsPerWeek: 5, color: '#ec4899' },
    { name: 'Hindi', code: 'HIN', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, color: '#f97316' },
    { name: 'Physics', code: 'PHY', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, preferMorning: true, color: '#f59e0b' },
    { name: 'Chemistry', code: 'CHEM', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, preferMorning: true, color: '#10b981' },
    { name: 'Biology', code: 'BIO', type: 'theory', category: 'elective', defaultPeriodsPerWeek: 4, color: '#14b8a6' },
    { name: 'Computer Science', code: 'CS', type: 'lab', category: 'elective', defaultPeriodsPerWeek: 3, requiresLab: true, canBeDoubled: true, color: '#8b5cf6' },
    { name: 'Social Science', code: 'SST', type: 'theory', category: 'core', defaultPeriodsPerWeek: 4, color: '#0ea5e9' },
    { name: 'Physical Education', code: 'PE', type: 'games', category: 'co_curricular', defaultPeriodsPerWeek: 2, preferAfternoon: true, color: '#ef4444' },
    { name: 'Art & Craft', code: 'ART', type: 'activity', category: 'co_curricular', defaultPeriodsPerWeek: 1, preferAfternoon: true, color: '#a855f7' },
    { name: 'Library', code: 'LIB', type: 'library', category: 'co_curricular', defaultPeriodsPerWeek: 1, color: '#78716c' },
    { name: 'Moral Science', code: 'MS', type: 'theory', category: 'co_curricular', defaultPeriodsPerWeek: 1, color: '#d946ef' },
    { name: 'Music', code: 'MUS', type: 'activity', category: 'extra_curricular', defaultPeriodsPerWeek: 1, preferAfternoon: true, color: '#fb923c' },
    { name: 'Science', code: 'SCI', type: 'theory', category: 'core', defaultPeriodsPerWeek: 5, preferMorning: true, color: '#22c55e' },
  ];
  for (const sd of subjectsData) {
    S[sd.code] = await Subject.create({ ...sd, school: school._id, session: session._id });
  }
  console.log(`✅ ${Object.keys(S).length} subjects`);

  // 5. Teachers
  const T = {};
  const teachersData = [
    { name: 'Dr. Arun Sharma', email: 'arun@dps.edu', department: 'Mathematics', caps: ['MATH'], color: '#6366f1' },
    { name: 'Mrs. Priya Verma', email: 'priya@dps.edu', department: 'English', caps: ['ENG'], color: '#ec4899' },
    { name: 'Mr. Rajesh Kumar', email: 'rajesh@dps.edu', department: 'Science', caps: ['PHY', 'SCI'], color: '#f59e0b' },
    { name: 'Dr. Meena Iyer', email: 'meena@dps.edu', department: 'Science', caps: ['CHEM', 'SCI'], color: '#10b981' },
    { name: 'Mr. Suresh Nair', email: 'suresh@dps.edu', department: 'Science', caps: ['BIO', 'SCI'], color: '#14b8a6' },
    { name: 'Ms. Anita Desai', email: 'anita@dps.edu', department: 'Computer Science', caps: ['CS'], color: '#8b5cf6' },
    { name: 'Mr. Vikram Singh', email: 'vikram@dps.edu', department: 'Social Studies', caps: ['SST'], color: '#0ea5e9' },
    { name: 'Mrs. Kavita Joshi', email: 'kavita@dps.edu', department: 'Physical Education', caps: ['PE'], color: '#ef4444' },
    { name: 'Mr. Arjun Reddy', email: 'arjun@dps.edu', department: 'Arts', caps: ['ART', 'MUS'], color: '#a855f7' },
    { name: 'Dr. Sanjay Gupta', email: 'sanjay@dps.edu', department: 'Mathematics', caps: ['MATH'], color: '#3b82f6' },
    { name: 'Mrs. Rekha Pillai', email: 'rekha@dps.edu', department: 'Hindi', caps: ['HIN'], color: '#f97316' },
    { name: 'Mr. Deepak Tiwari', email: 'deepak@dps.edu', department: 'Library', caps: ['LIB', 'MS'], color: '#78716c' },
  ];
  for (const td of teachersData) {
    T[td.email.split('@')[0]] = await Teacher.create({
      ...td, school: school._id, session: session._id,
      capabilities: td.caps.map(c => ({ subject: S[c]._id, proficiency: 'primary' })),
      maxPeriodsPerDay: 6, maxPeriodsPerWeek: 30
    });
  }
  console.log(`✅ ${Object.keys(T).length} teachers`);

  // 6. Rooms
  const rooms = await Room.insertMany([
    { school: school._id, name: 'Room 101', roomNumber: '101', type: 'classroom', capacity: 40, floor: 1 },
    { school: school._id, name: 'Room 102', roomNumber: '102', type: 'classroom', capacity: 40, floor: 1 },
    { school: school._id, name: 'Room 103', roomNumber: '103', type: 'classroom', capacity: 40, floor: 1 },
    { school: school._id, name: 'Room 201', roomNumber: '201', type: 'classroom', capacity: 35, floor: 2 },
    { school: school._id, name: 'Room 202', roomNumber: '202', type: 'classroom', capacity: 35, floor: 2 },
    { school: school._id, name: 'Room 203', roomNumber: '203', type: 'classroom', capacity: 35, floor: 2 },
    { school: school._id, name: 'Computer Lab', roomNumber: 'LAB-1', type: 'computer_lab', capacity: 30, floor: 3 },
    { school: school._id, name: 'Physics Lab', roomNumber: 'LAB-2', type: 'lab', capacity: 30, floor: 3 },
    { school: school._id, name: 'Library', roomNumber: 'LIB', type: 'library', capacity: 50, floor: 0 },
    { school: school._id, name: 'Playground', roomNumber: 'PG', type: 'playground', capacity: 200, floor: 0 },
  ]);
  console.log(`✅ ${rooms.length} rooms`);

  // 7. Classes
  const C = {};
  const classesData = [
    { grade: 9, section: 'A', studentCount: 35, ct: 'arun' },
    { grade: 9, section: 'B', studentCount: 38, ct: 'priya' },
    { grade: 10, section: 'A', studentCount: 32, ct: 'rajesh' },
    { grade: 10, section: 'B', studentCount: 36, ct: 'meena' },
  ];
  for (const cd of classesData) {
    const cls = await Class.create({
      school: school._id, session: session._id,
      grade: cd.grade, section: cd.section, studentCount: cd.studentCount,
      classTeacher: T[cd.ct]._id, stream: 'none'
    });
    C[`${cd.grade}${cd.section}`] = cls;
  }
  console.log(`✅ ${Object.keys(C).length} classes`);

  // 8. Subject Requirements
  const reqData = [
    // Class 9-A
    { c: '9A', s: 'MATH', t: 'arun', p: 5 }, { c: '9A', s: 'ENG', t: 'priya', p: 5 },
    { c: '9A', s: 'HIN', t: 'rekha', p: 4 }, { c: '9A', s: 'SCI', t: 'rajesh', p: 5 },
    { c: '9A', s: 'SST', t: 'vikram', p: 4 }, { c: '9A', s: 'CS', t: 'anita', p: 3 },
    { c: '9A', s: 'PE', t: 'kavita', p: 2 }, { c: '9A', s: 'ART', t: 'arjun', p: 1 },
    // Class 9-B
    { c: '9B', s: 'MATH', t: 'sanjay', p: 5 }, { c: '9B', s: 'ENG', t: 'priya', p: 5 },
    { c: '9B', s: 'HIN', t: 'rekha', p: 4 }, { c: '9B', s: 'SCI', t: 'meena', p: 5 },
    { c: '9B', s: 'SST', t: 'vikram', p: 4 }, { c: '9B', s: 'CS', t: 'anita', p: 3 },
    { c: '9B', s: 'PE', t: 'kavita', p: 2 }, { c: '9B', s: 'ART', t: 'arjun', p: 1 },
    // Class 10-A
    { c: '10A', s: 'MATH', t: 'arun', p: 5 }, { c: '10A', s: 'ENG', t: 'priya', p: 5 },
    { c: '10A', s: 'HIN', t: 'rekha', p: 4 }, { c: '10A', s: 'SCI', t: 'rajesh', p: 5 },
    { c: '10A', s: 'SST', t: 'vikram', p: 4 }, { c: '10A', s: 'CS', t: 'anita', p: 3 },
    { c: '10A', s: 'PE', t: 'kavita', p: 2 },
    // Class 10-B
    { c: '10B', s: 'MATH', t: 'sanjay', p: 5 }, { c: '10B', s: 'ENG', t: 'priya', p: 5 },
    { c: '10B', s: 'HIN', t: 'rekha', p: 4 }, { c: '10B', s: 'SCI', t: 'suresh', p: 5 },
    { c: '10B', s: 'SST', t: 'vikram', p: 4 }, { c: '10B', s: 'CS', t: 'anita', p: 3 },
    { c: '10B', s: 'PE', t: 'kavita', p: 2 },
  ];
  for (const r of reqData) {
    await SubjectRequirement.create({
      school: school._id, session: session._id,
      class: C[r.c]._id, subject: S[r.s]._id, teacher: T[r.t]._id,
      periodsPerWeek: r.p
    });
  }
  console.log(`✅ ${reqData.length} subject requirements`);

  // 9. Combination Rules
  await SubjectCombinationRule.create({
    school: school._id, session: session._id,
    name: 'Library combined for 9A & 9B',
    subject: S.LIB._id, teacher: T.deepak._id,
    appliesTo: [{ class: C['9A']._id }, { class: C['9B']._id }],
    periodsPerWeek: 1, strictness: 'must_combine'
  });
  await SubjectCombinationRule.create({
    school: school._id, session: session._id,
    name: 'Moral Science combined for 10A & 10B',
    subject: S.MS._id, teacher: T.deepak._id,
    appliesTo: [{ class: C['10A']._id }, { class: C['10B']._id }],
    periodsPerWeek: 1, strictness: 'try_combine'
  });
  console.log('✅ 2 combination rules');

  // 10. Reserved Period Rules
  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Saturday Last Period Activity',
    type: 'activity', day: 'Saturday', periods: [8],
    appliesTo: [], isLocked: true
  });
  console.log('✅ 1 reserved period rule');

  // 11. Default Admin User
  const adminUser = await User.create({
    name: 'Admin User', email: 'admin@dps.edu', password: 'admin123',
    role: 'school_admin',
    schools: [{ school: school._id, role: 'school_admin', permissions: [
      'view_timetable','generate_timetable','edit_setup','manage_teachers',
      'manage_rules','approve_substitutions','publish_timetable','view_audit',
      'manage_users','manage_school','export_reports','edit_timetable',
      'manage_absences','manage_replacements'
    ]}],
    activeSchool: school._id, activeSession: session._id
  });
  console.log(`✅ Admin user: admin@dps.edu / admin123`);

  console.log('\n🎉 Seed complete! Run the server and open http://localhost:5173');
  process.exit(0);
};

seed().catch(err => { console.error('❌', err); process.exit(1); });
