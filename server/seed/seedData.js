#!/usr/bin/env node
/**
 * TimeCraft ERP — Production-Grade Multi-School Seed
 * 
 * Creates 5 realistic schools for development/testing:
 *   School 1: Sunrise Primary (small, low conflicts)
 *   School 2: Delhi Model School (medium, manageable conflicts)
 *   School 3: National Sr. Secondary (senior, split groups, combined classes, labs)
 *   School 4: Mega City Academy (stress test, large dataset)
 *   School 5: Impossible School (intentionally impossible constraints)
 * 
 * Usage:
 *   npm run seed              — seed all 5 schools (additive, does not clear)
 *   npm run seed:reset        — wipe database + seed all 5 schools
 *   npm run seed:multi-school — alias for seed
 * 
 * SAFETY: Reset is blocked when NODE_ENV === 'production'
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Models
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const PeriodStructure = require('../models/PeriodStructure');
const SubjectRequirement = require('../models/SubjectRequirement');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const CanTeach = require('../models/CanTeach');

// Optional models for sample data
let AuditLog, GeneratedTimetable, LessonBlock, Substitution, ConflictLog, Snapshot;
try { AuditLog = require('../models/AuditLog'); } catch(e) {}
try { GeneratedTimetable = require('../models/GeneratedTimetable'); } catch(e) {}
try { LessonBlock = require('../models/LessonBlock'); } catch(e) {}
try { Substitution = require('../models/Substitution'); } catch(e) {}
try { ConflictLog = require('../models/ConflictLog'); } catch(e) {}
try { Snapshot = require('../models/Snapshot'); } catch(e) {}

const isReset = process.argv.includes('--reset');
const PLAIN_PW = 'admin123'; // User model pre-save hook will hash this

const ALL_PERMISSIONS = [
  'view_timetable', 'generate_timetable', 'edit_timetable', 'publish_timetable',
  'edit_setup', 'manage_teachers', 'manage_rules', 'approve_substitutions',
  'view_audit', 'manage_users', 'manage_school', 'export_reports',
  'manage_absences', 'manage_replacements'
];

const WORKING_DAYS_6 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WORKING_DAYS_5 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function defaultTimeslots8() {
  return [
    { label: 'P1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
    { label: 'P2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
    { label: 'P3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
    { label: 'P4', slotNumber: 4, startTime: '10:00', endTime: '10:40', type: 'period', isSchedulable: true },
    { label: 'Break', slotNumber: 5, startTime: '10:40', endTime: '11:00', type: 'break', isSchedulable: false },
    { label: 'P5', slotNumber: 6, startTime: '11:00', endTime: '11:40', type: 'period', isSchedulable: true },
    { label: 'P6', slotNumber: 7, startTime: '11:40', endTime: '12:20', type: 'period', isSchedulable: true },
    { label: 'Lunch', slotNumber: 8, startTime: '12:20', endTime: '13:00', type: 'lunch', isSchedulable: false },
    { label: 'P7', slotNumber: 9, startTime: '13:00', endTime: '13:40', type: 'period', isSchedulable: true },
    { label: 'P8', slotNumber: 10, startTime: '13:40', endTime: '14:20', type: 'period', isSchedulable: true },
  ];
}

function saturdayTimeslots6() {
  return [
    { label: 'P1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
    { label: 'P2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
    { label: 'P3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
    { label: 'P4', slotNumber: 4, startTime: '10:00', endTime: '10:40', type: 'period', isSchedulable: true },
    { label: 'Break', slotNumber: 5, startTime: '10:40', endTime: '11:00', type: 'break', isSchedulable: false },
    { label: 'P5', slotNumber: 6, startTime: '11:00', endTime: '11:40', type: 'period', isSchedulable: true },
    { label: 'P6', slotNumber: 7, startTime: '11:40', endTime: '12:20', type: 'period', isSchedulable: true },
  ];
}

async function createSchoolUsers(school, session, prefix, schoolName) {
  const users = [];
  const makeSchoolEntry = (role, perms) => ({
    school: school._id, role, permissions: perms, isActive: true
  });

  users.push(await User.create({
    name: `${schoolName} Admin`, email: `admin@${prefix}.edu.in`, password: PLAIN_PW,
    role: 'school_admin',
    schools: [makeSchoolEntry('school_owner', ALL_PERMISSIONS)],
    activeSchool: school._id, activeSession: session._id, isActive: true
  }));
  users.push(await User.create({
    name: `${schoolName} Principal`, email: `principal@${prefix}.edu.in`, password: PLAIN_PW,
    role: 'principal',
    schools: [makeSchoolEntry('school_owner', ALL_PERMISSIONS)],
    activeSchool: school._id, activeSession: session._id, isActive: true
  }));
  users.push(await User.create({
    name: `${schoolName} TT Manager`, email: `timetable@${prefix}.edu.in`, password: PLAIN_PW,
    role: 'timetable_manager',
    schools: [makeSchoolEntry('school_admin', ALL_PERMISSIONS.filter(p => p !== 'manage_users'))],
    activeSchool: school._id, activeSession: session._id, isActive: true
  }));
  users.push(await User.create({
    name: `${schoolName} Teacher`, email: `teacher@${prefix}.edu.in`, password: PLAIN_PW,
    role: 'teacher',
    schools: [makeSchoolEntry('teacher', ['view_timetable', 'manage_absences'])],
    activeSchool: school._id, activeSession: session._id, isActive: true
  }));
  users.push(await User.create({
    name: `${schoolName} Viewer`, email: `viewer@${prefix}.edu.in`, password: PLAIN_PW,
    role: 'viewer',
    schools: [makeSchoolEntry('viewer', ['view_timetable'])],
    activeSchool: school._id, activeSession: session._id, isActive: true
  }));
  return users;
}

async function createSubjects(school, session, subjectList) {
  const subjects = {};
  for (const s of subjectList) {
    const created = await Subject.create({ ...s, school: school._id, session: session._id });
    subjects[s.code] = created;
  }
  return subjects;
}

async function createTeachers(school, session, teacherDefs, subjects) {
  const teachers = {};
  let empCounter = 1001;
  for (const td of teacherDefs) {
    const caps = (td.subjects || []).map(code => ({
      subject: subjects[code]?._id,
      proficiency: td.proficiency || 'primary'
    })).filter(c => c.subject);
    const emailSlug = td.shortName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const schoolSlug = school.code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const t = await Teacher.create({
      name: td.name, shortName: td.shortName, department: td.department,
      email: `${emailSlug}.${empCounter}@${schoolSlug}.edu.in`,
      school: school._id, session: session._id, status: 'active',
      employeeId: `EMP-${empCounter++}`,
      phone: `+91-98${String(empCounter).padStart(8, '0')}`,
      maxPeriodsPerDay: td.maxPerDay || 6,
      maxPeriodsPerWeek: td.maxPerWeek || 30,
      capabilities: caps
    });
    teachers[td.shortName] = t;
  }
  return teachers;
}

async function createCanTeach(school, session, teacherDefs, teachers, subjects) {
  for (const td of teacherDefs) {
    const t = teachers[td.shortName];
    for (const code of (td.subjects || [])) {
      const s = subjects[code];
      if (!t || !s) continue;
      await CanTeach.create({
        school: school._id, session: session._id,
        teacher: t._id, subject: s._id,
        role: 'primary', priority: 8, isActive: true
      });
    }
  }
}

async function createReq(school, session, cls, subj, teacher, periods, opts = {}) {
  if (!cls || !subj || !teacher) return;
  await SubjectRequirement.create({
    school: school._id, session: session._id,
    class: cls._id, subject: subj._id, teacher: teacher._id,
    periodsPerWeek: periods,
    allowDoublePeriod: opts.double || false,
    consecutivePreference: opts.consecutive || 'none',
    consecutiveCount: opts.consecutiveCount || 2,
    studentGroup: opts.group || null,
    isActive: true
  });
}

// ═══════════════════════════════════════════════════════════════
// SCHOOL 1: SUNRISE PRIMARY (Small, Low Conflicts)
// ═══════════════════════════════════════════════════════════════
async function seedSchool1() {
  console.log('\n📚 Creating School 1: Sunrise Primary School...');

  const school = await School.create({
    name: 'Sunrise Primary School',
    code: 'SPS-001',
    address: '45 Garden Lane, Jaipur, Rajasthan',
    phone: '+91-141-2567890',
    email: 'info@sunriseprimary.edu.in',
    status: 'active',
    settings: {
      workingDays: WORKING_DAYS_6,
      defaultPeriodsPerDay: 8,
      defaultBreakPeriod: 5,
      classTeacherFirstPeriodPreference: true
    }
  });

  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  await createSchoolUsers(school, session, 'sunrise', 'Sunrise');

  const subjectList = [
    { name: 'English', code: 'ENG', type: 'theory', color: '#3B82F6' },
    { name: 'Hindi', code: 'HIN', type: 'theory', color: '#F59E0B' },
    { name: 'Mathematics', code: 'MAT', type: 'theory', color: '#EF4444', maxPerDay: 2 },
    { name: 'Environmental Studies', code: 'EVS', type: 'theory', color: '#10B981' },
    { name: 'Science', code: 'SCI', type: 'theory', color: '#14B8A6' },
    { name: 'Social Science', code: 'SST', type: 'theory', color: '#F97316' },
    { name: 'Physical Education', code: 'PE', type: 'games', color: '#059669' },
    { name: 'Art & Craft', code: 'ART', type: 'activity', color: '#DB2777' },
    { name: 'Music', code: 'MUS', type: 'activity', color: '#7C3AED' },
    { name: 'Moral Science', code: 'MS', type: 'activity', color: '#94A3B8' },
    { name: 'General Knowledge', code: 'GK', type: 'activity', color: '#475569' },
    { name: 'Library', code: 'LIB', type: 'activity', color: '#78716C' },
  ];
  const subjects = await createSubjects(school, session, subjectList);

  const teacherDefs = [
    { name: 'Mrs. Anita Sharma', shortName: 'ASH', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Kavita Joshi', shortName: 'KJH', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mr. Ramesh Gupta', shortName: 'RGP', department: 'Primary', subjects: ['ENG', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Sunita Devi', shortName: 'SDV', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mr. Lalit Kumar', shortName: 'LKM', department: 'Middle', subjects: ['ENG', 'SCI', 'SST', 'MAT'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Deepa Rani', shortName: 'DRN', department: 'Middle', subjects: ['HIN', 'SCI', 'SST', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mr. Vijay Pandey', shortName: 'VPD', department: 'Middle', subjects: ['MAT', 'SCI'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mrs. Reema Singh', shortName: 'RSG', department: 'Middle', subjects: ['ENG', 'HIN', 'SST'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mr. Sunil Yadav', shortName: 'SYD', department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 },
    { name: 'Mrs. Meena Kumari', shortName: 'MKM', department: 'Arts', subjects: ['ART', 'MUS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Pramod Rawat', shortName: 'PRW', department: 'General', subjects: ['MS', 'GK', 'LIB'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Poonam Verma', shortName: 'PVR', department: 'Primary', subjects: ['ENG', 'HIN', 'EVS', 'MAT'], maxPerDay: 7, maxPerWeek: 36 },
  ];
  const teachers = await createTeachers(school, session, teacherDefs, subjects);
  await createCanTeach(school, session, teacherDefs, teachers, subjects);

  // Rooms: 10 classrooms
  const roomData = [];
  for (let i = 1; i <= 10; i++) roomData.push({ name: `Room ${i}`, roomNumber: `R${i}`, type: 'classroom', capacity: 40, floor: Math.ceil(i / 4), school: school._id });
  roomData.push({ name: 'Activity Room', roomNumber: 'AR1', type: 'auditorium', capacity: 80, floor: 0, school: school._id });
  await Room.insertMany(roomData);

  // Period Structure
  const ps = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default (Mon-Sat)',
    templateType: 'default', status: 'active',
    workingDays: WORKING_DAYS_6,
    timeslots: defaultTimeslots8(),
    saturdayConfig: { enabled: true, timeslots: saturdayTimeslots6() }
  });

  // Classes: 1-8 single section
  const classes = {};
  for (let g = 1; g <= 8; g++) {
    classes[`${g}-A`] = await Class.create({
      school: school._id, session: session._id,
      grade: g, section: 'A', stream: 'none',
      studentCount: 35, periodStructure: ps._id
    });
  }

  // Assign class teachers
  const ctMap = { '1-A': 'ASH', '2-A': 'KJH', '3-A': 'RGP', '4-A': 'SDV', '5-A': 'PVR', '6-A': 'LKM', '7-A': 'DRN', '8-A': 'VPD' };
  for (const [ck, tc] of Object.entries(ctMap)) {
    if (classes[ck] && teachers[tc]) { classes[ck].classTeacher = teachers[tc]._id; await classes[ck].save(); }
  }

  // Subject Requirements — Primary (1-5)
  const primaryReqDef = [
    { subject: 'ENG', periods: 7 }, { subject: 'HIN', periods: 6 },
    { subject: 'MAT', periods: 7 }, { subject: 'EVS', periods: 5 },
    { subject: 'PE', periods: 2 }, { subject: 'ART', periods: 1 },
    { subject: 'MUS', periods: 1 }, { subject: 'MS', periods: 1 },
    { subject: 'GK', periods: 1 }, { subject: 'LIB', periods: 1 }
  ];
  const primaryTC = { '1-A': 'ASH', '2-A': 'KJH', '3-A': 'RGP', '4-A': 'SDV', '5-A': 'PVR' };
  for (const [ck, tc] of Object.entries(primaryTC)) {
    for (const r of primaryReqDef) {
      const tCode = ['PE'].includes(r.subject) ? 'SYD' : ['ART', 'MUS'].includes(r.subject) ? 'MKM' : ['MS', 'GK', 'LIB'].includes(r.subject) ? 'PRW' : tc;
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[tCode], r.periods);
    }
  }

  // Subject Requirements — Middle (6-8)
  const middleReqDef = [
    { subject: 'ENG', periods: 6 }, { subject: 'HIN', periods: 5 },
    { subject: 'MAT', periods: 6 }, { subject: 'SCI', periods: 5, double: true, consecutive: 'preferred' },
    { subject: 'SST', periods: 5 }, { subject: 'PE', periods: 2 },
    { subject: 'ART', periods: 1 }, { subject: 'MUS', periods: 1 },
    { subject: 'GK', periods: 1 }, { subject: 'LIB', periods: 1 }
  ];
  const middleTC = { '6-A': ['LKM', 'DRN'], '7-A': ['RSG', 'VPD'], '8-A': ['LKM', 'VPD'] };
  for (const [ck, tcPair] of Object.entries(middleTC)) {
    for (const r of middleReqDef) {
      let tCode;
      if (['PE'].includes(r.subject)) tCode = 'SYD';
      else if (['ART', 'MUS'].includes(r.subject)) tCode = 'MKM';
      else if (['GK', 'LIB'].includes(r.subject)) tCode = 'PRW';
      else if (['MAT', 'SCI'].includes(r.subject)) tCode = tcPair[1] || tcPair[0];
      else tCode = tcPair[0];
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[tCode], r.periods, { double: r.double, consecutive: r.consecutive });
    }
  }

  // Reserved Period: Saturday last period = Activity
  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Saturday Activity', type: 'activity',
    day: 'Saturday', periods: [6], isLocked: true, isActive: true
  });

  console.log(`   ✅ Sunrise Primary: 8 classes, ${teacherDefs.length} teachers, 11 rooms`);
  return school;
}

// ═══════════════════════════════════════════════════════════════
// SCHOOL 2: DELHI MODEL SCHOOL (Medium, Manageable Conflicts)
// ═══════════════════════════════════════════════════════════════
async function seedSchool2() {
  console.log('\n📚 Creating School 2: Delhi Model School...');

  const school = await School.create({
    name: 'Delhi Model School',
    code: 'DMS-002',
    address: '78 Sector 14, Dwarka, New Delhi',
    phone: '+91-11-25678901',
    email: 'info@delhimodel.edu.in',
    status: 'active',
    settings: {
      workingDays: WORKING_DAYS_6,
      defaultPeriodsPerDay: 8,
      defaultBreakPeriod: 5,
      classTeacherFirstPeriodPreference: true
    }
  });

  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  await createSchoolUsers(school, session, 'dms', 'DMS');

  const subjectList = [
    { name: 'English', code: 'ENG', type: 'theory', color: '#3B82F6', preferMorning: true },
    { name: 'Hindi', code: 'HIN', type: 'theory', color: '#F59E0B', preferMorning: true },
    { name: 'Mathematics', code: 'MAT', type: 'theory', color: '#EF4444', preferMorning: true, maxPerDay: 2 },
    { name: 'Science', code: 'SCI', type: 'theory', color: '#10B981', preferMorning: true },
    { name: 'Social Science', code: 'SST', type: 'theory', color: '#F97316' },
    { name: 'Computer Science', code: 'CS', type: 'theory', color: '#0891B2', requiresLab: true },
    { name: 'Sanskrit', code: 'SKT', type: 'theory', color: '#EA580C' },
    { name: 'Physical Education', code: 'PE', type: 'games', color: '#059669', preferAfternoon: true },
    { name: 'Art & Craft', code: 'ART', type: 'activity', color: '#DB2777' },
    { name: 'Music', code: 'MUS', type: 'activity', color: '#7C3AED' },
    { name: 'Moral Science', code: 'MS', type: 'activity', color: '#94A3B8' },
    { name: 'General Knowledge', code: 'GK', type: 'activity', color: '#475569' },
    { name: 'Library', code: 'LIB', type: 'activity', color: '#78716C' },
    { name: 'Environmental Studies', code: 'EVS', type: 'theory', color: '#84CC16' },
  ];
  const subjects = await createSubjects(school, session, subjectList);

  const teacherDefs = [
    // English (3)
    { name: 'Mrs. Anjali Verma', shortName: 'AVR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mr. Suresh Nair', shortName: 'SNR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mrs. Kavita Singh', shortName: 'KSG', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 30 },
    // Hindi (2)
    { name: 'Mrs. Geeta Rao', shortName: 'GRO', department: 'Hindi', subjects: ['HIN', 'SKT'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mr. Ramesh Pandey', shortName: 'RPD', department: 'Hindi', subjects: ['HIN', 'SKT'], maxPerDay: 6, maxPerWeek: 32 },
    // Math (3)
    { name: 'Mr. Rajendra Kumar', shortName: 'RKM', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mrs. Deepa Mathur', shortName: 'DMT', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mr. Arun Saxena', shortName: 'ASX', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 30 },
    // Science (3)
    { name: 'Dr. Vivek Tiwari', shortName: 'VTW', department: 'Science', subjects: ['SCI'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Dr. Rekha Srivastava', shortName: 'RSV', department: 'Science', subjects: ['SCI'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Uma Shankar', shortName: 'USK', department: 'Science', subjects: ['SCI', 'EVS'], maxPerDay: 6, maxPerWeek: 30 },
    // SST (2)
    { name: 'Mr. Amit Sharma', shortName: 'AMH', department: 'Social Science', subjects: ['SST'], maxPerDay: 6, maxPerWeek: 32 },
    { name: 'Mrs. Pooja Bhatt', shortName: 'PBT', department: 'Social Science', subjects: ['SST'], maxPerDay: 6, maxPerWeek: 32 },
    // CS (1)
    { name: 'Mr. Rohit Kapoor', shortName: 'RKP', department: 'Computer Science', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 },
    // Primary (4)
    { name: 'Mrs. Sheela Gupta', shortName: 'SHG', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Lalita Menon', shortName: 'LMN', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Alka Patel', shortName: 'APT', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Rani Kumari', shortName: 'RKI', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS'], maxPerDay: 7, maxPerWeek: 36 },
    // Specialists
    { name: 'Mr. Sunil Yadav', shortName: 'SYD', department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 },
    { name: 'Mr. Lalit Tandon', shortName: 'LTN', department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 },
    { name: 'Mrs. Meenakshi Sood', shortName: 'MSD', department: 'Art', subjects: ['ART'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Prateek Vohra', shortName: 'PVH', department: 'Music', subjects: ['MUS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Vikas Rawat', shortName: 'VRW', department: 'Sanskrit', subjects: ['SKT'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Kamla Devi', shortName: 'KDV', department: 'General', subjects: ['MS', 'GK'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Deepak Rawat', shortName: 'DRW', department: 'Library', subjects: ['LIB'], maxPerDay: 6, maxPerWeek: 30 },
  ];
  const teachers = await createTeachers(school, session, teacherDefs, subjects);
  await createCanTeach(school, session, teacherDefs, teachers, subjects);

  // Rooms: 18
  const roomData = [];
  for (let i = 1; i <= 14; i++) roomData.push({ name: `Room ${200 + i}`, roomNumber: `${200 + i}`, type: 'classroom', capacity: 45, floor: Math.ceil(i / 5), school: school._id });
  roomData.push({ name: 'Computer Lab', roomNumber: 'CMP1', type: 'lab', capacity: 35, floor: 2, school: school._id });
  roomData.push({ name: 'Science Lab', roomNumber: 'SL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Activity Hall', roomNumber: 'AH1', type: 'auditorium', capacity: 150, floor: 0, school: school._id });
  roomData.push({ name: 'Sports Ground', roomNumber: 'SG1', type: 'playground', capacity: 200, floor: 0, school: school._id });
  await Room.insertMany(roomData);

  const ps = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default (Mon-Sat)',
    templateType: 'default', status: 'active',
    workingDays: WORKING_DAYS_6,
    timeslots: defaultTimeslots8(),
    saturdayConfig: { enabled: true, timeslots: saturdayTimeslots6() }
  });

  // Classes: 1-10 with A/B sections = 20 classes
  const classes = {};
  for (let g = 1; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      classes[`${g}-${sec}`] = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 40, periodStructure: ps._id
      });
    }
  }

  // Class teachers
  const ctMap = {
    '1-A': 'SHG', '1-B': 'LMN', '2-A': 'APT', '2-B': 'RKI',
    '3-A': 'SHG', '3-B': 'LMN', '4-A': 'APT', '4-B': 'RKI',
    '5-A': 'SHG', '5-B': 'LMN',
    '6-A': 'AVR', '6-B': 'GRO', '7-A': 'RKM', '7-B': 'AMH',
    '8-A': 'DMT', '8-B': 'PBT', '9-A': 'KSG', '9-B': 'VTW',
    '10-A': 'ASX', '10-B': 'RSV'
  };
  for (const [ck, tc] of Object.entries(ctMap)) {
    if (classes[ck] && teachers[tc]) { classes[ck].classTeacher = teachers[tc]._id; await classes[ck].save(); }
  }

  // Primary (1-5) requirements
  const pReqs = [
    { subject: 'ENG', periods: 7 }, { subject: 'HIN', periods: 6 },
    { subject: 'MAT', periods: 7 }, { subject: 'EVS', periods: 5 },
    { subject: 'PE', periods: 2 }, { subject: 'ART', periods: 1 },
    { subject: 'MUS', periods: 1 }, { subject: 'MS', periods: 1 },
    { subject: 'GK', periods: 1 }, { subject: 'LIB', periods: 1 }
  ];
  const pTCMap = { '1-A': 'SHG', '1-B': 'LMN', '2-A': 'APT', '2-B': 'RKI', '3-A': 'SHG', '3-B': 'LMN', '4-A': 'APT', '4-B': 'RKI', '5-A': 'SHG', '5-B': 'LMN' };
  for (const [ck, tc] of Object.entries(pTCMap)) {
    for (const r of pReqs) {
      const tCode = r.subject === 'PE' ? (ck.endsWith('A') ? 'SYD' : 'LTN') : r.subject === 'ART' ? 'MSD' : r.subject === 'MUS' ? 'PVH' : ['MS', 'GK'].includes(r.subject) ? 'KDV' : r.subject === 'LIB' ? 'DRW' : tc;
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[tCode], r.periods);
    }
  }

  // Middle (6-8) requirements
  for (let g = 6; g <= 8; g++) {
    for (const sec of ['A', 'B']) {
      const ck = `${g}-${sec}`;
      const reqs = [
        { subject: 'ENG', periods: 5, tc: sec === 'A' ? 'AVR' : 'SNR' },
        { subject: 'HIN', periods: 5, tc: sec === 'A' ? 'GRO' : 'RPD' },
        { subject: 'MAT', periods: 6, tc: sec === 'A' ? 'RKM' : 'DMT' },
        { subject: 'SCI', periods: 5, tc: sec === 'A' ? 'VTW' : 'RSV', double: true, consecutive: 'preferred' },
        { subject: 'SST', periods: 5, tc: sec === 'A' ? 'AMH' : 'PBT' },
        { subject: 'CS', periods: 2, tc: 'RKP', double: true, consecutive: 'preferred' },
        { subject: 'SKT', periods: 1, tc: 'VRW' },
        { subject: 'PE', periods: 2, tc: sec === 'A' ? 'SYD' : 'LTN' },
        { subject: 'ART', periods: 1, tc: 'MSD' },
        { subject: 'MUS', periods: 1, tc: 'PVH' },
        { subject: 'LIB', periods: 1, tc: 'DRW' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double, consecutive: r.consecutive });
      }
    }
  }

  // Secondary (9-10) requirements
  for (let g = 9; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      const ck = `${g}-${sec}`;
      const reqs = [
        { subject: 'ENG', periods: 5, tc: 'KSG' },
        { subject: 'HIN', periods: 5, tc: sec === 'A' ? 'GRO' : 'RPD' },
        { subject: 'MAT', periods: 6, tc: sec === 'A' ? 'ASX' : 'DMT' },
        { subject: 'SCI', periods: 6, tc: sec === 'A' ? 'USK' : 'RSV', double: true, consecutive: 'required' },
        { subject: 'SST', periods: 5, tc: sec === 'A' ? 'AMH' : 'PBT' },
        { subject: 'CS', periods: 2, tc: 'RKP', double: true, consecutive: 'preferred' },
        { subject: 'PE', periods: 2, tc: sec === 'A' ? 'SYD' : 'LTN' },
        { subject: 'LIB', periods: 1, tc: 'DRW' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double, consecutive: r.consecutive });
      }
    }
  }

  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Saturday Activity Period', type: 'activity',
    day: 'Saturday', periods: [6], isLocked: true, isActive: true
  });

  console.log(`   ✅ Delhi Model School: 20 classes, ${teacherDefs.length} teachers, 18 rooms`);
  return school;
}

// ═══════════════════════════════════════════════════════════════
// SCHOOL 3: NATIONAL SR. SECONDARY (Senior, Split Groups, Labs)
// ═══════════════════════════════════════════════════════════════
async function seedSchool3() {
  console.log('\n📚 Creating School 3: National Sr. Secondary School...');

  const school = await School.create({
    name: 'National Senior Secondary School',
    code: 'NSSS-003',
    address: '12 Academic Road, Chandigarh',
    phone: '+91-172-3456789',
    email: 'info@nationalss.edu.in',
    status: 'active',
    settings: {
      workingDays: WORKING_DAYS_6,
      defaultPeriodsPerDay: 8,
      defaultBreakPeriod: 5,
      classTeacherFirstPeriodPreference: true
    }
  });

  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  await createSchoolUsers(school, session, 'nsss', 'NSSS');

  const subjectList = [
    { name: 'English', code: 'ENG', type: 'theory', color: '#3B82F6', preferMorning: true },
    { name: 'Hindi', code: 'HIN', type: 'theory', color: '#F59E0B', preferMorning: true },
    { name: 'Mathematics', code: 'MAT', type: 'theory', color: '#EF4444', preferMorning: true, maxPerDay: 2 },
    { name: 'Science', code: 'SCI', type: 'theory', color: '#10B981', preferMorning: true },
    { name: 'Social Science', code: 'SST', type: 'theory', color: '#F97316' },
    { name: 'Physics', code: 'PHY', type: 'theory', color: '#6366F1', requiresLab: true, preferMorning: true },
    { name: 'Chemistry', code: 'CHM', type: 'theory', color: '#8B5CF6', requiresLab: true, preferMorning: true },
    { name: 'Biology', code: 'BIO', type: 'theory', color: '#14B8A6', requiresLab: true, preferMorning: true },
    { name: 'Economics', code: 'ECO', type: 'theory', color: '#22C55E' },
    { name: 'Accountancy', code: 'ACC', type: 'theory', color: '#F43F5E' },
    { name: 'Business Studies', code: 'BST', type: 'theory', color: '#EC4899' },
    { name: 'History', code: 'HIS', type: 'theory', color: '#A855F7' },
    { name: 'Geography', code: 'GEO', type: 'theory', color: '#0EA5E9' },
    { name: 'Political Science', code: 'POL', type: 'theory', color: '#64748B' },
    { name: 'Computer Science', code: 'CS', type: 'theory', color: '#0891B2', requiresLab: true },
    { name: 'Physical Education', code: 'PE', type: 'games', color: '#059669', preferAfternoon: true },
    { name: 'Art & Craft', code: 'ART', type: 'activity', color: '#DB2777' },
    { name: 'Library', code: 'LIB', type: 'activity', color: '#78716C' },
    { name: 'Sanskrit', code: 'SKT', type: 'theory', color: '#EA580C' },
  ];
  const subjects = await createSubjects(school, session, subjectList);

  const teacherDefs = [
    // English (4)
    { name: 'Mrs. Anjali Verma', shortName: 'AVR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Suresh Nair', shortName: 'SNR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Kavita Singh', shortName: 'KSG', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Ms. Priya Malhotra', shortName: 'PML', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 28 },
    // Hindi (3)
    { name: 'Mrs. Geeta Rao', shortName: 'GRO', department: 'Hindi', subjects: ['HIN'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Ramesh Pandey', shortName: 'RPD', department: 'Hindi', subjects: ['HIN', 'SKT'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Sunita Joshi', shortName: 'SJH', department: 'Hindi', subjects: ['HIN', 'SKT'], maxPerDay: 6, maxPerWeek: 28 },
    // Math (4)
    { name: 'Mr. Rajendra Kumar', shortName: 'RKM', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Deepa Mathur', shortName: 'DMT', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Arun Saxena', shortName: 'ASX', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mrs. Meera Iyer', shortName: 'MIY', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 28 },
    // Physics (2)
    { name: 'Dr. Vivek Tiwari', shortName: 'VTW', department: 'Physics', subjects: ['PHY', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mr. Sanjay Dubey', shortName: 'SDB', department: 'Physics', subjects: ['PHY', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    // Chemistry (2)
    { name: 'Dr. Rekha Srivastava', shortName: 'RSV', department: 'Chemistry', subjects: ['CHM', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mr. Pankaj Mishra', shortName: 'PMH', department: 'Chemistry', subjects: ['CHM', 'SCI'], maxPerDay: 5, maxPerWeek: 26 },
    // Biology (2)
    { name: 'Dr. Smita Gupta', shortName: 'SGP', department: 'Biology', subjects: ['BIO', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mrs. Nisha Kapoor', shortName: 'NKP', department: 'Biology', subjects: ['BIO', 'SCI'], maxPerDay: 5, maxPerWeek: 26 },
    // SST (3)
    { name: 'Mr. Amit Sharma', shortName: 'AMH', department: 'Social Science', subjects: ['SST', 'HIS', 'GEO'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Pooja Bhatt', shortName: 'PBT', department: 'Social Science', subjects: ['SST', 'HIS', 'POL'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Vikram Chauhan', shortName: 'VCH', department: 'Social Science', subjects: ['SST', 'GEO', 'ECO'], maxPerDay: 6, maxPerWeek: 28 },
    // Commerce (2)
    { name: 'Mrs. Ritu Malhotra', shortName: 'RML', department: 'Commerce', subjects: ['ECO', 'BST'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Dinesh Agarwal', shortName: 'DAG', department: 'Commerce', subjects: ['ACC', 'BST'], maxPerDay: 5, maxPerWeek: 26 },
    // Political Science
    { name: 'Mrs. Anita Devi', shortName: 'ADV', department: 'Political Science', subjects: ['POL', 'HIS'], maxPerDay: 5, maxPerWeek: 26 },
    // CS (2)
    { name: 'Mr. Rohit Kapoor', shortName: 'RKP', department: 'Computer Science', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Neha Gupta', shortName: 'NGP', department: 'Computer Science', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 },
    // Primary/Middle (6)
    { name: 'Mrs. Sheela Gupta', shortName: 'SHG', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Lalita Menon', shortName: 'LMN', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Alka Patel', shortName: 'APT', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Rani Kumari', shortName: 'RKI', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Suman Devi', shortName: 'SDV', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    { name: 'Mrs. Padma Singh', shortName: 'PSG', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 7, maxPerWeek: 36 },
    // Specialists
    { name: 'Mr. Sunil Yadav', shortName: 'SYD', department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 },
    { name: 'Mr. Lalit Tandon', shortName: 'LTN', department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 },
    { name: 'Mrs. Meenakshi Sood', shortName: 'MSD', department: 'Art', subjects: ['ART'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Deepak Rawat', shortName: 'DRW', department: 'Library', subjects: ['LIB'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Vikas Rawat', shortName: 'VRW', department: 'Sanskrit', subjects: ['SKT'], maxPerDay: 5, maxPerWeek: 26 },
  ];
  const teachers = await createTeachers(school, session, teacherDefs, subjects);
  await createCanTeach(school, session, teacherDefs, teachers, subjects);

  // Rooms: 25
  const roomData = [];
  for (let i = 1; i <= 18; i++) roomData.push({ name: `Room ${300 + i}`, roomNumber: `${300 + i}`, type: 'classroom', capacity: 45, floor: Math.ceil(i / 6), school: school._id });
  roomData.push({ name: 'Physics Lab', roomNumber: 'PL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Chemistry Lab', roomNumber: 'CL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Biology Lab', roomNumber: 'BL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Computer Lab', roomNumber: 'CMP1', type: 'lab', capacity: 35, floor: 3, school: school._id });
  roomData.push({ name: 'Activity Hall', roomNumber: 'AH1', type: 'auditorium', capacity: 200, floor: 0, school: school._id });
  roomData.push({ name: 'Library', roomNumber: 'LIB1', type: 'library', capacity: 60, floor: 1, school: school._id });
  roomData.push({ name: 'Sports Ground', roomNumber: 'SG1', type: 'playground', capacity: 300, floor: 0, school: school._id });
  await Room.insertMany(roomData);

  const ps = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default (Mon-Sat)',
    templateType: 'default', status: 'active',
    workingDays: WORKING_DAYS_6,
    timeslots: defaultTimeslots8(),
    saturdayConfig: { enabled: true, timeslots: saturdayTimeslots6() }
  });

  // Classes: 9-10 (A/B), 11-12 (Science A/B, Commerce A, Humanities A)
  const classes = {};
  for (let g = 9; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      classes[`${g}-${sec}`] = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 40, periodStructure: ps._id
      });
    }
  }
  for (let g = 11; g <= 12; g++) {
    for (const [stream, sections, groups] of [
      ['science', ['A', 'B'], [
        { name: 'Bio Group', code: 'BIO', studentCount: 20 },
        { name: 'Maths Group', code: 'MATH', studentCount: 20 }
      ]],
      ['commerce', ['A'], []],
      ['humanities', ['A'], []]
    ]) {
      for (const sec of sections) {
        classes[`${g}-${sec}-${stream}`] = await Class.create({
          school: school._id, session: session._id,
          grade: g, section: sec, stream,
          studentCount: stream === 'science' ? 40 : 35,
          periodStructure: ps._id,
          studentGroups: groups
        });
      }
    }
  }

  // 9-10 requirements
  for (let g = 9; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      const ck = `${g}-${sec}`;
      const reqs = [
        { subject: 'ENG', periods: 5, tc: sec === 'A' ? 'KSG' : 'PML' },
        { subject: 'HIN', periods: 5, tc: sec === 'A' ? 'GRO' : 'SJH' },
        { subject: 'MAT', periods: 6, tc: sec === 'A' ? 'ASX' : 'MIY' },
        { subject: 'SCI', periods: 6, tc: sec === 'A' ? 'SDB' : 'PMH', double: true, consecutive: 'required' },
        { subject: 'SST', periods: 5, tc: sec === 'A' ? 'AMH' : 'VCH' },
        { subject: 'CS', periods: 2, tc: 'NGP', double: true, consecutive: 'preferred' },
        { subject: 'PE', periods: 2, tc: sec === 'A' ? 'SYD' : 'LTN' },
        { subject: 'LIB', periods: 1, tc: 'DRW' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double, consecutive: r.consecutive });
      }
    }
  }

  // 11-12 Science (split groups: Bio/Maths)
  for (let g = 11; g <= 12; g++) {
    for (const sec of ['A', 'B']) {
      const ck = `${g}-${sec}-science`;
      if (!classes[ck]) continue;
      const reqs = [
        { subject: 'ENG', periods: 4, tc: sec === 'A' ? 'AVR' : 'SNR' },
        { subject: 'PHY', periods: 5, tc: sec === 'A' ? 'VTW' : 'SDB', double: true, consecutive: 'required' },
        { subject: 'CHM', periods: 5, tc: sec === 'A' ? 'RSV' : 'PMH', double: true, consecutive: 'required' },
        { subject: 'BIO', periods: 5, tc: sec === 'A' ? 'SGP' : 'NKP', group: 'Bio Group', double: true, consecutive: 'required' },
        { subject: 'MAT', periods: 5, tc: sec === 'A' ? 'RKM' : 'DMT', group: 'Maths Group' },
        { subject: 'PE', periods: 2, tc: 'SYD' },
        { subject: 'CS', periods: 2, tc: 'RKP', double: true, consecutive: 'preferred' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double, consecutive: r.consecutive, group: r.group });
      }
    }
  }

  // 11-12 Commerce
  for (let g = 11; g <= 12; g++) {
    const ck = `${g}-A-commerce`;
    if (!classes[ck]) continue;
    const reqs = [
      { subject: 'ENG', periods: 4, tc: 'SNR' },
      { subject: 'ACC', periods: 5, tc: 'DAG' },
      { subject: 'BST', periods: 5, tc: 'RML' },
      { subject: 'ECO', periods: 5, tc: 'VCH' },
      { subject: 'MAT', periods: 4, tc: 'DMT' },
      { subject: 'PE', periods: 2, tc: 'LTN' },
      { subject: 'CS', periods: 2, tc: 'NGP' },
    ];
    for (const r of reqs) {
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods);
    }
  }

  // 11-12 Humanities
  for (let g = 11; g <= 12; g++) {
    const ck = `${g}-A-humanities`;
    if (!classes[ck]) continue;
    const reqs = [
      { subject: 'ENG', periods: 4, tc: 'KSG' },
      { subject: 'HIS', periods: 5, tc: 'PBT' },
      { subject: 'GEO', periods: 5, tc: 'AMH' },
      { subject: 'POL', periods: 5, tc: 'ADV' },
      { subject: 'ECO', periods: 4, tc: 'RML' },
      { subject: 'PE', periods: 2, tc: 'SYD' },
    ];
    for (const r of reqs) {
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods);
    }
  }

  // Combined class rules for English across 11 Science + Commerce + Humanities
  try {
    await SubjectCombinationRule.create({
      school: school._id, session: session._id,
      name: 'PE Combined 11',
      type: 'combined_class',
      subject: subjects['PE']._id,
      classes: [classes['11-A-science']?._id, classes['11-A-commerce']?._id, classes['11-A-humanities']?._id].filter(Boolean),
      periodsPerWeek: 2,
      isActive: true
    });
  } catch(e) { /* model may not support all fields */ }

  // Reserved periods
  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Monday Assembly', type: 'assembly',
    day: 'Monday', periods: [1], isLocked: true, isActive: true
  });
  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Saturday Activity', type: 'activity',
    day: 'Saturday', periods: [6], isLocked: true, isActive: true
  });

  const totalClasses = Object.keys(classes).length;
  console.log(`   ✅ National Sr. Secondary: ${totalClasses} classes (incl. streams), ${teacherDefs.length} teachers, 25 rooms`);
  return school;
}

