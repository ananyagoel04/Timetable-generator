#!/usr/bin/env node
/**
 * Seed Verification Script
 * Checks that all required data exists in MongoDB after seeding.
 * Usage: npm run seed:verify
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function verify() {
  await connectDB();
  const db = mongoose.connection.db;
  const dbName = db.databaseName;

  console.log('🔍 Seed Verification Report');
  console.log('═'.repeat(60));
  console.log(`   Database: ${dbName}`);
  console.log(`   URI: ${process.env.MONGODB_URI}`);
  console.log('═'.repeat(60));

  // ── Collection Counts ──
  const collections = [
    'schools', 'users', 'academicsessions', 'teachers', 'classes',
    'subjects', 'rooms', 'periodstructures', 'subjectrequirements',
    'canteaches', 'reservedperiodrules', 'generatedtimetables',
    'lessonblocks', 'absences', 'substitutions', 'auditlogs'
  ];

  const minExpected = {
    schools: 5, users: 25, academicsessions: 5, teachers: 100, classes: 70,
    subjects: 30, rooms: 80, periodstructures: 5, subjectrequirements: 500,
    canteaches: 200, generatedtimetables: 3, lessonblocks: 10,
    absences: 5, substitutions: 3
  };

  let totalPass = 0;
  let totalFail = 0;

  console.log('\n📊 Collection Counts:');
  console.log('─'.repeat(50));
  for (const col of collections) {
    let count = 0;
    try { count = await db.collection(col).countDocuments(); } catch(e) {}
    const min = minExpected[col] || 0;
    const pass = count >= min;
    const status = count === 0 ? '❌ EMPTY' : pass ? '✅ PASS' : '⚠️  LOW';
    console.log(`   ${col.padEnd(25)} ${String(count).padStart(5)}  ${status}${min > 0 ? ` (min: ${min})` : ''}`);
    if (pass || count > 0) totalPass++; else totalFail++;
  }

  // ── School-wise Breakdown ──
  console.log('\n📚 School-wise Breakdown:');
  console.log('─'.repeat(50));
  const schools = await db.collection('schools').find({}).toArray();
  for (const school of schools) {
    const sid = school._id;
    const sessions = await db.collection('academicsessions').countDocuments({ school: sid });
    const activeSessions = await db.collection('academicsessions').countDocuments({ school: sid, isCurrent: true });
    const teachers = await db.collection('teachers').countDocuments({ school: sid });
    const classes = await db.collection('classes').countDocuments({ school: sid });
    const subjects = await db.collection('subjects').countDocuments({ school: sid });
    const rooms = await db.collection('rooms').countDocuments({ school: sid });
    const reqs = await db.collection('subjectrequirements').countDocuments({ school: sid });
    const canteach = await db.collection('canteaches').countDocuments({ school: sid });
    const ps = await db.collection('periodstructures').countDocuments({ school: sid });
    const tt = await db.collection('generatedtimetables').countDocuments({ school: sid });

    console.log(`\n   🏫 ${school.name} (${school.code})`);
    console.log(`      Sessions: ${sessions} (active: ${activeSessions}) | Teachers: ${teachers} | Classes: ${classes}`);
    console.log(`      Subjects: ${subjects} | Rooms: ${rooms} | Requirements: ${reqs}`);
    console.log(`      CanTeach: ${canteach} | PeriodStructures: ${ps} | Timetables: ${tt}`);

    if (activeSessions === 0) { console.log('      ❌ NO ACTIVE SESSION!'); totalFail++; }
    else totalPass++;
    if (teachers === 0) { console.log('      ❌ NO TEACHERS!'); totalFail++; }
    if (classes === 0) { console.log('      ❌ NO CLASSES!'); totalFail++; }
    if (reqs === 0) { console.log('      ❌ NO REQUIREMENTS!'); totalFail++; }
  }

  // ── User Credentials ──
  console.log('\n🔑 User Credentials:');
  console.log('─'.repeat(50));
  const users = await db.collection('users').find({}, { projection: { email: 1, role: 1, isActive: 1 } }).toArray();
  const platformUsers = users.filter(u => u.role?.startsWith('platform'));
  const schoolAdmins = users.filter(u => u.role === 'school_admin');

  console.log('   Platform users:');
  for (const u of platformUsers) {
    console.log(`     ${u.email.padEnd(35)} ${u.role} ${u.isActive ? '✅' : '❌ INACTIVE'}`);
  }
  console.log('   School admins:');
  for (const u of schoolAdmins) {
    console.log(`     ${u.email.padEnd(35)} ${u.role} ${u.isActive ? '✅' : '❌ INACTIVE'}`);
  }

  // ── Final Score ──
  console.log('\n' + '═'.repeat(60));
  const total = totalPass + totalFail;
  const pct = total > 0 ? Math.round((totalPass / total) * 100) : 0;
  console.log(`\n   Result: ${totalPass} passed, ${totalFail} failed — ${pct}% readiness`);
  if (totalFail === 0) {
    console.log('   🎉 ALL CHECKS PASSED — Database is ready for testing!');
  } else {
    console.log('   ⚠️  Some checks failed. Run npm run seed:reset to fix.');
  }
  console.log('');

  await mongoose.connection.close();
  process.exit(totalFail > 0 ? 1 : 0);
}

verify().catch(err => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
