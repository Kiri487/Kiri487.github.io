import { nearestStatue } from "./compass";
import { cellHasHole } from "./decay";
import { hash3, mod } from "./hash";
import type { WorldMap } from "./map";
import type { Tuning } from "./tuning";

/*
 * The Weed Cat Cult's posters (Kiri's picture), stuck up here and there on the walls and ceiling. They're rare, but
 * there are more of them the nearer a statue is. Each is one of a few copies aged differently: yellowed, damp,
 * creased, a corner or two torn off; some were torn down long ago and only a scrap is left, or only the tape. The
 * green on them (the leaves, the moons, 信者募集) glows faintly in the dark, like the leaf on a statue's chest.
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
export const POSTER_WIDTH = 0.25;
/** How strongly the green on it glows, next to a statue's leaf (1). */
export const POSTER_GLOW = 0.45;

/** How many differently aged copies there are: whole, torn down to a scrap, and torn off leaving only the tape. */
const WHOLE = 8;
const SCRAPS = 6;
const TAPE_ONLY = 2;
/** Of the posters put up, how many are now scraps, and how many only tape. */
const SCRAP_SHARE = 0.18;
const TAPE_SHARE = 0.07;
/** The chance of a poster on any stretch of wall, far from every statue, at 100 %. */
const RARE = 0.015;
/** The chance added close to a statue, at 100 %, fading out between these two distances in cells. */
const NEAR = 0.1;
const NEAR_FULL = 5;
const NEAR_GONE = 30;

/** The yellowish brown old paper and ink drift towards. */
const AGED = [96, 84, 52];
/** The picture is dark: printed and lit on a wall it reads a little brighter. */
const INK_LIFT = 1.3;
/** Damp: darker and browner. */
const DAMP = [58, 44, 22];
/** Old yellowed tape. */
const TAPE = [178, 162, 108];
/** A piece of tape at each corner: its size, as a share of the poster's width, and how far in from the corner. */
const TAPE_SIZE = 0.13;
const TAPE_INSET = 0.01;

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

type Kind = "whole" | "scrap" | "tape";

