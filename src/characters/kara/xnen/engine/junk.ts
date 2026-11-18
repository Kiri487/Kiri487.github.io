import type { WorldMap } from "./map";
import type { StatueMesh, StatueModel, StatueSkin } from "./statue";

/*
 * Things that don't belong, half through the place as if nobody minded: Kara's old CRT monitor, still on, showing
 * her desktop, and plain wooden chairs, some of them gone wrong. Stuck in a wall, sunk into the carpet, hanging
 * upside down out of the ceiling, or (a chair) just facing a wall. Rare, and anywhere. They're only scenery: nothing
 * happens when they're touched, but they're in the way.
 */

// ---- the monitor ----

/** The monitor's atlas: plastic, the front bezel, the vented back, and the screen. */
const AW = 64;
const AH = 64;
const SCREEN = { x: 32, y: 0, w: 32, h: 24 };
const PLASTIC = { x: 0, y: 0, w: 32, h: 32 };
const BEZEL = { x: 0, y: 32, w: 32, h: 32 };
const VENTS = { x: 32, y: 32, w: 32, h: 32 };

type Rect = { x: number; y: number; w: number; h: number };
type V3 = [number, number, number];

/** A face of four corners, counter-clockwise seen from outside, painted with a rect of the atlas. */
function quad(out: number[], a: V3, b: V3, c: V3, d: V3, r: Rect) {
  const u0 = r.x + 0.5;
  const v0 = r.y + 0.5;
  const u1 = r.x + r.w - 0.5;
  const v1 = r.y + r.h - 0.5;
  // a bottom left, b bottom right, c top right, d top left, as the face is seen.
  out.push(...a, u0, v1, ...b, u1, v1, ...c, u1, v0, 0);
  out.push(...a, u0, v1, ...c, u1, v0, ...d, u0, v0, 0);
}

/** A box from (x0, y0, z0) to (x1, y1, z1); `front` paints the +z face, `back` the −z face, `side` the rest. */
function box(
  out: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  front: Rect,
  back: Rect,
  side: Rect,
) {
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front);
  quad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], back);
  quad(out, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side);
  quad(out, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
  quad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], side);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], side);
}

function buildMonitor(): StatueModel {
  const tris: number[] = [];
  // The stand, the front with its bezel, the bulging back, and the screen just proud of the bezel.
  box(tris, -0.07, 0.07, 0, 0.03, -0.07, 0.12, PLASTIC, PLASTIC, PLASTIC);
  box(tris, -0.18, 0.18, 0.03, 0.33, 0.03, 0.14, BEZEL, PLASTIC, PLASTIC);
  box(tris, -0.135, 0.135, 0.06, 0.3, -0.19, 0.03, PLASTIC, VENTS, VENTS);
  quad(tris, [-0.157, 0.053, 0.142], [0.157, 0.053, 0.142], [0.157, 0.307, 0.142], [-0.157, 0.307, 0.142], SCREEN);
  return { tris, atlasWidth: AW, atlasHeight: AH, stone: [190, 180, 146] };
}

const MONITOR = buildMonitor();

const grain = (x: number, y: number) => {
  let n = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  n ^= n >>> 15;
  n = Math.imul(n, 0x2c1b3c6d);
  n ^= n >>> 12;
  return ((n >>> 0) % 1000) / 1000;
};

/** Kara's olive taskbar, and the little icons on her desktop. */
const TASKBAR = [113, 131, 63];
const ICON = [232, 228, 200];

/**
 * The monitor's atlas, its screen showing Kara's desktop shrunk from her wallpaper (RGBA, w × h). Alpha marks what
 * lights itself: 64–127 the screen, 128–254 the green power light.
 */
