import type { WorldMap } from "./map";

/*
 * The timecode compass. It's always 4 o'clock; the digits after the colon say how far the nearest statue is, as the
 * crow flies, and only in front of one does it read 4:20. Walls don't count: it can say a statue is right there with
 * no way through yet. That's the place.
 */

/** How far off nearestStatue looks at most: past every band, where all it does is read the most digits. */
const FARTHEST_LOOK = 300;

/** Straight-line distance in cells from (x, y) to the nearest statue, or Infinity if none stands nearby. */
export function nearestStatue(map: WorldMap, x: number, y: number): number {
  // Looked for within a region's width first. One found farther off than that may not be the nearest: a nearer one
  // could stand just outside the square looked in, so it looks again, wider, out to past the last band's reach.
  let best = Infinity;
  for (let radius = map.region; ; radius *= 2) {
    for (const s of map.statuesAround(x, y, radius)) best = Math.min(best, Math.hypot(s.x - x, s.y - y));
    if (best <= radius || radius >= FARTHEST_LOOK) return best;
  }
}


/** At or under this distance it reads 4:20: close enough to touch. */
export const AT_STATUE = 1.4;
/** Up to these distances (in cells, before tuning stretches them) the timecode has this many digits. */
const BANDS: readonly (readonly [number, number])[] = [
  [21, 2],
  [42, 3],
  [77, 4],
  [112, 5],
  [154, 6],
];
const MOST_DIGITS = 7;
/** Within this many cells it counts down 4:29 … 4:21. */
const CLOSE = 10;

function randomDigits(count: number): string {
  // Two digits from 30 up, so far away never reads as 4:2x.
  let s = count === 2 ? String(3 + Math.floor(Math.random() * 7)) : "";
  while (s.length < count) s += String(Math.floor(Math.random() * 10));
  return s;
}

/** The digits after "4:", jumpy rather than smooth like a dial, and now and then slipping back. */
export class Timecode {
  private shown = "20";
  private shownKey = "";
  private nextChange = 0;

  /**
   * `distance` in cells, `stretch` the tuning's percentage, `now` in seconds. With reduced motion the digits only
   * change when the distance moves into another band, and don't jump about in between.
   */
  update(distance: number, stretch: number, now: number, reduced: boolean): string {
    if (distance <= AT_STATUE) {
      this.shown = "20";
      this.shownKey = "20";
      return this.shown;
    }
    const k = Math.max(0.2, stretch / 100);
    let d = distance;
    if (!reduced) {
      if (now < this.nextChange) return this.shown;
      this.nextChange = now + 0.35 + Math.random() * 0.45;
      d *= 1 + (Math.random() - 0.5) * 0.2;
      if (Math.random() < 0.12) d *= 1.6;
    }
    let key: string;
    let text: string;
    if (d < CLOSE * k) {
      const n = Math.min(9, Math.max(1, Math.round(d / k)));
      key = text = `2${n}`;
    } else {
      const band = BANDS.find(([upTo]) => d < upTo * k);
      const count = band ? band[1] : MOST_DIGITS;
      key = String(count);
      text = key === this.shownKey && reduced ? this.shown : randomDigits(count);
    }
    this.shown = text;
    this.shownKey = key;
    return text;
  }
}
