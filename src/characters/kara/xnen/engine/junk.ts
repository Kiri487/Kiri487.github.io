import type { WorldMap } from "./map";
import type { StatueMesh, StatueModel, StatueSkin } from "./statue";

/*
 * Things that don't belong, half through the place as if nobody minded: for now, Kara's old CRT monitor, still on,
 * showing her desktop. Stuck in a wall, sunk into the carpet, or hanging upside down out of the ceiling. Rare, and
 * anywhere. They're only scenery: nothing happens when they're touched, but they're in the way.
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

export const MONITOR = buildMonitor();

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

// ---- where they are ----

/** One piece of junk: where it's put, how it's turned, and the part of it in the way (if any). */
export interface Junk {
  key: string;
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

/** Junk is worked out a square block at a time, this many cells across; each block has at most one. */
const BLOCK = 12;
/** How many blocks have something. */
const CHANCE = 0.18;

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

function junkIn(map: WorldMap, bx: number, by: number): Junk[] {
  const roll = (k: number) => map.noise(bx * 31 + k, by, 700);
  if (roll(0) >= CHANCE) return [];
  const key = `${bx},${by}`;
  for (let k = 0; k < 16; k++) {
    const cx = bx * BLOCK + Math.floor(roll(1 + k) * BLOCK);
    const cy = by * BLOCK + Math.floor(roll(20 + k) * BLOCK);
    if (map.wall(cx, cy)) continue;
    const how = roll(40);
    if (how < 0.5) {
      // In a wall beside this cell, if there is one.
      const side = Math.floor(roll(41) * 4);
      for (let s = 0; s < 4; s++) {
        const [ox, oy] = OUT[(side + s) % 4];
        if (map.wall(cx + ox, cy + oy)) return [inWall(key, cx, cy, ox, oy, roll(42), roll(43), roll(44), roll(45))];
      }
    }
    if (how < 0.8) {
      return [inFloor(key, cx + 0.3 + roll(50) * 0.4, cy + 0.3 + roll(51) * 0.4, roll(52), roll(53), roll(54))];
    }
    return [inCeiling(key, cx + 0.3 + roll(60) * 0.4, cy + 0.3 + roll(61) * 0.4, roll(62), roll(63))];
  }
  return [];
}

/** Half into the wall on side (ox, oy) of cell (cx, cy), facing out of it, at some height, a little askew. */
function inWall(
  key: string,
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  a: number,
  b: number,
  c: number,
  d: number,
): Junk {
  // The wall's face, part way along it.
  const along = 0.25 + a * 0.5;
  const fx = cx + 0.5 + ox * 0.5 + (oy !== 0 ? along - 0.5 : 0);
  const fy = cy + 0.5 + oy * 0.5 + (ox !== 0 ? along - 0.5 : 0);
  const h = 0.12 + b * 0.45;
  return {
    key,
    x: fx - ox * 0.02,
    y: fy - oy * 0.02,
    h,
    yaw: Math.atan2(-oy, -ox),
    pitch: (c - 0.5) * 0.4,
    roll: (d - 0.5) * 0.7,
    solid: h < 0.85 ? { x: fx - ox * 0.14, y: fy - oy * 0.14, r: 0.2 } : null,
  };
}

/** Sunk into the carpet, tipped back so the screen looks up, any way round. */
function inFloor(key: string, x: number, y: number, a: number, b: number, c: number): Junk {
  return {
    key,
    x,
    y,
    h: -0.06 - b * 0.1,
    yaw: a * Math.PI * 2,
    pitch: -0.25 - c * 0.45,
    roll: (b - 0.5) * 0.5,
    solid: { x, y, r: 0.24 },
  };
}

/** Upside down, its stand buried in the ceiling. Above the visitor's head, but in the way of anyone up there. */
function inCeiling(key: string, x: number, y: number, a: number, b: number): Junk {
  const solid = { x, y, r: 0.24, overhead: true };
  return { key, x, y, h: 1.08, yaw: a * Math.PI * 2, pitch: (b - 0.5) * 0.4, roll: Math.PI, solid };
}

// ---- putting one in place ----

/** The monitor turned and moved to where this piece of junk is, ready to draw. */
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
