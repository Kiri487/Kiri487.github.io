/** Randomness for setting up a round. Always from a generator, so a round can be rebuilt from its seed. */

export type Rng = () => number;

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** An integer in [min, max]. */
export function between(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}
