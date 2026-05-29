/**
 * ManualTimetableService — Orchestrator for manual timetable creation.
 */
const GeneratedTimetable = require('../../models/GeneratedTimetable');
const LessonBlock = require('../../models/LessonBlock');
const AuditLog = require('../../models/AuditLog');
const SubjectRequirement = require('../../models/SubjectRequirement');
const validator = require('./ManualLessonValidator');
const suggestions = require('./ManualSuggestionService');

class ManualTimetableService {
  /**
   * Create a blank draft timetable for manual building.
   */
  async createBlank({ schoolId, sessionId, name, userId, scope }) {
    const timetable = await GeneratedTimetable.create({
      school: schoolId,
      session: sessionId,
      name: name || `Manual Timetable - ${new Date().toLocaleDateString()}`,
      creationMode: 'manual',
      status: 'draft',
      createdBy: userId,
      stats: { totalBlocks: 0, placedBlocks: 0, unplacedBlocks: 0 },
      diagnostics: { scope: scope || 'full_school' }
    });

    await this._audit(schoolId, sessionId, userId, 'manual_timetable_created', 'timetable', timetable._id, timetable.name);

    return timetable;
  }

  /**
   * Clone an existing timetable into a new draft.
   */
  async cloneExisting({ sourceTimetableId, schoolId, sessionId, name, userId }) {
    const source = await GeneratedTimetable.findById(sourceTimetableId);
    if (!source || source.school.toString() !== schoolId) {
      throw new Error('Source timetable not found or access denied');
    }

    const timetable = await GeneratedTimetable.create({
      school: schoolId,
      session: sessionId,
      name: name || `Copy of ${source.name}`,
      creationMode: 'copied',
      sourceTimetableId,
      status: 'draft',
      createdBy: userId,
      stats: { ...source.stats?.toObject?.() || source.stats }
    });

    // Clone all lesson blocks
    const blocks = await LessonBlock.find({ timetable: sourceTimetableId });
    const bulkOps = blocks.map(b => ({
      ...b.toObject(),
      _id: undefined,
      timetable: timetable._id,
      source: 'copied',
      isDraft: true,
      parentBlockId: b._id
    }));

    if (bulkOps.length > 0) {
      await LessonBlock.insertMany(bulkOps);
    }

    await this._audit(schoolId, sessionId, userId, 'manual_timetable_created', 'timetable', timetable._id, timetable.name, { sourceTimetableId });

    return timetable;
  }

  /**
   * Add a lesson block manually.
   */
  async addLesson({ timetableId, schoolId, sessionId, userId, lesson, force = false }) {
    const tt = await this._getTimetable(timetableId, schoolId);

    // Validate
    const validation = await validator.validate({
      timetableId, schoolId, sessionId, lesson
    });

    if (validation.status === 'blocked' && !force) {
      return { success: false, validation, block: null };
    }

    const periods = Array.from({ length: lesson.duration || 1 }, (_, i) => (lesson.period || 1) + i);

    const block = await LessonBlock.create({
      school: schoolId,
      timetable: timetableId,
      type: lesson.type || 'normal',
      duration: lesson.duration || 1,
      subject: lesson.subjectId,
      teacher: lesson.teacherId,
      room: lesson.roomId,
      classes: lesson.classId ? [lesson.classId] : [],
      studentGroup: lesson.studentGroup,
      day: lesson.day,
      periods,
      source: 'manual',
      manuallyCreatedBy: userId,
      manualReason: lesson.reason,
      validationStatus: validation.status,
      warningCodes: validation.messages.filter(m => m.type === 'warning' || m.type === 'blocked').map(m => m.code),
      forceWithWarning: force && validation.status === 'warning',
      isDraft: true
    });

    // Update stats
    tt.stats.placedBlocks = (tt.stats.placedBlocks || 0) + 1;
    tt.stats.totalBlocks = (tt.stats.totalBlocks || 0) + 1;
    await tt.save();

    await this._audit(schoolId, sessionId, userId, 'manual_lesson_added', 'lesson_block', block._id, `${lesson.day} P${lesson.period}`, { lesson });

    return { success: true, validation, block };
  }

