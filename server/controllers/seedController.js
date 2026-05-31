const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const SubjectRequirement = require('../models/SubjectRequirement');
const PeriodStructure = require('../models/PeriodStructure');
const CanTeach = require('../models/CanTeach');

/**
 * POST /api/setup/seed
 * Generate demo seed data: classes 1-12, 2 sections each, all streams, subjects, teachers, rooms, requirements, Can Teach mappings
 */
exports.seedData = async (req, res, next) => {
  try {
    // Get or create school + session
    let school = await School.findOne();
    if (!school) school = await School.create({ name: 'Demo Public School', code: 'DPS001', settings: { workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] } });

    let session = await AcademicSession.findOne({ school: school._id, isCurrent: true });
    if (!session) session = await AcademicSession.create({ school: school._id, name: '2025-26', startDate: new Date('2025-04-01'), endDate: new Date('2026-03-31'), isCurrent: true });

    const scope = { school: school._id, session: session._id };

    // --- Subjects ---
    const subjectDefs = [
      { name: 'English', code: 'ENG', color: '#3b82f6', category: 'core', type: 'academic', defaultPeriodsPerWeek: 6 },
      { name: 'Hindi', code: 'HIN', color: '#ef4444', category: 'core', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'Mathematics', code: 'MAT', color: '#8b5cf6', category: 'core', type: 'academic', defaultPeriodsPerWeek: 6, canBeDoubled: true },
      { name: 'Science', code: 'SCI', color: '#10b981', category: 'core', type: 'academic', defaultPeriodsPerWeek: 5, canBeDoubled: true },
      { name: 'Social Science', code: 'SST', color: '#f59e0b', category: 'core', type: 'academic', defaultPeriodsPerWeek: 4 },
      { name: 'Physics', code: 'PHY', color: '#06b6d4', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5, canBeDoubled: true },
      { name: 'Chemistry', code: 'CHM', color: '#ec4899', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5, canBeDoubled: true },
      { name: 'Biology', code: 'BIO', color: '#22c55e', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5, canBeDoubled: true },
      { name: 'Computer Science', code: 'CS', color: '#6366f1', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 4 },
      { name: 'Accountancy', code: 'ACC', color: '#0ea5e9', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'Business Studies', code: 'BS', color: '#a855f7', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'Economics', code: 'ECO', color: '#14b8a6', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'History', code: 'HIS', color: '#d946ef', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'Political Science', code: 'POL', color: '#f97316', category: 'elective', type: 'academic', defaultPeriodsPerWeek: 5 },
      { name: 'Physical Education', code: 'PE', color: '#78716c', category: 'core', type: 'activity', defaultPeriodsPerWeek: 2 },
      { name: 'Art & Craft', code: 'ART', color: '#e11d48', category: 'core', type: 'activity', defaultPeriodsPerWeek: 2 },
      { name: 'Music', code: 'MUS', color: '#7c3aed', category: 'core', type: 'activity', defaultPeriodsPerWeek: 1 },
      { name: 'Moral Science', code: 'MS', color: '#ca8a04', category: 'core', type: 'activity', defaultPeriodsPerWeek: 1 },
      { name: 'Science Lab', code: 'SLAB', color: '#059669', category: 'core', type: 'lab', defaultPeriodsPerWeek: 2, canBeDoubled: true },
      { name: 'Computer Lab', code: 'CLAB', color: '#4f46e5', category: 'core', type: 'lab', defaultPeriodsPerWeek: 1, canBeDoubled: true },
    ];

    const subjects = [];
    for (const sd of subjectDefs) {
      const sub = await Subject.findOneAndUpdate(
        { ...scope, code: sd.code },
        { ...scope, ...sd, shortName: sd.code, isActive: true },
        { upsert: true, new: true }
      );
      subjects.push(sub);
    }

    const streams = ['Science', 'Commerce', 'Humanities'];
    const sections = ['A', 'B'];
    const classesCreated = [];
    for (let grade = 1; grade <= 12; grade++) {
      for (const section of sections) {
        if (grade >= 11) {
          for (const s of streams) {
            const cls = await Class.findOneAndUpdate(
              { ...scope, grade, section, stream: s },
              { ...scope, name: `${grade}-${section} (${s})`, grade, section, stream: s, isActive: true, maxStudents: 40 },
              { upsert: true, new: true }
            );
            classesCreated.push(cls);
          }
        } else {
          const cls = await Class.findOneAndUpdate(
            { ...scope, grade, section, stream: null },
            { ...scope, name: `${grade}-${section}`, grade, section, stream: null, isActive: true, maxStudents: 40 },
            { upsert: true, new: true }
          );
          classesCreated.push(cls);
        }
      }
    }

    // --- Teachers ---
    const teacherDefs = [
      { name: 'Priya Sharma', shortName: 'P.Sharma', dept: 'English', subjects: ['ENG'], email: 'priya.sharma@school.edu' },
      { name: 'Anita Gupta', shortName: 'A.Gupta', dept: 'English', subjects: ['ENG'], email: 'anita.gupta@school.edu' },
      { name: 'Kavita Joshi', shortName: 'K.Joshi', dept: 'English', subjects: ['ENG'], email: 'kavita.joshi@school.edu' },
      { name: 'Sunita Verma', shortName: 'S.Verma', dept: 'Hindi', subjects: ['HIN'], email: 'sunita.verma@school.edu' },
      { name: 'Meera Devi', shortName: 'M.Devi', dept: 'Hindi', subjects: ['HIN'], email: 'meera.devi@school.edu' },
      { name: 'Rajesh Kumar', shortName: 'R.Kumar', dept: 'Mathematics', subjects: ['MAT'], email: 'rajesh.kumar@school.edu' },
      { name: 'Amit Tiwari', shortName: 'A.Tiwari', dept: 'Mathematics', subjects: ['MAT'], email: 'amit.tiwari@school.edu' },
      { name: 'Deepak Singh', shortName: 'D.Singh', dept: 'Mathematics', subjects: ['MAT'], email: 'deepak.singh@school.edu' },
      { name: 'Neha Agarwal', shortName: 'N.Agarwal', dept: 'Mathematics', subjects: ['MAT'], email: 'neha.agarwal@school.edu' },
      { name: 'Sanjay Patel', shortName: 'S.Patel', dept: 'Science', subjects: ['SCI', 'PHY'], email: 'sanjay.patel@school.edu' },
      { name: 'Ritu Mishra', shortName: 'R.Mishra', dept: 'Science', subjects: ['SCI', 'CHM'], email: 'ritu.mishra@school.edu' },
      { name: 'Vikram Rao', shortName: 'V.Rao', dept: 'Science', subjects: ['SCI', 'BIO'], email: 'vikram.rao@school.edu' },
      { name: 'Dr. Arun Mehta', shortName: 'A.Mehta', dept: 'Physics', subjects: ['PHY', 'SCI'], email: 'arun.mehta@school.edu' },
      { name: 'Pooja Nair', shortName: 'P.Nair', dept: 'Physics', subjects: ['PHY'], email: 'pooja.nair@school.edu' },
      { name: 'Dr. Seema Bhat', shortName: 'S.Bhat', dept: 'Chemistry', subjects: ['CHM', 'SCI'], email: 'seema.bhat@school.edu' },
      { name: 'Manoj Saxena', shortName: 'M.Saxena', dept: 'Chemistry', subjects: ['CHM'], email: 'manoj.saxena@school.edu' },
      { name: 'Dr. Rekha Das', shortName: 'R.Das', dept: 'Biology', subjects: ['BIO', 'SCI'], email: 'rekha.das@school.edu' },
      { name: 'Ashok Pandey', shortName: 'A.Pandey', dept: 'Social Science', subjects: ['SST', 'HIS'], email: 'ashok.pandey@school.edu' },
      { name: 'Nandini Iyer', shortName: 'N.Iyer', dept: 'Social Science', subjects: ['SST', 'POL'], email: 'nandini.iyer@school.edu' },
      { name: 'Rohit Sharma', shortName: 'Ro.Sharma', dept: 'Social Science', subjects: ['SST'], email: 'rohit.sharma@school.edu' },
      { name: 'CA Suresh Bose', shortName: 'S.Bose', dept: 'Commerce', subjects: ['ACC', 'BS'], email: 'suresh.bose@school.edu' },
      { name: 'Geeta Chopra', shortName: 'G.Chopra', dept: 'Commerce', subjects: ['ECO', 'BS'], email: 'geeta.chopra@school.edu' },
      { name: 'Vivek Reddy', shortName: 'V.Reddy', dept: 'Computer Science', subjects: ['CS'], email: 'vivek.reddy@school.edu' },
      { name: 'Swati Kulkarni', shortName: 'Sw.Kulkarni', dept: 'Computer Science', subjects: ['CS'], email: 'swati.kulkarni@school.edu' },
      { name: 'Ravi Chauhan', shortName: 'R.Chauhan', dept: 'Physical Education', subjects: ['PE'], email: 'ravi.chauhan@school.edu' },
      { name: 'Sunil Yadav', shortName: 'S.Yadav', dept: 'Physical Education', subjects: ['PE'], email: 'sunil.yadav@school.edu' },
      { name: 'Archana Roy', shortName: 'A.Roy', dept: 'Art', subjects: ['ART'], email: 'archana.roy@school.edu' },
      { name: 'Kiran Naik', shortName: 'K.Naik', dept: 'Music', subjects: ['MUS', 'MS'], email: 'kiran.naik@school.edu' },
      { name: 'Manish Jha', shortName: 'M.Jha', dept: 'Lab', subjects: ['SLAB'], email: 'manish.jha@school.edu' },
      { name: 'Pankaj More', shortName: 'P.More', dept: 'Lab', subjects: ['CLAB'], email: 'pankaj.more@school.edu' },
      { name: 'Divya Menon', shortName: 'D.Menon', dept: 'English', subjects: ['ENG'], email: 'divya.menon@school.edu' },
      { name: 'Shalini Bhatt', shortName: 'Sh.Bhatt', dept: 'Hindi', subjects: ['HIN'], email: 'shalini.bhatt@school.edu' },
      { name: 'Anil Kapoor', shortName: 'An.Kapoor', dept: 'Mathematics', subjects: ['MAT'], email: 'anil.kapoor@school.edu' },
      { name: 'Smita Desai', shortName: 'Sm.Desai', dept: 'Science', subjects: ['SCI'], email: 'smita.desai@school.edu' },
      { name: 'Tarun Ghosh', shortName: 'T.Ghosh', dept: 'Social Science', subjects: ['SST', 'ECO'], email: 'tarun.ghosh@school.edu' },
    ];

    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s.code] = s._id; });

    const teachersCreated = [];
    for (const td of teacherDefs) {
      const capabilities = td.subjects.map(code => ({
        subject: subjectMap[code],
        proficiency: 'primary'
      })).filter(c => c.subject);

      const teacher = await Teacher.findOneAndUpdate(
        { ...scope, email: td.email },
        {
          ...scope, name: td.name, shortName: td.shortName, printAlias: td.shortName,
          email: td.email, department: td.dept, capabilities, status: 'active',
          maxPeriodsPerDay: 7, maxPeriodsPerWeek: 36, maxContinuousPeriods: 4
        },
        { upsert: true, new: true }
      );
      teachersCreated.push(teacher);
    }

    // --- Rooms ---
    const roomDefs = [];
    for (let i = 1; i <= 24; i++) roomDefs.push({ name: `Room ${100 + i}`, roomNumber: `${100 + i}`, type: 'classroom', capacity: 45 });
    roomDefs.push({ name: 'Physics Lab', roomNumber: 'PL-1', type: 'lab', capacity: 30 });
    roomDefs.push({ name: 'Chemistry Lab', roomNumber: 'CL-1', type: 'lab', capacity: 30 });
    roomDefs.push({ name: 'Biology Lab', roomNumber: 'BL-1', type: 'lab', capacity: 30 });
    roomDefs.push({ name: 'Computer Lab', roomNumber: 'COMP-1', type: 'lab', capacity: 35 });
    roomDefs.push({ name: 'Art Room', roomNumber: 'ART-1', type: 'activity', capacity: 40 });
    roomDefs.push({ name: 'Music Room', roomNumber: 'MUS-1', type: 'activity', capacity: 35 });
    roomDefs.push({ name: 'Sports Ground', roomNumber: 'GND-1', type: 'ground', capacity: 200 });

    for (const rd of roomDefs) {
      await Room.findOneAndUpdate(
        { ...scope, roomNumber: rd.roomNumber },
        { ...scope, ...rd, isActive: true },
        { upsert: true, new: true }
      );
    }

    // --- Period Structure ---
    let ps = await PeriodStructure.findOne({ school: school._id, status: 'active' });
    if (!ps) {
      ps = await PeriodStructure.create({
        school: school._id, session: session._id, name: 'Standard (8 periods)',
        workingDays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
        timeslots: [
          { label: 'Period 1', slotNumber: 1, startTime: '08:00', endTime: '08:40', type: 'period', isSchedulable: true },
          { label: 'Period 2', slotNumber: 2, startTime: '08:40', endTime: '09:20', type: 'period', isSchedulable: true },
          { label: 'Period 3', slotNumber: 3, startTime: '09:20', endTime: '10:00', type: 'period', isSchedulable: true },
          { label: 'Short Break', slotNumber: 4, startTime: '10:00', endTime: '10:15', type: 'break', isSchedulable: false },
          { label: 'Period 4', slotNumber: 5, startTime: '10:15', endTime: '10:55', type: 'period', isSchedulable: true },
          { label: 'Period 5', slotNumber: 6, startTime: '10:55', endTime: '11:35', type: 'period', isSchedulable: true },
          { label: 'Lunch', slotNumber: 7, startTime: '11:35', endTime: '12:15', type: 'lunch', isSchedulable: false },
          { label: 'Period 6', slotNumber: 8, startTime: '12:15', endTime: '12:55', type: 'period', isSchedulable: true },
          { label: 'Period 7', slotNumber: 9, startTime: '12:55', endTime: '13:35', type: 'period', isSchedulable: true },
          { label: 'Period 8', slotNumber: 10, startTime: '13:35', endTime: '14:15', type: 'period', isSchedulable: true },
        ],
        status: 'active'
      });
    }

    // --- Subject Requirements ---
    let reqCount = 0;
    const getTeacherForSubject = (subCode, idx = 0) => {
      const matching = teachersCreated.filter(t =>
        t.capabilities.some(c => c.subject?.toString() === subjectMap[subCode]?.toString())
      );
      return matching[idx % matching.length];
    };

    for (const cls of classesCreated) {
      const grade = cls.grade;
      const stream = cls.stream;
      let subjectsForClass = [];

      if (grade <= 5) {
        subjectsForClass = [
          { code: 'ENG', periods: 7 }, { code: 'HIN', periods: 6 }, { code: 'MAT', periods: 7 },
          { code: 'SCI', periods: 4 }, { code: 'SST', periods: 3 }, { code: 'PE', periods: 3 },
          { code: 'ART', periods: 3 }, { code: 'MUS', periods: 2 }, { code: 'MS', periods: 1 },
          { code: 'CLAB', periods: 1 }
        ];
      } else if (grade <= 8) {
        subjectsForClass = [
          { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'MAT', periods: 6 },
          { code: 'SCI', periods: 5 }, { code: 'SST', periods: 4 }, { code: 'PE', periods: 2 },
          { code: 'ART', periods: 2 }, { code: 'MUS', periods: 1 }, { code: 'MS', periods: 1 },
          { code: 'SLAB', periods: 2 }, { code: 'CLAB', periods: 1 }
        ];
      } else if (grade <= 10) {
        subjectsForClass = [
          { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'MAT', periods: 7 },
          { code: 'SCI', periods: 6 }, { code: 'SST', periods: 5 }, { code: 'PE', periods: 2 },
          { code: 'SLAB', periods: 2 }, { code: 'CLAB', periods: 1 }, { code: 'MS', periods: 1 }
        ];
      } else if (stream === 'Science') {
        subjectsForClass = [
          { code: 'ENG', periods: 5 }, { code: 'PHY', periods: 6 }, { code: 'CHM', periods: 6 },
          { code: 'MAT', periods: 6 }, { code: 'BIO', periods: 5 }, { code: 'CS', periods: 4 },
          { code: 'PE', periods: 2 }, { code: 'SLAB', periods: 2 }
        ];
      } else if (stream === 'Commerce') {
        subjectsForClass = [
          { code: 'ENG', periods: 5 }, { code: 'ACC', periods: 6 }, { code: 'BS', periods: 6 },
          { code: 'ECO', periods: 6 }, { code: 'MAT', periods: 5 }, { code: 'CS', periods: 4 },
          { code: 'PE', periods: 2 }, { code: 'MS', periods: 1 }
        ];
      } else {
        subjectsForClass = [
          { code: 'ENG', periods: 6 }, { code: 'HIN', periods: 5 }, { code: 'HIS', periods: 6 },
          { code: 'POL', periods: 6 }, { code: 'ECO', periods: 5 }, { code: 'SST', periods: 4 },
          { code: 'PE', periods: 2 }, { code: 'MS', periods: 1 }
        ];
      }

      let teacherIdx = 0;
      for (const { code, periods } of subjectsForClass) {
        if (!subjectMap[code]) continue;
        const teacher = getTeacherForSubject(code, teacherIdx++);
        if (!teacher) continue;

        const consecutive = ['MAT', 'SCI', 'PHY', 'CHM', 'BIO'].includes(code) && periods >= 4;
        await SubjectRequirement.findOneAndUpdate(
          { ...scope, class: cls._id, subject: subjectMap[code], studentGroup: null },
          {
            ...scope, class: cls._id, subject: subjectMap[code],
            teacher: teacher._id, periodsPerWeek: periods,
            allowDoublePeriod: ['MAT', 'SCI', 'PHY', 'CHM', 'BIO', 'SLAB', 'CLAB'].includes(code),
            doublePeriodsPerWeek: ['SLAB', 'CLAB'].includes(code) ? 1 : 0,
            consecutivePreference: consecutive ? 'preferred' : 'none',
            consecutiveCount: 2, isActive: true
          },
          { upsert: true, new: true }
        );
        reqCount++;
      }
    }

    // --- Can Teach Mappings ---
    let canTeachCount = 0;
    const middleClasses = classesCreated.filter(c => c.grade >= 6 && c.grade <= 8).map(c => c._id);
    const secondaryClasses = classesCreated.filter(c => c.grade >= 9 && c.grade <= 10).map(c => c._id);
    const scienceClasses = classesCreated.filter(c => c.stream === 'Science').map(c => c._id);
    const commerceClasses = classesCreated.filter(c => c.stream === 'Commerce').map(c => c._id);
    const humanitiesClasses = classesCreated.filter(c => c.stream === 'Humanities').map(c => c._id);

    for (const teacher of teachersCreated) {
      for (const cap of teacher.capabilities) {
        if (!cap.subject) continue;
        const subjectDoc = subjects.find(s => s._id.toString() === cap.subject.toString());
        if (!subjectDoc) continue;
        const code = subjectDoc.code;

        let eligibleClasses = [];
        let eligibleStreams = [];

        if (['SCI', 'SST', 'SLAB'].includes(code)) {
          eligibleClasses = [...middleClasses, ...secondaryClasses];
        } else if (['PHY', 'CHM', 'BIO'].includes(code)) {
          eligibleClasses = scienceClasses;
          eligibleStreams = ['Science'];
        } else if (['ACC', 'BS'].includes(code)) {
          eligibleClasses = commerceClasses;
          eligibleStreams = ['Commerce'];
        } else if (['ECO'].includes(code)) {
          eligibleClasses = [...commerceClasses, ...humanitiesClasses];
          eligibleStreams = ['Commerce', 'Humanities'];
        } else if (['HIS', 'POL'].includes(code)) {
          eligibleClasses = humanitiesClasses;
          eligibleStreams = ['Humanities'];
        } else if (['CS'].includes(code)) {
          eligibleClasses = [...scienceClasses, ...commerceClasses];
          eligibleStreams = ['Science', 'Commerce'];
        }
        // Core subjects (ENG, HIN, MAT, PE, ART, MUS, MS, CLAB) → empty = all classes

        await CanTeach.findOneAndUpdate(
          { ...scope, teacher: teacher._id, subject: cap.subject, eligibilityType: 'primary' },
          {
            ...scope, teacher: teacher._id, subject: cap.subject,
            eligibilityType: 'primary', priority: 8,
            eligibleClasses, eligibleStreams,
            eligibleSections: [], isActive: true
          },
          { upsert: true, new: true }
        );
        canTeachCount++;

        // Cross-department secondary: Science teachers → Science Lab
        if (['SCI'].includes(code) && teacher.department !== 'Lab') {
          await CanTeach.findOneAndUpdate(
            { ...scope, teacher: teacher._id, subject: subjectMap['SLAB'], eligibilityType: 'secondary' },
            {
              ...scope, teacher: teacher._id, subject: subjectMap['SLAB'],
              eligibilityType: 'secondary', priority: 4,
              eligibleClasses: [...middleClasses, ...secondaryClasses],
              eligibleStreams: [], eligibleSections: [], isActive: true
            },
            { upsert: true, new: true }
          );
          canTeachCount++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Seed data created successfully',
      summary: {
        school: school.name,
        session: session.name,
        subjects: subjects.length,
        classes: classesCreated.length,
        teachers: teachersCreated.length,
        rooms: roomDefs.length,
        requirements: reqCount,
        canTeachMappings: canTeachCount,
        streams, sections
      }
    });
  } catch (err) { next(err); }
};
