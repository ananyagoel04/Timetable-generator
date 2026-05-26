/**
 * AIRecommendationEngine — Post-generation intelligence module.
 *
 * Analyzes a completed timetable and produces actionable recommendations
 * for improving scheduling quality, teacher balance, room utilization,
 * and overall school operations.
 */
class AIRecommendationEngine {
  /**
   * @param {Object} options
   * @param {Array}  options.placedBlocks - All placed LessonBlock documents
   * @param {Array}  options.errors      - Unplaced items
   * @param {Object} options.score       - Quality score from ConstraintValidator
   * @param {Array}  options.teachers    - Teacher documents
   * @param {Array}  options.classes     - Class documents
   * @param {Array}  options.rooms       - Room documents
   * @param {Object} options.classPeriodMap - Period structures
   */
  constructor(options) {
    this.blocks = options.placedBlocks || [];
    this.errors = options.errors || [];
    this.score = options.score || {};
    this.teachers = options.teachers || [];
    this.classes = options.classes || [];
    this.rooms = options.rooms || [];
    this.classPeriodMap = options.classPeriodMap || {};
  }

  /**
   * Generate all recommendations.
   * @returns {{ recommendations: Array, summary: Object }}
   */
  analyze() {
    const recommendations = [
      ...this._analyzeTeacherWorkload(),
      ...this._analyzeRoomUtilization(),
      ...this._analyzeUnplacedItems(),
      ...this._analyzeSchedulingGaps(),
      ...this._analyzeSubjectDistribution(),
      ...this._analyzeConstraintRelaxation()
    ];

    // Sort by priority (critical → high → medium → low)
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

    return {
      recommendations,
      summary: {
        total: recommendations.length,
        critical: recommendations.filter(r => r.priority === 'critical').length,
        high: recommendations.filter(r => r.priority === 'high').length,
        medium: recommendations.filter(r => r.priority === 'medium').length,
        low: recommendations.filter(r => r.priority === 'low').length,
        qualityScore: this.score.total || 0,
        factors: this.score.factors || {}
      }
    };
  }

  // ─── Teacher Workload Analysis ──────────────────────────────────
  _analyzeTeacherWorkload() {
    const recs = [];
    const teacherLoads = {};

    for (const b of this.blocks) {
      if (b.type === 'reserved' || !b.teacher) continue;
      const tid = b.teacher.toString();
      if (!teacherLoads[tid]) teacherLoads[tid] = { total: 0, days: {}, name: '' };
      teacherLoads[tid].total++;
      teacherLoads[tid].days[b.day] = (teacherLoads[tid].days[b.day] || 0) + 1;
    }

    // Enrich with teacher names
    for (const t of this.teachers) {
      const tid = t._id.toString();
      if (teacherLoads[tid]) teacherLoads[tid].name = t.name;
    }

    const loads = Object.values(teacherLoads);
    if (loads.length < 2) return recs;

    const avgLoad = loads.reduce((s, l) => s + l.total, 0) / loads.length;
    const stdDev = Math.sqrt(loads.reduce((s, l) => s + Math.pow(l.total - avgLoad, 2), 0) / loads.length);

    // Find overloaded teachers (> avg + 1.5 stddev)
    for (const [tid, load] of Object.entries(teacherLoads)) {
      if (load.total > avgLoad + 1.5 * stdDev) {
        recs.push({
          type: 'teacher_overload',
          priority: 'high',
          title: `${load.name} is overloaded`,
          description: `${load.name} has ${load.total} periods/week (avg: ${Math.round(avgLoad)}). Consider redistributing to underutilized teachers.`,
          metric: { current: load.total, average: Math.round(avgLoad), stdDev: Math.round(stdDev) },
          actionable: true,
          action: 'Reassign some subjects to less-loaded teachers'
        });
      }

      // Check for unbalanced daily distribution
      const dayLoads = Object.values(load.days);
      if (dayLoads.length > 0) {
        const maxDay = Math.max(...dayLoads);
        const minDay = Math.min(...dayLoads);
        if (maxDay - minDay > 3) {
          recs.push({
            type: 'teacher_daily_imbalance',
            priority: 'medium',
            title: `${load.name} has uneven daily load`,
            description: `Daily range: ${minDay}–${maxDay} periods. Better balance improves teacher satisfaction.`,
            metric: { min: minDay, max: maxDay },
            actionable: true,
            action: 'Enable workload balance optimization in generation settings'
          });
        }
      }
    }

    // Find underutilized teachers
    for (const [tid, load] of Object.entries(teacherLoads)) {
      if (load.total < avgLoad - 1.5 * stdDev && load.total < avgLoad * 0.5) {
        recs.push({
          type: 'teacher_underutilized',
          priority: 'low',
          title: `${load.name} may be underutilized`,
          description: `Only ${load.total} periods/week vs average ${Math.round(avgLoad)}.`,
          metric: { current: load.total, average: Math.round(avgLoad) },
          actionable: true,
          action: 'Consider assigning additional subjects or classes'
        });
      }
    }

    return recs;
  }

