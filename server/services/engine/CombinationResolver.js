/**
 * CombinationResolver — Stage 2 of the scheduling pipeline.
 *
 * Merges multi-class subjects into atomic combined blocks and removes
 * duplicate raw blocks that overlap with combination rules.
 *
 * Key guarantee: A combined class (e.g., English for 11A+11B+11C) produces
 * exactly ONE block per period — never multiple independent entries.
 */
class CombinationResolver {
  /**
   * @param {Array} combinationRules - Populated SubjectCombinationRule documents
   * @param {Array} rawBlocks - Block descriptors from LessonBlockGenerator
   * @param {Array} classes - All class documents
   * @param {Array} teachers - All teacher documents
   * @returns {{ combinedBlocks: Array, filteredRawBlocks: Array, coveredSet: Set }}
   */
  resolve(combinationRules, rawBlocks, classes, teachers) {
    const combinedBlocks = [];
    const coveredSet = new Set(); // "subjectId_classId" strings

    // Build combined blocks from rules
    for (const rule of combinationRules) {
      if (!rule.isActive) continue;

      const classIds = rule.appliesTo
        .map(a => a.class?._id || a.class)
        .filter(Boolean);

      if (classIds.length === 0) continue;

      const subjectId = rule.subject?._id?.toString();
      if (!subjectId) continue;

      // Mark all class+subject pairs as covered
      for (const cid of classIds) {
        coveredSet.add(`${subjectId}_${cid.toString()}`);
      }

      // Create combined block descriptors
      for (let i = 0; i < rule.periodsPerWeek; i++) {
        // Calculate total student count for room sizing
        const totalStudents = classIds.reduce((sum, cid) => {
          const cls = classes.find(c => c._id.toString() === cid.toString());
          return sum + (cls?.studentCount || 30);
        }, 0);

        combinedBlocks.push({
          type: 'combined_class',
          classIds: classIds.map(c => c.toString ? c : c),
          subjectId: rule.subject._id,
          subjectName: rule.subject?.name || 'Combined',
          teacherId: rule.teacher?._id,
          teacherName: rule.teacher?.name || 'TBD',
          roomId: rule.room?._id || null,
          preferredDays: rule.preferredDays || [],
          preferredPeriods: rule.preferredPeriods || [],
          strictness: rule.strictness || 'must_combine',
          combinationRuleId: rule._id,
          totalStudents,
          isConsecutive: false,
          consecutiveSize: 1,
          // Combined blocks get highest priority (hardest to place)
          priorityWeight: 90 + (classIds.length * 2),
          source: 'combination_rule'
        });
      }
    }

    // Filter raw blocks: remove any whose (subjectId, classId) is in the covered set
    const filteredRawBlocks = rawBlocks.filter(block => {
      const key = `${block.subjectId.toString()}_${block.classId.toString()}`;
      return !coveredSet.has(key);
    });

    return { combinedBlocks, filteredRawBlocks, coveredSet };
  }

  /**
   * Build the coverage set without generating blocks.
   * Used by LessonBlockGenerator to pre-filter.
   */
  buildCoveredSet(combinationRules) {
    const coveredSet = new Set();
    for (const rule of combinationRules) {
      if (!rule.isActive) continue;
      const subjectId = rule.subject?._id?.toString();
      if (!subjectId) continue;
      const classIds = rule.appliesTo
        .map(a => a.class?._id || a.class)
        .filter(Boolean);
      for (const cid of classIds) {
        coveredSet.add(`${subjectId}_${cid.toString()}`);
      }
    }
    return coveredSet;
  }
}

module.exports = CombinationResolver;
