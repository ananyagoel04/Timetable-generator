#!/usr/bin/env node
/**
 * Seed Smoke Test Script
 * Tests that seeded data is functionally usable (login, data access).
 * Usage: npm run seed:smoke
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const User = require('../models/User');
const School = require('../models/School');
const AcademicSession = require('../models/AcademicSession');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const PeriodStructure = require('../models/PeriodStructure');
const SubjectRequirement = require('../models/SubjectRequirement');
const CanTeach = require('../models/CanTeach');

const testCredentials = [
  { email: 'platform@erp.com', password: 'admin123', type: 'platform' },
  { email: 'developer@erp.com', password: 'developer123', type: 'platform' },
  { email: 'admin@sunrise.edu.in', password: 'admin123', type: 'school' },
  { email: 'admin@delhimodel.edu.in', password: 'admin123', type: 'school' },
  { email: 'admin@seniorscholars.edu.in', password: 'admin123', type: 'school' },
  { email: 'admin@stressschool.edu.in', password: 'admin123', type: 'school' },
  { email: 'admin@impossible.edu.in', password: 'admin123', type: 'school' },
  { email: 'timetable@sunrise.edu.in', password: 'admin123', type: 'school' },
  { email: 'teacher@sunrise.edu.in', password: 'admin123', type: 'school' },
  { email: 'viewer@sunrise.edu.in', password: 'admin123', type: 'school' },
];

async function smoke() {
  await connectDB();

  console.log('🧪 Seed Smoke Tests');
  console.log('═'.repeat(60));

  let pass = 0;
  let fail = 0;

  const check = (name, result) => {
    if (result) { console.log(`   ✅ ${name}`); pass++; }
    else { console.log(`   ❌ ${name}`); fail++; }
  };

  // ── Test 1: Login Credentials ──
  console.log('\n🔑 Test 1: Login Credentials');
  console.log('─'.repeat(40));
  for (const cred of testCredentials) {
    const user = await User.findOne({ email: cred.email }).select('+password');
    if (!user) {
      check(`${cred.email} — user exists`, false);
      continue;
    }
    const validPw = await bcrypt.compare(cred.password, user.password);
    check(`${cred.email} — login works`, validPw);
  }

  // ── Test 2: Each School Has Active Session ──
  console.log('\n📅 Test 2: Active Sessions');
  console.log('─'.repeat(40));
  const schools = await School.find({});
  for (const school of schools) {
    const activeSession = await AcademicSession.findOne({ school: school._id, isCurrent: true });
    check(`${school.name} — has active session (${activeSession?.name || 'NONE'})`, !!activeSession);
  }

  // ── Test 3: Each School Has Period Structure ──
  console.log('\n⏰ Test 3: Period Structures');
  console.log('─'.repeat(40));
  for (const school of schools) {
    const session = await AcademicSession.findOne({ school: school._id, isCurrent: true });
    const ps = await PeriodStructure.findOne({ school: school._id, session: session?._id });
    check(`${school.name} — has period structure`, !!ps);
    if (ps) {
      const teachable = ps.timeslots?.filter(t => t.isSchedulable).length || 0;
      check(`${school.name} — has ${teachable} teaching periods`, teachable >= 4);
    }
  }

  // ── Test 4: Data Completeness Per School ──
  console.log('\n📦 Test 4: Data Completeness');
  console.log('─'.repeat(40));
  for (const school of schools) {
    const session = await AcademicSession.findOne({ school: school._id, isCurrent: true });
    if (!session) continue;
    const sid = school._id;
    const sesId = session._id;

    const teachers = await Teacher.countDocuments({ school: sid, session: sesId });
    const classes = await Class.countDocuments({ school: sid, session: sesId });
    const subjects = await Subject.countDocuments({ school: sid, session: sesId });
    const rooms = await Room.countDocuments({ school: sid });
    const reqs = await SubjectRequirement.countDocuments({ school: sid, session: sesId });
    const canTeach = await CanTeach.countDocuments({ school: sid, session: sesId });

    check(`${school.name} — teachers (${teachers})`, teachers >= 2);
    check(`${school.name} — classes (${classes})`, classes >= 2);
    check(`${school.name} — subjects (${subjects})`, subjects >= 3);
    check(`${school.name} — rooms (${rooms})`, rooms >= 2);
    check(`${school.name} — requirements (${reqs})`, reqs >= 5);
    check(`${school.name} — canTeach (${canTeach})`, canTeach >= 3);
  }

  // ── Test 5: School 1 Multi-Session ──
  console.log('\n📆 Test 5: Multi-Session (School 1)');
  console.log('─'.repeat(40));
  const sunrise = await School.findOne({ code: 'SPS-001' });
  if (sunrise) {
    const sessions = await AcademicSession.find({ school: sunrise._id }).sort({ name: 1 });
    check(`Sunrise has ${sessions.length} sessions`, sessions.length >= 3);
    const archived = sessions.filter(s => s.status === 'archived');
    const active = sessions.filter(s => s.isCurrent);
    const draft = sessions.filter(s => s.status === 'draft');
    check(`Has archived session (${archived.map(s => s.name).join(',') || 'NONE'})`, archived.length >= 1);
    check(`Has active session (${active.map(s => s.name).join(',') || 'NONE'})`, active.length === 1);
    check(`Has draft session (${draft.map(s => s.name).join(',') || 'NONE'})`, draft.length >= 1);
  }

  // ── Test 6: Data Isolation ──
  console.log('\n🔒 Test 6: Data Isolation');
  console.log('─'.repeat(40));
  if (schools.length >= 2) {
    const s1Teachers = await Teacher.find({ school: schools[0]._id }).select('_id');
    const s1Ids = s1Teachers.map(t => t._id);
    const leakedReqs = await SubjectRequirement.countDocuments({
      school: schools[1]._id, teacher: { $in: s1Ids }
    });
    check(`No teacher leak from ${schools[0].name} to ${schools[1].name}`, leakedReqs === 0);
  }

  // ── Final ──
  console.log('\n' + '═'.repeat(60));
  console.log(`\n   Result: ${pass} passed, ${fail} failed`);
  if (fail === 0) {
    console.log('   🎉 ALL SMOKE TESTS PASSED!');
  } else {
    console.log('   ⚠️  Some tests failed. Check output above.');
  }
  console.log('');

  await mongoose.connection.close();
  process.exit(fail > 0 ? 1 : 0);
}

smoke().catch(err => {
  console.error('❌ Smoke test failed:', err.message);
  process.exit(1);
});
