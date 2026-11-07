// Mulberry32 deterministic 32-bit pseudo-random number generator
export class PRNG {
  constructor(seed = 4207) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    if (typeof seed === 'string') {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
      }
      this.s = h >>> 0;
    } else {
      this.s = Math.floor(Math.abs(seed)) >>> 0;
    }
    if (this.s === 0) this.s = 1;
  }

  // Returns pseudo-random float in [0, 1)
  random() {
    let t = (this.s += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns random float in [min, max)
  range(min, max) {
    return min + this.random() * (max - min);
  }

  // Returns random integer in [min, max] inclusive
  rangeInt(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // Returns random element from array
  choice(array) {
    if (!array || array.length === 0) return null;
    return array[this.rangeInt(0, array.length - 1)];
  }

  // Fisher-Yates array shuffle in place
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.rangeInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

