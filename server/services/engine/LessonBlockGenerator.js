/**
 * LessonBlockGenerator — Stage 1 of the scheduling pipeline.
 *
 * Transforms SubjectRequirements into raw block descriptors (unplaced candidates).
 * Handles:
 *   - Converting each requirement into one or more block descriptors
 *   - Splitting consecutive/double period preferences into grouped blocks
 *   - Marking student-group blocks for split-group processing
 *   - Counting already-placed periods (from prior stages like reserved rules)
 *   - Adding duration and blockType hints for downstream placement
 *   - Mapping subject type → requiredRoomType for room allocation
 */

// Maps subject type to the room type it needs
const SUBJECT_TYPE_TO_ROOM = {
  practical: 'lab',
  lab: 'lab',
  activity: 'art_room',
  library: 'library',
  games: 'playground',
  club: 'classroom',
  theory: 'classroom',
  moral_science: 'classroom',
  other: 'classroom'
};

// Maps subject code patterns to room types
const SUBJECT_CODE_ROOM_OVERRIDES = [
  { pattern: /^(CS|COMP|ICT|IT)\b/i, roomType: 'computer_lab' },
  { pattern: /^(MUS|MUSIC)\b/i, roomType: 'music_room' },
  { pattern: /^(ART|DRAW|PAINT)\b/i, roomType: 'art_room' },
  { pattern: /^(PE|PT|GAMES|SPORT)\b/i, roomType: 'playground' },
  { pattern: /^(LIB)\b/i, roomType: 'library' }
];

class LessonBlockGenerator {
  /**
   * @param {Array} requirements - Populated SubjectRequirement documents
   * @param {Object} options
   * @param {Map} options.coveredSet - Set of "subjectId_classId" strings covered by combination rules
   * @param {Array} options.existingBlocks - Blocks already placed by prior stages
   * @param {Object} options.classPeriodMap - Per-class period structure data
   * @param {Array} options.teachers - All teacher documents
   */
  generate(requirements, options = {}) {
    const { coveredSet = new Set(), existingBlocks = [], classPeriodMap = {} } = options;
    const rawBlocks = [];
    const warnings = [];

    for (const req of requirements) {
      if (!req.class || !req.subject || !req.teacher) continue;

      const classId = req.class._id.toString();
      const subjectId = req.subject._id.toString();
      const teacherId = req.teacher._id.toString();
      const coverageKey = `${subjectId}_${classId}`;

      // Skip if fully covered by a combination rule
      if (coveredSet.has(coverageKey)) continue;

      // Validate periodsPerWeek
      if (!req.periodsPerWeek || req.periodsPerWeek < 1) {
        warnings.push(`Skipped ${req.subject?.name} for ${req.class?.name}: periodsPerWeek=${req.periodsPerWeek}`);
        continue;
      }

      // Count periods already placed for this class+subject (from reserved rules, class-teacher first period, etc.)
      const alreadyPlaced = this._countAlreadyPlaced(existingBlocks, classId, subjectId, teacherId, classPeriodMap);
      let remainingPeriods = req.periodsPerWeek - alreadyPlaced;
      if (remainingPeriods <= 0) continue;

      // Resolve working days for this class
      const cp = classPeriodMap[classId];
      const workingDays = cp?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Determine the required room type from subject metadata
      const requiredRoomType = this._resolveRoomType(req.subject);

      // Build base descriptor
      const base = {
        classId: req.class._id,
        className: req.class.name,
        subjectId: req.subject._id,
        subjectName: req.subject.name,
        subjectCode: req.subject.code,
        subjectType: req.subject.type || 'theory',
        teacherId: req.teacher._id,
        teacherName: req.teacher.name,
        requiresLab: req.subject.requiresLab || false,
        requiredRoomType,
        preferredRoom: req.preferredRoom || null,
        preferMorning: req.subject.preferMorning || false,
        preferAfternoon: req.subject.preferAfternoon || false,
        maxPerDay: req.subject.maxPerDay || 2,
        studentGroup: req.studentGroup || null,
        studentCount: req.class.studentCount || 30,
        teacherMaxPerDay: req.teacher?.maxPeriodsPerDay || 6,
        teacherMaxPerWeek: req.teacher?.maxPeriodsPerWeek || 30,
        preferredDays: req.preferredDays || [],
        avoidDays: req.avoidDays || [],
        color: req.subject.color,
        workingDays,
        source: 'requirement'
      };

      // Handle consecutive/double period grouping
      if (req.consecutivePreference !== 'none' || req.allowDoublePeriod) {
        const groupSize = req.consecutiveCount || (req.allowDoublePeriod ? 2 : 2);
        const blockType = this._resolveBlockType(req.subject, groupSize);
        while (remainingPeriods >= groupSize) {
          rawBlocks.push({
            ...base,
            isConsecutive: true,
            consecutiveSize: groupSize,
            duration: groupSize,
            blockType,
            consecutivePreference: req.consecutivePreference || 'preferred',
            priorityWeight: this._calculatePriority(base, true, groupSize)
          });
          remainingPeriods -= groupSize;
        }
      }

      // Remaining single periods — use correct block type
      const singleBlockType = this._resolveSingleBlockType(req.subject);
      for (let i = 0; i < remainingPeriods; i++) {
        rawBlocks.push({
          ...base,
          isConsecutive: false,
          consecutiveSize: 1,
          duration: 1,
          blockType: singleBlockType,
          consecutivePreference: 'none',
          priorityWeight: this._calculatePriority(base, false, 1)
        });
      }
    }

    return { blocks: rawBlocks, warnings };
  }