export function monitorSkin(wallpaper: Uint8ClampedArray, ww: number, wh: number): StatueSkin {
  const data = new Uint8ClampedArray(AW * AH * 4);
  const put = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
    const o = (y * AW + x) * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = a;
  };
  const fill = (rect: Rect, shade: (x: number, y: number) => number) => {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const m = shade(x - rect.x, y - rect.y) * (0.94 + 0.08 * grain(x, y));
        put(x, y, 200 * m, 190 * m, 156 * m);
      }
    }
  };
  fill(PLASTIC, () => 1);
  // Yellowed plastic, a darker edge round the bezel.
  fill(BEZEL, (x, y) => (x < 2 || y < 2 || x > 29 || y > 29 ? 0.78 : 1));
  fill(VENTS, (_x, y) => (y % 4 === 1 ? 0.55 : 0.85));
  // The power light, bottom right of the bezel.
  put(BEZEL.x + 27, BEZEL.y + 30, 40, 200, 90, 230);
  put(BEZEL.x + 28, BEZEL.y + 30, 40, 200, 90, 230);

  // The screen: the wallpaper's middle, shrunk, then her taskbar along the bottom and a column of icons.
  const cropW = Math.min(ww, Math.round(wh * (SCREEN.w / SCREEN.h)));
  const cropX = Math.floor((ww - cropW) / 2);
  for (let y = 0; y < SCREEN.h; y++) {
    for (let x = 0; x < SCREEN.w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      const sx0 = cropX + Math.floor((x * cropW) / SCREEN.w);
      const sx1 = cropX + Math.floor(((x + 1) * cropW) / SCREEN.w);
      const sy0 = Math.floor((y * wh) / SCREEN.h);
      const sy1 = Math.floor(((y + 1) * wh) / SCREEN.h);
      for (let sy = sy0; sy < sy1; sy += 2) {
        for (let sx = sx0; sx < sx1; sx += 2) {
          const o = (sy * ww + sx) * 4;
          r += wallpaper[o];
          g += wallpaper[o + 1];
          b += wallpaper[o + 2];
          n++;
        }
      }
      let c = n ? [r / n, g / n, b / n] : [77, 91, 48];
      if (y >= SCREEN.h - 3) c = y === SCREEN.h - 3 ? [164, 178, 118] : TASKBAR;
      else if (x >= 1 && x <= 2 && (y - 1) % 4 < 2 && y < 15) c = ICON;
      // The tube's corners are darker.
      const cx = (x + 0.5) / SCREEN.w - 0.5;
      const cy = (y + 0.5) / SCREEN.h - 0.5;
      const v = 1 - 0.9 * (cx * cx + cy * cy);
      put(SCREEN.x + x, SCREEN.y + y, c[0] * v, c[1] * v, c[2] * v, 100);
    }
  }
  return { data };
}

// ---- the chair ----

/** The chair's atlas: one square of wood. */
const WOOD: Rect = { x: 0, y: 0, w: 32, h: 32 };

/** How a chair is bent out of shape: each 1 for an ordinary one. */
interface ChairShape {
  /** Width across the seat. */
  width: number;
  /** Leg length. */
  legs: number;
  /** Backrest height. */
  back: number;
  /** Everything's height, squashed flat. */
  flat: number;
}

const ORDINARY: ChairShape = { width: 1, legs: 1, back: 1, flat: 1 };
/** The whole chair scaled by this: an ordinary one's back comes up to just under eye height. */
const CHAIR_SIZE = 0.72;

/** A plain wooden chair with a back: four legs, rails between them, a seat, two posts, a top rail and two slats. */
function buildChair(shape: ChairShape): StatueModel {
  const tris: number[] = [];
  const hw = 0.15 * shape.width;
  const hd = 0.14;
  const L = 0.03;
  const legH = 0.3 * shape.legs;
  const seatTop = legH + 0.03;
  const top = seatTop + 0.32 * shape.back;
  const f = shape.flat;
  const k = CHAIR_SIZE;
  const part = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    box(tris, x0 * k, x1 * k, y0 * f * k, y1 * f * k, z0 * k, z1 * k, WOOD, WOOD, WOOD);
  // Legs; the back two carry on up as the backrest's posts.
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -hw : hw - L;
    part(x0, x0 + L, 0, legH, hd - L, hd);
    part(x0, x0 + L, 0, top, -hd, -hd + L);
    // Rails along the sides, low down.
    part(x0 + 0.005, x0 + L - 0.005, legH * 0.3, legH * 0.3 + 0.02, -hd + L, hd - L);
  }
  part(-hw + L, hw - L, legH * 0.3, legH * 0.3 + 0.02, -hd + 0.005, -hd + L - 0.005);
  part(-hw - 0.01, hw + 0.01, legH, seatTop, -hd - 0.005, hd + 0.01);
  // The backrest: a top rail and two slats between the posts.
  part(-hw, hw, top - 0.05, top, -hd, -hd + 0.025);
  part(-hw + L, hw - L, top - 0.13, top - 0.1, -hd + 0.002, -hd + 0.022);
  part(-hw + L, hw - L, top - 0.21, top - 0.18, -hd + 0.002, -hd + 0.022);
  return { tris, atlasWidth: 32, atlasHeight: 32, stone: [120, 84, 50] };
}

