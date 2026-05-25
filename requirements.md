Below is the **complete master requirement list** for the **Advanced Automated School Timetable Manager** we planned.

You can use this as your **SRS / PRD checklist** for development.

---

# 1. Product Vision

The system will be an **Advanced Automated School Timetable System** for a School ERP platform.

It should not be a simple timetable maker.

It must support:

```text
Multi-school login
Multi-user access
Role-based permissions
Automated timetable generation
Custom period and break setup
Class-wise subject load customization
Teacher capability and assignment management
Teacher replacement
Teacher absence adjustment
Subject combination rules
Room/resource allocation
Manual timetable editing
Conflict detection
Audit logs
Reports
Mobile-responsive admin dashboard
Future custom rule engine
```

The system should help a school admin generate a full timetable with minimum human effort, but still allow manual editing after generation.

---

# 2. User Types / Roles

The system must support multiple users and multiple schools.

## Platform-Level Users

```text
Platform Owner
Platform Support
Developer / System Admin
```

## School-Level Users

```text
School Owner
School Admin
Principal
Timetable Manager
Teacher
Office Staff
Viewer
Custom Role
```

## Role-Based Permissions

Each role should have permissions such as:

```text
View timetable
Generate timetable
Edit timetable
Manage school setup
Manage teachers
Manage classes
Manage subjects
Manage rooms
Manage rules
Approve substitutions
Publish timetable
View audit logs
Export reports
Manage users
Manage roles
Manage school settings
```

A teacher should not see admin-only pages unless permission is given.

A viewer should only view timetable and reports.

---

# 3. Multi-School Login Requirement

The system must support:

```text
User login
Logout
Forgot password
Password reset
Secure password hashing
JWT / token authentication
Refresh token support
Protected routes
Multi-school membership
School selector after login
Academic session selector
School-wise data isolation
Session-wise data isolation
Permission-based UI visibility
```

Example flow:

```text
User logs in
↓
System checks user schools
↓
If user has multiple schools, show school selector
↓
User selects school
↓
User selects academic session
↓
Dashboard loads only selected school/session data
```

One school’s data must never be visible to another school.

---

# 4. Main Timetable Concept

The timetable should not be stored as only:

```text
Class + Subject + Teacher + Period
```

Instead, the system should use:

```text
Lesson Blocks
```

A lesson block can contain:

```text
One class
Multiple classes
One section
Multiple sections
One stream
Multiple streams
One student group
Parallel student groups
One teacher
Substitute teacher options
One room
One required resource
One period
Multiple continuous periods
```

This allows real-school timetable scenarios.

---

# 5. Lesson Block Types

The system must support these lesson block types:

```text
Normal Lesson
Double Period Lesson
Lab Lesson
Activity Block
Club Block
Reserved Period
Combined Class Lesson
Senior Common Subject Lesson
Parallel Split Group Lesson
Substitution Lesson
Locked Manual Lesson
```

Example:

```text
Normal Lesson:
6A Maths by Mr. Sharma in Room 101

Combined Lesson:
11 Science + 11 Commerce + 11 Humanities English together

Split Lesson:
11 Science Bio group gets Biology while Maths group gets Mathematics

Reserved Block:
Saturday last two periods activity

Substitution:
Absent teacher’s period assigned to alternate teacher
```

---

# 6. School Setup Requirements

Admin should configure:

```text
School name
Academic session
Working days
Weekly pattern
Custom day timings
Period count
Period duration
Start time
End time
Fruit break
Lunch break
Assembly
Short breaks
Saturday special timing
Reserved slots
Activity slots
Club slots
Exam slots
Temporary timing changes
Permanent timing changes
```

Important rule:

```text
The system must not be hardcoded to 8 periods.
```

The school should be able to create:

```text
6-period day
7-period day
8-period day
9-period day
Different Saturday structure
Special event day structure
Exam week structure
```

---

# 7. Period and Break Customization

The period system must be fully customizable.

Admin should define:

