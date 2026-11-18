import { nearestStatue } from "./compass";
import { hash3 } from "./hash";
import type { WorldMap } from "./map";
import type { Tuning } from "./tuning";

/*
 * The Weed Cat Cult's posters (Kiri's picture), stuck up here and there on the walls. They're rare, but there are
 * more of them the nearer a statue is. Each is one of a few copies aged differently: yellowed, damp, creased, a
 * corner or two torn off. The green on them (the leaves, the moons, 信者募集) glows faintly in the dark, like the
 * leaf on a statue's chest.
 */

/** One size of a poster copy: RGB, and per pixel 0 where the paper's torn away, otherwise 1 + glow × 254. */
export interface PosterLevel {
  w: number;
  h: number;
  rgb: Uint8Array;
  mask: Uint8Array;
}

/** One aged copy, at full size and then halved again and again, so a far poster doesn't sparkle. */
export type PosterArt = PosterLevel[];

/** How wide a poster is, as a share of a cell. Its height follows the picture. */
const POSTER_WIDTH = 0.25;
/** How strongly the green on it glows, next to a statue's leaf (1). */
export const POSTER_GLOW = 0.45;

/** How many differently aged copies there are. */
const COPIES = 8;
/** The chance of a poster on any stretch of wall, far from every statue, at 100 %. */
const RARE = 0.015;
/** The chance added close to a statue, at 100 %, fading out between these two distances in cells. */
const NEAR = 0.22;
const NEAR_FULL = 5;
const NEAR_GONE = 30;

/** The yellowish brown old paper and ink drift towards. */
const AGED = [96, 84, 52];
/** The picture is dark: printed and lit on a wall it reads a little brighter. */
const INK_LIFT = 1.3;
/** Damp: darker and browner. */
const DAMP = [58, 44, 22];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Smooth noise over the poster, for jagged tears and blotchy stains. */
function wobble(u: number, v: number, scale: number, s: number): number {
  const x = u * scale;
  const y = v * scale;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash3(xi, yi, s);
  const b = hash3(xi + 1, yi, s);
  const c = hash3(xi, yi + 1, s);
  const d = hash3(xi + 1, yi + 1, s);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** How green a pixel of the picture is, 0–1: the parts that glow. */
function greenness(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max !== g || max === 0) return 0;
  const sat = (max - min) / max;
  const hue = ((b - r) / (max - min) + 2) / 6;
  if (hue < 0.15 || hue > 0.42) return 0;
  return clamp01((sat - 0.2) / 0.25) * clamp01((max / 255 - 0.18) / 0.15);
}

/** One copy of the picture, aged by its own dice. */
function ageCopy(src: Uint8ClampedArray, w: number, h: number, copy: number): PosterLevel {
  const roll = (k: number) => hash3(copy, k, 4207);
  const fade = 0.12 + roll(1) * 0.3;
  // Damp creeping up from the bottom (or now and then down from the top), with a dark tide line at its edge.
  const damp = roll(2) < 0.6;
  const fromTop = roll(3) < 0.25;
  const dampLine = fromTop ? 0.12 + roll(4) * 0.2 : 0.62 + roll(4) * 0.25;
  // A couple of round stains.
  const stains = [0, 1].map((i) => ({
    on: roll(10 + i) < 0.5,
    u: roll(12 + i),
    v: roll(14 + i),
    r: 0.07 + roll(16 + i) * 0.12,
  }));
  // Corners torn off: top left, top right, bottom right, bottom left.
  const tears = [0, 1, 2, 3].map((i) => (roll(20 + i) < 0.32 ? 0.08 + roll(24 + i) * 0.16 : 0));
  // Creases: lines across the paper, lighter on one side and darker on the other.
  const creases = Array.from({ length: Math.floor(roll(30) * 3.4) }, (_, i) => {
    const angle = roll(31 + i) * Math.PI;
    return { nx: Math.cos(angle), ny: Math.sin(angle), at: roll(35 + i) - 0.5 };
  });
  const aspect = h / w;

  const rgb = new Uint8Array(w * h * 3);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const i = y * w + x;
      // Torn corners, with ragged edges.
      const corners = [
        [u, v * aspect],
        [1 - u, v * aspect],
        [1 - u, (1 - v) * aspect],
        [u, (1 - v) * aspect],
      ];
      let torn = false;
      for (let k = 0; k < 4; k++) {
        if (!tears[k]) continue;
        const [cu, cv] = corners[k];
        if (cu + cv * 0.8 < tears[k] + (wobble(u, v, 40, copy * 7 + k) - 0.5) * 0.05) torn = true;
      }
      if (torn) continue;

      const s = i * 4;
      const glow = greenness(src[s], src[s + 1], src[s + 2]);
      let r = src[s] * INK_LIFT;
      let g = src[s + 1] * INK_LIFT;
      let b = src[s + 2] * INK_LIFT;
      r += (AGED[0] - r) * fade;
      g += (AGED[1] - g) * fade;
      b += (AGED[2] - b) * fade;

      let wet = 0;
      if (damp) {
        const line = dampLine + (wobble(u, 0, 7, copy * 11) - 0.5) * 0.12;
        const into = fromTop ? line - v : v - line;
        if (into > 0) wet = 0.35 + 0.25 * wobble(u, v, 9, copy * 13);
        if (Math.abs(into) < 0.012) wet = 0.75;
      }
      for (const stain of stains) {
        if (!stain.on) continue;
        const dist = Math.hypot(u - stain.u, (v - stain.v) * aspect) / stain.r;
        const edge = dist + (wobble(u, v, 14, copy * 17) - 0.5) * 0.4;
        if (edge < 1) wet = Math.max(wet, edge > 0.88 ? 0.6 : 0.25);
      }
      if (wet) {
        r += (DAMP[0] - r) * wet;
        g += (DAMP[1] - g) * wet;
        b += (DAMP[2] - b) * wet;
      }

      let shade = 1;
      for (const crease of creases) {
        const d = ((u - 0.5) * crease.nx + (v - 0.5) * aspect * crease.ny - crease.at) / 0.02;
        shade += 0.3 * d * Math.exp(-d * d);
      }
      rgb[i * 3] = Math.min(255, r * shade);
      rgb[i * 3 + 1] = Math.min(255, g * shade);
      rgb[i * 3 + 2] = Math.min(255, b * shade);
      mask[i] = 1 + Math.round(glow * (1 - wet) * 254);
    }
  }
  return { w, h, rgb, mask };
}