/** How tall a chair of this shape stands. */
const chairHeight = (shape: ChairShape) => (0.33 * shape.legs + 0.32 * shape.back) * shape.flat * CHAIR_SIZE;

/**
 * Most chairs are ordinary; the rest are the same chair gone wrong: legs far too long, squashed flat, a backrest
 * reaching up and up, stretched wide, or thin as a rake.
 */
function chairShape(a: number, b: number): ChairShape {
  if (a < 0.55) return ORDINARY;
  if (a < 0.67) return { ...ORDINARY, legs: 2.2 + b * 1.2 };
  if (a < 0.77) return { ...ORDINARY, flat: 0.25 + b * 0.15 };
  if (a < 0.86) return { ...ORDINARY, back: 2 + b * 1.2 };
  if (a < 0.94) return { ...ORDINARY, width: 1.8 + b * 0.8 };
  return { ...ORDINARY, width: 0.45, legs: 1.5 + b * 0.5 };
}

/** The wood: warm brown with a grain running along it, a little worn. */
export const WOOD_SKIN: StatueSkin = (() => {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const streak = Math.sin(y * 0.9 + Math.sin(x * 0.35) * 1.6 + grain(0, y) * 2);
      const m = 0.82 + 0.1 * streak + 0.1 * grain(x, y);
      const o = (y * 32 + x) * 4;
      data[o] = 142 * m;
      data[o + 1] = 98 * m;
      data[o + 2] = 58 * m;
      data[o + 3] = 255;
    }
  }
  return { data };
})();

// ---- where they are ----

export type JunkKind = "monitor" | "chair";

/** One piece of junk: what it is, where it's put, how it's turned, and the part of it in the way (if any). */
export interface Junk {
  key: string;
  kind: JunkKind;
  model: StatueModel;
  x: number;
  y: number;
  /** Height of its base above the floor; below 0 it's sunk in. */
  h: number;
  /** Which way its front faces, then tipped forward (pitch) and turned about its front (roll), in radians. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Where it's in the way, a circle on the floor plan; `overhead` if up at the ceiling, out of the visitor's way. */
  solid: { x: number; y: number; r: number; overhead?: boolean } | null;
}

/** Junk is worked out a square block at a time, this many cells across; each block has at most one of each kind. */
const BLOCK = 12;
/** How many blocks have a monitor, and how many a chair. */
const MONITOR_CHANCE = 0.18;
const CHAIR_CHANCE = 0.18;

const OUT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const blocks = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** Every piece of junk within `radius` of (x, y). The same every time for this map. */
export function junkAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  let known = blocks.get(map);
  if (!known) {
    known = new Map();
    blocks.set(map, known);
  }
  const out: Junk[] = [];
  for (let by = Math.floor((y - radius) / BLOCK); by <= Math.floor((y + radius) / BLOCK); by++) {
    for (let bx = Math.floor((x - radius) / BLOCK); bx <= Math.floor((x + radius) / BLOCK); bx++) {
      const key = `${bx},${by}`;
      let found = known.get(key);
      if (!found) {
        found = junkIn(map, bx, by);
        known.set(key, found);
      }
      for (const junk of found) if (Math.hypot(junk.x - x, junk.y - y) <= radius) out.push(junk);
    }
  }
  return out;
}

