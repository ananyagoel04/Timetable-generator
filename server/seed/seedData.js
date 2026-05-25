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

async function seedData() {
  await connectDB();
  console.log('🌱 Starting comprehensive K-12 seed...');

  // Clear existing
  const models = [School, AcademicSession, User, Teacher, Class, Subject, Room, PeriodStructure,
    SubjectRequirement, SubjectCombinationRule, ReservedPeriodRule, CanTeach];
  for (const M of models) await M.deleteMany({});

  // ═══ 1. SCHOOL ═══
  const school = await School.create({
    name: 'Delhi Public School — Model Campus',
    code: 'DPS-MODEL',
    address: '12 Academic Road, New Delhi',
    phone: '+91-11-26863456',
    email: 'admin@dpsmodel.edu.in',
    status: 'active',
    settings: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      defaultPeriodsPerDay: 8,
      defaultBreakPeriod: 5,
      classTeacherFirstPeriodPreference: true
    }
  });

  // ═══ 2. SESSION ═══
  const session = await AcademicSession.create({
    school: school._id, name: '2025-26',
    startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'),
    isCurrent: true, status: 'active'
  });

  // ═══ 3. USERS ═══
  const hashedPw = await bcrypt.hash('admin123', 12);
  await User.create([
    { name: 'Platform Admin', email: 'platform@dpsmodel.edu.in', password: hashedPw, role: 'platform_developer', schools: [{ school: school._id, role: 'school_owner', permissions: ['view_timetable', 'generate_timetable', 'edit_setup', 'manage_teachers', 'manage_rules', 'approve_substitutions', 'publish_timetable', 'view_audit', 'manage_users', 'manage_school', 'export_reports', 'edit_timetable', 'manage_absences', 'manage_replacements'], isActive: true }], activeSchool: school._id, activeSession: session._id, isActive: true },
    { name: 'Dr. Ranjit Kumar', email: 'principal@dpsmodel.edu.in', password: hashedPw, role: 'principal', schools: [{ school: school._id, role: 'school_owner', permissions: ['view_timetable', 'generate_timetable', 'edit_setup', 'manage_teachers', 'manage_rules', 'approve_substitutions', 'publish_timetable', 'view_audit', 'manage_users', 'manage_school', 'export_reports', 'edit_timetable', 'manage_absences', 'manage_replacements'], isActive: true }], activeSchool: school._id, activeSession: session._id, isActive: true },
    { name: 'Mrs. Priya Sharma', email: 'timetable@dpsmodel.edu.in', password: hashedPw, role: 'timetable_manager', schools: [{ school: school._id, role: 'school_admin', permissions: ['view_timetable', 'generate_timetable', 'edit_setup', 'manage_teachers', 'manage_rules', 'approve_substitutions', 'publish_timetable', 'view_audit', 'export_reports', 'edit_timetable', 'manage_absences', 'manage_replacements'], isActive: true }], activeSchool: school._id, activeSession: session._id, isActive: true },
    { name: 'Mr. Anil Gupta', email: 'teacher@dpsmodel.edu.in', password: hashedPw, role: 'teacher', schools: [{ school: school._id, role: 'teacher', permissions: ['view_timetable', 'manage_absences'], isActive: true }], activeSchool: school._id, activeSession: session._id, isActive: true },
    { name: 'Parent Viewer', email: 'viewer@dpsmodel.edu.in', password: hashedPw, role: 'viewer', schools: [{ school: school._id, role: 'viewer', permissions: ['view_timetable'], isActive: true }], activeSchool: school._id, activeSession: session._id, isActive: true }
  ]);

  // ═══ 4. SUBJECTS ═══
  const subjectData = [
    { name: 'English', code: 'ENG', type: 'academic', color: '#3B82F6', preferMorning: true },
    { name: 'Hindi', code: 'HIN', type: 'academic', color: '#F59E0B', preferMorning: true },
    { name: 'Mathematics', code: 'MAT', type: 'academic', color: '#EF4444', preferMorning: true, maxPerDay: 2 },
    { name: 'Science', code: 'SCI', type: 'academic', color: '#10B981', preferMorning: true },
    { name: 'Physics', code: 'PHY', type: 'academic', color: '#6366F1', requiresLab: true, preferMorning: true },
    { name: 'Chemistry', code: 'CHM', type: 'academic', color: '#8B5CF6', requiresLab: true, preferMorning: true },
    { name: 'Biology', code: 'BIO', type: 'academic', color: '#14B8A6', requiresLab: true, preferMorning: true },
    { name: 'Social Science', code: 'SST', type: 'academic', color: '#F97316' },
    { name: 'History', code: 'HIS', type: 'academic', color: '#A855F7' },
    { name: 'Geography', code: 'GEO', type: 'academic', color: '#0EA5E9' },
    { name: 'Economics', code: 'ECO', type: 'academic', color: '#22C55E' },
    { name: 'Commerce', code: 'COM', type: 'academic', color: '#D946EF' },
    { name: 'Accountancy', code: 'ACC', type: 'academic', color: '#F43F5E' },
    { name: 'Business Studies', code: 'BST', type: 'academic', color: '#EC4899' },
    { name: 'Political Science', code: 'POL', type: 'academic', color: '#64748B' },
    { name: 'Computer Science', code: 'CS', type: 'academic', color: '#0891B2', requiresLab: true },
    { name: 'Environmental Studies', code: 'EVS', type: 'academic', color: '#84CC16' },
    { name: 'Sanskrit', code: 'SKT', type: 'academic', color: '#EA580C' },
    { name: 'Physical Education', code: 'PE', type: 'physical', color: '#059669', preferAfternoon: true },
    { name: 'Art & Craft', code: 'ART', type: 'co_curricular', color: '#DB2777' },
    { name: 'Music', code: 'MUS', type: 'co_curricular', color: '#7C3AED' },
    { name: 'Dance', code: 'DNC', type: 'co_curricular', color: '#C026D3', preferAfternoon: true },
    { name: 'Moral Science', code: 'MS', type: 'co_curricular', color: '#94A3B8' },
    { name: 'General Knowledge', code: 'GK', type: 'co_curricular', color: '#475569' },
    { name: 'Library', code: 'LIB', type: 'activity', color: '#78716C' },
  ];
  const subjects = {};
  for (const s of subjectData) {
    const created = await Subject.create({ ...s, school: school._id, session: session._id });
    subjects[s.code] = created;
  }

  // ═══ 5. ROOMS ═══
  const roomData = [];
  for (let i = 1; i <= 20; i++) roomData.push({ name: `Room ${100 + i}`, roomNumber: `${100 + i}`, type: 'classroom', capacity: 45, floor: Math.ceil(i / 5), school: school._id });
  roomData.push({ name: 'Physics Lab', roomNumber: 'PL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Chemistry Lab', roomNumber: 'CL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Biology Lab', roomNumber: 'BL1', type: 'lab', capacity: 40, floor: 2, school: school._id });
  roomData.push({ name: 'Computer Lab', roomNumber: 'CMP1', type: 'lab', capacity: 35, floor: 3, school: school._id });
  roomData.push({ name: 'Activity Hall', roomNumber: 'AH1', type: 'hall', capacity: 200, floor: 0, school: school._id });
  roomData.push({ name: 'Music Room', roomNumber: 'MR1', type: 'special', capacity: 40, floor: 1, school: school._id });
  roomData.push({ name: 'Art Room', roomNumber: 'AR1', type: 'special', capacity: 40, floor: 1, school: school._id });
  roomData.push({ name: 'Library', roomNumber: 'LIB1', type: 'special', capacity: 60, floor: 1, school: school._id });
  roomData.push({ name: 'Sports Ground', roomNumber: 'SG1', type: 'playground', capacity: 300, floor: 0, school: school._id });
  const rooms = await Room.insertMany(roomData);

  // ═══ 6. TEACHERS (45 teachers) ═══
  const teacherDefs = [
    { name: 'Mrs. Anjali Verma', shortName: 'AVR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Suresh Nair', shortName: 'SNR', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Kavita Singh', shortName: 'KSG', department: 'English', subjects: ['ENG'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mrs. Geeta Rao', shortName: 'GRO', department: 'Hindi', subjects: ['HIN'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Ramesh Pandey', shortName: 'RPD', department: 'Hindi', subjects: ['HIN'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Sunita Joshi', shortName: 'SJH', department: 'Hindi', subjects: ['HIN', 'SKT'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mr. Rajendra Kumar', shortName: 'RKM', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Deepa Mathur', shortName: 'DMT', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Arun Saxena', shortName: 'ASX', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mrs. Meera Iyer', shortName: 'MIY', department: 'Mathematics', subjects: ['MAT'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Dr. Vivek Tiwari', shortName: 'VTW', department: 'Physics', subjects: ['PHY', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mr. Sanjay Dubey', shortName: 'SDB', department: 'Physics', subjects: ['PHY', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Dr. Rekha Srivastava', shortName: 'RSV', department: 'Chemistry', subjects: ['CHM', 'SCI'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mr. Pankaj Mishra', shortName: 'PMH', department: 'Chemistry', subjects: ['CHM', 'SCI'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Dr. Smita Gupta', shortName: 'SGP', department: 'Biology', subjects: ['BIO', 'SCI', 'EVS'], maxPerDay: 5, maxPerWeek: 28 },
    { name: 'Mrs. Nisha Kapoor', shortName: 'NKP', department: 'Biology', subjects: ['BIO', 'EVS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Amit Sharma', shortName: 'ASH', department: 'Social Science', subjects: ['SST', 'HIS', 'GEO'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Pooja Bhatt', shortName: 'PBT', department: 'Social Science', subjects: ['SST', 'HIS', 'POL'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Vikram Chauhan', shortName: 'VCH', department: 'Social Science', subjects: ['SST', 'GEO', 'ECO'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mrs. Ritu Malhotra', shortName: 'RML', department: 'Economics', subjects: ['ECO', 'BST'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Dinesh Agarwal', shortName: 'DAG', department: 'Commerce', subjects: ['ACC', 'BST', 'COM'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Swati Jain', shortName: 'SJN', department: 'Commerce', subjects: ['ACC', 'COM', 'ECO'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Rohit Kapoor', shortName: 'RKP', department: 'Computer Science', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Neha Gupta', shortName: 'NGP', department: 'Computer Science', subjects: ['CS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Vikas Rawat', shortName: 'VRW', department: 'Sanskrit', subjects: ['SKT'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Anita Devi', shortName: 'ADV', department: 'Political Science', subjects: ['POL', 'HIS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Sunil Yadav', shortName: 'SYD', department: 'Physical Education', subjects: ['PE'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Lalit Tandon', shortName: 'LTN', department: 'Physical Education', subjects: ['PE', 'DNC'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Meenakshi Sood', shortName: 'MSD', department: 'Art', subjects: ['ART'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mr. Prateek Vohra', shortName: 'PVH', department: 'Music', subjects: ['MUS'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Riya Choudhary', shortName: 'RCH', department: 'Dance', subjects: ['DNC'], maxPerDay: 5, maxPerWeek: 26 },
    { name: 'Mrs. Kamla Devi', shortName: 'KDV', department: 'Moral Science', subjects: ['MS', 'GK'], maxPerDay: 5, maxPerWeek: 26 },
    // Additional teachers for primary/pre-primary
    { name: 'Mrs. Sheela Gupta', shortName: 'SHG', department: 'Pre-Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS', 'ART', 'MUS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Lalita Menon', shortName: 'LMN', department: 'Pre-Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS', 'ART', 'MUS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Alka Patel', shortName: 'APT', department: 'Pre-Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS', 'ART', 'MUS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Rani Kumari', shortName: 'RKI', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS', 'GK', 'MS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Suman Devi', shortName: 'SDV', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'EVS', 'GK', 'MS'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Padma Singh', shortName: 'PSG', department: 'Primary', subjects: ['ENG', 'HIN', 'MAT', 'SCI', 'SST'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mr. Naveen Reddy', shortName: 'NRD', department: 'Primary', subjects: ['ENG', 'MAT', 'SCI', 'PE'], maxPerDay: 6, maxPerWeek: 30 },
    { name: 'Mrs. Uma Shankar', shortName: 'USK', department: 'Science', subjects: ['SCI', 'EVS'], maxPerDay: 6, maxPerWeek: 28 },
    { name: 'Mr. Deepak Rawat', shortName: 'DRW', department: 'Library', subjects: ['LIB'], maxPerDay: 6, maxPerWeek: 30 },
  ];

  const teachers = {};
  for (const td of teacherDefs) {
    const caps = td.subjects.map(code => ({
      subject: subjects[code]?._id,
      proficiency: 'expert'
    })).filter(c => c.subject);
    const t = await Teacher.create({
      name: td.name, shortName: td.shortName, department: td.department,
      school: school._id, session: session._id, status: 'active',
      maxPeriodsPerDay: td.maxPerDay, maxPeriodsPerWeek: td.maxPerWeek,
      capabilities: caps
    });
    teachers[td.shortName] = t;
  }

  // ═══ 7. PERIOD STRUCTURES ═══
  // Default (Mon-Fri: 8 periods + lunch)
  const defaultPS = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Default (Mon-Fri)',
    templateType: 'default', status: 'active',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    timeslots: [
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
    ],
    saturdayConfig: {
      enabled: true,
      timeslots: [
        { label: 'P1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
        { label: 'P2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
        { label: 'P3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
        { label: 'P4', slotNumber: 4, startTime: '10:00', endTime: '10:40', type: 'period', isSchedulable: true },
        { label: 'Break', slotNumber: 5, startTime: '10:40', endTime: '11:00', type: 'break', isSchedulable: false },
        { label: 'P5', slotNumber: 6, startTime: '11:00', endTime: '11:40', type: 'period', isSchedulable: true },
        { label: 'P6', slotNumber: 7, startTime: '11:40', endTime: '12:20', type: 'period', isSchedulable: true },
      ]
    }
  });

  // Pre-primary (shorter day)
  const prePrimaryPS = await PeriodStructure.create({
    school: school._id, session: session._id, name: 'Pre-Primary',
    templateType: 'junior', status: 'active',
    assignedTo: { grades: [-2, -1, 0] },
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    timeslots: [
      { label: 'P1', slotNumber: 1, startTime: '08:30', endTime: '09:10', type: 'period', isSchedulable: true },
      { label: 'P2', slotNumber: 2, startTime: '09:10', endTime: '09:50', type: 'period', isSchedulable: true },
      { label: 'Snack', slotNumber: 3, startTime: '09:50', endTime: '10:10', type: 'break', isSchedulable: false },
      { label: 'P3', slotNumber: 4, startTime: '10:10', endTime: '10:50', type: 'period', isSchedulable: true },
      { label: 'P4', slotNumber: 5, startTime: '10:50', endTime: '11:30', type: 'period', isSchedulable: true },
      { label: 'Lunch', slotNumber: 6, startTime: '11:30', endTime: '12:00', type: 'lunch', isSchedulable: false },
      { label: 'P5', slotNumber: 7, startTime: '12:00', endTime: '12:40', type: 'period', isSchedulable: true },
    ]
  });

  // ═══ 8. CLASSES (Nursery through 12) ═══
  const allClasses = {};

  // Pre-primary
  for (const [grade, label] of [[-2, 'Nursery'], [-1, 'LKG'], [0, 'UKG']]) {
    for (const sec of ['A', 'B']) {
      const c = await Class.create({
        school: school._id, session: session._id,
        grade, section: sec, stream: 'none',
        studentCount: 30, periodStructure: prePrimaryPS._id
      });
      allClasses[`${label}-${sec}`] = c;
    }
  }

  // Primary (1-5)
  for (let g = 1; g <= 5; g++) {
    for (const sec of ['A', 'B']) {
      const c = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 40, periodStructure: defaultPS._id
      });
      allClasses[`${g}-${sec}`] = c;
    }
  }

  // Middle (6-8)
  for (let g = 6; g <= 8; g++) {
    for (const sec of ['A', 'B']) {
      const c = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 40, periodStructure: defaultPS._id
      });
      allClasses[`${g}-${sec}`] = c;
    }
  }

  // Secondary (9-10)
  for (let g = 9; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      const c = await Class.create({
        school: school._id, session: session._id,
        grade: g, section: sec, stream: 'none',
        studentCount: 40, periodStructure: defaultPS._id
      });
      allClasses[`${g}-${sec}`] = c;
    }
  }

  // Senior (11-12) with streams
  for (let g = 11; g <= 12; g++) {
    for (const [stream, streamCode] of [['science', 'Sci'], ['commerce', 'Com'], ['humanities', 'Hum']]) {
      for (const sec of ['A']) {
        const c = await Class.create({
          school: school._id, session: session._id,
          grade: g, section: sec, stream,
          studentCount: 35, periodStructure: defaultPS._id,
          studentGroups: stream === 'science' ? [
            { name: 'Bio Group', code: 'BIO', studentCount: 18 },
            { name: 'Maths Group', code: 'MATH', studentCount: 17 }
          ] : []
        });
        allClasses[`${g}-${sec}-${streamCode}`] = c;
      }
    }
  }

  // ═══ 9. SUBJECT REQUIREMENTS ═══
  // Helper to create requirements
  const createReqs = async (classKey, reqList) => {
    const cls = allClasses[classKey];
    if (!cls) return;
    for (const r of reqList) {
      const subj = subjects[r.subject];
      const teacher = teachers[r.teacher];
      if (!subj || !teacher) continue;
      await SubjectRequirement.create({
        school: school._id, session: session._id,
        class: cls._id, subject: subj._id, teacher: teacher._id,
        periodsPerWeek: r.periods, allowDoublePeriod: r.double || false,
        consecutivePreference: r.consecutive || 'none',
        consecutiveCount: r.consecutiveCount || 2,
        studentGroup: r.group || null, isActive: true
      });
    }
  };

  // Pre-primary requirements (5 periods/week of main subjects)
  const prePrimaryReqs = [
    { subject: 'ENG', periods: 6 }, { subject: 'HIN', periods: 5 },
    { subject: 'MAT', periods: 5 }, { subject: 'EVS', periods: 4 },
    { subject: 'ART', periods: 2 }, { subject: 'MUS', periods: 1 },
    { subject: 'PE', periods: 2 },
  ];
  for (const [classKey, teacherCode] of [['Nursery-A', 'SHG'], ['Nursery-B', 'LMN'], ['LKG-A', 'SHG'], ['LKG-B', 'APT'], ['UKG-A', 'LMN'], ['UKG-B', 'APT']]) {
    await createReqs(classKey, prePrimaryReqs.map(r => ({
      ...r,
      teacher: ['ART', 'MUS', 'PE'].includes(r.subject)
        ? (r.subject === 'ART' ? 'MSD' : r.subject === 'MUS' ? 'PVH' : 'SYD')
        : teacherCode
    })));
  }

  // Primary (1-5): ENG 6, HIN 5, MAT 6, EVS 4, GK 1, MS 1, PE 2, ART 1, MUS 1, LIB 1
  const primaryReqs = (tc) => [
    { subject: 'ENG', periods: 6, teacher: tc }, { subject: 'HIN', periods: 5, teacher: tc },
    { subject: 'MAT', periods: 6, teacher: tc }, { subject: 'EVS', periods: 4, teacher: tc },
    { subject: 'GK', periods: 1, teacher: 'KDV' }, { subject: 'MS', periods: 1, teacher: 'KDV' },
    { subject: 'PE', periods: 2, teacher: 'SYD' }, { subject: 'ART', periods: 1, teacher: 'MSD' },
    { subject: 'MUS', periods: 1, teacher: 'PVH' }, { subject: 'LIB', periods: 1, teacher: 'DRW' },
  ];
  const primaryTeachers = { '1-A': 'RKI', '1-B': 'SDV', '2-A': 'PSG', '2-B': 'NRD', '3-A': 'RKI', '3-B': 'SDV', '4-A': 'PSG', '4-B': 'NRD', '5-A': 'RKI', '5-B': 'SDV' };
  for (const [ck, tc] of Object.entries(primaryTeachers)) {
    await createReqs(ck, primaryReqs(tc));
  }

  // Middle (6-8): ENG 5, HIN 5, MAT 6, SCI 5 (double), SST 5, CS 2 (double), PE 2, ART 1, MUS 1, LIB 1, SKT 1
  for (let g = 6; g <= 8; g++) {
    for (const sec of ['A', 'B']) {
      await createReqs(`${g}-${sec}`, [
        { subject: 'ENG', periods: 5, teacher: sec === 'A' ? 'AVR' : 'SNR' },
        { subject: 'HIN', periods: 5, teacher: sec === 'A' ? 'GRO' : 'RPD' },
        { subject: 'MAT', periods: 6, teacher: sec === 'A' ? 'RKM' : 'DMT' },
        { subject: 'SCI', periods: 5, teacher: sec === 'A' ? 'VTW' : 'RSV', double: true, consecutive: 'preferred' },
        { subject: 'SST', periods: 5, teacher: sec === 'A' ? 'ASH' : 'PBT' },
        { subject: 'CS', periods: 2, teacher: 'RKP', double: true, consecutive: 'preferred' },
        { subject: 'SKT', periods: 1, teacher: 'VRW' },
        { subject: 'PE', periods: 2, teacher: sec === 'A' ? 'SYD' : 'LTN' },
        { subject: 'ART', periods: 1, teacher: 'MSD' },
        { subject: 'MUS', periods: 1, teacher: 'PVH' },
        { subject: 'LIB', periods: 1, teacher: 'DRW' },
      ]);
    }
  }

  // Secondary (9-10): ENG 5, HIN 5, MAT 6, SCI 6 (double), SST 5, CS 2, PE 2, LIB 1
  for (let g = 9; g <= 10; g++) {
    for (const sec of ['A', 'B']) {
      await createReqs(`${g}-${sec}`, [
        { subject: 'ENG', periods: 5, teacher: 'KSG' },
        { subject: 'HIN', periods: 5, teacher: 'SJH' },
        { subject: 'MAT', periods: 6, teacher: sec === 'A' ? 'ASX' : 'MIY' },
        { subject: 'SCI', periods: 6, teacher: sec === 'A' ? 'SDB' : 'PMH', double: true, consecutive: 'required' },
        { subject: 'SST', periods: 5, teacher: 'VCH' },
        { subject: 'CS', periods: 2, teacher: 'NGP', double: true, consecutive: 'preferred' },
        { subject: 'PE', periods: 2, teacher: 'LTN' },
        { subject: 'LIB', periods: 1, teacher: 'DRW' },
      ]);
    }
  }

  // Senior Science (11-12): PHY 5, CHM 5, BIO/MAT 5 (split), ENG 4, PE 2, CS 2
  for (let g = 11; g <= 12; g++) {
    const ck = `${g}-A-Sci`;
    await createReqs(ck, [
      { subject: 'ENG', periods: 4, teacher: 'AVR' },
      { subject: 'PHY', periods: 5, teacher: 'VTW', double: true, consecutive: 'required' },
      { subject: 'CHM', periods: 5, teacher: 'RSV', double: true, consecutive: 'required' },
      { subject: 'BIO', periods: 5, teacher: 'SGP', group: 'Bio Group', double: true, consecutive: 'required' },
      { subject: 'MAT', periods: 5, teacher: 'ASX', group: 'Maths Group' },
      { subject: 'PE', periods: 2, teacher: 'SYD' },
      { subject: 'CS', periods: 2, teacher: 'RKP', double: true, consecutive: 'preferred' },
    ]);
  }

  // Senior Commerce (11-12): ACC 5, BST 5, ECO 5, ENG 4, MAT/CS 2, PE 2
  for (let g = 11; g <= 12; g++) {
    await createReqs(`${g}-A-Com`, [
      { subject: 'ENG', periods: 4, teacher: 'SNR' },
      { subject: 'ACC', periods: 5, teacher: 'DAG' },
      { subject: 'BST', periods: 5, teacher: 'RML' },
      { subject: 'ECO', periods: 5, teacher: 'SJN' },
      { subject: 'MAT', periods: 4, teacher: 'DMT' },
      { subject: 'PE', periods: 2, teacher: 'LTN' },
      { subject: 'CS', periods: 2, teacher: 'NGP' },
    ]);
  }

  // Senior Humanities (11-12): HIS 5, GEO 5, POL 5, ENG 4, ECO 4, PE 2
  for (let g = 11; g <= 12; g++) {
    await createReqs(`${g}-A-Hum`, [
      { subject: 'ENG', periods: 4, teacher: 'KSG' },
      { subject: 'HIS', periods: 5, teacher: 'PBT' },
      { subject: 'GEO', periods: 5, teacher: 'ASH' },
      { subject: 'POL', periods: 5, teacher: 'ADV' },
      { subject: 'ECO', periods: 4, teacher: 'VCH' },
      { subject: 'PE', periods: 2, teacher: 'SYD' },
    ]);
  }

  // ═══ 10. CAN TEACH MAPPINGS ═══
  for (const td of teacherDefs) {
    const t = teachers[td.shortName];
    for (const code of td.subjects) {
      const s = subjects[code];
      if (!t || !s) continue;
      await CanTeach.create({
        school: school._id, session: session._id,
        teacher: t._id, subject: s._id,
        role: 'primary', priority: 8, isActive: true
      });
    }
  }

  // ═══ 11. RESERVED PERIOD RULES ═══
  // Saturday last period = Activity
  await ReservedPeriodRule.create({
    school: school._id, session: session._id,
    name: 'Saturday Activity Period', type: 'activity',
    day: 'Saturday', periods: [7], isLocked: true, isActive: true
  });

  // Set class teachers
  const classTeacherMap = {
    '1-A': 'RKI', '1-B': 'SDV', '2-A': 'PSG', '2-B': 'NRD',
    '3-A': 'RKI', '3-B': 'SDV', '4-A': 'PSG', '4-B': 'NRD',
    '5-A': 'RKI', '5-B': 'SDV',
    '6-A': 'AVR', '6-B': 'GRO', '7-A': 'RKM', '7-B': 'ASH',
    '8-A': 'DMT', '8-B': 'PBT',
    '9-A': 'KSG', '9-B': 'VCH', '10-A': 'ASX', '10-B': 'SDB',
  };
  for (const [ck, tc] of Object.entries(classTeacherMap)) {
    const cls = allClasses[ck];
    const t = teachers[tc];
    if (cls && t) {
      cls.classTeacher = t._id;
      await cls.save();
    }
  }

  console.log(`✅ Seed complete!`);
  console.log(`   📚 School: ${school.name}`);
  console.log(`   🗓️  Session: ${session.name}`);
  console.log(`   👩‍🏫 Teachers: ${Object.keys(teachers).length}`);
  console.log(`   🏫 Classes: ${Object.keys(allClasses).length}`);
  console.log(`   📖 Subjects: ${Object.keys(subjects).length}`);
  console.log(`   🚪 Rooms: ${rooms.length}`);
  console.log(`\n   Login: platform@dpsmodel.edu.in / admin123`);
  console.log(`   Login: principal@dpsmodel.edu.in / admin123`);
  console.log(`   Login: timetable@dpsmodel.edu.in / admin123`);
  console.log(`   Login: teacher@dpsmodel.edu.in / admin123`);

  await mongoose.connection.close();
  process.exit(0);
}

seedData().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