/** Half the size: each pixel the average of four, torn away if most of them are. */
function halve(level: PosterLevel): PosterLevel {
  const w = Math.max(1, level.w >> 1);
  const h = Math.max(1, level.h >> 1);
  const rgb = new Uint8Array(w * h * 3);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, glow = 0, paper = 0;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const k = Math.min(level.h - 1, y * 2 + j) * level.w + Math.min(level.w - 1, x * 2 + i);
          if (!level.mask[k]) continue;
          r += level.rgb[k * 3];
          g += level.rgb[k * 3 + 1];
          b += level.rgb[k * 3 + 2];
          glow += level.mask[k] - 1;
          paper++;
        }
      }
      if (paper < 2) continue;
      const k = y * w + x;
      rgb[k * 3] = r / paper;
      rgb[k * 3 + 1] = g / paper;
      rgb[k * 3 + 2] = b / paper;
      mask[k] = 1 + Math.round(glow / paper);
    }
  }
  return { w, h, rgb, mask };
}

/** Every aged copy of the picture (RGBA, w × h), each at every size. */
export function agePosters(src: Uint8ClampedArray, w: number, h: number): PosterArt[] {
  return Array.from({ length: COPIES }, (_, copy) => {
    const levels = [ageCopy(src, w, h, copy)];
    while (levels[levels.length - 1].h > 12) levels.push(halve(levels[levels.length - 1]));
    return levels;
  });
}

/**
 * A poster on a face of wall, all in wall units (a cell is 1 across, the wall 1 high): its middle across the wall
 * left to right as seen and down it from the ceiling, its half width and half height, how it's turned, and how far
 * from its middle any corner can reach.
 */
export interface PosterSpot {
  copy: number;
  across: number;
  down: number;
  halfW: number;
  halfH: number;
  cos: number;
  sin: number;
  reach: number;
}

/**
 * The posters on one face of wall cell (cx, cy), the last on top, or null. `face` is the side it's seen from: 0
 * from the west, 1 the east, 2 the north, 3 the south. `aspect` is the picture's height over its width. Stuck up by
 * hand, carelessly: none quite straight, at all heights, many crooked, a few sideways or upside down, and often
 * several overlapping.
 * The same every time for this map.
 */
export function postersOn(
  map: WorldMap,
  cx: number,
  cy: number,
  face: number,
  tuning: Tuning,
  aspect: number,
): PosterSpot[] | null {
  const fx = cx * 4 + face;
  const rare = (RARE * tuning.posters) / 100;
  const near = (NEAR * tuning.posterNear) / 100;
  const dice = map.noise(fx, cy, 300);
  // Most walls have none whatever the statues: no need to look for one.
  if (dice >= rare + near) return null;
  if (dice >= rare) {
    const d = nearestStatue(map, cx + 0.5, cy + 0.5);
    const closeness = clamp01((NEAR_GONE - d) / (NEAR_GONE - NEAR_FULL));
    if (dice >= rare + near * closeness) return null;
  }

  const roll = (k: number) => map.noise(fx, cy, 310 + k);
  const bunch = roll(0);
  const count = bunch < 0.05 ? 5 : bunch < 0.12 ? 4 : bunch < 0.3 ? 3 : bunch < 0.55 ? 2 : 1;
  const spots: PosterSpot[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => roll(1 + i * 8 + k);
    const halfW = POSTER_WIDTH / 2;
    const halfH = (POSTER_WIDTH * aspect) / 2;
    const reach = Math.hypot(halfW, halfH);
    const tilt = r(1);
    let angle = (r(2) - 0.5) * (tilt < 0.2 ? 0.07 : tilt < 0.65 ? 0.35 : 0.87);
    // Now and then one on its side or upside down.
    if (tilt > 0.95) angle += tilt > 0.98 ? Math.PI : (r(7) < 0.5 ? -1 : 1) * (Math.PI / 2);
    // The first anywhere along the wall, about eye height; the rest beside it, overlapping a little.
    const side = r(3) < 0.5 ? -1 : 1;
    let across = i === 0 ? r(4) : spots[0].across + side * (0.04 + r(4) * 0.22);
    let down = i === 0 ? 0.25 + r(5) * 0.5 : spots[0].down + (r(5) - 0.5) * 0.5;
    across = Math.min(1 - reach, Math.max(reach, across));
    down = Math.min(0.97 - reach, Math.max(0.03 + reach, down));
    spots.push({
      copy: Math.floor(r(6) * COPIES),
      across,
      down,
      halfW,
      halfH,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      reach,
    });
  }
  return spots;
}