```text
Period name
Period number
Start time
End time
Duration
Slot type
Break name
Break duration
Break position
Lunch timing
Assembly timing
Applicable days
Applicable classes
Temporary/permanent status
```

Slot types:

```text
Teaching
Fruit Break
Lunch
Assembly
Activity
Club
Exam
Sports
Reserved
Blocked
```

Example:

```text
Monday to Friday:
P1, P2, Fruit Break, P3, P4, Lunch, P5, P6, P7, P8

Saturday:
P1, P2, Fruit Break, P3, P4, Activity, Activity
```

---

# 8. Class, Section, Stream and Group Setup

The system must support K-12 structure.

## Class Setup

```text
Nursery
LKG
UKG
Class 1 to Class 12
```

## Section Setup

```text
A
B
C
D
Custom sections
```

## Senior Streams

```text
Science
Commerce
Humanities
Arts
Vocational
Custom streams
```

## Student Groups

```text
Bio Group
Maths Group
Computer Group
Hindi Group
Physical Education Group
Optional Subject Groups
```

Important:

```text
Class 11 and 12 logic must not be hardcoded.
```

The same stream/group logic should work for any class if required.

---

# 9. Subject Setup Requirements

Subjects should support different categories:

```text
Academic
Language
Activity
Lab
Sports
Optional
Club
Library
Moral Science
Computer
Practical
```

Each subject should support:

```text
Subject name
Subject code
Subject type
Priority
Preferred periods
Avoided periods
Preferred days
Avoided days
Room requirement
Lab requirement
Can be combined
Can be double period
Max per day
Preferred before lunch
Preferred after lunch
Prefer last periods
```

Examples:

```text
Maths → prefer morning
Science → prefer before lunch
Games → prefer last periods
Dance → prefer last periods
Computer → requires computer lab
Biology → requires bio lab
Library → can be flexible
```

---

# 10. Class-Wise Weekly Subject Load

For every class, section, stream, or group, every subject must have customizable weekly load.

Admin should define:

```text
Subject
Class/section/stream/group
Weekly required periods
Minimum periods
Maximum periods
Maximum per day
Strict or flexible mode
Preferred periods
Avoided periods
Preferred days
Avoided days
Double-period requirement
Lab requirement
Room requirement
Priority
Teacher assigned
```

Example:

```text
Class 6A:
English: 6/week
Hindi: 5/week
Maths: 7/week
Science: 6/week
Computer: 2/week
Games: 2/week
Dance: 1/week
Library: 1/week
```

Important:

```text
Weekly subject load should not always be strict.
```

Admin should choose:

```text
Strict
Preferred
Flexible
```

---

# 11. Teacher Management Requirements

Teacher profile must separate:

```text
What teacher can teach
What teacher is currently teaching
```

## Teacher Capability

This means what the teacher is capable of teaching.

```text
Can teach subjects
Can teach classes
Can teach streams
Can teach groups
Can manage labs
Can take activities
Available days
Unavailable periods
Preferred periods
Max periods per day
Max periods per week
Max continuous periods
Min free periods per day
```

## Teacher Assignment

This means what the teacher is currently assigned to teach.

```text
Teacher
Subject
Class
Section
Stream
Group
Weekly periods
Primary teacher
Alternate teacher
Temporary/permanent assignment
Effective from
Effective to
```

This separation is required for:

```text
Teacher replacement
Teacher absence
Substitution suggestion
Workload balancing
Re-optimization
```

---

# 12. Class Teacher Rule

The system must support:

```text
Class teacher should preferably attend first period of their own class.
```

This rule should be configurable:

```text
Strict
Preferred
Flexible
Disabled
```

Dashboard should show coverage:

```text
6A: 5/6 days
7A: 4/6 days
8A: 6/6 days
10A: 3/6 days
```

---

# 13. Teacher Replacement Requirements

The system must support teacher replacement when:

```text
Teacher leaves mid-session
New teacher joins
Subject is reassigned
Some classes move to another teacher
Workload is divided among multiple teachers
Temporary replacement is needed
Permanent replacement is needed
```

