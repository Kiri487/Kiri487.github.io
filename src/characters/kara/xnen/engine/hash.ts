/** Three integers to a number in [0, 1). The whole place is built from this, so one seed always gives the same place. */
export function hash3(x: number, y: number, s: number): number {
  let n = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x2c1b3c6d);
  n ^= n >>> 12;
  n = Math.imul(n, 0x297a2d39);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}

/** Remainder that stays positive, for coordinates on both sides of zero. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;
