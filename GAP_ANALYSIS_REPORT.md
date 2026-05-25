# 🔍 GAP ANALYSIS REPORT
## Advanced Automated School Timetable System — Full Four-Agent Audit
### Current Implementation vs. `requirements.md` (36 Sections)

> **Audit Date:** 2026-05-25
> **Validation Baseline:** [`requirements.md`](file:///Users/ananyagoel/Downloads/timetable%203/requirements.md) (36 sections, 1609 lines)
> **Evidence Method:** Full code inspection, API testing, module loading verification, frontend build analysis, browser rendering check
> **Agents:** Product Analyst (Agent 1), Backend Engineer (Agent 2), Frontend/UX Engineer (Agent 3), Integration/QA Lead (Agent 4)

---

## 1. EXECUTIVE SUMMARY

| Metric | Current Value | Target |
|--------|:---:|:---:|
| **Overall Completion** | **~60–65%** | 100% |
| **Production Readiness** | ❌ **NOT READY** | ✅ |
| **Critical Blockers** | **14** | 0 |
| **High-Priority Gaps** | **22** | 0 |
| **Medium-Priority Gaps** | **18** | ≤ 5 |
| **Models Implemented** | 29 / ~37 planned | 37 |
| **Routes with Auth** | 20 / 20 ✅ | 20 |
| **Routes with Input Validation** | 12 / 20 | 20 |
| **Frontend Pages** | 25 / ~29 required | 29 |
| **Frontend Pages with Permission Gating** | 2 / 25 | 25 |
| **PDF Export** | ❌ Not implemented | ✅ |
| **Excel Export** | ✅ 3 endpoints (bug fixed) | ✅ |
| **Background Job System** | ❌ Missing | ✅ |
| **Timetable Quality Score UI** | ❌ Missing | ✅ |
| **API Browser Test Pass Rate** | **70.9%** (56/79 pass) | 95% |

### Progress Since Last Audit (2026-05-22)

| Area | Before | Now |
|------|:---:|:---:|
| Route-level authorization | 1/18 (5.5%) | **20/20 (100%)** ✅ |
| Input validation middleware | 0% | **~60%** |
| Tenant isolation middleware | None | **scopeToSchool on all /api** ✅ |
| Platform isolation (platformOnly) | Untested | **✅ Verified — admin→403, dev→200** |
| Timetable engine | Single-pass greedy | **7-factor scoring, CanTeach, consecutive-aware** |
| Timetable editor | Basic | **Undo/redo, lock/unlock, validate-move** |
| DnD implementation | HTML5 native (buggy) | **@dnd-kit (proper)** ✅ |
| Platform admin | Placeholder | **Overview + schools + audit + users** ✅ |
| Permission gating | None | **PermissionGate component + isPlatformUser** |
| Excel export (class view) | ❌ Crash on duplicate names | **✅ Fixed — unique worksheet names** |
| Server staleness | Routes not loaded (stale process) | **✅ Restarted — all routes active** |

### Browser-Level Testing Summary (2026-05-25)
| Agent | Focus | Pass | Fail | Warn |
|:---:|-------|:---:|:---:|:---:|
| Agent 1 | Auth, CRUD, Reports, Export | 37 | 0 | 15 |
| Agent 2 | Timetable Engine, Generation | 14 | 1 | 4 |
| Agent 3 | UI/UX, Responsive, Source | 2 | 0 | 0 |
| Agent 4 | Multi-tenant, Integration | 3 | 0 | 3 |
| **Total** | | **56** | **1** | **22** |


---

## 2. CRITICAL BLOCKERS (Severity: 🔴 P0)

### 2.1 — No Role/Permission Management Page
**Requirement:** §2, §28 — "Manage roles", "Manage roles", "Role and Permission Management" page
**Status:** ❌ **NOT IMPLEMENTED**
**Impact:** School admins cannot create custom roles, assign granular permissions, or manage role hierarchies. The Role model itself doesn't even exist — roles are hardcoded strings.
**Missing Models:** `Role`, `Permission` (§33 requirement)
**Affected Users:** All school admins, principals

### 2.2 — No School/Session Selector After Login
**Requirement:** §3 — "If user has multiple schools, show school selector → User selects academic session"
**Status:** ⚠️ **PARTIALLY IMPLEMENTED** — `SchoolSessionSelector.jsx` exists but is NOT wired into the login flow automatically. No session selector visible in header/dashboard.
**Impact:** Multi-school users cannot switch schools after login without knowing the URL. Header has no school/session indicator or switcher.

### 2.3 — No Timetable Quality Score
**Requirement:** §23 — "Timetable Score: 92% / Hard Conflicts: 0 / Soft Warnings: 8"
**Status:** ❌ **NOT IMPLEMENTED in UI**
**Backend:** Engine calculates `calculateTimetableScore()` but Generator page does NOT display it.
**Impact:** Admins have no quality feedback after generation.

### 2.4 — No PDF Export
**Requirement:** §27 — "Export formats: PDF, Excel, Print view"
**Status:** ❌ **NOT IMPLEMENTED** — `jspdf` and `jspdf-autotable` are in package.json but NO controller uses them. Only Excel export exists (3 endpoints).
**Impact:** Schools cannot generate professional PDF timetables for distribution.

### 2.5 — No Background Job System for Generation
**Requirement:** §34 — "Background jobs for generation → Generation status API → Frontend shows progress"
**Status:** ❌ **NOT IMPLEMENTED** — Generation runs synchronously in the request handler. Large schools with 40+ teachers will timeout.
**Impact:** Production-blocking for real schools with >500 lesson blocks.

### 2.6 — Missing 8 Database Models from §33
**Requirement:** §33 lists 37 models. Currently 29 exist.
**Missing:**
| Model | Purpose | Impact |
|-------|---------|--------|
| `Role` | Dynamic role definitions | Cannot create custom roles |
| `Permission` | Granular permission objects | Hardcoded permission strings |
| `UserSchoolMembership` | Separate join table | Embedded in User.schools array (works but not queryable) |
| `WorkingDay` | Day-specific configurations | Hardcoded DAYS array |
| `ClassLevel` | Nursery/LKG/UKG/1-12 mapping | Merged into Class model grade field |
| `Section` | Standalone sections | Embedded in Class model |
| `Stream` | Standalone stream config | Enum in Class model |
| `StudentGroup` | Parallel group definitions | String field in LessonBlock |

### 2.7 — No Permission-Based UI Visibility on 23 of 25 Pages
**Requirement:** §3 — "Permission-based UI visibility", §28 — "A teacher should not see admin-only pages"
**Status:** ❌ **MOSTLY MISSING**
**Implemented:** Dashboard (cards gated), PlatformAdmin (isPlatformUser check)
**Not implemented:** Teachers, Classes, Subjects, Rooms, Settings, Users, Reports, Generator, etc. — all accessible by any authenticated user regardless of role.
**Impact:** A `viewer` role user can access User Management, Generator, and all admin pages.

### 2.8 — Combined Class Lesson Blocks Not Properly Generated
**Requirement:** §15 — "English → 11 Science + 11 Commerce + 11 Humanities"
**Status:** ⚠️ **PARTIAL** — `SubjectCombinationRule` model exists, engine has `_buildLessonRequirements()` that reads combination rules, but the generated blocks don't correctly link multiple classes into a single `combined_class` block with shared teacher/room/period.
**Impact:** Combined classes may get double-booked or not scheduled at all.

### 2.9 — Split Group / Parallel Lesson Blocks Not Functional
**Requirement:** §16 — "11 Science Bio Group → Biology while 11 Science Maths Group → Mathematics"
**Status:** ❌ **NOT FUNCTIONAL** — `StudentGroup` is just a string field. No UI to define student groups. Engine doesn't parallel-schedule split groups.
**Impact:** Senior class timetabling impossible for real schools.

### 2.10 — No Conflict Center with Suggested Fixes
**Requirement:** §25 — "Each conflict should show: Suggested fixes + Action button"
**Status:** ⚠️ **PARTIAL** — `ConflictCenter.jsx` shows basic conflict list but NO suggested fixes, NO action buttons, NO "Move to Room 102" type suggestions.
**Impact:** Admins see problems but cannot resolve them from the conflict center.

### 2.11 — No Substitution Priority Logic (7-Level)
**Requirement:** §14 — "1. Alternate teacher → 2. Free teacher same subject → 3. Same class teacher → ... → 7. Mark unresolved"
**Status:** ⚠️ **PARTIAL** — `absenceController.js` has `suggestSubstitutes` but only checks free teachers who can teach the subject. Missing levels 3-7 entirely.
**Impact:** Substitution suggestions are simplistic and miss valid options.

### 2.12 — No "Save with Reason" for Manual Edits
**Requirement:** §24 — "Save with reason"
**Status:** ❌ — Block edits save without requiring a reason. `editHistory` stores actions but `reason` field is never populated from the frontend.

### 2.13 — Teacher Capability vs. Assignment Not Separated in UI
**Requirement:** §11 — "What teacher CAN teach vs. What teacher IS teaching must be separate"
**Status:** ⚠️ — `CanTeach` model exists (capability), `SubjectRequirement` stores assignments. But the UI doesn't clearly separate these. Teachers page shows capabilities but not current assignments.

### 2.14 — No Incremental Re-optimization
**Requirement:** §34 — "Incremental re-optimization / Avoid full regeneration for small absence"
**Status:** ❌ — Any change requires full timetable regeneration. No partial re-optimization exists.

---

## 3. HIGH-PRIORITY GAPS (Severity: 🟠 P1)

### 3.1 — Setup Wizard Incomplete (§30)
**Required:** 21-step guided wizard
**Implemented:** ~6 steps (school, session, periods, teachers, subjects, classes)
**Missing steps:** Streams/groups, teacher capabilities, teacher assignments, weekly loads, rooms, special rules, combination rules, readiness review, generation, score review, publish, export

### 3.2 — Dashboard Missing Key Widgets (§31)
**Required:** Setup completion %, Timetable score, Pending issues, Recent activity, Audit summary, Quick actions (Mark absent, Replace teacher, Add combination rule)
**Implemented:** Stats cards + quick action links
**Missing:** Setup completion progress, timetable score, recent activity feed, audit summary, "Mark absent" and "Replace teacher" quick actions

### 3.3 — Sidebar Missing Required Behaviors (§29)
**Required:** Tooltip in collapsed state, Settings/user at bottom, icon-only collapsed state
**Status:** Sidebar collapses but no tooltips shown. Settings link is in the main list, not pinned to bottom.

### 3.4 — No Temporary Timing Changes (§6)
**Required:** "Temporary timing changes / Permanent timing changes / Exam week structure / Special event day structure"
**Status:** Period structures are static. No support for temporary/date-based timing overrides.

### 3.5 — Subject Setup Missing Fields (§9)
**Required:** Priority, Preferred periods, Avoided periods, Preferred days, Avoided days, Preferred before/after lunch
**Status:** Subject model has `preferMorning` and `preferAfternoon` booleans. Missing: `priority`, `preferredPeriods[]`, `avoidedPeriods[]`, `preferredDays[]`, `avoidedDays[]`, `preferBeforeLunch`, `preferLastPeriods`

### 3.6 — Weekly Load Missing Fields (§10)
**Required:** Minimum periods, Maximum periods, Strict/Preferred/Flexible mode, Preferred/Avoided periods/days, Priority
**Status:** `SubjectRequirement` model has `periodsPerWeek` (fixed), `allowDoublePeriod`, `consecutivePreference`. Missing: `minPeriods`, `maxPeriods`, `mode` (strict/preferred/flexible), preference arrays, priority

### 3.7 — Teacher Replacement Flow Incomplete (§13)
**Required:** 11-step replacement flow: Select old teacher → Show assignments → Select to move → Suggest → Check capability → Check workload → Check conflicts → Choose temp/perm → Choose date → Preview → Apply
**Status:** `TeacherReplacements.jsx` exists but is a basic CRUD form. No guided wizard, no conflict preview, no timetable impact preview.

### 3.8 — Absence Flow Missing "Selected Periods" and "Weekly Absence" (§14)
**Required:** "Full day / Selected periods / Date range / Temporary absence / Weekly absence"
**Status:** Only full_day, partial, multi_day supported. No weekly recurring absence. Partial absence doesn't specify which periods.

### 3.9 — No Reserved Period Management UI (§18)
**Required:** "Admin should create reserved periods — Saturday last two periods activity / Friday last period club"
**Status:** `ReservedPeriodRule` model exists. Route exists in `rules.js`. But there's NO dedicated UI page for reserved period management.

### 3.10 — Rule Engine Not Testable (§19)
**Required:** "Custom rules should be testable before activation"
**Status:** `CustomRules.jsx` allows creating rules but no "Test Rule" or "Dry Run" feature exists.

### 3.11 — Class Teacher First-Period Rule Missing Dashboard (§12)
**Required:** "Dashboard should show coverage: 6A: 5/6 days, 7A: 4/6 days"
**Status:** `classTeacher` field exists on Class model. Engine has class-teacher-first-period scoring. But NO coverage dashboard widget exists.

### 3.12 — No Audit Log Filtering by Class/Teacher/Room/Period (§26)
**Required:** Filter by "Class / Teacher / Room / Action type / Source / Affected period"
**Status:** `AuditLogs.jsx` filters by date range and search text only. Missing: entity-type filter, class/teacher/room dropdowns, action-type selector.

### 3.13 — Reports Missing 5 of 12 Report Types (§27)
**Required:** 12 report types
**Implemented:** Class-wise, Teacher-wise, Room-wise, Day-wise, Substitution, Teacher workload, Conflict
**Missing:** Subject completion report, Class teacher first-period report, Room usage report, Audit log report, Published timetable history

### 3.14 — No Print Scaling / Paper-Size Fitting (§27, §29)
**Required:** Print view with proper scaling
**Status:** Reports page has `handlePrint()` using `window.print()` with CSS classes. No actual A3/A4 scaling CSS. Print preview not responsive.

### 3.15 — No School-Level Data in Header
**Required:** §31 — "Current school / Current session" visible on dashboard
**Status:** Header shows page title and theme toggle. No school name, no session indicator, no school-switcher dropdown.

### 3.16 — Export Routes Missing PDF and CSV Formats
**Required:** §27 — "PDF, Excel, Print view"
**Status:** Only 3 Excel export routes exist (`/export/timetable/excel`, `/export/substitutions/excel`, `/export/workload/excel`). No PDF endpoints. No CSV server-side endpoints (CSV is client-side only).

### 3.17 — Absence Adjustment Doesn't Preserve Master Timetable (§14)
**Required:** "Temporary absence must not overwrite the master timetable"
**Status:** `DailyAdjustment` model exists but substitutions directly modify or create new `LessonBlock` entries. No clear separation between master timetable and daily adjustments.

### 3.18 — No Room Capacity Validation During Generation (§17, §20)
**Required:** "Room capacity should be checked" (hard constraint)
**Status:** Engine assigns rooms but does NOT validate `room.capacity >= classStudentCount`. The Class model has `studentCount` but it's never compared against `Room.capacity`.

### 3.19 — No Subject Combination Strictness Options (§15)
**Required:** "Must combine / Try to combine / Combine only if possible"
**Status:** `SubjectCombinationRule` model has `strictness: enum ['required', 'preferred', 'flexible']` ✅ but engine treats all combination rules identically — no differentiation in scheduling logic.

### 3.20 — Missing Conflict Categories (§25)
**Required:** 14 conflict categories including "Room capacity issue / Missing teacher / Teacher overload / Broken combined block / Invalid split group / Permission issue"
**Status:** `ConflictLog` model has basic types. Engine only detects teacher-double-booking and room conflicts. Missing: capacity violations, workload overloads, broken combined blocks.

### 3.21 — No Refresh Token Rotation
**Required:** §3 — "Refresh token support"
**Status:** `auth.js` has a `/refresh` endpoint but `User` model doesn't have a `refreshToken` field in the schema. The route references `user.refreshToken` which is undefined. **This endpoint is non-functional.**

### 3.22 — No Device/IP Logging in Audit (§26)
**Required:** "IP/device if available"
**Status:** `AuditLog` model has no `ip` or `device` field. Audit middleware doesn't capture request IP.

---

## 4. MEDIUM-PRIORITY GAPS (Severity: 🟡 P2)

### 4.1 — No Dedicated Streams/Groups Management Page
Student groups and streams are embedded in Class model as enum/string values. No dedicated UI for creating/managing streams and groups across grades.

### 4.2 — No Teacher Preferred/Avoided Periods in UI
Teacher model has `unavailableSlots` but no `preferredSlots` or `preferredDays`. The UI doesn't expose unavailable period editing either.

### 4.3 — No "Re-optimize Remaining Timetable" After Manual Edit (§24)
After manual edits, there's no button to re-optimize unfixed blocks around locked blocks.

### 4.4 — No Undo/Redo in Frontend Timetable Editor
Backend has undo/redo stack in `timetableEditor.js`, but frontend TimetableView has no Undo/Redo buttons.

### 4.5 — No Timetable Snapshots / Versioning
Requirement §22 says "Save timetable snapshot". No snapshot/versioning system exists. Regeneration overwrites previous data.

### 4.6 — Mobile Layout Issues
Mobile layout includes Header now (fixed), but timetable grid requires horizontal scroll which is not touch-optimized. Cards are not stacked on mobile dashboard. Touch-friendly button sizing not verified.

### 4.7 — No Notification System for Substitutions
`Notification` model exists but no real-time notification delivery. No push, no email, no in-app badge.

### 4.8 — No `.env.example` File (§35)
`.env` exists with actual secrets. No `.env.example` template for new developers.

### 4.9 — Light Theme Color Inconsistencies
Several components still use `dark:text-dark-50` without corresponding light-mode text color. Active tab buttons use `text-slate-900 dark:text-dark-50` instead of `text-white` on colored backgrounds.

### 4.10 — No Search Highlighting in Global Search
Search returns results but doesn't highlight matching text in results.

### 4.11 — Subject Category Mismatch (§9 vs. Model)
Requirements list: Academic, Language, Activity, Lab, Sports, Optional, Club, Library, Moral Science, Computer, Practical
Model has: theory, practical, lab, activity, library, games, moral_science, club, other
Missing: language, computer, sports as distinct types

### 4.12 — Room Types Mismatch (§17 vs. Model)
Requirements list 12 room types. Model has: classroom, lab, hall, special, playground, library
Missing: Computer Lab, Science Lab, Physics Lab, Chemistry Lab, Bio Lab, Dance Room, Music Room, Smart Class

### 4.13 — No "Force Override" in Manual Editing (§24)
Required: "Force override if allowed" with explicit warning
Status: Edits either succeed or fail. No force-override toggle.

### 4.14 — No Date-Based Replacement (§13)
Required: "Date-Based Replacement / Effective from / Effective to"
`TeacherReplacement` model has these fields but UI doesn't expose date-range filtering.

### 4.15 — Audit Log Missing Event Types (§26)
Required 29 event types. Current `AuditLog` stores free-text `action` strings. Missing structured categories: logout, failed_login, session_switch, permission_update, period_timing_changed, break_changed, etc.

### 4.16 — Soft Constraints Partially Implemented (§21)
12 soft constraints listed. Engine implements 7 scoring factors. Missing: "Avoid unnecessary room changes", "Balance teacher free periods", "Prefer activity periods on configured days".

### 4.17 — No Workload Balancing Visualization
Required by §21, §31. No chart/graph showing teacher workload distribution.

### 4.18 — TimetableSlot Model May Be Vestigial
`TimetableSlot.js` exists but is not referenced by any controller or route. Appears to be an older model superseded by `LessonBlock`.

---

## 5. ARCHITECTURE & SECURITY NOTES

### 5.1 — Strengths ✅
- All routes now have `authorize()` middleware with proper permission strings
- Tenant isolation via `scopeToSchool` middleware on all `/api` routes
- Platform hierarchy with `platformOnly` middleware
- Rate limiting on auth and API routes
- Helmet security headers
- Input validation middleware (express-validator) on 12 route files
- dnd-kit integration replaces fragile HTML5 DnD
- Proper error handler middleware

### 5.2 — Remaining Risks ⚠️
- **No CSRF protection** for cookie-based sessions (currently JWT in headers, so lower risk)
- **No request size limiting per route** (global 10mb limit too generous)
- **No MongoDB connection pooling configuration** (using mongoose defaults)
- **No health check endpoint** for load balancers
- **Synchronous timetable generation** will timeout for large schools
- **No database migrations** — schema changes require manual intervention
- **User.refreshToken field doesn't exist** — refresh endpoint will crash

---

## 6. FRONTEND / UX GAPS

### 6.1 — Missing Pages (vs. §28)
| Required Page | Status |
|---------------|--------|
| Login | ✅ |
| Forgot Password | ✅ |
| School Selector | ⚠️ Exists but not auto-shown |
| Session Selector | ❌ Combined with School Selector |
| Dashboard | ✅ |
| Setup Wizard | ⚠️ Partial (6 of 21 steps) |
| Period/Break Customization | ✅ |
| Classes and Subjects | ✅ (separate pages) |
| Teacher Management | ✅ |
| Subject Weekly Load | ✅ |
| Room Management | ✅ |
| Rules and Preferences | ✅ |
| Subject Combination Builder | ✅ |
| Generate Timetable | ✅ |
| Timetable Editor | ✅ |
| Teacher Replacement | ✅ |
| Absence Adjustment | ✅ |
| Conflict Center | ⚠️ Basic (no suggested fixes) |
| Audit Logs | ✅ |
| Reports | ⚠️ Missing 5 report types |
| Settings | ✅ |
| User Management | ✅ |
| **Role/Permission Management** | ❌ **MISSING** |

### 6.2 — Component Library Status
| Component | Quality |
|-----------|---------|
| PermissionGate | ✅ Good |
| ConfirmDialog | ✅ Good |
| EmptyState | ✅ Good |
| LoadingSpinner | ✅ Good |
| Modal | ✅ Good |
| Toast system | ✅ Good |
| Data tables | ⚠️ No reusable table component |
| Pagination | ❌ Not implemented anywhere |
| Form validation UI | ❌ No inline error display |

### 6.3 — Responsive Breakpoint Status
| Breakpoint | Status |
|:---:|--------|
| 1440px | ✅ Works |
| 1280px | ✅ Works |
| 1024px | ⚠️ Some overflow on timetable grid |
| 768px | ⚠️ Sidebar collapse works, tables overflow |
| 430px | ⚠️ Cards stack but timetable needs scroll |
| 390px | ❌ Not properly tested |

---

## 7. AGENT-SPECIFIC FINDINGS

### Agent 2 — Backend Findings
1. `User.refreshToken` field is missing from schema — `/api/auth/refresh` endpoint will throw
2. `TimetableSlot` model is unused — candidate for removal
3. No compound indexes on `SubjectCombinationRule`, `ReservedPeriodRule`, `CustomRule`, `GeneratedTimetable` — performance risk at scale
4. `SubjectRequirement.periodsPerWeek` should support min/max range per §10
5. Engine `_violatesCustomRules()` only checks `avoid_day` and `teacher_day_off` — 7 other rule types not handled
6. No transaction support for multi-document operations (swap, reassign)
7. Export routes only cover Excel — no PDF generation despite `jspdf` being installed

### Agent 3 — Frontend/UX Findings
1. Dark mode toast text uses class-based override but Toaster styles are inline — may conflict
2. Print CSS in `index.css` is minimal — no @media print rules for timetable grid
3. No keyboard shortcuts for common actions (Ctrl+Z undo, Ctrl+S save)
4. Generator page doesn't show generation progress or scoring
5. No form validation error display — errors only shown as toast
6. Settings page has theme toggle but no school-level settings (working days, naming convention)
7. Several pages use `window.confirm()` instead of `ConfirmDialog`

### Agent 4 — Integration/QA Findings
1. `POST /api/auth/register` with short password (2 chars) succeeds — validator runs but inline check `if (!name || !email || !password)` catches some cases while validator catches others, creating inconsistent behavior
2. Seeded platform user login depends on seed data being run — no auto-seed on first boot
3. No end-to-end workflow test from setup → generation → editing → publishing → export
4. Platform audit log endpoint returns empty because cross-school query lacks proper aggregation
5. Absence → Substitution → Timetable flow is disconnected — substitution doesn't update LessonBlock

---

## 8. RECOMMENDED PRIORITY ORDER

### Sprint 1 — Security & Data Integrity (Week 1)
1. Add `refreshToken` field to User model
2. Complete input validation on remaining 8 route files
3. Add permission gating to all frontend pages
4. Fix school/session selector in login flow and header

### Sprint 2 — Core Engine & Data (Week 2)
5. Implement combined-class and split-group generation properly
6. Add PDF export using jspdf-autotable
7. Add background job system (BullMQ or simple queue)
8. Implement timetable score display in Generator and Dashboard

### Sprint 3 — Workflows & UX (Week 3)
9. Build Role/Permission Management page
10. Complete Setup Wizard (21 steps)
11. Add conflict center suggested fixes
12. Complete 7-level substitution priority logic
13. Add remaining 5 report types

### Sprint 4 — Polish & Scale (Week 4)
14. Add remaining missing model fields (Subject preferences, WorkingDay)
15. Implement timetable snapshots/versioning
16. Add notification delivery system
17. Complete responsive testing at all breakpoints
18. Create .env.example, health check, and deployment docs

---

## 9. BROWSER-LEVEL TESTING FINDINGS (2026-05-25)

> **Test Method:** Automated API validation suite (79 test cases) + source code analysis + runtime server verification
> **Server State:** Backend restarted to load latest route changes — stale server process was running since May 22 while code was modified on May 23

### 9.1 — Fixes Applied During Browser Testing

| # | Issue | Fix | Verified |
|:---:|-------|-----|:---:|
| 1 | **Excel export crash** — `Worksheet name already exists: 9-A` on duplicate class names | Added `Set()` tracking of used worksheet names with numeric suffix dedup in [`export.js`](file:///Users/ananyagoel/Downloads/timetable%203/server/routes/export.js) | ✅ 200 + 31KB file |
| 2 | **Platform routes unreachable** — All `/api/platform/*` returning 404 for all users | Server restart — process was started on May 22, routes modified May 23 | ✅ Stats/schools/audit now accessible |
| 3 | **Platform isolation untested** — `platformOnly` middleware never validated | Verified: admin → `403 Platform-level access required`, dev → `200` with data | ✅ |

### 9.2 — Critical Runtime Finding: 36 Class Double-Booking Conflicts

**Impact:** ❌ **CRITICAL** — The existing timetable has **36 class double-booking conflicts** where a single class is scheduled for two different lessons in the same period/day slot.
**Root Cause:** The `combined_class` block type creates separate entries for each class in a combination but shares the same day/period, which the conflict checker correctly flags as a collision.
**Action Required:** Engine must either merge combined-class assignments into a single multi-class block OR the conflict checker must whitelist combined-class blocks from the double-booking check.

### 9.3 — Report Route Mismatches

The frontend and test suite call report endpoints that differ from the actual backend routes:

| Called By Frontend/Tests | Actual Backend Route | Status |
|--------------------------|---------------------|:---:|
| `/reports/class-timetable` | `/reports/class-weekly/:classId` | ❌ 404 |
| `/reports/teacher-timetable` | `/reports/teacher-weekly/:teacherId` | ❌ 404 |
| `/reports/substitution-report` | `/reports/replacement-report` | ❌ 404 |
| `/reports/conflict-report` | (Not implemented) | ❌ 404 |
| `/reports/room-utilization` | `/reports/room-utilization?timetableId=...` | ⚠️ 400 (needs param) |
| `/reports/teacher-workload` | `/reports/teacher-workload?timetableId=...` | ⚠️ 400 (needs param) |
| `/reports/day-wise` | `/reports/day-wise?timetableId=...&day=Monday` | ⚠️ 400 (needs params) |

**Impact:** All report routes work correctly when called with the right path and parameters, but the frontend likely has mismatched API calls.

### 9.4 — Missing API Endpoints

| Endpoint | §Ref | Status |
|----------|:---:|:---:|
| `/api/rules/soft-preferences` | §21 | ❌ 404 — No route exists |
| `/api/setup/status` | §30 | ❌ No endpoint |
| `/api/diagnostics/health` | §35 | ⚠️ Returns `{}` (empty), separate `/api/health` exists but is public |
| `/api/absences/suggest-substitutes` | §14 | ⚠️ 400 — Requires valid teacher+date params |

### 9.5 — Schema Field Gaps Confirmed at Runtime

Verified by inspecting actual API responses:

| Model | §Ref | Missing Fields |
|-------|:---:|----------------|
| Teacher | §11 | `employeeId`, `phone` |
| Class | §8 | `stream`, `classTeacher` (not assigned), `studentCount` |
| Subject | §9 | `priority`, `preferredPeriods`, `avoidedPeriods`, `preferredDays` |
| SubjectRequirement | §10 | `minPeriods`, `maxPeriods`, `mode` |
| AuditLog | §26 | `ip`, `device` |
| LessonBlock | §5 | Types used: `normal`, `reserved`, `combined_class` only. Missing: `split_group`, `double_period`, `lab`, `activity`, `club`, `substitution`, `locked_manual`, `free` |

### 9.6 — Frontend Source Analysis

| Metric | Value | Issue |
|--------|:---:|-------|
| Responsive breakpoints in CSS | 1 (`768px`) | Only 1 of 6 required breakpoints |
| Pages with PermissionGate | 3/25 | 22 pages accessible by any role |
| Pages using `window.confirm()` | 5 | Should use `ConfirmDialog` component |
| Print CSS rules | 1 block | Minimal — no timetable grid print layout |
| Dark mode coverage | ✅ Good | All pages use `dark:` classes |
| Sidebar role gating | ✅ Good | 4-tier role visibility implemented |
| DnD implementation | ✅ Good | `@dnd-kit/core` with sensors + overlay |
| Modal usage across pages | 15 pages | Well-implemented modal pattern |

### 9.7 — Engine Quality Assessment

| Metric | Value | Assessment |
|--------|:---:|-----------|
| Hard score | 0 | ✅ No hard constraint violations |
| Soft score | 91/100 | ✅ Good |
| Subject distribution | 100% | ✅ Perfect |
| Teacher workload balance | 73% | ⚠️ Room for improvement |
| Timing preferences | 100% | ✅ Perfect |
| Class teacher first period | 63% | ⚠️ Below target (§12 coverage) |
| Completeness | 100% | ✅ All blocks scheduled |
| Consecutive quality | 100% | ✅ No broken consecutive pairs |
| Soft preferences | 100% | ✅ Perfect |
| Teacher min/max workload | 2–20 periods | ⚠️ 10x range (imbalance) |