Replacement types:

```text
Full Replacement
Partial Replacement
Subject-Wise Replacement
Class-Wise Replacement
Temporary Replacement
Permanent Replacement
Mid-Session Replacement
Date-Based Replacement
```

## Replacement Flow

```text
Select old teacher
↓
Show all assigned classes/subjects
↓
Select assignments to move
↓
System suggests suitable teachers
↓
Select new teacher(s)
↓
Check capability
↓
Check workload
↓
Check timetable conflicts
↓
Choose temporary/permanent
↓
Choose effective date
↓
Preview affected timetable
↓
Apply and re-optimize
```

## Suggestion Logic

System should suggest teachers based on:

```text
Can teach subject
Can teach class/stream/group
Available in required periods
Current workload
Max workload limit
Same subject experience
Conflict-free slots
Substitution priority
```

---

# 14. Teacher Absence and Substitution

The system must support absence for:

```text
Full day
Selected periods
Date range
Temporary absence
Weekly absence
```

## Absence Adjustment Flow

```text
Select absent teacher
↓
Select date/date range
↓
System finds affected periods
↓
System suggests substitutes
↓
Admin reviews suggestions
↓
Admin approves/edits
↓
Daily adjustment is published
```

## Substitution Priority

```text
1. Alternate teacher for same subject
2. Free teacher who can teach same subject
3. Same class subject teacher
4. Valid period swap
5. Move activity/library/games period
6. Supervised study
7. Mark unresolved for admin approval
```

Temporary absence must not overwrite the master timetable.

---

# 15. Universal Subject Combination Rule

The system must allow any subject to be combined for any selected classes, sections, streams, or groups.

This must not be limited to Class 11 or 12.

Examples:

```text
English → 11 Science + 11 Commerce + 11 Humanities
English → 12 Science + 12 Commerce + 12 Humanities
Dance → 1A + 3A + 7A + 8A + 9A
Games → 6A + 6B + 7A + 7B
Computer → 11 Science + 12 Science
Library → 4A + 4B
Moral Science → 9A + 9B + 10A
```

## Rule Fields

```text
Rule name
Subject
Selected classes
Selected sections
Selected streams
Selected groups
Teacher
Room
Weekly periods
Single/double period
Preferred days
Preferred periods
Avoided periods
Strictness
Temporary/permanent
Effective from
Effective to
Priority
Active/inactive
```

## Strictness Options

```text
Must combine
Try to combine
Combine only if possible
```

The engine should treat this as one lesson block:

```text
One teacher booking
One room booking
Multiple classes/groups busy
Subject period counted for all selected groups
```

---

# 16. Senior Stream and Split Group Logic

The system must support senior class structure.

Example:

```text
Class 11
- Science
- Commerce
- Humanities
```

Common subjects:

```text
English
Computer
Physical Education
```

Stream-specific subjects:

```text
Science → Physics, Chemistry
Commerce → Accountancy, Business Studies
Humanities → History, Political Science
```

Split groups:

```text
Science Bio Group → Biology
Science Maths Group → Mathematics
```

Example parallel period:

```text
Monday Period 5:
11 Science Bio Group → Biology
11 Science Maths Group → Mathematics
```

This is valid because student groups are different.

---

# 17. Room and Resource Management

The system must support:

```text
Normal Classroom
Computer Lab
Science Lab
Physics Lab
Chemistry Lab
Bio Lab
Library
Dance Room
Music Room
Activity Hall
Playground
Seminar Hall
Smart Class
Custom Room
```

Room fields:

```text
Room name
Room type
Capacity
Allowed subjects
Allowed classes
Unavailable slots
Active/inactive
```

Room rules:

```text
One room cannot host two unrelated lessons at same time.
Combined class block can use one room.
Room capacity should be checked.
Required room type should match.
Room unavailable slots should be respected.
```

---

# 18. Reserved Periods and Activities

Admin should be able to create reserved periods.

Examples:

```text
Saturday last two periods activity
Friday last period club
Monday first period assembly
Wednesday P6-P7 rehearsal
Exam practice week
Annual function practice week
```

