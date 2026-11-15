/**
 * A small seeded generator, so the same text corrupts the same way on every render (no Math.random in render), and
 * the same field of the record rots the same way all round.
 */
export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** A number in [0, 1) fixed for this seed: for deciding which fields of a document get hit. */
export function chance(seed: string): number {
  return seeded(seed)();
}
