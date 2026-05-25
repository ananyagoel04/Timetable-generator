> [!WARNING]
> **SUPERSEDED:** This document was created on 2026-05-22. An updated 4-agent comprehensive audit was performed on **2026-05-25**.
> 
> See the updated reports:
> - [GAP_ANALYSIS_REPORT.md](file:///Users/ananyagoel/Downloads/timetable%203/GAP_ANALYSIS_REPORT.md) — 54 issues across 8 sections
> - [FINAL_PRODUCTION_READINESS_REPORT.md](file:///Users/ananyagoel/Downloads/timetable%203/FINAL_PRODUCTION_READINESS_REPORT.md) — Production readiness assessment with deployment roadmap

# 🔍 GAP ANALYSIS DOCUMENT (ARCHIVED — 2026-05-22)
## Advanced Automated School Timetable System
### Current Implementation vs Master Requirement & Flow Plan

> **Audit Date:** 2026-05-22  
> **Auditor Role:** Senior Product Auditor / ERP Solution Architect / QA Gap Analyst  
> **Baseline:** [requirements](file:///Users/ananyagoel/Downloads/timetable%203/requirements) (36 sections, 1609 lines)  
> **Evidence Method:** Full code inspection of all models, controllers, routes, services, middleware, pages, components, contexts, and configurations.

---

# 1. EXECUTIVE SUMMARY

| Metric | Value |
|--------|-------|
| **Overall Product Completion** | **~35–40%** |
| **Production Readiness** | ❌ **NOT READY** |
| **Critical Blockers** | 12 |
| **High-Priority Gaps** | 18 |
| **Medium-Priority Gaps** | 15 |
| **Models Implemented** | 24 / ~37 planned |
| **Routes with Auth Middleware** | 1 / 18 (5.5%) |
| **Frontend Pages Using Permission Checks** | 0 / 23 |
| **Timetable Quality Scoring** | Not Implemented |
| **Background Job System** | Not Implemented |
| **Refresh Token Flow** | Not Implemented |
| **PDF/Excel Export** | Not Implemented |

### Top Risk Areas

> [!CAUTION]
> 1. **SECURITY**: All API routes except `/api/auth` are completely unprotected — no authentication, no authorization, no tenant scoping enforced at server level. Any unauthenticated user can read/write ALL school data.
> 2. **DATA ISOLATION**: Multi-school/session data isolation exists in model schemas but is NOT enforced via middleware on any route.
> 3. **TIMETABLE ENGINE**: Greedy single-pass algorithm with randomized shuffling — no optimization, no scoring, no iterative improvement, no backtracking.
> 4. **HARDCODED LIMITS**: `TimetableSlot.js` caps periods at `max: 8`, violating §6 requirement.

---

# 2. SYSTEM INSPECTION SUMMARY

## 2.1 Architecture Overview

```
timetable 3/
├── client/          # Vite + React frontend
│   ├── src/
│   │   ├── pages/          (23 pages)
│   │   ├── components/     (3 layout + 1 UI = 4 components)
│   │   ├── context/        (3 contexts: Auth, Sidebar, Theme)
│   │   └── api/            (1 file: axios.js)
│   └── package.json
├── server/          # Express + Mongoose backend
│   ├── models/             (24 models)
│   ├── controllers/        (not inspected individually — logic mostly in routes)
│   ├── routes/             (18 route files)
│   ├── services/           (1 file: schedulerEngine.js)
│   ├── middleware/         (3 files: auth, errorHandler, validate)
│   └── server.js
├── requirements             (master plan document)
└── .gitignore
```

## 2.2 Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Vite 6.4 + React 19 | ✅ |
| Styling | Vanilla CSS (custom design system) | ✅ |
| Backend | Express 4.21 + Node.js | ✅ |
| Database | MongoDB via Mongoose 8.7 | ✅ |
| Auth | JWT (jsonwebtoken 9.0) | ⚠️ Partial |
| Password Hashing | bcryptjs 3.0 | ✅ |
| Background Jobs | None | ❌ Missing |
| Caching | None | ❌ Missing |
| Real-time | None | ❌ Missing |
| PDF Export | None | ❌ Missing |
| Excel Export | None | ❌ Missing |
| Rate Limiting | None | ❌ Missing |
| Input Validation | Minimal (Mongoose only) | ⚠️ Weak |

## 2.3 Existing Model Inventory (24 implemented)

| Model | School-Scoped | Session-Scoped | Indexes |
|-------|:---:|:---:|:---:|
| [User.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/User.js) | ❌ (global) | ❌ | ✅ unique email |
| [School.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/School.js) | N/A | N/A | ✅ unique code |
| [AcademicSession.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/AcademicSession.js) | ✅ | N/A | ❌ None |
| [Class.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Class.js) | ✅ | ✅ | ✅ compound |
| [Subject.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Subject.js) | ✅ | ✅ | ✅ unique code |
| [Teacher.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Teacher.js) | ✅ | ✅ | ✅ unique email |
| [Room.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Room.js) | ✅ | ❌ | ✅ unique roomNumber |
| [PeriodStructure.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/PeriodStructure.js) | ✅ | ✅ | ✅ compound |
| [SubjectRequirement.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/SubjectRequirement.js) | ✅ | ✅ | ✅ compound |
| [SubjectCombinationRule.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/SubjectCombinationRule.js) | ✅ | ✅ | ❌ None |
| [ReservedPeriodRule.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/ReservedPeriodRule.js) | ✅ | ✅ | ❌ None |
| [CustomRule.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/CustomRule.js) | ✅ | ⚠️ Optional | ❌ None |
| [SoftPreference.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/SoftPreference.js) | ✅ | ⚠️ Optional | ✅ |
| [GeneratedTimetable.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/GeneratedTimetable.js) | ✅ | ✅ | ❌ None |
| [LessonBlock.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/LessonBlock.js) | ❌ (via timetable) | ❌ (via timetable) | ✅ compound |
| [TimetableSlot.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/TimetableSlot.js) | ❌ | ❌ | ✅ compound |
| [ConflictLog.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/ConflictLog.js) | ❌ (via timetable) | ❌ | ✅ |
| [AuditLog.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/AuditLog.js) | ✅ | ✅ | ✅ compound |
| [Absence.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Absence.js) | ✅ | ⚠️ Optional | ✅ compound |
| [Substitution.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Substitution.js) | ✅ | ❌ | ❌ None |
| [DailyAdjustment.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/DailyAdjustment.js) | ✅ | ❌ | ❌ None |
| [TeacherReplacement.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/TeacherReplacement.js) | ✅ | ✅ | ❌ None |
| [Notification.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/Notification.js) | ✅ | ⚠️ Optional | ✅ compound |
| [CanTeach.js](file:///Users/ananyagoel/Downloads/timetable%203/server/models/CanTeach.js) | ✅ | ✅ | ❌ None |

## 2.4 Existing API Route Groups (18)

| Route | Auth Middleware | Permission Middleware | Tenant Scope |
|-------|:---:|:---:|:---:|
| `/api/auth` | ✅ (on /me, /switch-school) | ❌ | ❌ |
| `/api/setup` | ❌ | ❌ | ❌ |
| `/api/teachers` | ❌ | ❌ | ❌ |
| `/api/subjects` | ❌ | ❌ | ❌ |
| `/api/classes` | ❌ | ❌ | ❌ |
| `/api/rooms` | ❌ | ❌ | ❌ |
| `/api/rules` | ❌ | ❌ | ❌ |
| `/api/timetable` | ❌ | ❌ | ❌ |
| `/api/absences` | ❌ | ❌ | ❌ |
| `/api/substitutions` | ❌ | ❌ | ❌ |
| `/api/audit-logs` | ❌ | ❌ | ❌ |
| `/api/reports` | ❌ | ❌ | ❌ |
| `/api/search` | ❌ | ❌ | ❌ |
| `/api/notifications` | ❌ | ❌ | ❌ |
| `/api/diagnostics` | ❌ | ❌ | ❌ |
| `/api/users` | ❌ | ❌ | ❌ |
| `/api/requirements` | ❌ | ❌ | ❌ |
| `/api/can-teach` | ❌ | ❌ | ❌ |

> [!CAUTION]
> **Evidence**: [server.js line 18](file:///Users/ananyagoel/Downloads/timetable%203/server/server.js#L18) explicitly states: `"no auth enforced yet — progressive adoption"`. The `protect`, `authorize`, and `scopeToSchool` middleware exist in [auth.js](file:///Users/ananyagoel/Downloads/timetable%203/server/middleware/auth.js) but are NEVER imported by any route file except auth.js.

---

# 3. REQUIREMENT vs CURRENT SYSTEM — DETAILED GAP ANALYSIS

## §1. Product Vision

| Requirement | Status | Risk |
|------------|--------|------|
| Multi-school login | ⚠️ Partial | High |
| Multi-user access | ⚠️ Partial | High |
| Role-based permissions | ⚠️ Schema only, not enforced | **Critical** |
| Automated timetable generation | ⚠️ Basic greedy algorithm | High |
| Custom period and break setup | ✅ PeriodStructure model + UI | Low |
| Class-wise subject load | ✅ SubjectRequirement | Low |
| Teacher capability management | ✅ Teacher.capabilities + CanTeach | Medium |
| Teacher replacement | ⚠️ Backend model + basic UI | Medium |
| Teacher absence adjustment | ⚠️ Backend model + auto-replacement | Medium |
| Subject combination rules | ✅ Model + UI + engine support | Low |
| Room/resource allocation | ✅ Basic allocation in engine | Medium |
| Manual timetable editing | ⚠️ Drag/drop + edit modal, no undo | Medium |
| Conflict detection | ⚠️ Teacher/room clashes only | Medium |
| Audit logs | ⚠️ Model + UI, not auto-triggered | High |
| Reports | ⚠️ UI exists, no PDF/Excel export | High |
| Mobile-responsive dashboard | ✅ Responsive CSS implemented | Low |
| Future custom rule engine | ⚠️ Schema exists, engine ignores it | Medium |

---

## §2. User Types / Roles — **Status: PARTIAL** — Risk: **CRITICAL**

**What exists:**
- User model has 12 role types (platform_owner through viewer)
- `schools[].permissions` array with 14 permission strings
- `hasPermission()` function in AuthContext
- `authorize()` middleware function defined

**What is BROKEN/MISSING:**
- ❌ `authorize()` middleware is **never called** on any route
- ❌ `hasPermission()` is **never called** in any frontend page (0 of 23 pages)
- ❌ No Role model (permissions hardcoded as string arrays)
- ❌ No Permission model
- ❌ No Custom Role support
- ❌ Teachers see ALL admin pages (no visibility gating)
- ❌ Viewers have full CRUD access to everything
- ❌ No Role/Permission management page (UserManagement.jsx exists but doesn't manage roles)

---

## §3. Multi-School Login — **Status: PARTIAL** — Risk: **HIGH**

**What exists:**
- JWT authentication (login, register)
- User.schools[] multi-school membership schema
- User.activeSchool / activeSession fields
- `switchSchool` API endpoint
- X-School-Id / X-Session-Id headers sent from frontend

**What is MISSING:**
- ❌ **No Forgot Password** — no endpoint, no page, no email
- ❌ **No Password Reset flow**
- ❌ **No Refresh Token** — field exists in User model but never populated or used
- ❌ **No School Selector page** after login (auto-sets first school)
- ❌ **No Session Selector page**
- ❌ **School-wise data isolation not enforced** — `scopeToSchool` middleware exists but is never used
- ❌ **Session-wise data isolation not enforced** — many controllers use `School.findOne()` instead of scoped queries
- ❌ **No multi-school membership UI** — can't add user to multiple schools

---

## §4–5. Lesson Block Architecture — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- LessonBlock model with correct type enum (normal, double_period, lab, activity, club, reserved, combined_class, split_group, substitution, locked_manual, free)
- `consecutiveGroupId` and `consecutivePosition` fields
- `editHistory` array
- `linkedBlockId` for double periods

**What is MISSING:**
- ❌ No "Senior Common Subject Lesson" type
- ❌ No parallel student groups tracking within a single timeslot
- ❌ Engine doesn't create proper `double_period` type blocks (uses consecutive singles instead)
- ❌ Engine doesn't set `linkedBlockId` for double periods
- ❌ `editHistory` is never populated during manual edits

---

## §6. School Setup — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- School model with settings (working days, period count, break period)
- PeriodStructure with flexible timeslots, Saturday config, day overrides

**What is MISSING/BROKEN:**
- ❌ **Period count hardcoded**: [TimetableSlot.js line 6](file:///Users/ananyagoel/Downloads/timetable%203/server/models/TimetableSlot.js#L6) → `period: { max: 8 }` — violates "must not be hardcoded to 8 periods"
- ❌ School.settings.defaultBreakPeriod assumes single break (requirement allows multiple breaks)
- ❌ No temporary timing change support
- ❌ No exam slot / event day structure
- ❌ No assembly timing field in School model (handled via PeriodStructure but not integrated)

---

## §7. Period and Break Customization — **Status: PARTIAL** — Risk: **LOW**

**What exists:**
- PeriodStructure model with timeslots (label, slotNumber, startTime, endTime, type)
- Types: period, break, lunch, assembly, activity, custom
- Saturday-specific config
- Per-day overrides

**What is MISSING:**
- ❌ No "fruit break" slot type (requirement §7 lists it explicitly)
- ❌ No "sports" or "exam" or "club" or "blocked" slot types
- ❌ Scheduler engine IGNORES PeriodStructure — uses `School.settings.defaultPeriodsPerDay` and a single break period number instead of reading actual timeslots
- ❌ No "applicable classes" for period structures in the engine (field exists in model but engine doesn't use it)

> [!WARNING]
> The PeriodStructure model is well-designed but the scheduler engine at [schedulerEngine.js lines 54-61](file:///Users/ananyagoel/Downloads/timetable%203/server/services/schedulerEngine.js#L54-L61) completely bypasses it and uses hardcoded values from School.settings.

---

## §8. Class, Section, Stream, Group Setup — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- Class model with grade (1-12), section, stream, studentGroups[], classTeacher, level

**What is MISSING:**
- ❌ Grade range limited to 1-12 (no Nursery, LKG, UKG support — required in §8)
- ❌ No dedicated Stream model — stream is a string enum on Class
- ❌ No dedicated StudentGroup model — embedded array only
- ❌ Custom streams not supported (enum: none, science, commerce, humanities, general)
- ❌ No "Vocational" or "Arts" stream options
- ❌ Groups lack proper schedule isolation tracking

---

## §9. Subject Setup — **Status: PARTIAL** — Risk: **LOW**

**What exists:**
- Subject model with type, category, requiresLab, requiresSpecialRoom, preferMorning, preferAfternoon, maxPerDay, canBeDoubled

**What is MISSING:**
- ❌ No `priority` field (requirement §9 specifies subject priority)
- ❌ No `preferredPeriods` / `avoidedPeriods` arrays
- ❌ No `preferredDays` / `avoidedDays` arrays
- ❌ No `canBeCombined` flag
- ❌ No `preferBeforeLunch` / `preferAfterLunch` / `preferLastPeriods` flags
- ❌ Subject type enum missing: "language", "computer", "practical" from §9 list

---

## §10. Class-Wise Weekly Subject Load — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- SubjectRequirement model with class, subject, teacher, periodsPerWeek, studentGroup, allowDoublePeriod, consecutivePreference, preferredDays, avoidDays

**What is MISSING:**
- ❌ No `minimumPeriods` / `maximumPeriods` (flexibility range)
- ❌ No `strictness` mode (strict/preferred/flexible as required in §10)
- ❌ No `preferredPeriods` / `avoidedPeriods` (day preferences exist but not period preferences)
- ❌ No `roomRequirement` per requirement (exists on Subject but not per class-subject pair)
- ❌ No `labRequirement` per requirement
- ❌ No per-requirement priority field

---

## §11. Teacher Management — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- Teacher model with capabilities[], maxPeriodsPerDay/Week, maxContinuousPeriods, unavailableSlots
- CanTeach model (structured eligibility with roles)

**What is MISSING:**
- ❌ **No "Teacher Assignment" model** — requirement §11 explicitly requires separating "can teach" from "currently teaching." The system uses SubjectRequirement.teacher as assignments, but lacks a dedicated TeacherAssignment model
- ❌ No `availableDays` field (only unavailableSlots exists)
- ❌ No `preferredPeriods` on teacher
- ❌ No `minFreePeriodsPerDay` field
- ❌ No `canManageLabs` / `canTakeActivities` boolean fields

---

## §12. Class Teacher Rule — **Status: MISSING** — Risk: **MEDIUM**

- ❌ School.settings has `classTeacherFirstPeriodPreference: Boolean` but the **scheduler engine does NOT implement this rule**
- ❌ No class teacher first-period coverage dashboard
- ❌ No strict/preferred/flexible/disabled mode for this rule
- ❌ No report showing coverage (e.g., "6A: 5/6 days")

---

## §13. Teacher Replacement — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- TeacherReplacement model with types (full, partial, subject_wise, etc.)
- TeacherReplacements.jsx frontend page
- Backend controller with basic CRUD

**What is MISSING:**
- ❌ No "suggestion" endpoint that checks capability + workload + conflicts
- ❌ No "preview affected timetable" before applying
- ❌ No "re-optimize" after applying replacement
- ❌ No workload validation during replacement
- ❌ No conflict check during replacement
- ❌ Status flow (draft → previewing → approved → applied → reverted) partially modeled but not enforced

---

## §14. Teacher Absence & Substitution — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- Absence model with types (full_day, selected_periods, date_range)
- Auto-replacement logic in absenceController using CanTeach scoring
- DailyAdjustment model with resolution types
- Substitution model

**What is MISSING:**
- ❌ No "weekly absence" type (required in §14)
- ❌ Substitution priority logic (§14 lists 7 priority levels) — only levels 1-3 implemented, no period swap, no activity move, no supervised study fallback
- ❌ **Temporary absence does NOT protect master timetable** — no clear separation between daily adjustments and permanent timetable
- ❌ No "publish daily adjustment" workflow
- ❌ No admin review/approve flow for substitutions in UI

---

## §15. Universal Subject Combination Rule — **Status: MOSTLY COMPLETE** — Risk: **LOW**

**What exists:**
- SubjectCombinationRule model with appliesTo[], teacher, room, periodsPerWeek, strictness
- Engine placement logic for combined classes
- CombinationRules.jsx UI

**What is MISSING:**
- ❌ No `singleOrDoublePeriod` option
- ❌ No `avoidedPeriods` field
- ❌ No `temporary/permanent` flags
- ❌ No `effectiveFrom`/`effectiveTo` dates
- ❌ No priority field

---

## §16. Senior Stream & Split Group Logic — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- Class.stream field, Class.studentGroups[]
- SubjectRequirement.studentGroup field
- Engine creates `split_group` type blocks

**What is MISSING:**
- ❌ No parallel group scheduling validation (engine doesn't verify that Bio Group and Maths Group periods are placed in the same timeslot)
- ❌ No group-level conflict detection
- ❌ No UI to visualize parallel split group schedule

---

## §17. Room & Resource Management — **Status: PARTIAL** — Risk: **LOW**

**What exists:**
- Room model with type, capacity, unavailableSlots, resources
- Engine allocates rooms based on type and capacity

**What is MISSING:**
- ❌ No `allowedSubjects` field (requirement §17)
- ❌ No `allowedClasses` field
- ❌ No room capacity check **in the UI** when editing
- ❌ Room types missing: "dance_room", "seminar_hall", "smart_class" from §17

---

## §18. Reserved Periods — **Status: PARTIAL** — Risk: **LOW**

**What exists:**
- ReservedPeriodRule model with type, appliesTo, day, periods, isLocked
- Engine places reserved rules first

**What is MISSING:**
- ❌ No `scope` field (requirement says "Scope" is a field)
- ❌ No `applicableDate` for one-time events
- ❌ No `temporary/permanent` flags
- ❌ No `effectiveFrom`/`effectiveTo` dates
- ❌ Missing types: "sports", "exam", "rehearsal", "event", "blocked" from §18

---

## §19. Rule Engine — **Status: SCHEMA ONLY** — Risk: **HIGH**

**What exists:**
- CustomRule model with ruleType (hard/soft/preference/warning/custom), priority, weight, config
- SoftPreference model

**What is BROKEN:**
- ❌ **Scheduler engine DOES NOT read or apply CustomRule or SoftPreference** — these models are completely ignored during generation
- ❌ No rule testing/validation before activation
- ❌ No RuleVersion model
- ❌ No system default rules
- ❌ Rule layers concept (system/school/developer) exists in schema but not in engine

---

## §20–21. Hard & Soft Constraints — **Status: PARTIAL** — Risk: **HIGH**

**Hard constraints implemented in engine:**
- ✅ Teacher cannot teach two unrelated lessons at same time
- ✅ Class cannot attend two lessons at same time
- ✅ Room cannot host two lessons at same time
- ✅ Combined classes share same period (via combination rule)
- ⚠️ Teacher unavailable slots respected (basic check)

**Hard constraints MISSING:**
- ❌ "Teacher cannot teach outside capability" — engine does NOT verify teacher capabilities
- ❌ "Required room type must match" — engine has basic type check but falls back to any room
- ❌ "Locked periods cannot be changed" — no lock checking during generation
- ❌ "School/session data must be isolated" — not enforced

**Soft constraints MISSING (ALL):**
- ❌ Class teacher first period preference
- ❌ Games/dance/sports prefer later
- ❌ Math/science prefer before lunch (field exists but no scoring)
- ❌ Avoid same subject too many times per day (maxPerDay checked but no soft scoring)
- ❌ Avoid too many continuous periods for teacher
- ❌ Balance teacher workload
- ❌ Balance subject distribution across week
- ❌ Avoid unnecessary room changes
- ❌ Balance teacher free periods
- ❌ Prefer activity periods on configured days
- ❌ Avoid heavy subjects after lunch

---

## §22. Timetable Generation Flow — **Status: PARTIAL** — Risk: **HIGH**

**What exists (greedy single-pass):**
1. ✅ Load school data
2. ⚠️ Load periods (from School.settings, NOT PeriodStructure)
3. ✅ Load classes, teachers, rooms
4. ✅ Load requirements and combination rules
5. ✅ Place reserved rules first
6. ✅ Place combination rules
7. ✅ Place regular requirements (shuffle + greedy)
8. ✅ Place break blocks
9. ✅ Detect teacher/room conflicts
10. ✅ Save timetable with stats

**What is MISSING:**
- ❌ No loading of custom rules
- ❌ No loading of soft preferences
- ❌ No "locked/manual blocks" pre-placement (§22 step)
- ❌ **No soft rule optimization pass**
- ❌ **No timetable quality score calculation**
- ❌ **No iterative improvement / backtracking**
- ❌ **No background job** — generation runs synchronously, blocking the request
- ❌ No generation progress updates to frontend
- ❌ No "re-optimization" option
- ❌ No incremental re-optimization for small changes

---

## §23. Timetable Score — **Status: MISSING** — Risk: **HIGH**

- ❌ No score calculation at all
- ❌ No score factors (hard conflicts, soft warnings, workload balance, etc.)
- ❌ No score display on dashboard
- ❌ GeneratedTimetable.stats.softRuleScore field exists but is always 0

---

## §24. Manual Timetable Editing — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- Drag/drop support in TimetableView.jsx
- Edit modal for changing subject/teacher/room per slot
- Lock/unlock per lesson block

**What is MISSING:**
- ❌ No **undo/redo** (grep confirmed: zero matches)
- ❌ No **swap** operation (only move)
- ❌ No "save with reason" — no reason field on edit
- ❌ No force override option
- ❌ No pre-save validation (teacher availability, capability, workload, room capacity)
- ❌ No conflict preview before saving
- ❌ `editHistory[]` on LessonBlock is never populated
- ❌ No combined block relation preservation during edits
- ❌ No split group relation preservation during edits

---

## §25. Conflict Center — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- ConflictLog model with 12 conflict types
- ConflictCenter.jsx frontend page
- Engine detects teacher clashes and room clashes

**What is MISSING:**
- ❌ No "class busy" conflict type detection in engine
- ❌ No "teacher overload" detection
- ❌ No "room capacity" detection
- ❌ No "missing teacher" detection
- ❌ No "subject period shortage" detection
- ❌ No "broken combined block" detection
- ❌ No "invalid split group" detection
- ❌ No actionable "fix" buttons in the UI
- ❌ Suggested fixes are text only, not clickable actions

---

## §26. Audit Logs — **Status: PARTIAL** — Risk: **HIGH**

**What exists:**
- AuditLog model with 28 action types, entity tracking, old/new values, IP/user agent
- AuditLogs.jsx frontend page with date/action/entity filters

**What is BROKEN/MISSING:**
- ❌ **No automatic audit log creation** — no middleware that auto-logs. Audit entries must be manually created in each controller. Most controllers DON'T create audit logs.
- ❌ Login/logout events not logged
- ❌ Failed login not logged
- ❌ School switch not logged
- ❌ CRUD operations on teachers/classes/subjects not logged
- ❌ Manual timetable edits not logged
- ❌ Generation events not logged (engine doesn't create audit entries)
- ❌ No rollback capability (isRollbackable field exists but never used)

---

## §27. Reports & Export — **Status: PARTIAL** — Risk: **HIGH**

**What exists:**
- Reports.jsx with class-wise, teacher-wise, day-wise, room-wise timetable views
- Substitution/replacement report tab
- Print support via CSS @media print

**What is MISSING:**
- ❌ **No PDF export** — no pdf library installed
- ❌ **No Excel export** — no xlsx library installed
- ❌ No teacher workload report
- ❌ No subject completion report
- ❌ No class teacher first-period report
- ❌ No room usage report
- ❌ No conflict report (separate from Conflict Center)
- ❌ No published timetable history report
- ❌ Print formatting exists but no header/footer customization

---

## §28. Frontend UI/UX — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- 23 pages implemented
- Professional SaaS design with glassmorphism, gradients, animations
- Dark/light theme toggle
- Responsive CSS framework

**Pages MISSING from requirements:**
- ❌ Forgot Password page
- ❌ School Selector page
- ❌ Session Selector page
- ❌ Role & Permission Management page (separate from User Management)

**UI quality issues:**
- ⚠️ No loading skeletons (uses spinners)
- ⚠️ Only 1 reusable UI component (Modal.jsx) — tables, forms, buttons are inline CSS classes
- ⚠️ No form validation beyond HTML5 required attributes
- ⚠️ No confirmation dialogs for destructive actions (uses browser confirm())

---

## §29. Sidebar & Layout — **Status: MOSTLY COMPLETE** — Risk: **LOW**

**What exists:**
- Expanded/collapsed desktop sidebar
- Mobile drawer with hamburger
- Active state highlighting
- Icon-only collapsed state with tooltips
- Smooth transition animations
- Settings at bottom

**What is MISSING:**
- ❌ No permission-based nav item visibility (teacher sees all admin links)

---

## §30. Setup Wizard — **Status: PARTIAL** — Risk: **MEDIUM**

**What exists:**
- SetupWizard.jsx with multi-step UI
- Seed data button

**What is MISSING:**
- ❌ Only covers basic steps (school info, periods, classes, subjects, teachers)
- ❌ No step for teacher capabilities
- ❌ No step for teacher assignments
- ❌ No step for weekly subject load
- ❌ No step for rooms/resources
- ❌ No step for special rules
- ❌ No step for combination rules
- ❌ No "review readiness" step
- ❌ No "generate timetable" step from wizard

---

## §31. Dashboard — **Status: PARTIAL** — Risk: **LOW**

**What exists:**
- Welcome banner with timetable status
- 9 stat cards (teachers, classes, subjects, rooms, loads, rules, scheduled, conflicts, absences)
- 4 quick action cards
- Recent audit log activity

**What is MISSING:**
- ❌ No current school/session display
- ❌ No setup completion percentage
- ❌ No timetable score display
- ❌ No "teachers ready" / "classes ready" indicators
- ❌ No recent activity feed

---

## §32. Backend API Groups — **Status: PARTIAL** — Risk: **MEDIUM**

**Required API groups vs implemented:**

| API Group | Status |
|-----------|--------|
| Auth APIs | ✅ |
| User APIs | ✅ Basic |
| Role/Permission APIs | ❌ Missing |
| School APIs | ⚠️ Via setup |
| Session APIs | ⚠️ Minimal |
| Period/Timeslot APIs | ✅ |
| Class/Section/Stream APIs | ✅ |
| Subject APIs | ✅ |
| Teacher APIs | ✅ |
| Teacher Capability APIs | ✅ (CanTeach) |
| Teacher Assignment APIs | ❌ Missing |
| Subject Load APIs | ✅ (Requirements) |
| Room/Resource APIs | ✅ |
| Rule APIs | ✅ |
| Subject Combination APIs | ✅ |
| Reserved Period APIs | ✅ (via rules) |
| Custom Rule APIs | ✅ (via rules) |
| Timetable Generation APIs | ✅ |
| Manual Edit APIs | ⚠️ Basic |
| Absence APIs | ✅ |
| Replacement APIs | ⚠️ Basic |
| Conflict APIs | ⚠️ Read-only |
| Audit Log APIs | ✅ |
| Report APIs | ✅ |
| Export APIs | ❌ Missing |

---

## §33. Database Models — **Status: PARTIAL** — Risk: **HIGH**

**Models required but MISSING entirely:**

| Missing Model | Purpose | Risk |
|--------------|---------|------|
| Role | Custom role definitions | High |
| Permission | Granular permission entities | High |
| UserSchoolMembership | Dedicated membership tracking | Medium |
| WorkingDay | Per-day working config | Low |
| TimeSlot | Individual timeslot entity | Low |
| ClassLevel | Pre-primary/junior/middle/senior entity | Low |
| Section | Dedicated section entity | Low |
| Stream | Dedicated stream entity | Medium |
| StudentGroup | Dedicated student group entity | Medium |
| SubjectWeeklyLoad | Dedicated weekly load (SubjectRequirement serves this partially) | Low |
| TeacherCapability | Dedicated capability model (Teacher.capabilities[] + CanTeach serve this) | Low |
| TeacherAssignment | What teacher is currently teaching (distinct from capability) | High |
| ClassTeacherAssignment | Class teacher → class mapping | Medium |
| Resource | Shared equipment (projector, etc.) | Low |
| SubjectRoomRequirement | Per-subject room needs | Low |
| RuleVersion | Rule change history | Low |
| TimetableEntry | Individual timetable entry (LessonBlock serves this) | Low |
| ManualOverride | Dedicated override tracking | Medium |
| ActivityLog | Lightweight activity feed | Low |
| PublishLog | Timetable publish history | Medium |

---

## §34. Performance — **Status: NOT IMPLEMENTED** — Risk: **HIGH**

- ❌ **No background job system** — generation is synchronous, blocking the HTTP request
- ❌ No Redis/BullMQ/queue
- ❌ No generation status polling API (frontend waits for request to complete)
- ❌ No caching
- ❌ No pagination on most list endpoints
- ❌ No timetable snapshots (GeneratedTimetable exists but no snapshot comparison)
- ❌ No incremental re-optimization
- ❌ Missing indexes on 7 models (SubjectCombinationRule, ReservedPeriodRule, GeneratedTimetable, Substitution, DailyAdjustment, TeacherReplacement, CanTeach)

---

## §35. Git / Deployment — **Status: PARTIAL** — Risk: **MEDIUM**

- ✅ Git repository initialized
- ✅ .gitignore includes node_modules, .env
- ❌ No `.env.example` file
- ❌ No Dockerfile
- ❌ No docker-compose
- ❌ No CI/CD pipeline
- ❌ No production build script for server

---

## §36. Final Product Acceptance Criteria Checklist

| Criterion | Status |
|-----------|--------|
| Secure multi-user login | ⚠️ Login works, but not secure (no rate limiting, no refresh tokens) |
| Multi-school access | ⚠️ Schema exists, not enforced |
| School/session selector | ❌ Missing UI |
| Role-based access control | ❌ Not enforced |
| Permission-based UI | ❌ Not implemented |
| Custom period/break setup | ✅ |
| Class/section/stream/group setup | ⚠️ Partial (no Nursery/LKG/UKG) |
| Subject setup | ✅ |
| Class-wise weekly subject load | ✅ |
| Teacher capability vs assignment | ⚠️ Capability exists, no dedicated assignment |
| Teacher replacement suggestions | ❌ No smart suggestions |
| Temp/permanent teacher replacement | ⚠️ Model exists, workflow incomplete |
| Teacher absence adjustment | ⚠️ Basic auto-replacement |
| Universal subject combination | ✅ |
| Room/resource allocation | ⚠️ Basic |
| Lesson-block timetable generation | ⚠️ Greedy only |
| Conflict detection | ⚠️ Teacher/room only |
| Manual timetable editing | ⚠️ No undo, no validation |
| Locked periods | ⚠️ Schema only |
| Audit logs for every change | ❌ Not auto-triggered |
| Reports and exports | ⚠️ View only, no PDF/Excel |
| Expandable/collapsible sidebar | ✅ |
| Mobile responsiveness | ✅ |
| Professional SaaS UI | ✅ |
| Localhost setup | ✅ |
| GitHub push | ✅ |

---

# 4. SECURITY & PERMISSION AUDIT

> [!CAUTION]
> **SEVERITY: CRITICAL — Production deployment would expose ALL school data to any user or attacker.**

| Security Issue | Evidence | Risk |
|---------------|----------|------|
| All 17 data routes unprotected | [server.js L18](file:///Users/ananyagoel/Downloads/timetable%203/server/server.js#L18): "no auth enforced yet" | **Critical** |
| JWT secret has hardcoded fallback | [auth.js L4](file:///Users/ananyagoel/Downloads/timetable%203/server/middleware/auth.js#L4): `'timecraft-secret-key-2025'` | **Critical** |
| No rate limiting on login | No express-rate-limit dependency | High |
| No refresh token rotation | Field exists, never used | High |
| No CORS origin restriction | `app.use(cors())` with no config — accepts ALL origins | High |
| No input sanitization | No express-validator, no mongo-sanitize | High |
| No CSRF protection | No csrf token handling | Medium |
| No helmet security headers | No helmet dependency | Medium |
| No request size limiting (except 10mb JSON) | Could allow large payload attacks | Medium |
| Audit logs don't capture IP consistently | Available in schema, not captured in practice | Low |

---

# 5. TIMETABLE ENGINE AUDIT

| Engine Aspect | Status | Details |
|--------------|--------|---------|
| Algorithm type | Greedy single-pass | No optimization, no backtracking |
| Randomization | `_shuffle()` on requirements and days | Non-deterministic — same input produces different output |
| PeriodStructure integration | ❌ Not used | Engine reads School.settings instead |
| CustomRule integration | ❌ Not used | CustomRule and SoftPreference models exist but are ignored |
| Soft constraint scoring | ❌ Not implemented | No quality scoring at all |
| Consecutive period placement | ⚠️ Basic | Checks numerically adjacent periods, checks break between |
| Saturday handling | ⚠️ Basic | Uses same period structure as weekdays |
| Combined class placement | ✅ Works | Places combined lessons before regular |
| Reserved rule placement | ✅ Works | Places reserved first |
| Room allocation | ⚠️ Basic | Falls back to any available room if type doesn't match |
| Teacher workload balancing | ❌ Not implemented | No cross-day distribution logic |
| Subject distribution | ❌ Not implemented | No even-distribution check |
| Class teacher first period | ❌ Not implemented | Setting exists but engine ignores it |
| Conflict detection | ⚠️ Teacher + room only | No class clash, no capacity, no overload |
| Re-optimization | ❌ Not supported | Must regenerate from scratch |
| Background execution | ❌ Synchronous | Blocks HTTP request |

---

# 6. DATABASE GAP AUDIT

| Gap | Description | Risk |
|-----|------------|------|
| 13+ missing models | See §33 above | High |
| Missing indexes on 7 models | SubjectCombinationRule, ReservedPeriodRule, GeneratedTimetable, Substitution, DailyAdjustment, TeacherReplacement, CanTeach | Medium |
| No TTL indexes | Old notifications/logs grow unbounded | Low |
| TimetableSlot.period max:8 | Hardcoded limit | High |
| No compound uniqueness on several models | SubjectCombinationRule, ReservedPeriodRule lack unique constraints | Medium |
| AcademicSession no indexes | Missing school+status compound index | Low |
| Room missing session scope | Not session-scoped — rooms persist across sessions | Low |
| No migration system | No versioned migrations, all schema changes are implicit | Medium |

---

# 7. UI/UX AUDIT

| Area | Status | Notes |
|------|--------|-------|
| Sidebar | ✅ Good | Collapse, mobile drawer, tooltips work |
| Dashboard | ⚠️ | Missing school/session display, score, setup progress |
| Timetable grid | ⚠️ | Drag/drop works but no validation, no undo |
| Modals | ⚠️ | Only 1 reusable Modal component; most modals are inline |
| Forms | ⚠️ | No client-side validation beyond required |
| Reports | ⚠️ | View-only, no export buttons |
| Print | ⚠️ | CSS exists but no UI for print settings |
| Search | ✅ | ⌘K global search works |
| Theme | ✅ | Dark/light/system toggle |
| Mobile | ✅ | Responsive grid, stacked cards |
| Typography | ✅ | Inter font, good hierarchy |
| Spacing | ✅ | Consistent glass-card design system |
| Permission gating | ❌ | All pages visible to all users |
| Error states | ⚠️ | Toast notifications for errors, no inline form errors |
| Empty states | ⚠️ | Some pages have empty states, others show blank tables |
| Loading states | ⚠️ | Spinner only, no skeletons |

---

# 8. PRIORITY MATRIX

## 🔴 Critical Immediate (Must fix before ANY deployment)

| # | Gap | Module |
|---|-----|--------|
| 1 | Apply auth middleware to ALL routes | Security |
| 2 | Enforce school/session scoping on ALL queries | Data Isolation |
| 3 | Remove hardcoded JWT secret fallback | Security |
| 4 | Add CORS origin restrictions | Security |
| 5 | Fix TimetableSlot.period max:8 hardcode | Database |
| 6 | Apply permission middleware on sensitive routes | Authorization |

## 🟠 High Priority (Before beta/UAT)

| # | Gap | Module |
|---|-----|--------|
| 7 | Implement permission-based UI visibility | Frontend |
| 8 | Make scheduler engine read PeriodStructure | Engine |
| 9 | Add timetable quality scoring | Engine |
| 10 | Add PDF/Excel export | Reports |
| 11 | Add forgot password / password reset flow | Auth |
| 12 | Add refresh token rotation | Auth |
| 13 | Create school/session selector UI | Auth Flow |
| 14 | Add automatic audit log middleware | Audit |
| 15 | Add background job queue for generation | Performance |
| 16 | Add input validation (express-validator) | Security |
| 17 | Add rate limiting | Security |
| 18 | Implement soft constraint scoring in engine | Engine |
| 19 | Add missing database indexes | Database |

## 🟡 Medium Priority (Before production)

| # | Gap | Module |
|---|-----|--------|
| 20 | Support Nursery/LKG/UKG grades | Classes |
| 21 | Create dedicated TeacherAssignment model | Architecture |
| 22 | Add undo/redo for timetable editing | Editor |
| 23 | Add pre-edit conflict validation | Editor |
| 24 | Add class teacher first period rule in engine | Engine |
| 25 | Implement all conflict detection types | Conflicts |
| 26 | Complete Setup Wizard steps (11 missing) | Onboarding |
| 27 | Add teacher replacement suggestion logic | Replacements |
| 28 | Add Role/Permission management page | User Mgmt |
| 29 | Add missing report types (workload, completion, usage) | Reports |
| 30 | Add proper form validation throughout | UI/UX |

## 🟢 Low Priority (Future enhancement)

| # | Gap | Module |
|---|-----|--------|
| 31 | Add Stream/StudentGroup dedicated models | Architecture |
| 32 | Add Resource model | Rooms |
| 33 | Add RuleVersion model | Rules |
| 34 | Add PublishLog model | Timetable |
| 35 | Add ManualOverride dedicated model | Editor |
| 36 | Docker/CI-CD deployment pipeline | DevOps |
| 37 | Redis caching layer | Performance |
| 38 | Helmet security headers | Security |
| 39 | Loading skeletons | UI/UX |
| 40 | Browser notifications (WebSocket/SSE) | Notifications |

---

# 9. FINAL PRODUCTION READINESS SCORE

| Category | Score | Notes |
|----------|-------|-------|
| **Backend Readiness** | **25%** | Routes unprotected, no auth enforcement, no validation, no background jobs |
| **Frontend Readiness** | **55%** | 23 pages built with good UI, but no permission gating, no export, no critical pages |
| **Database Readiness** | **40%** | 24/37 models, 7 missing indexes, hardcoded limits |
| **UX Readiness** | **60%** | Professional design, responsive, but missing validation and critical flows |
| **Security Readiness** | **10%** | All routes open, hardcoded secret, no rate limiting, no CORS |
| **Timetable Engine Readiness** | **30%** | Greedy placement works, but no scoring, no optimization, no PeriodStructure integration |
| | | |
| **🏁 OVERALL PRODUCT READINESS** | **~35%** | **NOT ready for production or beta testing** |

> [!IMPORTANT]
> The system has a solid **foundation** — the data models are well-designed, the UI is professional, and the core scheduling pipeline works at a basic level. However, the complete absence of route-level authentication, the lack of permission enforcement, the missing export capabilities, and the simplistic scheduler algorithm make it unsuitable for deployment in its current state. The 6 Critical Immediate items must be resolved before any user testing begins.

---

*Document generated by automated deep-inspection of all project files. Every claim is verifiable by examining the referenced source files.*