Reserved rule fields:

```text
Name
Scope
Applicable classes
Applicable days
Applicable date
Periods
Type
Temporary/permanent
Effective from
Effective to
Locked/unlocked
```

Reserved types:

```text
Assembly
Activity
Club
Sports
Exam
Rehearsal
Event
Blocked
```

---

# 19. Rule Engine Requirements

The timetable should have a future-ready rule engine.

Rule layers:

```text
System Default Rules
School Configurable Rules
Developer Custom Rules
```

Rule types:

```text
Hard Rule
Soft Rule
Preference Rule
Warning Rule
Custom Rule
```

Rule fields:

```text
Rule code
Rule name
Rule type
Priority
Weight
Active/inactive
Applies to classes
Applies to sections
Applies to streams
Applies to groups
Applies to subjects
Applies to teachers
Applies to rooms
Applies to days
Applies to periods
Config JSON
Version
Created by
Updated by
```

Custom rules should be testable before activation.

Example custom rule:

```text
Class 10 Maths must be before lunch at least 4 days per week.
```

---

# 20. Hard Constraints

These must not break unless allowed by combined/split block logic.

```text
Teacher cannot teach two unrelated lessons at same time.
Class/group cannot attend two unrelated lessons at same time.
Room cannot host two unrelated lessons at same time.
Break/lunch cannot contain normal subject.
Teacher cannot teach outside capability.
Required room/resource must be available.
Locked periods cannot be changed.
Teacher unavailable slots must be respected.
Room unavailable slots must be respected.
Period structure must be followed.
School/session data must be isolated.
User cannot access unauthorized school.
Combined classes must share same subject, teacher, room, and period.
```

Special allowed cases:

```text
Teacher can teach multiple classes only in same combined lesson block.
Room can host multiple classes only in same combined lesson block.
Class can split only when student groups are different.
```

---

# 21. Soft Constraints

These improve timetable quality score.

```text
Class teacher should attend first period.
Games/dance/sports should be later.
Maths/science should be before lunch.
Avoid same subject too many times in one day.
Avoid too many continuous periods for teacher.
Balance teacher workload.
Balance subject distribution across week.
Avoid unnecessary room changes.
Balance teacher free periods.
Prefer activity periods on configured days.
Prefer senior common subjects combined.
Avoid heavy subjects after lunch.
```

---

# 22. Timetable Generation Flow

```text
Load selected school and session
↓
Load period structure and breaks
↓
Load classes, sections, streams, groups
↓
Load subjects and weekly loads
↓
Load teachers, capabilities, assignments
↓
Load rooms and resources
↓
Load reserved periods
↓
Load subject combination rules
↓
Convert requirements into lesson blocks
↓
Apply locked/manual blocks
↓
Apply hard constraints
↓
Apply custom hard rules
↓
Assign blocks to timeslots
↓
Assign rooms/resources
↓
Optimize with soft rules
↓
Calculate timetable score
↓
Generate conflict report
↓
Save timetable snapshot
↓
Admin reviews
↓
Manual edit if needed
↓
Publish timetable
```

---

# 23. Timetable Score

The system should show timetable quality.

Score factors:

```text
Hard conflicts
Soft warnings
Unassigned periods
Teacher workload balance
Room allocation quality
Class teacher first-period coverage
Subject distribution balance
Preference satisfaction
```

Example dashboard:

```text
Timetable Score: 92%
Hard Conflicts: 0
Soft Warnings: 8
Unassigned Periods: 0
Teacher Workload: Balanced
```

---

# 24. Manual Timetable Editing

Admin should be able to:

```text
Drag and drop period
Move lesson
Swap lessons
Lock lesson
Unlock lesson
Edit teacher
Edit room
Edit subject
Re-optimize remaining timetable
Undo/redo
Save with reason
Force override if allowed
```

Before saving, system must validate:

```text
Teacher availability
Teacher capability
Class availability
Room availability
Room capacity
Subject weekly count
Teacher workload
Locked status
Combined block relation
Split group relation
Period structure
```