  // ─── Room Utilization Analysis ──────────────────────────────────
  _analyzeRoomUtilization() {
    const recs = [];
    const roomUsage = {};
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MAX_PERIODS = 8;

    for (const b of this.blocks) {
      if (!b.room || b.type === 'reserved') continue;
      const rid = b.room.toString();
      roomUsage[rid] = (roomUsage[rid] || 0) + 1;
    }

    const totalSlots = DAYS.length * MAX_PERIODS;
    for (const room of this.rooms) {
      const rid = room._id.toString();
      const used = roomUsage[rid] || 0;
      const utilization = (used / totalSlots) * 100;

      if (utilization < 20 && used > 0) {
        recs.push({
          type: 'room_underutilized',
          priority: 'low',
          title: `Room ${room.name} is underutilized (${Math.round(utilization)}%)`,
          description: `Only ${used}/${totalSlots} slots used. Consider repurposing or scheduling more classes here.`,
          metric: { used, total: totalSlots, utilization: Math.round(utilization) },
          actionable: false
        });
      }
    }

    // Check if any rooms are never used
    const unusedRooms = this.rooms.filter(r => !roomUsage[r._id.toString()]);
    if (unusedRooms.length > 0) {
      recs.push({
        type: 'rooms_unused',
        priority: 'medium',
        title: `${unusedRooms.length} room(s) are completely unused`,
        description: `Rooms: ${unusedRooms.map(r => r.name).join(', ')}`,
        metric: { count: unusedRooms.length },
        actionable: true,
        action: 'Review room assignments or mark these rooms as inactive'
      });
    }

    return recs;
  }

  // ─── Unplaced Items Analysis ────────────────────────────────────
  _analyzeUnplacedItems() {
    const recs = [];
    if (this.errors.length === 0) return recs;

    // Group by type
    const byType = {};
    for (const e of this.errors) {
      byType[e.type] = byType[e.type] || [];
      byType[e.type].push(e);
    }

    for (const [type, items] of Object.entries(byType)) {
      recs.push({
        type: 'unplaced_blocks',
        priority: items.length > 5 ? 'critical' : 'high',
        title: `${items.length} ${type.replace(/_/g, ' ')} block(s) could not be placed`,
        description: items.slice(0, 3).map(i => i.message).join('; '),
        metric: { count: items.length, type },
        actionable: true,
        action: type === 'regular_unplaced'
          ? 'Add more rooms, reduce teacher constraints, or increase available periods'
          : 'Review combination/split group rules for conflicts'
      });
    }

    return recs;
  }

  // ─── Scheduling Gap Analysis ────────────────────────────────────
  _analyzeSchedulingGaps() {
    const recs = [];
    const classGaps = {};

    for (const b of this.blocks) {
      if (!b.subject && !b.subjectId) continue;
      const cid = (b.classes?.[0])?.toString();
      if (!cid) continue;
      const key = `${cid}_${b.day}`;
      if (!classGaps[key]) classGaps[key] = [];
      classGaps[key].push(b.periods?.[0] || 0);
    }

    let totalGaps = 0;
    for (const periods of Object.values(classGaps)) {
      if (periods.length < 2) continue;
      periods.sort((a, b) => a - b);
      for (let i = 0; i < periods.length - 1; i++) {
        const gap = periods[i + 1] - periods[i] - 1;
        if (gap > 0) totalGaps += gap;
      }
    }

    if (totalGaps > 10) {
      recs.push({
        type: 'scheduling_gaps',
        priority: totalGaps > 30 ? 'high' : 'medium',
        title: `${totalGaps} free-period gaps detected across all classes`,
        description: 'Students have unused periods between assigned subjects. Compact scheduling reduces idle time.',
        metric: { totalGaps },
        actionable: true,
        action: 'Re-generate with gap minimization enabled or manually compact the schedule'
      });
    }

    return recs;
  }

  // ─── Subject Distribution Analysis ─────────────────────────────
  _analyzeSubjectDistribution() {
    const recs = [];
    let overdistributed = 0;

    const subjDayCounts = {};
    for (const b of this.blocks) {
      if (!b.subject || b.type === 'reserved') continue;
      const cid = (b.classes?.[0])?.toString();
      const sid = b.subject?.toString();
      if (!cid || !sid) continue;
      const key = `${cid}_${sid}_${b.day}`;
      subjDayCounts[key] = (subjDayCounts[key] || 0) + 1;
    }

    for (const [key, count] of Object.entries(subjDayCounts)) {
      if (count > 2) overdistributed++;
    }

    if (overdistributed > 5) {
      recs.push({
        type: 'subject_clustering',
        priority: 'medium',
        title: `${overdistributed} subject-day combinations exceed 2 periods`,
        description: 'Multiple periods of the same subject on one day reduces learning effectiveness.',
        metric: { count: overdistributed },
        actionable: true,
        action: 'Set maxPerDay=2 for subjects that currently have higher daily caps'
      });
    }

    return recs;
  }

  // ─── Constraint Relaxation Suggestions ─────────────────────────
  _analyzeConstraintRelaxation() {
    const recs = [];
    const factors = this.score.factors || {};

    if (factors.completeness !== undefined && factors.completeness < 80) {
      recs.push({
        type: 'constraint_relaxation',
        priority: 'high',
        title: 'Low completeness score — consider relaxing constraints',
        description: `Completeness: ${factors.completeness}%. Some blocks couldn't be placed. Consider:`,
        metric: { completeness: factors.completeness },
        actionable: true,
        action: '1) Add more available rooms\n2) Extend working days\n3) Increase max periods per day for teachers\n4) Allow flexible period structures'
      });
    }

    if (factors.teacherWorkloadBalance !== undefined && factors.teacherWorkloadBalance < 60) {
      recs.push({
        type: 'workload_suggestion',
        priority: 'medium',
        title: 'Teacher workload imbalance detected',
        description: `Balance score: ${factors.teacherWorkloadBalance}%. Teaching load is unevenly distributed.`,
        metric: { balance: factors.teacherWorkloadBalance },
        actionable: true,
        action: 'Review CanTeach assignments — some teachers may be assigned too many or too few subjects'
      });
    }

    return recs;
  }
}

module.exports = AIRecommendationEngine;
