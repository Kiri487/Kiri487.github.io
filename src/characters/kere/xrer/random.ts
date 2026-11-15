/** Randomness for setting up a round. Only called from event handlers, never during render. */

export function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** An integer in [min, max]. */
export function between(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