// ═══════════════════════════════════════════════════════════════
// SCHOOL 4: MEGA CITY ACADEMY (Stress Test)
// ═══════════════════════════════════════════════════════════════
async function seedSchool4() {
  console.log('\n📚 Creating School 4: Mega City Academy (Stress Test)...');

  const school = await School.create({
    name: 'Mega City Academy',
    code: 'MCA-004',
    address: '1 MG Road, Bangalore, Karnataka',
    phone: '+91-80-45678901',
    email: 'info@megacity.edu.in',
    status: 'active',
    settings: {
      workingDays: WORKING_DAYS_6,
      defaultPeriodsPerDay: 8,
      defaultBreakPeriod: 5,
      classTeacherFirstPeriodPreference: true
    }
  });

  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  await createSchoolUsers(school, session, 'mega', 'Mega');

  const subjectList = [
    { name: 'English', code: 'ENG', type: 'theory', color: '#3B82F6' },
    { name: 'Hindi', code: 'HIN', type: 'theory', color: '#F59E0B' },
    { name: 'Mathematics', code: 'MAT', type: 'theory', color: '#EF4444', maxPerDay: 2 },
    { name: 'Science', code: 'SCI', type: 'theory', color: '#10B981' },
    { name: 'Social Science', code: 'SST', type: 'theory', color: '#F97316' },
    { name: 'Computer Science', code: 'CS', type: 'theory', color: '#0891B2', requiresLab: true },
    { name: 'Physical Education', code: 'PE', type: 'games', color: '#059669' },
    { name: 'Art & Craft', code: 'ART', type: 'activity', color: '#DB2777' },
    { name: 'Library', code: 'LIB', type: 'activity', color: '#78716C' },
    { name: 'Environmental Studies', code: 'EVS', type: 'theory', color: '#84CC16' },
    { name: 'Moral Science', code: 'MS', type: 'activity', color: '#94A3B8' },
  ];
  const subjects = await createSubjects(school, session, subjectList);

  // 50 teachers
  const teacherDefs = [];
  const depts = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Primary'];
  const subjMap = { English: ['ENG'], Hindi: ['HIN'], Mathematics: ['MAT'], Science: ['SCI', 'EVS'], 'Social Science': ['SST'], Primary: ['ENG', 'HIN', 'MAT', 'EVS'] };
  const firstNames = ['Anil', 'Sunil', 'Rajesh', 'Manoj', 'Sanjay', 'Priya', 'Neha', 'Ritu', 'Kavita', 'Deepa', 'Anita', 'Rekha', 'Suman', 'Geeta', 'Meera', 'Pooja', 'Ravi', 'Amit', 'Vikram', 'Arun'];
  const lastNames = ['Sharma', 'Verma', 'Gupta', 'Kumar', 'Singh', 'Yadav', 'Pandey', 'Mishra', 'Tiwari', 'Joshi'];
  let tCount = 0;
  for (const dept of depts) {
    const count = dept === 'Primary' ? 12 : dept === 'Mathematics' ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const fn = firstNames[(tCount + i) % firstNames.length];
      const ln = lastNames[(tCount + i) % lastNames.length];
      teacherDefs.push({
        name: `${fn} ${ln}`, shortName: `${fn[0]}${ln[0]}${tCount}`,
        department: dept, subjects: subjMap[dept],
        maxPerDay: dept === 'Primary' ? 7 : 6,
        maxPerWeek: dept === 'Primary' ? 36 : 32
      });
      tCount++;
    }
  }
  // Specialists
  for (let i = 0; i < 3; i++) teacherDefs.push({ name: `PE Coach ${i + 1}`, shortName: `PE${i}`, department: 'Sports', subjects: ['PE'], maxPerDay: 8, maxPerWeek: 40 });
  teacherDefs.push({ name: 'Art Teacher', shortName: 'ART0', department: 'Art', subjects: ['ART'], maxPerDay: 6, maxPerWeek: 30 });
  teacherDefs.push({ name: 'CS Teacher 1', shortName: 'CS0', department: 'CS', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 });
  teacherDefs.push({ name: 'CS Teacher 2', shortName: 'CS1', department: 'CS', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 });
  teacherDefs.push({ name: 'Library Teacher', shortName: 'LIB0', department: 'Library', subjects: ['LIB'], maxPerDay: 6, maxPerWeek: 30 });
  teacherDefs.push({ name: 'MS Teacher', shortName: 'MS0', department: 'General', subjects: ['MS'], maxPerDay: 6, maxPerWeek: 30 });

  const teachers = await createTeachers(school, session, teacherDefs, subjects);
  await createCanTeach(school, session, teacherDefs, teachers, subjects);

  // Rooms: 30
  const roomData = [];
  for (let i = 1; i <= 25; i++) roomData.push({ name: `Room ${400 + i}`, roomNumber: `${400 + i}`, type: 'classroom', capacity: 45, floor: Math.ceil(i / 8), school: school._id });
  for (let i = 1; i <= 3; i++) roomData.push({ name: `Computer Lab ${i}`, roomNumber: `CMP${i}`, type: 'lab', capacity: 35, floor: 3, school: school._id });
  roomData.push({ name: 'Science Lab', roomNumber: 'SL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Sports Ground', roomNumber: 'SG1', type: 'playground', capacity: 500, floor: 0, school: school._id });
  await Room.insertMany(roomData);

  const ps = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default (Mon-Sat)',
    templateType: 'default', status: 'active',
    workingDays: WORKING_DAYS_6,
    timeslots: defaultTimeslots8(),
    saturdayConfig: { enabled: true, timeslots: saturdayTimeslots6() }
  });

  // Classes: 1-10, A/B/C = 30 classes
  const classes = {};
  let tIdx = 0;
  for (let g = 1; g <= 10; g++) {
    for (const sec of ['A', 'B', 'C']) {
      classes[`${g}-${sec}`] = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 42, periodStructure: ps._id
      });
    }
  }

  // Requirements for all 30 classes
  const allTC = Object.keys(teachers);
  const engTCs = teacherDefs.filter(t => t.department === 'English').map(t => t.shortName);
  const hinTCs = teacherDefs.filter(t => t.department === 'Hindi').map(t => t.shortName);
  const matTCs = teacherDefs.filter(t => t.department === 'Mathematics').map(t => t.shortName);
  const sciTCs = teacherDefs.filter(t => t.department === 'Science').map(t => t.shortName);
  const sstTCs = teacherDefs.filter(t => t.department === 'Social Science').map(t => t.shortName);
  const priTCs = teacherDefs.filter(t => t.department === 'Primary').map(t => t.shortName);
  const peTCs = teacherDefs.filter(t => t.department === 'Sports').map(t => t.shortName);

  let classIdx = 0;
  for (let g = 1; g <= 5; g++) {
    for (const sec of ['A', 'B', 'C']) {
      const ck = `${g}-${sec}`;
      const tc = priTCs[classIdx % priTCs.length];
      const reqs = [
        { subject: 'ENG', periods: 7, tc }, { subject: 'HIN', periods: 6, tc },
        { subject: 'MAT', periods: 7, tc }, { subject: 'EVS', periods: 5, tc },
        { subject: 'PE', periods: 2, tc: peTCs[classIdx % peTCs.length] },
        { subject: 'ART', periods: 1, tc: 'ART0' },
        { subject: 'MS', periods: 1, tc: 'MS0' },
        { subject: 'LIB', periods: 1, tc: 'LIB0' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods);
      }
      classIdx++;
    }
  }

  for (let g = 6; g <= 10; g++) {
    for (const sec of ['A', 'B', 'C']) {
      const ck = `${g}-${sec}`;
      const idx = classIdx;
      const reqs = [
        { subject: 'ENG', periods: 5, tc: engTCs[idx % engTCs.length] },
        { subject: 'HIN', periods: 5, tc: hinTCs[idx % hinTCs.length] },
        { subject: 'MAT', periods: 6, tc: matTCs[idx % matTCs.length] },
        { subject: 'SCI', periods: 5, tc: sciTCs[idx % sciTCs.length], double: true },
        { subject: 'SST', periods: 5, tc: sstTCs[idx % sstTCs.length] },
        { subject: 'CS', periods: 2, tc: idx % 2 === 0 ? 'CS0' : 'CS1', double: true },
        { subject: 'PE', periods: 2, tc: peTCs[idx % peTCs.length] },
        { subject: 'ART', periods: 1, tc: 'ART0' },
        { subject: 'LIB', periods: 1, tc: 'LIB0' },
      ];
      for (const r of reqs) {
        await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double });
      }
      classIdx++;
    }
  }

  console.log(`   ✅ Mega City Academy: 30 classes, ${teacherDefs.length} teachers, 30 rooms (STRESS TEST)`);
  return school;
}