/** An open cell in the block, and the way to a wall beside it if there is one. */
interface Spot {
  cx: number;
  cy: number;
  wall: readonly [number, number] | null;
}

function spotIn(map: WorldMap, bx: number, by: number, roll: (k: number) => number): Spot | null {
  for (let k = 0; k < 16; k++) {
    const cx = bx * BLOCK + Math.floor(roll(1 + k) * BLOCK);
    const cy = by * BLOCK + Math.floor(roll(20 + k) * BLOCK);
    if (map.wall(cx, cy)) continue;
    const side = Math.floor(roll(41) * 4);
    let wall: readonly [number, number] | null = null;
    for (let s = 0; s < 4 && !wall; s++) {
      const out = OUT[(side + s) % 4];
      if (map.wall(cx + out[0], cy + out[1])) wall = out;
    }
    return { cx, cy, wall };
  }
  return null;
}

function junkIn(map: WorldMap, bx: number, by: number): Junk[] {
  const found: Junk[] = [];
  const monitorRoll = (k: number) => map.noise(bx * 31 + k, by, 700);
  if (monitorRoll(0) < MONITOR_CHANCE) {
    const spot = spotIn(map, bx, by, monitorRoll);
    if (spot) found.push(placeMonitor(`m${bx},${by}`, spot, monitorRoll));
  }
  const chairRoll = (k: number) => map.noise(bx * 31 + k, by, 710);
  if (chairRoll(0) < CHAIR_CHANCE) {
    const spot = spotIn(map, bx, by, chairRoll);
    if (spot) found.push(placeChair(`c${bx},${by}`, spot, chairRoll));
  }
  return found;
}

/** A point on the wall's face beside the cell, `along` (0–1) of the way along it. */
function wallFace(spot: Spot, [ox, oy]: readonly [number, number], along: number): [number, number] {
  return [
    spot.cx + 0.5 + ox * 0.5 + (oy !== 0 ? along - 0.5 : 0),
    spot.cy + 0.5 + oy * 0.5 + (ox !== 0 ? along - 0.5 : 0),
  ];
}

/** Monitors: half into a wall facing out of it, sunk into the carpet looking up, or upside down in the ceiling. */
function placeMonitor(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const base = { key, kind: "monitor" as const, model: MONITOR };
  const how = roll(40);
  if (how < 0.5 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.25 + roll(42) * 0.5);
    const h = 0.12 + roll(43) * 0.45;
    return {
      ...base,
      x: fx - ox * 0.02,
      y: fy - oy * 0.02,
      h,
      yaw: Math.atan2(-oy, -ox),
      pitch: (roll(44) - 0.5) * 0.4,
      roll: (roll(45) - 0.5) * 0.7,
      solid: h < 0.85 ? { x: fx - ox * 0.14, y: fy - oy * 0.14, r: 0.2 } : null,
    };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  if (how < 0.8) {
    return {
      ...base,
      x,
      y,
      h: -0.06 - roll(53) * 0.1,
      yaw: roll(52) * Math.PI * 2,
      pitch: -0.25 - roll(54) * 0.45,
      roll: (roll(53) - 0.5) * 0.5,
      solid: { x, y, r: 0.24 },
    };
  }
  return {
    ...base,
    x,
    y,
    h: 1.08,
    yaw: roll(62) * Math.PI * 2,
    pitch: (roll(63) - 0.5) * 0.4,
    roll: Math.PI,
    solid: { x, y, r: 0.24, overhead: true },
  };
}

/**
 * Chairs: half into a wall at any angle, sunk aslant into the carpet, upside down with their legs in the ceiling, or
 * just standing there, pushed up to a wall and facing it.
 */