Feedback examples:

```text
Allowed: No conflicts found.
Warning: Games is being moved to first period.
Blocked: Mr. Sharma is already teaching Class 9B.
Blocked: Room 101 is already used.
```

---

# 25. Conflict Center

The system should show helpful issues, not technical errors.

Conflict categories:

```text
Teacher busy
Class busy
Room busy
Room capacity issue
Missing teacher
Teacher overload
Subject period shortage
Rule warning
Unassigned lesson
Unavailable teacher
Unavailable room
Broken combined block
Invalid split group
Permission issue
```

Each conflict should show:

```text
Problem title
Affected class
Affected teacher
Affected room
Affected period
Why this happened
Suggested fixes
Action button
```

Example:

```text
Room 101 is already used on Monday Period 3.

Suggested fixes:
- Move Class 8A Science to Room 102
- Move Class 9A Maths to Period 5
- Select another room manually
```

---

# 26. Audit Logs / Change Logs

Every important action must be logged.

Log events:

```text
Login
Logout
Failed login
School switch
Session switch
Role update
Permission update
User created
Teacher created/updated
Class updated
Subject load changed
Period timing changed
Break changed
Rule created/updated
Timetable generated
Timetable regenerated
Manual move
Manual swap
Lock/unlock
Teacher replacement
Absence adjustment
Substitution approved
Conflict resolved
Room changed
Publish timetable
Unpublish timetable
Rollback
```

Each log should store:

```text
User
User role
School
Session
Action type
Source
Old value
New value
Reason
Affected class
Affected teacher
Affected room
Affected period
Timestamp
IP/device if available
```

Audit UI should allow filtering by:

```text
Date
User
Role
School
Session
Class
Teacher
Room
Action type
Source
Affected period
```

---

# 27. Reports and Export

Reports required:

```text
Class-wise timetable
Teacher-wise timetable
Room-wise timetable
Day-wise timetable
Substitution report
Teacher workload report
Subject completion report
Class teacher first-period report
Room usage report
Conflict report
Audit log report
Published timetable history
```

Export formats:

```text
PDF
Excel
Print view
```

---

# 28. Frontend UI/UX Requirements

The UI must be professional and easy for untrained school staff.

It should not look like a raw CRUD dashboard.

Required pages:

```text
Login
Forgot Password
School Selector
Session Selector
Home Dashboard
Setup Wizard
Period and Break Customization
Classes and Subjects
Teacher Management
Subject Weekly Load Setup
Room Management
Rules and Preferences
Subject Combination Rule Builder
Generate Timetable
Timetable Editor
Teacher Replacement
Absence Adjustment
Resolve Issues / Conflict Center
Audit Logs
Reports
Settings
User Management
Role and Permission Management
```

Design expectations:

```text
Premium SaaS look
Clean typography
Proper spacing
Professional padding
Consistent cards
Responsive layout
Awwwards-level polish
Easy navigation
Plain English labels
Guided workflow
Reusable components
```

---

# 29. Sidebar and Layout Requirements

Sidebar must support:

```text
Expanded desktop mode
Collapsed desktop mode
Mobile drawer mode
Active state
Icon-only collapsed state
Tooltip in collapsed state
Settings/user at bottom
Clean spacing
Smooth transition
```

Mobile layout must support:

```text
Drawer sidebar
Stacked cards
Responsive forms
Touch-friendly buttons
Scrollable timetable grid
No page overflow
Readable text
```

Test screen sizes:

```text
1440px
1280px
1024px
768px
430px
390px
```

---

# 30. Setup Wizard User Flow

The main user flow should be guided.

```text
Step 1: Login
Step 2: Select school
Step 3: Select academic session
Step 4: Open Setup Wizard
Step 5: Configure school timing
Step 6: Add classes and sections
Step 7: Add streams and groups
Step 8: Add subjects
Step 9: Add teachers
Step 10: Define teacher capabilities
Step 11: Assign teachers to subjects/classes
Step 12: Define weekly subject load
Step 13: Configure rooms/resources
Step 14: Add special rules
Step 15: Add subject combination rules
Step 16: Review readiness
Step 17: Generate timetable
Step 18: Review score/conflicts
Step 19: Fix issues or manually edit
Step 20: Publish timetable
Step 21: Export/print reports
```