  /**
   * Resolve the required room type from subject metadata.
   * Priority: requiresSpecialRoom > subject code pattern > subject type mapping
   */
  _resolveRoomType(subject) {
    // 1. Explicit special room requirement (e.g., "Physics Lab")
    if (subject.requiresSpecialRoom) {
      const special = subject.requiresSpecialRoom.toLowerCase();
      if (special.includes('computer')) return 'computer_lab';
      if (special.includes('lab')) return 'lab';
      if (special.includes('library')) return 'library';
      if (special.includes('art')) return 'art_room';
      if (special.includes('music')) return 'music_room';
      if (special.includes('auditorium')) return 'auditorium';
      if (special.includes('playground') || special.includes('ground')) return 'playground';
    }

    // 2. Subject code pattern overrides
    if (subject.code) {
      for (const override of SUBJECT_CODE_ROOM_OVERRIDES) {
        if (override.pattern.test(subject.code)) return override.roomType;
      }
    }

    // 3. requiresLab flag
    if (subject.requiresLab) return 'lab';

    // 4. Subject type mapping
    return SUBJECT_TYPE_TO_ROOM[subject.type] || 'classroom';
  }

  /**
   * Resolve the block type hint based on subject and group size.
   */
  _resolveBlockType(subject, groupSize) {
    if (groupSize >= 3 && (subject.requiresLab || subject.type === 'lab' || subject.type === 'practical')) {
      return 'triple_lab';
    }
    if (groupSize >= 2) return 'double_period';
    if (subject.type === 'lab' || subject.type === 'practical') return 'lab';
    if (subject.type === 'activity') return 'activity';
    if (subject.type === 'club') return 'club';
    return 'normal';
  }

  /**
   * Resolve block type for single-period blocks.
   * Unlike consecutive blocks, singles still need correct type for styling/placement.
   */
  _resolveSingleBlockType(subject) {
    if (subject.type === 'lab' || subject.type === 'practical') return 'lab';
    if (subject.type === 'activity') return 'activity';
    if (subject.type === 'club') return 'club';
    if (subject.type === 'library') return 'activity'; // Library uses activity-style placement
    if (subject.type === 'games') return 'activity';
    return 'normal';
  }

  /**
   * Count how many periods are already placed for a given class+subject+teacher.
   */
  _countAlreadyPlaced(existingBlocks, classId, subjectId, teacherId, classPeriodMap) {
    let count = 0;
    for (const block of existingBlocks) {
      if (block.subject?.toString() === subjectId &&
          block.teacher?.toString() === teacherId &&
          block.classes?.some(c => c.toString() === classId)) {
        count += (block.periods?.length || 1);
      }
    }
    return count;
  }

  /**
   * Calculate scheduling priority. Higher = placed first.
   * More constrained items get higher priority.
   */
  _calculatePriority(base, isConsecutive, groupSize) {
    let priority = 50; // Base priority

    // Triple labs are hardest to place → highest priority boost
    if (groupSize >= 3) priority += 30;
    // Double periods are harder than singles
    else if (isConsecutive) priority += 20;

    // Lab subjects are harder (fewer rooms) → higher priority
    if (base.requiresLab) priority += 15;

    // Specialty room types (not classroom) are harder
    if (base.requiredRoomType && base.requiredRoomType !== 'classroom') priority += 10;

    // Fewer working days = more constrained → higher priority
    if (base.workingDays.length <= 4) priority += 10;
    if (base.workingDays.length <= 3) priority += 15;

    // Student group blocks (split-group) need careful placement
    if (base.studentGroup) priority += 5;

    // Preferred room specified = more constrained
    if (base.preferredRoom) priority += 5;

    return priority;
  }
}

module.exports = LessonBlockGenerator;
