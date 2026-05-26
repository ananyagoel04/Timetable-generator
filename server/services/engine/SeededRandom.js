/**
 * SeededRandom — Deterministic PRNG using Mulberry32 algorithm.
 * Same seed always produces the same sequence of random numbers.
 */
class SeededRandom {
  constructor(seed) {
    this.state = this._hashSeed(seed);
  }

  /**
   * Convert any string/number seed into a 32-bit integer.
   */
  _hashSeed(seed) {
    if (typeof seed === 'number') return seed | 0;
    const str = String(seed);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash || 1; // Ensure non-zero
  }

  /**
   * Generate next random float in [0, 1).
   * Mulberry32 algorithm — fast, small footprint, good distribution.
   */
  next() {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Random integer in [min, max] inclusive.
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Fisher-Yates shuffle with seeded random.
   * Mutates and returns the array.
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Pick a random element from an array.
   */
  pick(arr) {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Partial shuffle: preserves relative priority ordering but shuffles
   * within same-priority groups (using a groupKey function).
   */
  partialShuffle(arr, groupKeyFn) {
    let i = 0;
    while (i < arr.length) {
      const key = groupKeyFn(arr[i]);
      let j = i;
      while (j < arr.length && groupKeyFn(arr[j]) === key) j++;
      // Shuffle the group [i, j)
      const group = arr.slice(i, j);
      this.shuffle(group);
      for (let k = 0; k < group.length; k++) {
        arr[i + k] = group[k];
      }
      i = j;
    }
    return arr;
  }

  /**
   * Create a seed string from school context for deterministic generation.
   */
  static createSeed(schoolId, sessionId) {
    return `${schoolId}_${sessionId}_${Math.floor(Date.now() / 60000)}`;
  }
}

module.exports = SeededRandom;
