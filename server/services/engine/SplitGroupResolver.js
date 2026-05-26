/**
 * SplitGroupResolver — Stage 2b of the scheduling pipeline.
 *
 * Identifies student-group blocks within the same class and marks them
 * as parallel-eligible so the PlacementEngine can schedule them in the
 * same period with different teachers/rooms.
 *
 * Example: Class 11 Science has Bio Group (Biology, Lab1) and Maths Group
 * (Mathematics, Room204) — both can occupy Period 3 on Monday because
 * they serve different student sub-groups.
 */
class SplitGroupResolver {
  /**
   * @param {Array} rawBlocks - Block descriptors from LessonBlockGenerator (already filtered)
   * @returns {{ splitPairs: Array, regularBlocks: Array }}
   *   splitPairs: groups of blocks that can be placed in parallel
   *   regularBlocks: blocks without studentGroup (unchanged)
   */
  resolve(rawBlocks) {
    const splitPairs = [];
    const regularBlocks = [];
    const groupMap = {}; // classId -> { groupName -> [blocks] }

    // Separate group blocks from regular blocks
    for (const block of rawBlocks) {
      if (block.studentGroup) {
        const cid = block.classId.toString();
        if (!groupMap[cid]) groupMap[cid] = {};
        if (!groupMap[cid][block.studentGroup]) groupMap[cid][block.studentGroup] = [];
        groupMap[cid][block.studentGroup].push(block);
      } else {
        regularBlocks.push(block);
      }
    }

    // For each class that has split groups, create parallel pairs
    for (const [classId, groups] of Object.entries(groupMap)) {
      const groupNames = Object.keys(groups);

      if (groupNames.length < 2) {
        // Only one group defined — treat as regular blocks (no parallel partner)
        for (const name of groupNames) {
          for (const block of groups[name]) {
            block.isSplitGroup = true;
            block.parallelEligible = false;
            regularBlocks.push(block);
          }
        }
        continue;
      }

      // Multiple groups exist — create parallel placement pairs
      // Match blocks across groups by index (1st Bio block pairs with 1st Maths block, etc.)
      const maxLen = Math.max(...groupNames.map(g => groups[g].length));

      for (let i = 0; i < maxLen; i++) {
        const parallelSet = [];
        for (const groupName of groupNames) {
          if (i < groups[groupName].length) {
            const block = groups[groupName][i];
            block.isSplitGroup = true;
            block.parallelEligible = true;
            block.splitGroupIndex = i;
            parallelSet.push(block);
          }
        }

        if (parallelSet.length >= 2) {
          splitPairs.push({
            classId,
            pairIndex: i,
            blocks: parallelSet,
            // Priority: split pairs are harder to place (need multiple free teachers/rooms)
            priorityWeight: 85 + parallelSet.length
          });
        } else {
          // Unpaired block — treat as regular
          for (const block of parallelSet) {
            block.parallelEligible = false;
            regularBlocks.push(block);
          }
        }
      }
    }

    return { splitPairs, regularBlocks };
  }
}

module.exports = SplitGroupResolver;
