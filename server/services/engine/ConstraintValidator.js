/**
 * ConstraintValidator — Stage 3 of the scheduling pipeline.
 *
 * Three independent sub-engines:
 *   HardConstraintEngine  — must-pass checks (violations = invalid placement)
 *   SoftConstraintEngine   — preference scoring (violations = lower quality)
 *   ScoringEngine          — aggregated timetable quality score (0-100)
 */
class ConstraintValidator {
  /**
   * @param {Object} context - Shared scheduling context
   * @param {Object} context.teacherSchedule  - { "tid_day_period": true }
   * @param {Object} context.roomSchedule     - { "rid_day_period": true }
   * @param {Object} context.classSchedule    - { "cid_day_period": groupName|true }
   * @param {Object} context.teacherDayCount  - { "tid_day": count }
   * @param {Object} context.teacherWeekCount - { "tid": count }
   * @param {Object} context.classDaySubjectCount - { "cid_sid_day": count }
   * @param {Array}  context.teachers         - Teacher documents
   * @param {Array}  context.customRules      - CustomRule documents
   * @param {Array}  context.canTeachMappings - CanTeach documents
   * @param {Object} context.classPeriodMap   - Per-class period structures
   * @param {Array}  context.rooms            - Room documents (optional, for suitability scoring)
   */
  constructor(context) {
    this.ctx = context;
    // Configurable scoring weights (can be overridden by school settings)
    this.weights = context.weights || {
      subjectDistribution: 1.0,
      teacherWorkloadBalance: 1.5,
      dailyBalance: 1.2,
      timingPreferences: 0.8,
      completeness: 1.5,
      consecutiveQuality: 0.9,
      softPreferences: 0.7,
      schedulingGaps: 1.3,
      roomSuitability: 1.0,
      subjectSpread: 1.1
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // HARD CONSTRAINT ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Validate a block placement against all hard constraints.
   * @returns {{ valid: boolean, violations: string[] }}
   */
  validateHard(block, day, period) {
    const violations = [];

    // 1. Class collision
    if (block.type === 'combined_class') {
      for (const cid of block.classIds) {
        const key = `${cid}_${day}_${period}`;
        const existing = this.ctx.classSchedule[key];
        if (existing && existing !== false) {
          // If existing is a group name and this is also a group, allow if different groups
          if (typeof existing === 'string' && block.studentGroup && existing !== block.studentGroup) {
            continue; // Different groups — parallel OK
          }
          violations.push(`Class ${cid} already occupied at ${day} P${period}`);
        }
      }
    } else {
      const cid = block.classId?.toString();
      if (cid) {
        const key = `${cid}_${day}_${period}`;
        const existing = this.ctx.classSchedule[key];
        if (existing && existing !== false) {
          if (block.isSplitGroup && typeof existing === 'string' && existing !== block.studentGroup) {
            // Different group — parallel placement OK
          } else if (existing === true && block.isSplitGroup && block.studentGroup) {
            // Whole-class block already placed — can't overlay group
            violations.push(`Class ${cid} has a whole-class block at ${day} P${period}`);
          } else {
            violations.push(`Class ${cid} already occupied at ${day} P${period}`);
          }
        }
      }
    }

    // 2. Teacher collision
    const tid = (block.teacherId || block.teacher)?.toString();
    if (tid) {
      const tKey = `${tid}_${day}_${period}`;
      if (this.ctx.teacherSchedule[tKey]) {
        violations.push(`Teacher ${block.teacherName || tid} already busy at ${day} P${period}`);
      }
    }

    // 3. Teacher unavailability
    if (tid) {
      const teacher = this.ctx.teachers.find(t => t._id.toString() === tid);
      if (teacher?.unavailableSlots) {
        const unavail = teacher.unavailableSlots.find(u => u.day === day);
        if (unavail?.periods?.includes(period)) {
          violations.push(`Teacher ${teacher.name} is unavailable at ${day} P${period}`);
        }
      }
    }

    // 4. Room collision (if room specified)
    const rid = (block.roomId || block.room)?.toString();
    if (rid) {
      const rKey = `${rid}_${day}_${period}`;
      if (this.ctx.roomSchedule[rKey]) {
        violations.push(`Room ${rid} already occupied at ${day} P${period}`);
      }
    }

    return { valid: violations.length === 0, violations };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SOFT CONSTRAINT ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Score a block placement against soft constraints.
   * Higher score = better fit. Range: 0-100.
   */
  scoreSoft(block, day, period) {
    let score = 50; // Neutral baseline
    const penalties = [];

    const tid = (block.teacherId || block.teacher)?.toString();
    const cid = (block.classId || block.classIds?.[0])?.toString();
    const sid = (block.subjectId || block.subject)?.toString();

    // 1. Teacher daily load check
    if (tid) {
      const tdKey = `${tid}_${day}`;
      const dayLoad = this.ctx.teacherDayCount[tdKey] || 0;
      const maxPerDay = block.teacherMaxPerDay || 6;
      if (dayLoad >= maxPerDay) {
        score -= 30;
        penalties.push('teacher_day_overload');
      } else if (dayLoad >= maxPerDay - 1) {
        score -= 10;
        penalties.push('teacher_day_near_limit');
      }
    }

    // 2. Teacher weekly load check
    if (tid) {
      const weekLoad = this.ctx.teacherWeekCount[tid] || 0;
      const maxPerWeek = block.teacherMaxPerWeek || 30;
      if (weekLoad >= maxPerWeek) {
        score -= 40;
        penalties.push('teacher_week_overload');
      }
    }

    // 3. Subject distribution (max per day)
    if (cid && sid) {
      const subjDayKey = `${cid}_${sid}_${day}`;
      const subjDayCount = this.ctx.classDaySubjectCount[subjDayKey] || 0;
      const maxPerDay = block.maxPerDay || 2;
      const pendingCount = block.isConsecutive ? block.consecutiveSize : 1;
      if (subjDayCount + pendingCount > maxPerDay) {
        score -= 20;
        penalties.push('subject_day_excess');
      }
    }

    // 4. Morning/afternoon timing preference
    if (cid) {
      const cp = this.ctx.classPeriodMap[cid];
      const allSlots = cp?.daySlots?.[day] || [];
      const midPoint = allSlots.length > 0 ? allSlots[Math.floor(allSlots.length / 2)] : 4;
      if (block.preferMorning && period <= midPoint) score += 10;
      else if (block.preferMorning && period > midPoint) score -= 5;
      if (block.preferAfternoon && period > midPoint) score += 10;
      else if (block.preferAfternoon && period <= midPoint) score -= 5;
    }

    // 5. Preferred/avoided days
    if (block.preferredDays?.length > 0) {
      if (block.preferredDays.includes(day)) score += 8;
      else score -= 3;
    }
    if (block.avoidDays?.includes(day)) {
      score -= 25;
      penalties.push('avoided_day');
    }

    return { score: Math.max(0, Math.min(100, score)), penalties };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SCORING ENGINE — Aggregate timetable quality
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate overall timetable quality score (0-100).
   * @param {Array} placedBlocks - All placed block documents
   * @param {Array} errors - Unplaced items
   * @param {Array} softPreferences - SoftPreference documents
   * @param {Object} school - School document
   * @returns {{ hard, soft, total, factors, analytics }}
   */
  calculateScore(placedBlocks, errors, softPreferences, school) {
    const factors = {};

    // Factor 1: Subject distribution
    let distribPenalty = 0;
    for (const key of Object.keys(this.ctx.classDaySubjectCount)) {
      const count = this.ctx.classDaySubjectCount[key];
      if (count > 2) distribPenalty += (count - 2) * 5;
    }
    factors.subjectDistribution = Math.max(0, 100 - distribPenalty);

    // Factor 2: Teacher workload balance (across teachers)
    const teacherDayLoads = {};
    for (const key of Object.keys(this.ctx.teacherDayCount)) {
      const tid = key.split('_')[0];
      if (!teacherDayLoads[tid]) teacherDayLoads[tid] = [];
      teacherDayLoads[tid].push(this.ctx.teacherDayCount[key]);
    }
    let balancePenalty = 0;
    for (const loads of Object.values(teacherDayLoads)) {
      if (loads.length < 2) continue;
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const variance = loads.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / loads.length;
      balancePenalty += Math.sqrt(variance) * 3;
    }
    factors.teacherWorkloadBalance = Math.max(0, Math.round(100 - balancePenalty));

    // Factor 2b: Daily balance (per-teacher day-to-day variance)
    let dailyBalancePenalty = 0;
    for (const [tid, loads] of Object.entries(teacherDayLoads)) {
      if (loads.length < 2) continue;
      const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
      const variance = loads.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / loads.length;
      if (variance > 2) dailyBalancePenalty += (variance - 2) * 2;
    }
    factors.dailyBalance = Math.max(0, Math.round(100 - dailyBalancePenalty));

    // Factor 3: Timing preferences
    let morningScore = 0, morningTotal = 0;
    for (const b of placedBlocks) {
      if (!b.subject && !b.subjectId) continue;
      if (b.preferMorning) {
        morningTotal++;
        const cp = this.ctx.classPeriodMap[(b.classes?.[0] || b.classId)?.toString()];
        const allSlots = cp?.daySlots?.[b.day] || [];
        const midPoint = allSlots.length > 0 ? allSlots[Math.floor(allSlots.length / 2)] : 4;
        if ((b.periods?.[0] || 0) <= midPoint) morningScore++;
      }
      if (b.preferAfternoon) {
        morningTotal++;
        const cp = this.ctx.classPeriodMap[(b.classes?.[0] || b.classId)?.toString()];
        const allSlots = cp?.daySlots?.[b.day] || [];
        const midPoint = allSlots.length > 0 ? allSlots[Math.floor(allSlots.length / 2)] : 4;
        if ((b.periods?.[0] || 0) > midPoint) morningScore++;
      }
    }
    factors.timingPreferences = morningTotal > 0 ? Math.round((morningScore / morningTotal) * 100) : 100;

    // Factor 4: Completeness
    factors.completeness = errors.length === 0 ? 100 : Math.max(0, 100 - errors.length * 10);

    // Factor 5: Consecutive placement quality
    // With atomic blocks, check that multi-period blocks have correct consecutive periods
    let consecutiveOk = 0, consecutiveTotal = 0;
    for (const b of placedBlocks) {
      if ((b.duration || 1) > 1 && b.periods?.length > 1) {
        consecutiveTotal++;
        const sorted = [...b.periods].sort((a, c) => a - c);
        let allConsecutive = true;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i + 1] - sorted[i] !== 1) {
            allConsecutive = false;
            break;
          }
        }
        if (allConsecutive) consecutiveOk++;
      }
    }
    // Also check legacy consecutiveGroupId blocks for backward compat
    const groupBlocks = {};
    for (const b of placedBlocks) {
      if (b.consecutiveGroupId) {
        const gid = b.consecutiveGroupId.toString();
        if (!groupBlocks[gid]) groupBlocks[gid] = [];
        groupBlocks[gid].push(b);
      }
    }
    for (const group of Object.values(groupBlocks)) {
      consecutiveTotal++;
      if (group.length < 2) continue;
      const sorted = group.sort((a, b) => (a.consecutivePosition || 0) - (b.consecutivePosition || 0));
      let allConsecutive = true;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].day !== sorted[i + 1].day ||
            Math.abs((sorted[i].periods?.[0] || 0) - (sorted[i + 1].periods?.[0] || 0)) !== 1) {
          allConsecutive = false;
          break;
        }
      }
      if (allConsecutive) consecutiveOk++;
    }
    factors.consecutiveQuality = consecutiveTotal > 0 ? Math.round((consecutiveOk / consecutiveTotal) * 100) : 100;

    // Factor 6: Soft preference adherence
    let prefScore = 0, prefTotal = 0;
    for (const pref of softPreferences || []) {
      prefTotal++;
      if (this._evaluateSoftPreference(pref, placedBlocks)) prefScore++;
    }
    factors.softPreferences = prefTotal > 0 ? Math.round((prefScore / prefTotal) * 100) : 100;

    // Factor 7: Scheduling gaps (free periods between assigned periods)
    let gapPenalty = 0;
    const classGaps = {};
    for (const b of placedBlocks) {
      if (!b.subject && !b.subjectId) continue;
      const cid = (b.classes?.[0] || b.classId)?.toString();
      const day = b.day;
      if (!cid || !day) continue;
      const key = `${cid}_${day}`;
      if (!classGaps[key]) classGaps[key] = [];
      for (const p of (b.periods || [])) {
        classGaps[key].push(p);
      }
    }
    for (const periods of Object.values(classGaps)) {
      if (periods.length < 2) continue;
      periods.sort((a, b) => a - b);
      for (let i = 0; i < periods.length - 1; i++) {
        const gap = periods[i + 1] - periods[i] - 1;
        if (gap > 0) gapPenalty += gap * 3;
      }
    }
    factors.schedulingGaps = Math.max(0, 100 - gapPenalty);

    // Factor 8: Room suitability — real type matching (Component 5 fix)
    const roomMap = {};
    if (this.ctx.rooms) {
      for (const r of this.ctx.rooms) {
        roomMap[r._id.toString()] = r;
      }
    }
    let roomSuitScore = 0, roomSuitTotal = 0;
    for (const b of placedBlocks) {
      if (!b.room || b.type === 'reserved') continue;
      roomSuitTotal++;
      const rid = (b.room._id || b.room)?.toString();
      const room = roomMap[rid];
      if (!room) { roomSuitScore++; continue; } // Can't check — give neutral

      // Check type match
      const blockRoomType = b.requiredRoomType || (b.requiresLab ? 'lab' : 'classroom');
      const roomType = room.type || 'classroom';
      if (roomType === blockRoomType) {
        roomSuitScore++; // Perfect match
      } else if (blockRoomType === 'classroom') {
        roomSuitScore++; // Classrooms are flexible
      } else {
        // Partial match (compatible types)
        const compat = {
          lab: ['lab', 'computer_lab'],
          computer_lab: ['computer_lab', 'lab'],
          art_room: ['art_room', 'music_room'],
          music_room: ['music_room', 'art_room']
        };
        if (compat[blockRoomType]?.includes(roomType)) {
          roomSuitScore += 0.7; // Compatible but not ideal
        } else {
          roomSuitScore += 0.3; // Wrong type entirely
        }
      }
    }
    factors.roomSuitability = roomSuitTotal > 0 ? Math.round((roomSuitScore / roomSuitTotal) * 100) : 100;

    // Factor 9: Subject spread across week
    let spreadScore = 0, spreadTotal = 0;
    const subjectWeekDays = {};
    for (const b of placedBlocks) {
      if (!b.subject && !b.subjectId) continue;
      if (b.type === 'reserved') continue;
      const cid = (b.classes?.[0] || b.classId)?.toString();
      const sid = (b.subject?._id || b.subject || b.subjectId)?.toString();
      if (!cid || !sid) continue;
      const key = `${cid}_${sid}`;
      if (!subjectWeekDays[key]) subjectWeekDays[key] = { days: new Set(), totalPeriods: 0 };
      subjectWeekDays[key].days.add(b.day);
      subjectWeekDays[key].totalPeriods += (b.periods?.length || 1);
    }
    for (const { days, totalPeriods } of Object.values(subjectWeekDays)) {
      if (totalPeriods <= 1) continue;
      spreadTotal++;
      // Ideal: periods spread across as many days as possible
      const idealDays = Math.min(totalPeriods, 5); // At most 5 working days
      const actualDays = days.size;
      spreadScore += Math.min(1, actualDays / idealDays);
    }
    factors.subjectSpread = spreadTotal > 0 ? Math.round((spreadScore / spreadTotal) * 100) : 100;

    // Factor 10: Room utilization — percentage of room-period slots used
    let totalRoomSlots = 0;
    let usedRoomSlots = 0;
    if (this.ctx.rooms && this.ctx.classPeriodMap) {
      const workingDaysSet = new Set();
      for (const cp of Object.values(this.ctx.classPeriodMap)) {
        for (const d of (cp.workingDays || [])) workingDaysSet.add(d);
      }
      const workingDays = [...workingDaysSet];
      const avgPeriods = Object.values(this.ctx.classPeriodMap).reduce((sum, cp) => {
        const slots = Object.values(cp.daySlots || {}).flat();
        return sum + (slots.length || 0);
      }, 0) / Math.max(Object.keys(this.ctx.classPeriodMap).length, 1);
      totalRoomSlots = this.ctx.rooms.length * workingDays.length * Math.round(avgPeriods / workingDays.length || 7);
      for (const key of Object.keys(this.ctx.roomSchedule)) {
        if (this.ctx.roomSchedule[key]) usedRoomSlots++;
      }
    }
    factors.roomUtilization = totalRoomSlots > 0 ? Math.round((usedRoomSlots / totalRoomSlots) * 100) : 100;

    // Factor 11: Teacher continuous-period quality — penalize long unbroken chains
    let continuousPenalty = 0;
    const teacherDayPeriods = {};
    for (const key of Object.keys(this.ctx.teacherSchedule)) {
      if (!this.ctx.teacherSchedule[key]) continue;
      const parts = key.split('_');
      const period = parseInt(parts[parts.length - 1]);
      const dayKey = parts.slice(0, -1).join('_'); // tid_day
      if (!teacherDayPeriods[dayKey]) teacherDayPeriods[dayKey] = [];
      teacherDayPeriods[dayKey].push(period);
    }
    for (const [dayKey, periods] of Object.entries(teacherDayPeriods)) {
      periods.sort((a, b) => a - b);
      let chain = 1;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] - periods[i - 1] === 1) {
          chain++;
          if (chain > 4) continuousPenalty += 5; // Penalize chains > 4
        } else {
          chain = 1;
        }
      }
    }
    factors.continuousQuality = Math.max(0, 100 - continuousPenalty);

    // Weighted aggregation
    let weightedSum = 0, totalWeight = 0;
    for (const [key, score] of Object.entries(factors)) {
      const w = this.weights[key] || 1.0;
      weightedSum += score * w;
      totalWeight += w;
    }

    const total = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Workload analytics (Component 3)
    const analytics = this._computeWorkloadAnalytics(teacherDayLoads);

    // Room utilization analytics
    analytics.roomUtilization = {
      totalSlots: totalRoomSlots,
      usedSlots: usedRoomSlots,
      percentage: totalRoomSlots > 0 ? Math.round((usedRoomSlots / totalRoomSlots) * 100) : 0
    };

    // Unplaced block analytics by type and cause (Priority 3)
    const unplacedByType = {};
    const unplacedByCause = {};
    for (const err of errors) {
      const t = err.type || 'unknown';
      unplacedByType[t] = (unplacedByType[t] || 0) + 1;
      const cause = err.rootCause || err.reason || 'unknown';
      unplacedByCause[cause] = (unplacedByCause[cause] || 0) + 1;
    }
    analytics.unplacedByType = unplacedByType;
    analytics.unplacedByCause = unplacedByCause;

    return { hard: errors.length, soft: total, total, factors, analytics };
  }

  /**
   * Compute workload analytics for teachers.
   */
  _computeWorkloadAnalytics(teacherDayLoads) {
    const weeklyLoads = {};
    for (const [tid, dayLoads] of Object.entries(teacherDayLoads)) {
      weeklyLoads[tid] = dayLoads.reduce((a, b) => a + b, 0);
    }
    const loads = Object.values(weeklyLoads);
    if (loads.length === 0) return { maxLoad: 0, avgLoad: 0, variance: 0, overloadedTeachers: [], underutilizedTeachers: [] };

    const maxLoad = Math.max(...loads);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((s, v) => s + Math.pow(v - avgLoad, 2), 0) / loads.length;

    const overloadedTeachers = [];
    const underutilizedTeachers = [];
    for (const [tid, weekLoad] of Object.entries(weeklyLoads)) {
      const teacher = this.ctx.teachers.find(t => t._id.toString() === tid);
      const maxWeek = teacher?.maxPeriodsPerWeek || 30;
      if (weekLoad > maxWeek * 0.9) {
        overloadedTeachers.push({ teacherId: tid, name: teacher?.name, load: weekLoad, max: maxWeek });
      }
      if (weekLoad < avgLoad * 0.5 && avgLoad > 5) {
        underutilizedTeachers.push({ teacherId: tid, name: teacher?.name, load: weekLoad, avg: Math.round(avgLoad) });
      }
    }

    return {
      maxLoad,
      avgLoad: Math.round(avgLoad * 10) / 10,
      variance: Math.round(variance * 10) / 10,
      overloadedTeachers,
      underutilizedTeachers
    };
  }

  _evaluateSoftPreference(pref, blocks) {
    if (pref.type === 'teacher_free_period' && pref.teacher && pref.day && pref.period) {
      return !this.ctx.teacherSchedule[`${pref.teacher}_${pref.day}_${pref.period}`];
    }
    if (pref.type === 'subject_time_preference' && pref.subject) {
      const subBlocks = blocks.filter(b =>
        (b.subject?.toString() || b.subjectId?.toString()) === pref.subject?.toString()
      );
      if (pref.preferBefore && subBlocks.length > 0) {
        return subBlocks.every(b => (b.periods?.[0] || 0) <= (pref.preferBefore || 4));
      }
    }
    return true;
  }
}

module.exports = ConstraintValidator;
