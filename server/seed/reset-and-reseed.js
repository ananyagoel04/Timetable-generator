/**
 * Phase 6: Database Reset & Clean Reseed Script
 * Drops all collections, rebuilds indexes, and seeds production-ready demo data.
 * 
 * Usage: node seed/reset-and-reseed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const SubjectRequirement = require('../models/SubjectRequirement');
const ClassSubjectMapping = require('../models/ClassSubjectMapping');
const PeriodStructure = require('../models/PeriodStructure');
const CanTeach = require('../models/CanTeach');
const LessonBlock = require('../models/LessonBlock');
const GeneratedTimetable = require('../models/GeneratedTimetable');
const Absence = require('../models/Absence');
const Substitution = require('../models/Substitution');
const AuditLog = require('../models/AuditLog');
const ConflictLog = require('../models/ConflictLog');
const Notification = require('../models/Notification');
const TimetableSnapshot = require('../models/TimetableSnapshot');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const SubjectCombinationRule = require('../models/SubjectCombinationRule');
const ReservedPeriodRule = require('../models/ReservedPeriodRule');
const CustomRule = require('../models/CustomRule');
const SoftPreference = require('../models/SoftPreference');
const ManualOverride = require('../models/ManualOverride');

async function resetAndReseed() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PHASE 6: DATABASE RESET & CLEAN RESEED');
  console.log('═══════════════════════════════════════════════════════\n');

  await connectDB();
  console.log('✅ Connected to MongoDB\n');

  // ── STEP 1: Drop all data collections ──
  console.log('🗑️  Dropping all data collections...');
  const collections = [
    LessonBlock, GeneratedTimetable, SubjectRequirement, ClassSubjectMapping, CanTeach,
    Absence, Substitution, ConflictLog, ManualOverride, TimetableSnapshot,
    Notification, AuditLog, SubjectCombinationRule, ReservedPeriodRule,
    CustomRule, SoftPreference, PeriodStructure,
    Teacher, Class, Subject, Room, User, AcademicSession, School,
    Role, Permission
  ];
  for (const Model of collections) {
    try {
      await Model.deleteMany({});
      console.log(`   ✓ Cleared ${Model.modelName}`);
    } catch (e) {
      console.log(`   ⚠ ${Model.modelName}: ${e.message}`);
    }
  }

  // ── STEP 2: Seed System Roles & Permissions ──
  console.log('\n🔐 Seeding system roles & permissions...');
  const { seedSystemData } = require('../controllers/roleController');
  await seedSystemData();
  console.log('   ✓ System roles seeded');

  // ── STEP 3: Create School ──
  console.log('\n🏫 Creating school...');
  const school = await School.create({
    name: 'Delhi Public School, R.K. Puram',
    code: 'DPS-RKP',
    settings: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      defaultPeriodsPerDay: 8,
      logo: null
    }
  });
  console.log(`   ✓ School: ${school.name} (${school._id})`);

  // ── STEP 4: Create Academic Session ──
  const session = await AcademicSession.create({
    school: school._id,
    name: '2025-26',
    startDate: new Date('2025-04-01'),
    endDate: new Date('2026-03-31'),
    isCurrent: true
  });
  console.log(`   ✓ Session: ${session.name}`);
  const scope = { school: school._id, session: session._id };

  // ── STEP 5: Create Users ──
  console.log('\n👤 Creating users...');
  const adminUser = await User.create({
    name: 'Dr. Ananya Goel',
    email: 'admin@divinewisdom.edu.in',
    password: 'admin123',
    role: 'school_admin',
    isActive: true,
    activeSchool: school._id,
    activeSession: session._id,
    schools: [{
      school: school._id, role: 'school_owner', isPrimary: true, isActive: true,
      permissions: ['view_timetable', 'edit_timetable', 'generate_timetable', 'manage_teachers',
        'edit_setup', 'manage_absences', 'approve_substitutions',
        'manage_replacements', 'export_reports', 'view_audit', 'manage_users',
        'manage_rules', 'manage_school', 'publish_timetable']
    }]
  });
  console.log(`   ✓ Admin: ${adminUser.email}`);

  const principalUser = await User.create({
    name: 'Mrs. Sudha Raghavan',
    email: 'principal@divinewisdom.edu.in',
    password: 'admin123',
    role: 'principal',
    isActive: true,
    activeSchool: school._id,
    activeSession: session._id,
    schools: [{
      school: school._id, role: 'school_admin', isPrimary: true, isActive: true,
      permissions: ['view_timetable', 'manage_teachers', 'edit_setup',
        'export_reports', 'view_audit']
    }]
  });
  console.log(`   ✓ Principal: ${principalUser.email}`);

  const ttManager = await User.create({
    name: 'Mr. Rajan Srivastava',
    email: 'timetable@divinewisdom.edu.in',
    password: 'admin123',
    role: 'timetable_manager',
    isActive: true,
    activeSchool: school._id,
    activeSession: session._id,
    schools: [{
      school: school._id, role: 'timetable_manager', isPrimary: true, isActive: true,
      permissions: ['view_timetable', 'edit_timetable', 'generate_timetable', 'manage_absences',
        'approve_substitutions', 'manage_replacements', 'export_reports', 'manage_rules', 'publish_timetable']
    }]
  });
  console.log(`   ✓ TT Manager: ${ttManager.email}`);

  const teacherUser = await User.create({
    name: 'Ms. Priya Sharma',
    email: 'priya.sharma@divinewisdom.edu.in',
    password: 'admin123',
    role: 'teacher',
    isActive: true,
    activeSchool: school._id,
    activeSession: session._id,
    schools: [{
      school: school._id, role: 'teacher', isPrimary: true, isActive: true,
      permissions: ['view_timetable']
    }]
  });
  console.log(`   ✓ Teacher: ${teacherUser.email}`);

  const platformDev = await User.create({
    name: 'TimeCraft Developer',
    email: 'dev@timecraft.io',
    password: 'admin123',
    role: 'platform_developer',
    isActive: true,
    schools: []
  });
  console.log(`   ✓ Platform Dev: ${platformDev.email}`);

  // ── STEP 6: Subjects ──
  console.log('\n📚 Creating subjects...');
  const subjectDefs = [
    { name: 'English', code: 'ENG', color: '#3b82f6', category: 'core', type: 'theory', defaultPeriodsPerWeek: 6 },
    { name: 'Hindi', code: 'HIN', color: '#ef4444', category: 'core', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'Mathematics', code: 'MAT', color: '#8b5cf6', category: 'core', type: 'theory', defaultPeriodsPerWeek: 6, canBeDoubled: true },
    { name: 'Science', code: 'SCI', color: '#10b981', category: 'core', type: 'theory', defaultPeriodsPerWeek: 5, canBeDoubled: true },
    { name: 'Social Science', code: 'SST', color: '#f59e0b', category: 'core', type: 'theory', defaultPeriodsPerWeek: 4 },
    { name: 'Physics', code: 'PHY', color: '#06b6d4', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5, canBeDoubled: true },
    { name: 'Chemistry', code: 'CHM', color: '#ec4899', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5, canBeDoubled: true },
    { name: 'Biology', code: 'BIO', color: '#22c55e', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5, canBeDoubled: true },
    { name: 'Computer Science', code: 'CS', color: '#6366f1', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 4 },
    { name: 'Accountancy', code: 'ACC', color: '#0ea5e9', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'Business Studies', code: 'BS', color: '#a855f7', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'Economics', code: 'ECO', color: '#14b8a6', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'History', code: 'HIS', color: '#d946ef', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'Political Science', code: 'POL', color: '#f97316', category: 'elective', type: 'theory', defaultPeriodsPerWeek: 5 },
    { name: 'Physical Education', code: 'PE', color: '#78716c', category: 'core', type: 'activity', defaultPeriodsPerWeek: 2 },
    { name: 'Art & Craft', code: 'ART', color: '#e11d48', category: 'core', type: 'activity', defaultPeriodsPerWeek: 2 },
    { name: 'Music', code: 'MUS', color: '#7c3aed', category: 'core', type: 'activity', defaultPeriodsPerWeek: 1 },
    { name: 'Moral Science', code: 'MS', color: '#ca8a04', category: 'core', type: 'moral_science', defaultPeriodsPerWeek: 1 },
    { name: 'Science Lab', code: 'SLAB', color: '#059669', category: 'core', type: 'lab', defaultPeriodsPerWeek: 2, canBeDoubled: true },
    { name: 'Computer Lab', code: 'CLAB', color: '#4f46e5', category: 'core', type: 'lab', defaultPeriodsPerWeek: 1, canBeDoubled: true },
    { name: 'Library', code: 'LIB', color: '#6b7280', category: 'core', type: 'library', defaultPeriodsPerWeek: 1 },
    { name: 'Club Activity', code: 'CLUB', color: '#f472b6', category: 'core', type: 'club', defaultPeriodsPerWeek: 1 },
    { name: 'Games', code: 'GAME', color: '#34d399', category: 'core', type: 'games', defaultPeriodsPerWeek: 1 },
  ];
  const subjects = [];
  const subjectMap = {};
  for (const sd of subjectDefs) {
    const sub = await Subject.create({ ...scope, ...sd, shortName: sd.code, isActive: true });
    subjects.push(sub);
    subjectMap[sd.code] = sub._id;
  }
  console.log(`   ✓ ${subjects.length} subjects created`);

  // ── STEP 7: Classes ──
  console.log('\n🏫 Creating classes (grades 1-12, streams, sections)...');
  const streams = ['science', 'commerce', 'humanities'];
  const sections = ['A', 'B'];
  const classesCreated = [];
  for (let grade = 1; grade <= 12; grade++) {
    for (const section of sections) {
      if (grade >= 11) {
        for (const s of streams) {
          const streamDisplay = s.charAt(0).toUpperCase() + s.slice(1);
          const cls = await Class.create({
            ...scope, name: `${grade}-${section} (${streamDisplay})`, grade, section, stream: s,
            isActive: true, maxStudents: 40, studentCount: 35 + Math.floor(Math.random() * 10)
          });
          classesCreated.push(cls);
        }
      } else {
        const cls = await Class.create({
          ...scope, name: `${grade}-${section}`, grade, section, stream: null,
          isActive: true, maxStudents: 45, studentCount: 38 + Math.floor(Math.random() * 10)
        });
        classesCreated.push(cls);
      }
    }
  }
  console.log(`   ✓ ${classesCreated.length} classes created`);

  // ── STEP 8: Teachers ──
  console.log('\n👨‍🏫 Creating teachers...');
  const teacherDefs = [
    { name: 'Priya Sharma', shortName: 'P.Sharma', dept: 'English', subjects: ['ENG'], email: 'priya.sharma@school.edu', employeeId: 'EMP001', phone: '9876543201' },
    { name: 'Anita Gupta', shortName: 'A.Gupta', dept: 'English', subjects: ['ENG'], email: 'anita.gupta@school.edu', employeeId: 'EMP002', phone: '9876543202' },
    { name: 'Kavita Joshi', shortName: 'K.Joshi', dept: 'English', subjects: ['ENG'], email: 'kavita.joshi@school.edu', employeeId: 'EMP003', phone: '9876543203' },
    { name: 'Divya Menon', shortName: 'D.Menon', dept: 'English', subjects: ['ENG'], email: 'divya.menon@school.edu', employeeId: 'EMP004', phone: '9876543204' },
    { name: 'Sunita Verma', shortName: 'S.Verma', dept: 'Hindi', subjects: ['HIN'], email: 'sunita.verma@school.edu', employeeId: 'EMP005', phone: '9876543205' },
    { name: 'Meera Devi', shortName: 'M.Devi', dept: 'Hindi', subjects: ['HIN'], email: 'meera.devi@school.edu', employeeId: 'EMP006', phone: '9876543206' },
    { name: 'Shalini Bhatt', shortName: 'Sh.Bhatt', dept: 'Hindi', subjects: ['HIN'], email: 'shalini.bhatt@school.edu', employeeId: 'EMP007', phone: '9876543207' },
    { name: 'Rajesh Kumar', shortName: 'R.Kumar', dept: 'Mathematics', subjects: ['MAT'], email: 'rajesh.kumar@school.edu', employeeId: 'EMP008', phone: '9876543208' },
    { name: 'Amit Tiwari', shortName: 'A.Tiwari', dept: 'Mathematics', subjects: ['MAT'], email: 'amit.tiwari@school.edu', employeeId: 'EMP009', phone: '9876543209' },
    { name: 'Deepak Singh', shortName: 'D.Singh', dept: 'Mathematics', subjects: ['MAT'], email: 'deepak.singh@school.edu', employeeId: 'EMP010', phone: '9876543210' },
    { name: 'Neha Agarwal', shortName: 'N.Agarwal', dept: 'Mathematics', subjects: ['MAT'], email: 'neha.agarwal@school.edu', employeeId: 'EMP011', phone: '9876543211' },
    { name: 'Anil Kapoor', shortName: 'An.Kapoor', dept: 'Mathematics', subjects: ['MAT'], email: 'anil.kapoor@school.edu', employeeId: 'EMP012', phone: '9876543212' },
    { name: 'Sanjay Patel', shortName: 'S.Patel', dept: 'Science', subjects: ['SCI', 'PHY'], email: 'sanjay.patel@school.edu', employeeId: 'EMP013', phone: '9876543213' },
    { name: 'Ritu Mishra', shortName: 'R.Mishra', dept: 'Science', subjects: ['SCI', 'CHM'], email: 'ritu.mishra@school.edu', employeeId: 'EMP014', phone: '9876543214' },
    { name: 'Vikram Rao', shortName: 'V.Rao', dept: 'Science', subjects: ['SCI', 'BIO'], email: 'vikram.rao@school.edu', employeeId: 'EMP015', phone: '9876543215' },
    { name: 'Smita Desai', shortName: 'Sm.Desai', dept: 'Science', subjects: ['SCI'], email: 'smita.desai@school.edu', employeeId: 'EMP016', phone: '9876543216' },
    { name: 'Dr. Arun Mehta', shortName: 'A.Mehta', dept: 'Physics', subjects: ['PHY', 'SCI'], email: 'arun.mehta@school.edu', employeeId: 'EMP017', phone: '9876543217' },
    { name: 'Pooja Nair', shortName: 'P.Nair', dept: 'Physics', subjects: ['PHY'], email: 'pooja.nair@school.edu', employeeId: 'EMP018', phone: '9876543218' },
    { name: 'Dr. Seema Bhat', shortName: 'S.Bhat', dept: 'Chemistry', subjects: ['CHM', 'SCI'], email: 'seema.bhat@school.edu', employeeId: 'EMP019', phone: '9876543219' },
    { name: 'Manoj Saxena', shortName: 'M.Saxena', dept: 'Chemistry', subjects: ['CHM'], email: 'manoj.saxena@school.edu', employeeId: 'EMP020', phone: '9876543220' },
    { name: 'Dr. Rekha Das', shortName: 'R.Das', dept: 'Biology', subjects: ['BIO', 'SCI'], email: 'rekha.das@school.edu', employeeId: 'EMP021', phone: '9876543221' },
    { name: 'Ashok Pandey', shortName: 'A.Pandey', dept: 'Social Science', subjects: ['SST', 'HIS'], email: 'ashok.pandey@school.edu', employeeId: 'EMP022', phone: '9876543222' },
    { name: 'Nandini Iyer', shortName: 'N.Iyer', dept: 'Social Science', subjects: ['SST', 'POL'], email: 'nandini.iyer@school.edu', employeeId: 'EMP023', phone: '9876543223' },
    { name: 'Rohit Sharma', shortName: 'Ro.Sharma', dept: 'Social Science', subjects: ['SST'], email: 'rohit.sharma@school.edu', employeeId: 'EMP024', phone: '9876543224' },
    { name: 'Tarun Ghosh', shortName: 'T.Ghosh', dept: 'Social Science', subjects: ['SST', 'ECO'], email: 'tarun.ghosh@school.edu', employeeId: 'EMP025', phone: '9876543225' },
    { name: 'CA Suresh Bose', shortName: 'S.Bose', dept: 'Commerce', subjects: ['ACC', 'BS'], email: 'suresh.bose@school.edu', employeeId: 'EMP026', phone: '9876543226' },
    { name: 'Geeta Chopra', shortName: 'G.Chopra', dept: 'Commerce', subjects: ['ECO', 'BS'], email: 'geeta.chopra@school.edu', employeeId: 'EMP027', phone: '9876543227' },
    { name: 'Vivek Reddy', shortName: 'V.Reddy', dept: 'Computer Science', subjects: ['CS', 'CLAB'], email: 'vivek.reddy@school.edu', employeeId: 'EMP028', phone: '9876543228' },
    { name: 'Swati Kulkarni', shortName: 'Sw.Kulkarni', dept: 'Computer Science', subjects: ['CS', 'CLAB'], email: 'swati.kulkarni@school.edu', employeeId: 'EMP029', phone: '9876543229' },
    { name: 'Ravi Chauhan', shortName: 'R.Chauhan', dept: 'Physical Education', subjects: ['PE', 'GAME'], email: 'ravi.chauhan@school.edu', employeeId: 'EMP030', phone: '9876543230' },
    { name: 'Sunil Yadav', shortName: 'S.Yadav', dept: 'Physical Education', subjects: ['PE', 'GAME'], email: 'sunil.yadav@school.edu', employeeId: 'EMP031', phone: '9876543231' },
    { name: 'Archana Roy', shortName: 'A.Roy', dept: 'Art', subjects: ['ART'], email: 'archana.roy@school.edu', employeeId: 'EMP032', phone: '9876543232' },
    { name: 'Kiran Naik', shortName: 'K.Naik', dept: 'Music', subjects: ['MUS', 'MS'], email: 'kiran.naik@school.edu', employeeId: 'EMP033', phone: '9876543233' },
    { name: 'Manish Jha', shortName: 'M.Jha', dept: 'Lab', subjects: ['SLAB'], email: 'manish.jha@school.edu', employeeId: 'EMP034', phone: '9876543234' },
    { name: 'Pankaj More', shortName: 'P.More', dept: 'Lab', subjects: ['CLAB'], email: 'pankaj.more@school.edu', employeeId: 'EMP035', phone: '9876543235' },
    { name: 'Leela Krishnan', shortName: 'L.Krishnan', dept: 'Library', subjects: ['LIB'], email: 'leela.krishnan@school.edu', employeeId: 'EMP036', phone: '9876543236' },
    { name: 'Harish Chandra', shortName: 'H.Chandra', dept: 'Activities', subjects: ['CLUB'], email: 'harish.chandra@school.edu', employeeId: 'EMP037', phone: '9876543237' },
  ];

  const teachersCreated = [];
  for (const td of teacherDefs) {
    const capabilities = td.subjects.map(code => ({
      subject: subjectMap[code],
      proficiency: 'primary'
    })).filter(c => c.subject);

    const teacher = await Teacher.create({
      ...scope, name: td.name, shortName: td.shortName, printAlias: td.shortName,
      email: td.email, employeeId: td.employeeId, phone: td.phone,
      department: td.dept, capabilities, status: 'active',
      maxPeriodsPerDay: 7, maxPeriodsPerWeek: 36, maxContinuousPeriods: 4,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    });
    teachersCreated.push(teacher);
  }
  console.log(`   ✓ ${teachersCreated.length} teachers created`);

  // ── STEP 9: Rooms ──
  console.log('\n🚪 Creating rooms...');
  const roomDefs = [];
  for (let i = 1; i <= 32; i++) roomDefs.push({ name: `Room ${100 + i}`, roomNumber: `${100 + i}`, type: 'classroom', capacity: 45 });
  roomDefs.push({ name: 'Physics Lab', roomNumber: 'PL-1', type: 'lab', capacity: 30 });
  roomDefs.push({ name: 'Chemistry Lab', roomNumber: 'CL-1', type: 'lab', capacity: 30 });
  roomDefs.push({ name: 'Biology Lab', roomNumber: 'BL-1', type: 'lab', capacity: 30 });
  roomDefs.push({ name: 'Computer Lab 1', roomNumber: 'COMP-1', type: 'computer_lab', capacity: 35 });
  roomDefs.push({ name: 'Computer Lab 2', roomNumber: 'COMP-2', type: 'computer_lab', capacity: 35 });
  roomDefs.push({ name: 'Art Room', roomNumber: 'ART-1', type: 'art_room', capacity: 40 });
  roomDefs.push({ name: 'Music Room', roomNumber: 'MUS-1', type: 'music_room', capacity: 35 });
  roomDefs.push({ name: 'Library', roomNumber: 'LIB-1', type: 'library', capacity: 60 });
  roomDefs.push({ name: 'Sports Ground', roomNumber: 'GND-1', type: 'playground', capacity: 200 });
  roomDefs.push({ name: 'Multipurpose Hall', roomNumber: 'MPH-1', type: 'auditorium', capacity: 150 });

  for (const rd of roomDefs) {
    await Room.create({ ...scope, ...rd, isActive: true });
  }
  console.log(`   ✓ ${roomDefs.length} rooms created`);

  // ── STEP 10: Period Structure ──
  console.log('\n⏰ Creating period structure...');
  await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Standard (8 periods)',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    timeslots: [
      { label: 'Period 1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Period 2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Period 3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Short Break', slotNumber: 4, startTime: '10:00', endTime: '10:15', type: 'break', isSchedulable: false, slotType: 'break' },
      { label: 'Period 4', slotNumber: 5, startTime: '10:15', endTime: '10:55', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Period 5', slotNumber: 6, startTime: '10:55', endTime: '11:35', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Lunch Break', slotNumber: 7, startTime: '11:35', endTime: '12:15', type: 'lunch', isSchedulable: false, slotType: 'lunch' },
      { label: 'Period 6', slotNumber: 8, startTime: '12:15', endTime: '12:55', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Period 7', slotNumber: 9, startTime: '12:55', endTime: '13:35', type: 'period', isSchedulable: true, slotType: 'period' },
      { label: 'Period 8', slotNumber: 10, startTime: '13:35', endTime: '14:15', type: 'period', isSchedulable: true, slotType: 'period' },
    ],
    status: 'active'
  });
  console.log('   ✓ Period structure created');

  // ── STEP 11: Subject Requirements (abbreviated for the 32 classes) ──
  console.log('\n📋 Creating subject requirements...');
  let reqCount = 0;
  const getTeacherForSubject = (subCode, idx = 0) => {
    const matching = teachersCreated.filter(t =>
      t.capabilities.some(c => c.subject?.toString() === subjectMap[subCode]?.toString())
    );
    return matching.length > 0 ? matching[idx % matching.length] : null;
  };

  for (const cls of classesCreated) {
    const grade = cls.grade;
    const stream = cls.stream;
    let subjectsForClass = [];

    if (grade <= 5) {
      subjectsForClass = [
        { code: 'ENG', periods: 7 }, { code: 'HIN', periods: 6 }, { code: 'MAT', periods: 7 },
        { code: 'SCI', periods: 4 }, { code: 'SST', periods: 3 }, { code: 'PE', periods: 2 },
        { code: 'ART', periods: 2 }, { code: 'MUS', periods: 1 }, { code: 'MS', periods: 1 },
        { code: 'LIB', periods: 1 }, { code: 'CLUB', periods: 1 }, { code: 'GAME', periods: 1 }
      ];
    } else if (grade <= 8) {
      subjectsForClass = [
        { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'MAT', periods: 6 },
        { code: 'SCI', periods: 5 }, { code: 'SST', periods: 4 }, { code: 'PE', periods: 2 },
        { code: 'ART', periods: 1 }, { code: 'MUS', periods: 1 }, { code: 'MS', periods: 1 },
        { code: 'SLAB', periods: 2 }, { code: 'CLAB', periods: 1 }, { code: 'LIB', periods: 1 },
        { code: 'CLUB', periods: 1 }
      ];
    } else if (grade <= 10) {
      subjectsForClass = [
        { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'MAT', periods: 7 },
        { code: 'SCI', periods: 6 }, { code: 'SST', periods: 5 }, { code: 'PE', periods: 2 },
        { code: 'SLAB', periods: 2 }, { code: 'CLAB', periods: 1 }, { code: 'LIB', periods: 1 },
        { code: 'CLUB', periods: 1 }
      ];
    } else if (stream === 'science') {
      subjectsForClass = [
        { code: 'ENG', periods: 5 }, { code: 'PHY', periods: 6 }, { code: 'CHM', periods: 6 },
        { code: 'MAT', periods: 6 }, { code: 'BIO', periods: 5 }, { code: 'CS', periods: 4 },
        { code: 'PE', periods: 2 }, { code: 'SLAB', periods: 2 }
      ];
    } else if (stream === 'commerce') {
      subjectsForClass = [
        { code: 'ENG', periods: 5 }, { code: 'ACC', periods: 6 }, { code: 'BS', periods: 6 },
        { code: 'ECO', periods: 6 }, { code: 'MAT', periods: 5 }, { code: 'CS', periods: 4 },
        { code: 'PE', periods: 2 }, { code: 'LIB', periods: 1 }, { code: 'CLUB', periods: 1 }
      ];
    } else {
      subjectsForClass = [
        { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'HIS', periods: 6 },
        { code: 'POL', periods: 6 }, { code: 'ECO', periods: 5 }, { code: 'SST', periods: 4 },
        { code: 'PE', periods: 2 }, { code: 'LIB', periods: 1 }, { code: 'CLUB', periods: 1 }
      ];
    }

    let teacherIdx = 0;
    for (const { code, periods } of subjectsForClass) {
      if (!subjectMap[code]) continue;
      const teacher = getTeacherForSubject(code, teacherIdx++);
      if (!teacher) continue;
      await SubjectRequirement.create({
        ...scope, class: cls._id, subject: subjectMap[code],
        teacher: teacher._id, periodsPerWeek: periods,
        allowDoublePeriod: ['MAT', 'SCI', 'PHY', 'CHM', 'BIO', 'SLAB', 'CLAB'].includes(code),
        doublePeriodsPerWeek: ['SLAB', 'CLAB'].includes(code) ? 1 : 0,
        consecutivePreference: 'none', consecutiveCount: 2, isActive: true
      });
      reqCount++;
    }
  }
  console.log(`   ✓ ${reqCount} subject requirements created`);

  // ── STEP 11b: Class-Subject Mappings (auto-generate from requirements) ──
  console.log('\n📎 Creating class-subject mappings...');
  let csmCount = 0;
  const csmSeen = new Set();
  for (const cls of classesCreated) {
    const grade = cls.grade;
    const stream = cls.stream;
    let subjectsForClass = [];
    if (grade <= 5) {
      subjectsForClass = ['ENG','HIN','MAT','SCI','SST','PE','ART','MUS','MS','LIB','CLUB','GAME'];
    } else if (grade <= 8) {
      subjectsForClass = ['ENG','HIN','MAT','SCI','SST','PE','ART','MUS','MS','SLAB','CLAB','LIB','CLUB'];
    } else if (grade <= 10) {
      subjectsForClass = ['ENG','HIN','MAT','SCI','SST','PE','SLAB','CLAB','LIB','CLUB'];
    } else if (stream === 'science') {
      subjectsForClass = ['ENG','PHY','CHM','MAT','BIO','CS','PE','SLAB'];
    } else if (stream === 'commerce') {
      subjectsForClass = ['ENG','ACC','BS','ECO','MAT','CS','PE','LIB','CLUB'];
    } else {
      subjectsForClass = ['ENG','HIN','HIS','POL','ECO','SST','PE','LIB','CLUB'];
    }
    for (const code of subjectsForClass) {
      if (!subjectMap[code]) continue;
      const key = `${cls._id}_${subjectMap[code]}`;
      if (csmSeen.has(key)) continue;
      csmSeen.add(key);
      await ClassSubjectMapping.create({
        ...scope, class: cls._id, subject: subjectMap[code],
        isActive: true, periodsPerWeek: 0, // actual periods set in SubjectRequirement
        requiresLab: ['SLAB','CLAB'].includes(code),
        requiredRoomType: ['SLAB'].includes(code) ? 'lab' : ['CLAB'].includes(code) ? 'computer_lab' : null,
        allowDoublePeriod: ['MAT','SCI','PHY','CHM','BIO','SLAB','CLAB'].includes(code)
      });
      csmCount++;
    }
  }
  console.log(`   ✓ ${csmCount} class-subject mappings created`);

  // ── STEP 12: CanTeach Mappings ──
  console.log('\n🔗 Creating CanTeach mappings...');
  let canTeachCount = 0;
  for (const teacher of teachersCreated) {
    for (const cap of teacher.capabilities) {
      if (!cap.subject) continue;
      await CanTeach.create({
        ...scope, teacher: teacher._id, subject: cap.subject,
        eligibilityType: 'primary', priority: 8, eligibleClasses: [], eligibleStreams: [],
        eligibleSections: [], isActive: true
      });
      canTeachCount++;
    }
  }
  console.log(`   ✓ ${canTeachCount} CanTeach mappings`);

  // ── STEP 13: Rules (skipped - configure via UI) ──
  console.log('\n📐 Rules: Configure via Setup UI after seeding');

  // ── STEP 14: Seed Audit Logs ──
  console.log('\n📝 Seeding audit logs...');
  const auditActions = [
    { action: 'login', entityType: 'user', user: adminUser._id, userName: adminUser.name, userRole: 'school_admin' },
    { action: 'create', entityType: 'teacher', user: adminUser._id, userName: adminUser.name, userRole: 'school_admin', newValue: { count: teachersCreated.length } },
    { action: 'create', entityType: 'class', user: adminUser._id, userName: adminUser.name, userRole: 'school_admin', newValue: { count: classesCreated.length } },
    { action: 'seed_data', entityType: 'system', user: adminUser._id, userName: adminUser.name, userRole: 'school_admin', newValue: { type: 'phase6_reseed' } },
  ];
  for (const a of auditActions) {
    await AuditLog.create({ ...scope, ...a, source: 'seed', ipAddress: '127.0.0.1', userAgent: 'Phase6-Seed-Script' });
  }
  console.log(`   ✓ ${auditActions.length} audit logs seeded`);

  // ── STEP 15: Rebuild Indexes ──
  console.log('\n🔧 Rebuilding indexes...');
  const ensureIndexes = require('../config/indexes');
  await ensureIndexes();
  console.log('   ✓ Indexes rebuilt');

  // ── FINAL SUMMARY ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅ DATABASE RESET & RESEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  School:        ${school.name}`);
  console.log(`  Session:       ${session.name}`);
  console.log(`  Users:         5 (admin + principal + tt_manager + teacher + platform_dev)`);
  console.log(`  Subjects:      ${subjects.length}`);
  console.log(`  Classes:       ${classesCreated.length} (grades 1-12, 3 streams for 11-12)`);
  console.log(`  Teachers:      ${teachersCreated.length}`);
  console.log(`  Rooms:         ${roomDefs.length}`);
  console.log(`  Requirements:  ${reqCount}`);
  console.log(`  ClassSubjMap:  ${csmCount}`);
  console.log(`  CanTeach:      ${canTeachCount}`);
  console.log(`  Audit Logs:    ${auditActions.length}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n  Login credentials:');
  console.log('  admin@divinewisdom.edu.in / admin123 (School Admin)');
  console.log('  principal@divinewisdom.edu.in / admin123 (Principal)');
  console.log('  timetable@divinewisdom.edu.in / admin123 (TT Manager)');
  console.log('  priya.sharma@divinewisdom.edu.in / admin123 (Teacher)');
  console.log('  dev@timecraft.io / admin123 (Platform Dev)\n');

  await mongoose.connection.close();
  process.exit(0);
}

resetAndReseed().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