---

# 31. Dashboard Requirements

Dashboard should show:

```text
Current school
Current session
Timetable status
Setup completion
Timetable score
Pending issues
Teachers ready
Classes ready
Rules configured
Latest generated timetable
Quick actions
Recent activity
Audit summary
```

Quick actions:

```text
Generate timetable
Mark teacher absent
Replace teacher
Add combination rule
View conflicts
View reports
```

---

# 32. Backend API Groups

Required API groups:

```text
Auth APIs
User APIs
Role/Permission APIs
School APIs
Session APIs
Period/Timeslot APIs
Class/Section/Stream/Group APIs
Subject APIs
Teacher APIs
Teacher Capability APIs
Teacher Assignment APIs
Subject Load APIs
Room/Resource APIs
Rule APIs
Subject Combination APIs
Reserved Period APIs
Custom Rule APIs
Timetable Generation APIs
Manual Edit APIs
Absence APIs
Replacement APIs
Conflict APIs
Audit Log APIs
Report APIs
Export APIs
```

Important backend middleware:

```text
Auth middleware
Role middleware
Permission middleware
School access middleware
Session context middleware
Tenant scope middleware
Validation middleware
Error middleware
Audit log middleware
```

---

# 33. Database Models Planned

Core models:

```text
User
Role
Permission
UserSchoolMembership
School
AcademicSession
WorkingDay
PeriodStructure
TimeSlot
ClassLevel
Section
Stream
StudentGroup
Subject
SubjectWeeklyLoad
Teacher
TeacherCapability
TeacherAssignment
ClassTeacherAssignment
TeacherReplacement
TeacherAbsence
Room
Resource
SubjectRoomRequirement
SubjectRequirement
SubjectCombinationRule
ReservedPeriodRule
CustomTimetableRule
RuleVersion
LessonBlock
GeneratedTimetable
TimetableEntry
ManualOverride
ConflictLog
AuditLog
ActivityLog
DailyAdjustment
SubstitutionEntry
PublishLog
```

---

# 34. Performance Requirements

System should be scalable and fast.

Use:

```text
Indexed queries
Pagination
Background jobs for generation
Generation status API
Redis/BullMQ if available
Timetable snapshots
Incremental re-optimization
Avoid full regeneration for small absence
Caching where useful
Optimized school/session scoped queries
```

Generation should work as:

```text
Admin clicks Generate
↓
Backend creates generation job
↓
Solver runs in background
↓
Frontend shows progress
↓
Generated result saved
↓
Admin reviews and publishes
```

---

# 35. Git / Deployment Requirement

Project should be connected to:

```text
https://github.com/ananyagoel04/Timetable-generator.git
```

Git requirements:

```text
Check git status
Initialize git if missing
Add .gitignore
Never commit .env or secrets
Create .env.example
Commit changes with clear message
Push to GitHub
```

Suggested commit message:

```text
Upgrade timetable generator with multi-school auth and advanced timetable foundation
```

---

# 36. Final Product Acceptance Criteria

The final system should support:

```text
Secure multi-user login
Multi-school access
School/session selector
Role-based access control
Permission-based UI
Custom period and break setup
Class/section/stream/group setup
Subject setup
Class-wise weekly subject load
Teacher capability vs current assignment
Teacher replacement suggestions
Temporary/permanent teacher replacement
Teacher absence adjustment
Universal subject combination rules
Room/resource allocation
Lesson-block timetable generation
Conflict detection
Manual timetable editing
Locked periods
Audit logs for every change
Reports and exports
Expandable/collapsible sidebar
Mobile responsiveness
Professional SaaS UI
Localhost setup
GitHub push
```

This is the complete requirement list we planned for the timetable manager.