  /**
   * Update a lesson block.
   */
  async updateLesson({ timetableId, blockId, schoolId, sessionId, userId, updates }) {
    const tt = await this._getTimetable(timetableId, schoolId);
    const block = await LessonBlock.findOne({ _id: blockId, timetable: timetableId });
    if (!block) throw new Error('Lesson block not found');

    if (block.isLocked) throw new Error('This lesson is locked and cannot be updated');

    const oldData = block.toObject();

    // Re-validate if key fields changed
    if (updates.teacherId || updates.classId || updates.roomId || updates.day || updates.period) {
      const lesson = {
        classId: updates.classId || block.classes?.[0],
        subjectId: updates.subjectId || block.subject,
        teacherId: updates.teacherId || block.teacher,
        roomId: updates.roomId || block.room,
        day: updates.day || block.day,
        period: updates.period || block.periods?.[0],
        duration: updates.duration || block.duration
      };
      const validation = await validator.validate({
        timetableId, schoolId, sessionId, lesson, excludeBlockId: blockId
      });

      if (validation.status === 'blocked') {
        return { success: false, validation, block: null };
      }
      block.validationStatus = validation.status;
      block.warningCodes = validation.messages.filter(m => m.type === 'warning').map(m => m.code);
    }

    // Apply updates
    if (updates.teacherId) block.teacher = updates.teacherId;
    if (updates.classId) block.classes = [updates.classId];
    if (updates.subjectId) block.subject = updates.subjectId;
    if (updates.roomId) block.room = updates.roomId;
    if (updates.day) block.day = updates.day;
    if (updates.period) block.periods = Array.from({ length: updates.duration || block.duration }, (_, i) => updates.period + i);
    if (updates.duration) block.duration = updates.duration;
    if (updates.type) block.type = updates.type;
    if (updates.reason) block.manualReason = updates.reason;

    block.editHistory.push({
      action: 'update', before: oldData, after: updates, userId, reason: updates.reason
    });

    await block.save();
    await this._audit(schoolId, sessionId, userId, 'manual_lesson_updated', 'lesson_block', block._id);

    return { success: true, block };
  }

  /**
   * Delete a lesson block.
   */
  async deleteLesson({ timetableId, blockId, schoolId, sessionId, userId }) {
    const tt = await this._getTimetable(timetableId, schoolId);
    const block = await LessonBlock.findOne({ _id: blockId, timetable: timetableId });
    if (!block) throw new Error('Lesson block not found');
    if (block.isLocked) throw new Error('This lesson is locked and cannot be deleted');

    await LessonBlock.deleteOne({ _id: blockId });

    tt.stats.placedBlocks = Math.max(0, (tt.stats.placedBlocks || 1) - 1);
    await tt.save();

    await this._audit(schoolId, sessionId, userId, 'manual_lesson_deleted', 'lesson_block', blockId);

    return { success: true };
  }

  /**
   * Move a lesson to a different day/period.
   */
  async moveLesson({ timetableId, blockId, schoolId, sessionId, userId, newDay, newPeriod }) {
    const block = await LessonBlock.findOne({ _id: blockId, timetable: timetableId });
    if (!block) throw new Error('Lesson block not found');
    if (block.isLocked) throw new Error('This lesson is locked');

    const lesson = {
      classId: block.classes?.[0],
      subjectId: block.subject,
      teacherId: block.teacher,
      roomId: block.room,
      day: newDay,
      period: newPeriod,
      duration: block.duration
    };

    const validation = await validator.validate({
      timetableId, schoolId, sessionId, lesson, excludeBlockId: blockId
    });

    if (validation.status === 'blocked') {
      return { success: false, validation };
    }

    const oldDay = block.day;
    const oldPeriods = [...block.periods];
    block.day = newDay;
    block.periods = Array.from({ length: block.duration }, (_, i) => newPeriod + i);
    block.validationStatus = validation.status;
    block.editHistory.push({
      action: 'move',
      before: { day: oldDay, periods: oldPeriods },
      after: { day: newDay, periods: block.periods },
      userId
    });

    await block.save();
    await this._audit(schoolId, sessionId, userId, 'manual_lesson_moved', 'lesson_block', blockId);

    return { success: true, validation, block };
  }

  /**
   * Swap two lessons.
   */
  async swapLessons({ timetableId, blockIdA, blockIdB, schoolId, sessionId, userId }) {
    const [blockA, blockB] = await Promise.all([
      LessonBlock.findOne({ _id: blockIdA, timetable: timetableId }),
      LessonBlock.findOne({ _id: blockIdB, timetable: timetableId })
    ]);

    if (!blockA || !blockB) throw new Error('One or both blocks not found');
    if (blockA.isLocked || blockB.isLocked) throw new Error('Cannot swap locked lessons');

    // Swap day and periods
    const tempDay = blockA.day;
    const tempPeriods = [...blockA.periods];
    blockA.day = blockB.day;
    blockA.periods = [...blockB.periods];
    blockB.day = tempDay;
    blockB.periods = tempPeriods;

    blockA.editHistory.push({ action: 'swap', before: { day: tempDay, periods: tempPeriods }, after: { day: blockA.day, periods: blockA.periods }, userId });
    blockB.editHistory.push({ action: 'swap', before: { day: blockB.day, periods: blockB.periods }, after: { day: tempDay, periods: tempPeriods }, userId });

    await Promise.all([blockA.save(), blockB.save()]);
    await this._audit(schoolId, sessionId, userId, 'manual_lesson_swapped', 'lesson_block', blockIdA, null, { blockIdB });

    return { success: true, blockA, blockB };
  }