/** One copy of the picture, aged by its own dice. */
function ageCopy(src: Uint8ClampedArray, w: number, h: number, copy: number, kind: Kind): PosterLevel {
  const roll = (k: number) => hash3(copy, k, 4207);
  // Taped up: every scrap and bare tape, and some of the whole ones (the rest were pinned or glued).
  const taped = kind !== "whole" || copy % 3 === 0;
  const tapeTilt = [0, 1, 2, 3].map((i) => (roll(51 + i) - 0.5) * 0.6);
  // What's left of a scrap: a strip along the top, a corner, or a strip down one side.
  const scrapShape = Math.floor(roll(40) * 3);
  const scrapSize = 0.2 + roll(41) * 0.3;
  const scrapCorner = Math.floor(roll(42) * 4);
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
      // Tape over the corners: it stays when the paper's gone.
      if (taped) {
        let onTape = false;
        for (let k = 0; k < 4 && !onTape; k++) {
          const tu = k === 0 || k === 3 ? u : 1 - u;
          const tv = (k < 2 ? v : 1 - v) * aspect;
          const a = tu - TAPE_INSET - TAPE_SIZE / 2;
          const b = tv - TAPE_INSET - TAPE_SIZE / 2;
          const t = tapeTilt[k];
          onTape = Math.abs(a + b * t) < TAPE_SIZE / 2 && Math.abs(b - a * t) < TAPE_SIZE / 3;
        }
        if (onTape) {
          const shade = 0.85 + wobble(u, v, 30, copy * 19) * 0.25;
          rgb[i * 3] = TAPE[0] * shade;
          rgb[i * 3 + 1] = TAPE[1] * shade;
          rgb[i * 3 + 2] = TAPE[2] * shade;
          mask[i] = 1;
          continue;
        }
      }
      if (kind === "tape") continue;
      if (kind === "scrap") {
        const jag = (wobble(u, v, 24, copy * 23) - 0.5) * 0.08;
        const cu = scrapCorner === 0 || scrapCorner === 3 ? u : 1 - u;
        const cv = (scrapCorner < 2 ? v : 1 - v) * aspect;
        const left =
          scrapShape === 0
            ? v * aspect < scrapSize + jag
            : scrapShape === 1
              ? cu + cv * 0.8 < scrapSize * 1.6 + jag
              : cu < scrapSize + jag;
        if (!left) continue;
      }
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
  return Array.from({ length: WHOLE + SCRAPS + TAPE_ONLY }, (_, copy) => {
    const kind: Kind = copy < WHOLE ? "whole" : copy < WHOLE + SCRAPS ? "scrap" : "tape";
    const levels = [ageCopy(src, w, h, copy, kind)];
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

/** Whether posters went up here: rare anywhere, likelier near a statue. `share` scales both, for the ceiling. */
function chosen(dice: number, map: WorldMap, cx: number, cy: number, tuning: Tuning, share: number): boolean {
  const rare = (RARE * share * tuning.posters) / 100;
  const near = (NEAR * share * tuning.posterNear) / 100;
  // Most places have none whatever the statues: no need to look for one.
  if (dice >= rare + near) return false;
  if (dice < rare) return true;
  const d = nearestStatue(map, cx + 0.5, cy + 0.5);
  return dice < rare + near * clamp01((NEAR_GONE - d) / (NEAR_GONE - NEAR_FULL));
}

/** How many went up together: mostly one, now and then a few. */
function bunchOf(dice: number): number {
  return dice < 0.015 ? 4 : dice < 0.05 ? 3 : dice < 0.2 ? 2 : 1;
}

/** Which copy: mostly whole, some only a scrap, a few only the tape. */
function copyOf(dice: number): number {
  if (dice < TAPE_SHARE) return WHOLE + SCRAPS + Math.floor((dice / TAPE_SHARE) * TAPE_ONLY);
  if (dice < TAPE_SHARE + SCRAP_SHARE) return WHOLE + Math.floor(((dice - TAPE_SHARE) / SCRAP_SHARE) * SCRAPS);
  return Math.floor(((dice - TAPE_SHARE - SCRAP_SHARE) / (1 - TAPE_SHARE - SCRAP_SHARE)) * WHOLE);
}

/** How far a poster's corners reach from its middle. */
const reachOf = (aspect: number) => Math.hypot(POSTER_WIDTH / 2, (POSTER_WIDTH * aspect) / 2);

function spotAt(copy: number, across: number, down: number, angle: number, aspect: number): PosterSpot {
  const halfW = POSTER_WIDTH / 2;
  const halfH = (POSTER_WIDTH * aspect) / 2;
  return { copy, across, down, halfW, halfH, cos: Math.cos(angle), sin: Math.sin(angle), reach: reachOf(aspect) };
}

/** A poster as put up, before it's placed on any one cell. */
interface Put {
  /** On a wall, along its line in world cells; on the ceiling, world x. */
  along: number;
  /** On a wall, down it from the ceiling; on the ceiling, world y. */
  down: number;
  angle: number;
  copy: number;
}

/** The way out of each face of a wall cell: where it's seen from. */
const FACE_OUT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** A face of wall cell (x, y) that can be seen: the cell is wall, and the one it faces is open. */
const faceOpen = (map: WorldMap, x: number, y: number, face: number) =>
  map.wall(x, y) === 1 && map.wall(x + FACE_OUT[face][0], y + FACE_OUT[face][1]) === 0;

/** How far a bunch on a wall may spread from the cell it started on, in cells either way. */
const WALL_SPREAD = 2;

/**
 * The posters that went up starting on one face of wall, or null. A bunch spreads along the wall into the cells
 * beside it, but never past the end of the wall or round a corner.
 */
function putOnWall(map: WorldMap, ox: number, oy: number, face: number, tuning: Tuning, aspect: number): Put[] | null {
  const fx = ox * 4 + face;
  if (!chosen(map.noise(fx, oy, 300), map, ox, oy, tuning, 1)) return null;
  if (!faceOpen(map, ox, oy, face)) return null;
  const alongX = face >= 2;
  const base = alongX ? ox : oy;
  const at = (k: number) => faceOpen(map, alongX ? ox + k : ox, alongX ? oy : oy + k, face);
  // How far the same wall runs either way.
  let lo = 0;
  while (lo > -WALL_SPREAD && at(lo - 1)) lo--;
  let hi = 0;
  while (hi < WALL_SPREAD && at(hi + 1)) hi++;
  const reach = reachOf(aspect);
  const from = base + lo + reach;
  const to = base + hi + 1 - reach;

  const roll = (k: number) => map.noise(fx, oy, 310 + k);
  const count = bunchOf(roll(0));
  const puts: Put[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => roll(1 + i * 8 + k);
    const tilt = r(1);
    let angle = (r(2) - 0.5) * (tilt < 0.2 ? 0.07 : tilt < 0.65 ? 0.35 : 0.87);
    // Now and then one on its side or upside down.
    if (tilt > 0.95) angle += tilt > 0.98 ? Math.PI : (r(7) < 0.5 ? -1 : 1) * (Math.PI / 2);
    // The first anywhere in its cell, at about eye height; each next one beside the last, straggling along.
    const last = puts[puts.length - 1];
    let along = last ? last.along + (r(3) < 0.5 ? -1 : 1) * (0.12 + r(4) * 0.45) : base + r(4);
    let down = last ? last.down + (r(5) - 0.5) * 0.45 : 0.25 + r(5) * 0.5;
    along = Math.min(to, Math.max(from, along));
    down = Math.min(0.97 - reach, Math.max(0.03 + reach, down));
    puts.push({ along, down, angle, copy: copyOf(r(6)) });
  }
  return puts;
}

/**
 * The posters on one face of wall cell (cx, cy), the last on top, or null: those put up on it, and any straggling
 * onto it from the cells beside it. `face` is the side it's seen from: 0 from the west, 1 the east, 2 the north,
 * 3 the south. `aspect` is the picture's height over its width; `across` runs left to right as seen. Stuck up by
 * hand, carelessly: none quite straight, at all heights, many crooked, a few sideways or upside down. The same
 * every time for this map.
 */
export function postersOn(
  map: WorldMap,
  cx: number,
  cy: number,
  face: number,
  tuning: Tuning,
  aspect: number,
): PosterSpot[] | null {
  const alongX = face >= 2;
  const base = alongX ? cx : cy;
  // Seen from in front, faces 0 and 3 run the way the world's axis does; 1 and 2 the other way.
  const forwards = face === 0 || face === 3;
  const reach = reachOf(aspect);
  let spots: PosterSpot[] | null = null;
  for (let k = -WALL_SPREAD; k <= WALL_SPREAD; k++) {
    const puts = putOnWall(map, alongX ? cx + k : cx, alongX ? cy : cy + k, face, tuning, aspect);
    if (!puts) continue;
    for (const put of puts) {
      const offset = put.along - base;
      if (offset <= -reach || offset >= 1 + reach) continue;
      spots ??= [];
      spots.push(spotAt(put.copy, forwards ? offset : 1 - offset, put.down, put.angle, aspect));
    }
  }
  return spots;
}

/** The ceiling has fewer than the walls: someone had to reach up there. */
const CEILING_SHARE = 0.25;
/** How far a bunch on the ceiling may spread from the tile it started on, in cells. */
const CEILING_SPREAD = 2;

/** A ceiling tile with nothing in the way: not over a wall, no light in it, none of it missing. */
const plainTile = (map: WorldMap, x: number, y: number) =>
  !map.wall(x, y) && !(mod(x, 3) === 1 && mod(y, 3) === 1) && !cellHasHole(map, x, y);

/** The posters that went up on the ceiling starting at tile (ox, oy), or null. Only where they fit on plain tiles. */
function putOnCeiling(map: WorldMap, ox: number, oy: number, tuning: Tuning, aspect: number): Put[] | null {
  if (!chosen(map.noise(ox, oy, 400), map, ox, oy, tuning, CEILING_SHARE)) return null;
  const reach = reachOf(aspect);
  const roll = (k: number) => map.noise(ox, oy, 410 + k);
  const count = bunchOf(roll(0));
  const puts: Put[] = [];
  for (let i = 0; i < count; i++) {
    const r = (k: number) => roll(1 + i * 8 + k);
    const last = puts[puts.length - 1];
    const step = 0.12 + r(1) * 0.4;
    const heading = r(2) * Math.PI * 2;
    let along = last ? last.along + Math.cos(heading) * step : ox + r(1);
    let down = last ? last.down + Math.sin(heading) * step : oy + r(2);
    along = Math.min(ox + CEILING_SPREAD + 1 - reach, Math.max(ox - CEILING_SPREAD + reach, along));
    down = Math.min(oy + CEILING_SPREAD + 1 - reach, Math.max(oy - CEILING_SPREAD + reach, down));
    // Every tile it covers has to be plain, or it would be cut off at a light or a wall.
    let clear = true;
    for (let y = Math.floor(down - reach); y <= Math.floor(down + reach) && clear; y++) {
      for (let x = Math.floor(along - reach); x <= Math.floor(along + reach) && clear; x++) {
        if (!plainTile(map, x, y)) clear = false;
      }
    }
    if (clear) puts.push({ along, down, angle: r(3) * Math.PI * 2, copy: copyOf(r(4)) });
  }
  return puts.length ? puts : null;
}

/**
 * The posters on the ceiling tile over cell (cx, cy), the last on top, or null. Seen from below, `across` runs from
 * the tile's north edge south and `down` from its west edge east, so the picture isn't mirrored. Turned any which
 * way: there's no up on a ceiling.
 */
export function postersOver(
  map: WorldMap,
  cx: number,
  cy: number,
  tuning: Tuning,
  aspect: number,
): PosterSpot[] | null {
  const reach = reachOf(aspect);
  let spots: PosterSpot[] | null = null;
  for (let j = -CEILING_SPREAD; j <= CEILING_SPREAD; j++) {
    for (let i = -CEILING_SPREAD; i <= CEILING_SPREAD; i++) {
      const puts = putOnCeiling(map, cx + i, cy + j, tuning, aspect);
      if (!puts) continue;
      for (const put of puts) {
        const east = put.along - cx;
        const south = put.down - cy;
        if (east <= -reach || east >= 1 + reach || south <= -reach || south >= 1 + reach) continue;
        spots ??= [];
        spots.push(spotAt(put.copy, south, east, put.angle, aspect));
      }
    }
  }
  return spots;
}
