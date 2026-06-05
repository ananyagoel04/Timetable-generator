/**
 * Break deduplication and period utilities used across the application.
 */

/**
 * Deduplicate consecutive breaks that have identical type and label.
 * Merges their time ranges so only one entry is shown.
 *
 * @param {Array} timeslots - Array of timeslot objects
 * @returns {Array} Deduplicated array
 */
export function dedupeBreaks(timeslots) {
  if (!timeslots || timeslots.length === 0) return [];

  const result = [];
  for (let i = 0; i < timeslots.length; i++) {
    const slot = timeslots[i];
    const prev = result[result.length - 1];

    if (
      prev &&
      !slot.isSchedulable &&
      !prev.isSchedulable &&
      slot.type === prev.type &&
      slot.label === prev.label &&
      slot.startTime === prev.endTime
    ) {
      // Merge: extend the previous break's end time
      result[result.length - 1] = { ...prev, endTime: slot.endTime, _merged: true };
    } else {
      result.push({ ...slot });
    }
  }
  return result;
}

/**
 * Calculate duration in minutes between two HH:mm time strings.
 *
 * @param {string} start - Start time in HH:mm
 * @param {string} end   - End time in HH:mm
 * @returns {number} Duration in minutes
 */
export function getDuration(start, end) {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

/**
 * Format a slot label for display. Returns an enriched label string.
 * Teaching periods get "P1", "P2", etc.
 * Non-teaching slots keep their label as-is.
 *
 * @param {Object} slot - Timeslot object
 * @param {number} teachingIndex - 1-based index among teaching periods
 * @returns {string} Display label
 */
export function formatPeriodLabel(slot, teachingIndex) {
  if (slot.isSchedulable) {
    return slot.label || `P${teachingIndex}`;
  }
  return slot.label || slot.type.charAt(0).toUpperCase() + slot.type.slice(1);
}

/**
 * Compute summary stats for a set of timeslots.
 *
 * @param {Array} slots - Array of timeslot objects
 * @returns {{ totalMinutes: number, teachingPeriods: number, breakCount: number, teachingMinutes: number }}
 */
export function computeStats(slots) {
  let totalMinutes = 0;
  let teachingPeriods = 0;
  let breakCount = 0;
  let teachingMinutes = 0;

  for (const s of slots) {
    const dur = getDuration(s.startTime, s.endTime);
    totalMinutes += dur;
    if (s.isSchedulable) {
      teachingPeriods++;
      teachingMinutes += dur;
    } else {
      breakCount++;
    }
  }

  return { totalMinutes, teachingPeriods, breakCount, teachingMinutes };
}

/**
 * Map day index (0–6) to day name.
 */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Map day name to index.
 */
export const DAY_INDEX = Object.fromEntries(DAY_NAMES.map((d, i) => [d, i]));