// ═══════════════════════════════════════════════════════════════
// SCHOOL 5: IMPOSSIBLE SCHOOL (Diagnostics Verification)
// ═══════════════════════════════════════════════════════════════
async function seedSchool5() {
  console.log('\n📚 Creating School 5: Impossible Constraints School...');

  const school = await School.create({
    name: 'Impossible Constraints School',
    code: 'ICS-005',
    address: '1 Test Lane, Noida',
    phone: '+91-120-1234567',
    email: 'info@impossible.edu.in',
    status: 'active',
    settings: {
      workingDays: WORKING_DAYS_5,
      defaultPeriodsPerDay: 6,
      defaultBreakPeriod: 4
    }
  });

  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  await createSchoolUsers(school, session, 'impossible', 'ICS');

  const subjectList = [
    { name: 'English', code: 'ENG', type: 'theory', color: '#3B82F6' },
    { name: 'Mathematics', code: 'MAT', type: 'theory', color: '#EF4444', maxPerDay: 2 },
    { name: 'Science', code: 'SCI', type: 'theory', color: '#10B981', requiresLab: true },
    { name: 'Hindi', code: 'HIN', type: 'theory', color: '#F59E0B' },
    { name: 'Social Science', code: 'SST', type: 'theory', color: '#F97316' },
    { name: 'Computer Science', code: 'CS', type: 'theory', color: '#0891B2', requiresLab: true },
    { name: 'Physical Education', code: 'PE', type: 'games', color: '#059669' },
  ];
  const subjects = await createSubjects(school, session, subjectList);

  // Only 3 teachers for 8 classes — intentionally impossible
  const teacherDefs = [
    { name: 'Teacher Alpha', shortName: 'TA', department: 'All', subjects: ['ENG', 'MAT', 'SCI', 'HIN', 'SST'], maxPerDay: 6, maxPerWeek: 25 },
    { name: 'Teacher Beta', shortName: 'TB', department: 'All', subjects: ['ENG', 'MAT', 'SCI', 'HIN', 'SST'], maxPerDay: 6, maxPerWeek: 25 },
    { name: 'Teacher Gamma', shortName: 'TG', department: 'All', subjects: ['CS', 'PE', 'ENG'], maxPerDay: 6, maxPerWeek: 25 },
  ];
  const teachers = await createTeachers(school, session, teacherDefs, subjects);
  await createCanTeach(school, session, teacherDefs, teachers, subjects);

  // Only 2 rooms for 8 classes — intentionally impossible
  await Room.insertMany([
    { name: 'Room 1', roomNumber: 'R1', type: 'classroom', capacity: 30, floor: 1, school: school._id },
    { name: 'Room 2', roomNumber: 'R2', type: 'classroom', capacity: 30, floor: 1, school: school._id },
  ]);

  const ps = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Short Day',
    templateType: 'default', status: 'active',
    workingDays: WORKING_DAYS_5,
    timeslots: [
      { label: 'P1', slotNumber: 1, startTime: '08:00', endTime: '08:45', type: 'period', isSchedulable: true },
      { label: 'P2', slotNumber: 2, startTime: '08:45', endTime: '09:30', type: 'period', isSchedulable: true },
      { label: 'P3', slotNumber: 3, startTime: '09:30', endTime: '10:15', type: 'period', isSchedulable: true },
      { label: 'Break', slotNumber: 4, startTime: '10:15', endTime: '10:30', type: 'break', isSchedulable: false },
      { label: 'P4', slotNumber: 5, startTime: '10:30', endTime: '11:15', type: 'period', isSchedulable: true },
      { label: 'P5', slotNumber: 6, startTime: '11:15', endTime: '12:00', type: 'period', isSchedulable: true },
      { label: 'P6', slotNumber: 7, startTime: '12:00', endTime: '12:45', type: 'period', isSchedulable: true },
    ]
  });

  // 8 classes — way too many for 3 teachers
  const classes = {};
  for (let g = 1; g <= 8; g++) {
    classes[`${g}-A`] = await Class.create({
      school: school._id, session: session._id,
      grade: g, section: 'A', stream: 'none',
      studentCount: 35, periodStructure: ps._id
    });
  }

  // Heavy requirements — each class needs 30 periods/week but only 3 teachers
  for (let g = 1; g <= 8; g++) {
    const ck = `${g}-A`;
    const reqs = [
      { subject: 'ENG', periods: 6, tc: 'TA' },
      { subject: 'MAT', periods: 6, tc: 'TB' },
      { subject: 'SCI', periods: 5, tc: 'TA', double: true },
      { subject: 'HIN', periods: 5, tc: 'TB' },
      { subject: 'SST', periods: 4, tc: 'TA' },
      { subject: 'CS', periods: 2, tc: 'TG', double: true },
      { subject: 'PE', periods: 2, tc: 'TG' },
    ];
    for (const r of reqs) {
      await createReq(school, session, classes[ck], subjects[r.subject], teachers[r.tc], r.periods, { double: r.double });
    }
  }

  console.log(`   ✅ Impossible School: 8 classes, 3 teachers, 2 rooms (INTENTIONALLY IMPOSSIBLE)`);
  return school;
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM ADMIN USER (cross-school access)
// ═══════════════════════════════════════════════════════════════
async function seedPlatformAdmin(schools) {
  console.log('\n👤 Creating Platform Admin user...');
  const schoolEntries = schools.map(s => ({
    school: s._id, role: 'school_owner', permissions: ALL_PERMISSIONS, isActive: true
  }));

  await User.create({
    name: 'Platform Admin', email: 'platform@timecraft.dev', password: PLAIN_PW,
    role: 'platform_developer',
    schools: schoolEntries,
    activeSchool: schools[0]._id,
    activeSession: (await AcademicSession.findOne({ school: schools[0]._id }))._id,
    isActive: true
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════════════════════════════
async function main() {
  await connectDB();

  // ── SAFETY CHECK ──
  if (isReset) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ FATAL: Database reset is BLOCKED in production mode.');
      console.error('   Set NODE_ENV=development or NODE_ENV=test to allow reset.');
      process.exit(1);
    }
    console.log('🗑️  Resetting database (NODE_ENV=' + process.env.NODE_ENV + ')...');
    const allModels = [
      School, AcademicSession, User, Teacher, Class, Subject, Room,
      PeriodStructure, SubjectRequirement, SubjectCombinationRule,
      ReservedPeriodRule, CanTeach
    ];
    // Optional models
    if (AuditLog) allModels.push(AuditLog);
    if (GeneratedTimetable) allModels.push(GeneratedTimetable);
    if (LessonBlock) allModels.push(LessonBlock);
    if (Substitution) allModels.push(Substitution);
    if (ConflictLog) allModels.push(ConflictLog);
    if (Snapshot) allModels.push(Snapshot);

    for (const M of allModels) {
      try { await M.deleteMany({}); } catch(e) { /* skip if model schema issue */ }
    }
    console.log('   ✅ Database cleared');
  }

  console.log('\n🌱 Starting Multi-School Seed...');
  console.log('═'.repeat(50));

  const school1 = await seedSchool1();
  const school2 = await seedSchool2();
  const school3 = await seedSchool3();
  const school4 = await seedSchool4();
  const school5 = await seedSchool5();
  await seedPlatformAdmin([school1, school2, school3, school4, school5]);

  console.log('\n' + '═'.repeat(50));
  console.log('✅ SEED COMPLETE!');
  console.log('═'.repeat(50));
  console.log('\n📊 Summary:');
  console.log('   School 1: Sunrise Primary (small, 8 classes, low conflicts)');
  console.log('   School 2: Delhi Model School (medium, 20 classes)');
  console.log('   School 3: National Sr. Secondary (streams, split groups, labs)');
  console.log('   School 4: Mega City Academy (30 classes, stress test)');
  console.log('   School 5: Impossible School (3 teachers, 8 classes, diagnostics)');
  console.log('\n🔑 Login Credentials (all passwords: admin123):');
  console.log('   Platform:  platform@timecraft.dev');
  console.log('   School 1:  admin@sunrise.edu.in');
  console.log('   School 2:  admin@dms.edu.in');
  console.log('   School 3:  admin@nsss.edu.in');
  console.log('   School 4:  admin@mega.edu.in');
  console.log('   School 5:  admin@impossible.edu.in');
  console.log('\n   Each school also has: principal@, timetable@, teacher@, viewer@');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