function placeChair(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const shape = chairShape(roll(70), roll(71));
  const base = { key, kind: "chair" as const, model: buildChair(shape) };
  const tall = chairHeight(shape);
  const how = roll(40);
  if (spot.wall && how < 0.35) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const h = -0.05 + roll(43) * 0.35;
    return {
      ...base,
      x: fx,
      y: fy,
      h,
      yaw: roll(44) * Math.PI * 2,
      pitch: (roll(45) - 0.5) * 0.8,
      roll: (roll(46) - 0.5) * 1.2,
      solid: h < 0.8 ? { x: fx - ox * 0.15, y: fy - oy * 0.15, r: 0.2 } : null,
    };
  }
  if (spot.wall && how < 0.55) {
    // Facing the wall, close up, as if someone had been made to sit there.
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const x = fx - ox * 0.2;
    const y = fy - oy * 0.2;
    return { ...base, x, y, h: 0, yaw: Math.atan2(oy, ox), pitch: 0, roll: 0, solid: { x, y, r: 0.2 } };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  if (how < 0.8) {
    return {
      ...base,
      x,
      y,
      h: -0.08 - roll(53) * 0.17,
      yaw: roll(52) * Math.PI * 2,
      pitch: (roll(54) - 0.5) * 1.2,
      roll: (roll(55) - 0.5) * 1.2,
      solid: { x, y, r: 0.24 },
    };
  }
  // Upside down, legs in the ceiling; one hanging low enough is in the visitor's way too.
  const h = 1.04 + roll(60) * 0.06;
  return {
    ...base,
    x,
    y,
    h,
    yaw: roll(62) * Math.PI * 2,
    pitch: (roll(63) - 0.5) * 0.3,
    roll: Math.PI,
    solid: { x, y, r: 0.24, overhead: h - tall > 0.55 },
  };
}

// ---- putting one in place ----

/** A model turned and moved to where this piece of junk is, ready to draw. */
export function placeJunk(model: StatueModel, junk: Junk): StatueMesh {
  const src = model.tris;
  const count = src.length / 16;
  const fx = Math.cos(junk.yaw);
  const fy = Math.sin(junk.yaw);
  const rx = fy;
  const ry = -fx;
  const cr = Math.cos(junk.roll);
  const sr = Math.sin(junk.roll);
  const cp = Math.cos(junk.pitch);
  const sp = Math.sin(junk.pitch);
  // Roll about its front, then tip forward, in its own frame (x across, y up, z out of the front).
  const turn = (X: number, Y: number, Z: number): V3 => {
    const x1 = X * cr - Y * sr;
    const y1 = X * sr + Y * cr;
    return [x1, y1 * cp - Z * sp, y1 * sp + Z * cp];
  };
  const corners = new Float32Array(count * 15);
  const normals = new Float32Array(count * 3);
  const centres = new Float32Array(count * 3);
  const flags = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 16;
    const q = i * 15;
    for (let k = 0; k < 3; k++) {
      const [X, Y, Z] = turn(src[o + k * 5], src[o + k * 5 + 1], src[o + k * 5 + 2]);
      corners[q + k * 5] = junk.x + X * rx + Z * fx;
      corners[q + k * 5 + 1] = junk.y + X * ry + Z * fy;
      corners[q + k * 5 + 2] = junk.h + Y;
      corners[q + k * 5 + 3] = src[o + k * 5 + 3];
      corners[q + k * 5 + 4] = src[o + k * 5 + 4];
    }
    const ax = src[o + 5] - src[o];
    const ay = src[o + 6] - src[o + 1];
    const az = src[o + 7] - src[o + 2];
    const bx = src[o + 10] - src[o];
    const by = src[o + 11] - src[o + 1];
    const bz = src[o + 12] - src[o + 2];
    const [nx, ny, nz] = turn(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i * 3] = (nx * rx + nz * fx) / len;
    normals[i * 3 + 1] = (nx * ry + nz * fy) / len;
    normals[i * 3 + 2] = ny / len;
    centres[i * 3] = (corners[q] + corners[q + 5] + corners[q + 10]) / 3;
    centres[i * 3 + 1] = (corners[q + 1] + corners[q + 6] + corners[q + 11]) / 3;
    centres[i * 3 + 2] = (corners[q + 2] + corners[q + 7] + corners[q + 12]) / 3;
    flags[i] = src[o + 15];
  }
  return { x: junk.x, y: junk.y, count, corners, normals, centres, flags };
}
