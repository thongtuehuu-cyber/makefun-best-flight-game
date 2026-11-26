// A small seeded random number generator (mulberry32): the same seed gives the
// same valley, the same rings and the same game, which is what makes the
// screenshot scenes repeatable. Written here from the algorithm's definition,
// not copied from any library.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A deterministic hash of two integer cell coordinates and a seed, returning a
 * value in [0, 1). Used to paint the field patchwork so the same valley always
 * looks the same without storing a map.
 */
export function cellHash(cellX, cellZ, seed) {
  let h = (cellX * 374761393 + cellZ * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