  /**
   * Lock/unlock a lesson.
   */
  async lockLesson({ timetableId, blockId, schoolId, sessionId, userId, lock = true }) {
    const block = await LessonBlock.findOne({ _id: blockId, timetable: timetableId });
    if (!block) throw new Error('Lesson block not found');
    block.isLocked = lock;
    block.editHistory.push({ action: lock ? 'lock' : 'unlock', userId });
    await block.save();

    await this._audit(schoolId, sessionId, userId, lock ? 'manual_lesson_locked' : 'manual_lesson_unlocked', 'lesson_block', blockId);

    return { success: true, block };
  }

  /**
   * Save draft (update last-saved timestamp and completeness).
   */
  async saveDraft({ timetableId, schoolId, sessionId, userId }) {
    const tt = await this._getTimetable(timetableId, schoolId);
    const score = await this._calculateCompleteness(timetableId, schoolId, sessionId);
    tt.manualCompletenessScore = score;
    tt.status = 'draft';
    await tt.save();
    return { success: true, completenessScore: score, savedAt: new Date() };
  }

  /**
   * Run full validation on entire timetable.
   */
  async validateFull({ timetableId, schoolId, sessionId, userId }) {
    const blocks = await LessonBlock.find({ timetable: timetableId });
    const issues = [];

    for (const block of blocks) {
      const lesson = {
        classId: block.classes?.[0],
        subjectId: block.subject,
        teacherId: block.teacher,
        roomId: block.room,
        day: block.day,
        period: block.periods?.[0],
        duration: block.duration
      };
      const result = await validator.validate({
        timetableId, schoolId, sessionId, lesson, excludeBlockId: block._id
      });
      if (result.status !== 'allowed') {
        issues.push({ blockId: block._id, day: block.day, periods: block.periods, ...result });
      }
    }

    const tt = await this._getTimetable(timetableId, schoolId);
    tt.validationSummary = {
      totalBlocks: blocks.length,
      issueCount: issues.length,
      blockedCount: issues.filter(i => i.status === 'blocked').length,
      warningCount: issues.filter(i => i.status === 'warning').length
    };
    tt.lastValidatedAt = new Date();
    tt.manualCompletenessScore = await this._calculateCompleteness(timetableId, schoolId, sessionId);
    await tt.save();

    await this._audit(schoolId, sessionId, userId, 'manual_timetable_validated', 'timetable', timetableId);

    return { success: true, summary: tt.validationSummary, issues, completenessScore: tt.manualCompletenessScore };
  }

  /**
   * Publish a manual timetable.
   */
  async publish({ timetableId, schoolId, sessionId, userId }) {
    const tt = await this._getTimetable(timetableId, schoolId);

    // Mark all blocks as non-draft
    await LessonBlock.updateMany({ timetable: timetableId }, { isDraft: false });

    tt.status = 'published';
    tt.publishedAt = new Date();
    tt.publishedByUser = userId;
    await tt.save();

    await this._audit(schoolId, sessionId, userId, 'manual_timetable_published', 'timetable', timetableId, tt.name);

    return { success: true, timetable: tt };
  }

  /**
   * Get timetable with blocks and progress.
   */
  async getTimetableDetails({ timetableId, schoolId, sessionId }) {
    const tt = await GeneratedTimetable.findOne({ _id: timetableId, school: schoolId })
      .populate('createdBy', 'name email')
      .populate('publishedByUser', 'name email');
    if (!tt) throw new Error('Timetable not found');

    const blocks = await LessonBlock.find({ timetable: timetableId })
      .populate('subject', 'name code color')
      .populate('teacher', 'name shortName')
      .populate('room', 'name roomNumber')
      .populate('classes', 'grade section stream');

    const completeness = await this._calculateCompleteness(timetableId, schoolId, sessionId);

    return { timetable: tt, blocks, completenessScore: completeness };
  }

  // ── Internal helpers ──

  async _getTimetable(timetableId, schoolId) {
    const tt = await GeneratedTimetable.findOne({ _id: timetableId, school: schoolId });
    if (!tt) throw new Error('Timetable not found or access denied');
    return tt;
  }

  async _calculateCompleteness(timetableId, schoolId, sessionId) {
    const reqs = await SubjectRequirement.find({ school: schoolId, session: sessionId, isActive: true });
    if (reqs.length === 0) return 100;

    let totalRequired = 0;
    let totalAssigned = 0;

    for (const req of reqs) {
      totalRequired += req.periodsPerWeek;
      const blocks = await LessonBlock.find({
        timetable: timetableId, classes: req.class, subject: req.subject
      });
      const assigned = blocks.reduce((sum, b) => sum + (b.duration || b.periods?.length || 1), 0);
      totalAssigned += Math.min(assigned, req.periodsPerWeek);
    }

    return totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 100;
  }

  async _audit(schoolId, sessionId, userId, action, entityType, entityId, entityName, extra = {}) {
    try {
      await AuditLog.create({
        school: schoolId,
        session: sessionId,
        user: userId,
        action,
        entityType,
        entityId,
        entityName,
        source: 'manual',
        ...extra
      });
    } catch { /* audit should never block operations */ }
  }
}

module.exports = new ManualTimetableService();
