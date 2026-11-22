import { clamp } from "../../../../shared/math";
import {
  campBed,
  CANDLE_SIGN_SIZE,
  meetingAlongX,
  mountedWall,
  FITTED_SIZE,
  HALL_LAMP,
  ROOM_BLOCK,
  STAIRS_W,
  type BurgerPlan,
  type DeadEnd,
  type StairsPlan,
  type CandleSign,
  type FittedPlan,
  type Statue,
  type WorldMap,
} from "./map";
import type { StatueMesh, StatueModel, StatueSkin } from "./statue";
import { WRITINGS, WRITTEN_FACE, WRITTEN_FRAME, WRITTEN_H, WRITTEN_W } from "./whiteboard";
import { FIRE_DOOR, heaviest, JUNK_WEIGHTS, OFFICE_FURNITURE, type ZoneWeights } from "./zones";

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

/**
 * Faces are cut into tiles no bigger than this. The drawing skips a whole triangle with a corner too close to the eye
 * or behind it, so a big face (a desk's top, seen standing over it) would vanish all at once; small tiles only go
 * where they really are that close.
 */
const TILE = 0.1;

/**
 * A face of four corners, counter-clockwise seen from outside, painted with a rect of the atlas. `upTile` is how tall
 * its tiles may be, if not TILE: a tall face no one can stand over (a partition) needs only to be cut across.
 */
function quad(out: number[], a: V3, b: V3, c: V3, d: V3, r: Rect, upTile = TILE) {
  const u0 = r.x + 0.5;
  const v0 = r.y + 0.5;
  const u1 = r.x + r.w - 0.5;
  const v1 = r.y + r.h - 0.5;
  // a bottom left, b bottom right, c top right, d top left, as the face is seen.
  const across = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / TILE));
  const up = Math.max(1, Math.ceil(Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / upTile));
  // The point s across and t up, and its place in the atlas.
  const at = (s: number, t: number) => {
    const p = [0, 1, 2].map(
      (k) => a[k] * (1 - s) * (1 - t) + b[k] * s * (1 - t) + c[k] * s * t + d[k] * (1 - s) * t,
    );
    return [...p, u0 + (u1 - u0) * s, v1 + (v0 - v1) * t];
  };
  for (let j = 0; j < up; j++) {
    for (let i = 0; i < across; i++) {
      const pa = at(i / across, j / up);
      const pb = at((i + 1) / across, j / up);
      const pc = at((i + 1) / across, (j + 1) / up);
      const pd = at(i / across, (j + 1) / up);
      out.push(...pa, ...pb, ...pc, 0);
      out.push(...pa, ...pc, ...pd, 0);
    }
  }
}

/**
 * A box as thin as this both ways (a leg, a post) is a stick: nobody gets close enough to the side of one for it to
 * need cutting up its length, so its four sides are cut only across.
 */
const STICK = 0.05;

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
  const up = Math.abs(x1 - x0) <= STICK && Math.abs(z1 - z0) <= STICK ? Infinity : TILE;
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front, up);
  quad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], back, up);
  quad(out, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, up);
  quad(out, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, up);
  quad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], side);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], side);
}

/**
 * The bulging back of the monitor, from (x0, y0, z0) to (x1, y1, z1): its back plain, and round its top, sides and
 * bottom slots running from front to back, the rows of the atlas going back the same way on all four, so each slot
 * goes on round the corners into the next face.
 */
function ventedBack(out: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], PLASTIC);
  quad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], PLASTIC);
  // Each with its first corner at the front and its fourth at the back.
  quad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], VENTS);
  quad(out, [x1, y0, z1], [x0, y0, z1], [x0, y0, z0], [x1, y0, z0], VENTS);
  quad(out, [x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], VENTS);
  quad(out, [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], VENTS);
}

function buildMonitor(): StatueModel {
  const tris: number[] = [];
  // The stand, the front with its bezel, the bulging back, and the screen just proud of the bezel.
  box(tris, -0.07, 0.07, 0, 0.03, -0.07, 0.12, PLASTIC, PLASTIC, PLASTIC);
  box(tris, -0.18, 0.18, 0.03, 0.33, 0.03, 0.14, BEZEL, PLASTIC, PLASTIC);
  ventedBack(tris, -0.135, 0.135, 0.06, 0.3, -0.19, 0.03);
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

/**
 * A plain wooden chair with a back: four legs, rails between them, a seat, two posts, a top rail and two slats. An
 * office one is the same chair in steel, its seat and a padded back in grey-blue fabric.
 */
function buildChair(shape: ChairShape, office = false): StatueModel {
  const tris: number[] = [];
  const hw = 0.15 * shape.width;
  const hd = 0.14;
  const L = 0.03;
  const legH = 0.3 * shape.legs;
  const seatTop = legH + 0.03;
  const top = seatTop + 0.32 * shape.back;
  const f = shape.flat;
  const k = CHAIR_SIZE;
  const frame = office ? STEEL : WOOD;
  const cover = office ? FABRIC : WOOD;
  const part = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r = frame) =>
    box(tris, x0 * k, x1 * k, y0 * f * k, y1 * f * k, z0 * k, z1 * k, r, r, r);
  // Legs; the back two carry on up as the backrest's posts.
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? -hw : hw - L;
    part(x0, x0 + L, 0, legH, hd - L, hd);
    // An office chair's stop just short of the top of its padded back, so they're wholly inside it: a face of theirs
    // lying on one of its faces flickers.
    part(x0, x0 + L, 0, office ? top - 0.01 : top, -hd, -hd + L);
    // Rails along the sides, low down.
    part(x0 + 0.005, x0 + L - 0.005, legH * 0.3, legH * 0.3 + 0.02, -hd + L, hd - L);
  }
  part(-hw + L, hw - L, legH * 0.3, legH * 0.3 + 0.02, -hd + 0.005, -hd + L - 0.005);
  part(-hw - 0.01, hw + 0.01, legH, seatTop, -hd - 0.005, hd + 0.01, cover);
  if (office) {
    // One padded back, round the posts and a little proud of them every way.
    part(-hw - 0.006, hw + 0.006, top - 0.21, top, -hd - 0.006, -hd + L + 0.006, cover);
    return { tris, atlasWidth: OFFICE_ATLAS_W, atlasHeight: OFFICE_ATLAS_H, stone: [84, 96, 118] };
  }
  // The backrest: a top rail and two slats between the posts.
  part(-hw, hw, top - 0.05, top, -hd, -hd + 0.025);
  part(-hw + L, hw - L, top - 0.13, top - 0.1, -hd + 0.002, -hd + 0.022);
  part(-hw + L, hw - L, top - 0.21, top - 0.18, -hd + 0.002, -hd + 0.022);
  return { tris, atlasWidth: 32, atlasHeight: 32, stone: [120, 84, 50] };
}

/** How tall a chair of this shape stands, and how high its seat is. */
const chairHeight = (shape: ChairShape) => (0.33 * shape.legs + 0.32 * shape.back) * shape.flat * CHAIR_SIZE;
const chairSeat = (shape: ChairShape) => (0.3 * shape.legs + 0.03) * shape.flat * CHAIR_SIZE;
/** From the middle of a chair's seat to its front edge. */
const CHAIR_EDGE = 0.15 * CHAIR_SIZE;

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

// ---- the road signs ----

/** The signs' atlas: each face in its own square, then the bare metal for the backs and the pole. */
const SIGN_FACES = {
  stop: { x: 0, y: 0, w: 64, h: 64 },
  noEntry: { x: 64, y: 0, w: 64, h: 64 },
  noCats: { x: 0, y: 64, w: 64, h: 64 },
  warning: { x: 128, y: 0, w: 64, h: 64 },
};
const METAL: Rect = { x: 64, y: 64, w: 64, h: 64 };

export type SignKind = keyof typeof SIGN_FACES;
const SIGN_KINDS: readonly SignKind[] = ["stop", "noEntry", "noCats", "warning"];
const SIGN_ATLAS_W = 192;
const SIGN_ATLAS_H = 128;

/** The plate's radius, and the pole's half thickness. */
const SIGN_R = 0.14;
/** The warning triangle's plate, against the others'. */
const WARNING_SIZE = 1.4;
const POLE = 0.016;

/** A triangle in the same circle looks small beside the others, so it's drawn in a bigger one. */
const signRadius = (kind: SignKind) => (kind === "warning" ? SIGN_R * WARNING_SIZE : SIGN_R);

type Corner = [number, number, number, number, number];

function tri(out: number[], a: Corner, b: Corner, c: Corner) {
  out.push(...a, ...b, ...c, 0);
}

/**
 * A sign on a pole: an octagon (the stop sign), a triangle (the warning) or a disc, its face toward +z, its middle
 * `middle` above the foot of the pole, which ends a little above the plate. The back of the plate is bare metal.
 * `mirrored`, the face is printed back to front, as if from the other side of a mirror. `poleTop`, the pole carries
 * on up at least that far.
 */
function signModel(kind: SignKind, middle: number, mirrored: boolean, poleTop = 0): StatueModel {
  const tris: number[] = [];
  const R = signRadius(kind);
  const pole = Math.max(middle + R * 0.6, poleTop);
  box(tris, -POLE, POLE, 0, pole, -0.03 - POLE, -0.03 + POLE, METAL, METAL, METAL);
  // An octagon, a triangle point up, or near enough a disc.
  const sides = kind === "stop" ? 8 : kind === "warning" ? 3 : 20;
  const turn = kind === "stop" ? Math.PI / 8 : kind === "warning" ? Math.PI / 2 : 0;
  const face = SIGN_FACES[kind];
  const rim: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = turn + (i / sides) * Math.PI * 2;
    rim.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  // Atlas spot for a point on the plate, from its own square.
  const front = (x: number, y: number, r: Rect): Corner => [
    x,
    middle + y,
    -0.01,
    r.x + ((mirrored ? -x : x) / R / 2 + 0.5) * (r.w - 1) + 0.5,
    r.y + (0.5 - y / R / 2) * (r.h - 1) + 0.5,
  ];
  const back = (x: number, y: number): Corner => [x, middle + y, -0.016, METAL.x + 8, METAL.y + 8];
  for (let i = 0; i < sides; i++) {
    const [x0, y0] = rim[i];
    const [x1, y1] = rim[(i + 1) % sides];
    tri(tris, front(0, 0, face), front(x0, y0, face), front(x1, y1, face));
    tri(tris, back(0, 0), back(x1, y1), back(x0, y0));
  }
  return { tris, atlasWidth: SIGN_ATLAS_W, atlasHeight: SIGN_ATLAS_H, stone: [150, 150, 146] };
}

/** The letters of STOP, EXIT, CAUTION and WET, three pixels by five. */
const LETTERS: Record<string, readonly string[]> = {
  A: ["###", "#.#", "###", "#.#", "#.#"],
  C: ["###", "#..", "#..", "#..", "###"],
  N: ["#.#", "###", "###", "#.#", "#.#"],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  E: ["###", "#..", "##.", "#..", "###"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  S: ["###", "#..", "###", "..#", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
};

/** Whether point (px, py) is inside the triangle a, b, c. */
function inTriangle(px: number, py: number, a: readonly number[], b: readonly number[], c: readonly number[]) {
  const side = (p: readonly number[], q: readonly number[]) =>
    (px - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (py - q[1]);
  const d1 = side(a, b);
  const d2 = side(b, c);
  const d3 = side(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const inEllipse = (px: number, py: number, cx: number, cy: number, rx: number, ry: number) =>
  ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;

/**
 * A sitting cat seen side on, in the 64-pixel face: head up to the right, clear of the slash, ears up, chest, body,
 * one front leg, and the tail curling round on the left.
 */
function inCat(x: number, y: number): boolean {
  // Drawn facing left, then mirrored.
  const px = 63.5 - x;
  const py = y + 0.5;
  if (inEllipse(px, py, 25, 23, 8, 7)) return true;
  if (inTriangle(px, py, [18.5, 20], [20, 10.5], [25, 17])) return true;
  if (inTriangle(px, py, [25, 16.5], [30.5, 11], [31.5, 20])) return true;
  if (inEllipse(px, py, 30, 33, 7, 9)) return true;
  if (inEllipse(px, py, 35, 42, 10, 9)) return true;
  if (inEllipse(px, py, 37, 49, 11, 4.5)) return true;
  if (px >= 25.5 && px <= 29.5 && py >= 33 && py <= 52) return true;
  if (inEllipse(px, py, 27.5, 52, 3.2, 1.6)) return true;
  const d = Math.hypot(px - 48, py - 44);
  const a = Math.atan2(py - 44, px - 48);
  return Math.abs(d - 7) < 1.8 && a > -1.9 && a < 1.75;
}

const SIGN_RED = [196, 34, 30];
const SIGN_WHITE = [236, 234, 226];

const SIGN_YELLOW = [232, 186, 40];
const SIGN_BLACK = [26, 24, 22];

/** The signs' faces, drawn: the stop sign, no entry, no cats, and the warning triangle. */
export const SIGN_SKIN: StatueSkin = (() => {
  const W = SIGN_ATLAS_W;
  const data = new Uint8ClampedArray(W * SIGN_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[]) => {
    const o = (y * W + x) * 4;
    const m = 0.93 + 0.1 * grain(x, y);
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  // Bare galvanised metal.
  for (let y = METAL.y; y < METAL.y + METAL.h; y++) {
    for (let x = METAL.x; x < METAL.x + METAL.w; x++) put(x, y, [150, 152, 150]);
  }
  // The stop sign: red with a thin white edge, STOP across the middle.
  const stop = SIGN_FACES.stop;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = Math.abs(x + 0.5 - 32);
      const dy = Math.abs(y + 0.5 - 32);
      // Distance in from the octagon's edge.
      const inward = 32 - Math.max(dx, dy, (dx + dy) / Math.SQRT2);
      put(stop.x + x, stop.y + y, inward < 3 ? SIGN_WHITE : SIGN_RED);
    }
  }
  const word = "STOP";
  const scale = 3;
  const left = 32 - Math.floor((word.length * 4 - 1) * scale / 2);
  const top = 32 - Math.floor((5 * scale) / 2);
  [...word].forEach((letter, i) => {
    LETTERS[letter].forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) {
        if (row[rx] !== "#") continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            put(stop.x + left + (i * 4 + rx) * scale + sx, stop.y + top + ry * scale + sy, SIGN_WHITE);
          }
        }
      }
    });
  });
  // The round signs, edged in white: no entry red with a white bar, no cats white in a red ring, a black cat struck
  // through.
  for (const kind of ["noEntry", "noCats"] as const) {
    const r = SIGN_FACES[kind];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const dx = x + 0.5 - 32;
        const dy = y + 0.5 - 32;
        const d = Math.hypot(dx, dy);
        let c = d > 25 ? SIGN_RED : SIGN_WHITE;
        if (d > 30.5) c = SIGN_WHITE;
        // No entry is the other way round: red all over, the bar white.
        if (kind === "noEntry" && d <= 30.5) c = Math.abs(dy) < 5 && Math.abs(dx) < 19 ? SIGN_WHITE : SIGN_RED;
        if (kind === "noCats" && d <= 25) {
          if (inCat(x, y)) c = [28, 26, 24];
          // The slash, top left to bottom right.
          if (Math.abs(dx - dy) < 5.5) c = SIGN_RED;
        }
        put(r.x + x, r.y + y, c);
      }
    }
  }
  // The warning triangle, point up: yellow, a black border, a black exclamation mark.
  const warning = SIGN_FACES.warning;
  const corners = [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6].map((a) => [
    32 + Math.cos(a) * 31.5,
    32 - Math.sin(a) * 31.5,
  ]);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Distance in from the nearest edge (negative outside).
      let inward = Infinity;
      for (let k = 0; k < 3; k++) {
        const [ax, ay] = corners[k];
        const [bx, by] = corners[(k + 1) % 3];
        const len = Math.hypot(bx - ax, by - ay);
        // The edges run anticlockwise on screen, so inside is to their left.
        inward = Math.min(inward, ((by - ay) * (px - ax) - (bx - ax) * (py - ay)) / len);
      }
      let c = inward < 4.5 ? SIGN_BLACK : SIGN_YELLOW;
      if (inward < 1.5) c = SIGN_WHITE;
      // Kept clear of the border: the bar starts where the triangle is wide enough, the dot sits above the bottom edge.
      const bar = Math.abs(px - 32) < 3 - (py - 18.5) * 0.06 && py > 18.5 && py < 33.5;
      const dot = Math.hypot(px - 32, py - 38.2) < 2.8;
      if (bar || dot) c = SIGN_BLACK;
      put(warning.x + x, warning.y + y, c);
    }
  }
  return { data };
})();

// ---- the doors ----

/**
 * The doors' atlas: a wooden door's face with four sunk panels, a red fire door's face with EXIT on it, wood, grey
 * metal, plain red, brass, the black of a pull handle and the silver of the push bar.
 */
const WOOD_FACE: Rect = { x: 0, y: 0, w: 32, h: 64 };
const FIRE_FACE: Rect = { x: 32, y: 0, w: 32, h: 64 };
const DOOR_WOOD: Rect = { x: 64, y: 0, w: 32, h: 32 };
const DOOR_METAL: Rect = { x: 64, y: 32, w: 32, h: 32 };
const DOOR_RED: Rect = { x: 96, y: 0, w: 32, h: 32 };
const BRASS: Rect = { x: 96, y: 32, w: 16, h: 16 };
const BAR: Rect = { x: 112, y: 32, w: 16, h: 16 };
const SILVER: Rect = { x: 96, y: 48, w: 16, h: 16 };
const DOOR_ATLAS_W = 128;
const DOOR_ATLAS_H = 64;

/** The door's height and width, its thickness, and the frame round it. */
const DOOR_H = 0.7;
const DOOR_W = 0.3;
const DOOR_T = 0.024;
const FRAME = 0.03;
const FRAME_DEPTH = 0.035;

type DoorKind = "wood" | "fire";

/**
 * A closed door in its frame, standing on its own, the foot of it at 0, its face toward +z. A wooden door has a brass
 * knob each side; a fire door a push bar on the front and a pull handle on the back.
 */
function buildDoor(kind: DoorKind): StatueModel {
  const tris: number[] = [];
  const hw = DOOR_W / 2;
  const ht = DOOR_T / 2;
  const fire = kind === "fire";
  const frame = fire ? DOOR_RED : DOOR_WOOD;
  const face = fire ? FIRE_FACE : WOOD_FACE;
  // The frame: two jambs and the head across the top.
  box(tris, -hw - FRAME, -hw, 0, DOOR_H + FRAME, -FRAME_DEPTH, FRAME_DEPTH, frame, frame, frame);
  box(tris, hw, hw + FRAME, 0, DOOR_H + FRAME, -FRAME_DEPTH, FRAME_DEPTH, frame, frame, frame);
  box(tris, -hw, hw, DOOR_H, DOOR_H + FRAME, -FRAME_DEPTH, FRAME_DEPTH, frame, frame, frame);
  // The door itself; a fire door's EXIT is only on the push side.
  box(tris, -hw, hw, 0, DOOR_H, -ht, ht, face, fire ? DOOR_RED : face, frame);
  if (fire) {
    // A silver push bar nearly all the way across, from a grey housing on the hinge side to a bracket at the other
    // end; a plain pull handle on the back.
    const bar = DOOR_H * 0.52;
    const z0 = ht + 0.01;
    box(tris, -hw + 0.02, -hw + 0.05, bar - 0.02, bar + 0.02, ht, z0 + 0.018, DOOR_METAL, DOOR_METAL, DOOR_METAL);
    box(tris, -hw + 0.05, hw - 0.025, bar - 0.009, bar + 0.009, z0, z0 + 0.014, SILVER, SILVER, SILVER);
    box(tris, hw - 0.035, hw - 0.022, bar - 0.011, bar + 0.011, ht, z0 + 0.016, DOOR_METAL, DOOR_METAL, DOOR_METAL);
    box(tris, hw - 0.05, hw - 0.035, bar - 0.05, bar + 0.05, -ht - 0.022, -ht, BAR, BAR, BAR);
  } else {
    const handle = DOOR_H * 0.46;
    // A brass knob each side.
    box(tris, hw - 0.055, hw - 0.033, handle - 0.011, handle + 0.011, ht, ht + 0.022, BRASS, BRASS, BRASS);
    box(tris, hw - 0.055, hw - 0.033, handle - 0.011, handle + 0.011, -ht - 0.022, -ht, BRASS, BRASS, BRASS);
  }
  return {
    tris,
    atlasWidth: DOOR_ATLAS_W,
    atlasHeight: DOOR_ATLAS_H,
    stone: fire ? [170, 34, 28] : [146, 100, 60],
  };
}

const DOORS: Record<DoorKind, StatueModel> = { wood: buildDoor("wood"), fire: buildDoor("fire") };

/** The doors' faces and the rest of their atlas. */
export const DOOR_SKIN: StatueSkin = (() => {
  const W = DOOR_ATLAS_W;
  const data = new Uint8ClampedArray(W * DOOR_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const DOOR_BROWN = [150, 104, 62];
  // Wood with the grain running up the door.
  const woodAt = (x: number, y: number) =>
    0.84 + 0.08 * Math.sin(x * 0.9 + Math.sin(y * 0.3) * 1.6 + grain(x, 0) * 2) + 0.08 * grain(x, y);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) put(DOOR_WOOD.x + x, DOOR_WOOD.y + y, DOOR_BROWN, woodAt(x, y));
  }
  // The wooden door: four sunk panels, two tall above and two below, lit from the top left.
  const panels = [
    [4, 5, 14, 31],
    [18, 5, 28, 31],
    [4, 36, 14, 59],
    [18, 36, 28, 59],
  ];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 32; x++) {
      let m = woodAt(x, y);
      for (const [x0, y0, x1, y1] of panels) {
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        if (x === x0 || y === y0) m *= 0.68;
        else if (x === x1 || y === y1) m *= 1.12;
        else m *= 0.94;
      }
      put(WOOD_FACE.x + x, WOOD_FACE.y + y, DOOR_BROWN, m);
    }
  }
  // Painted metal: grey for the fire door's frame, red for the door.
  const FIRE_RED = [170, 34, 28];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      put(DOOR_METAL.x + x, DOOR_METAL.y + y, [128, 130, 128], 0.92 + 0.1 * grain(x, y + 40));
      put(DOOR_RED.x + x, DOOR_RED.y + y, FIRE_RED, 0.92 + 0.1 * grain(x, y + 80));
    }
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      put(BRASS.x + x, BRASS.y + y, [196, 156, 70], 0.85 + 0.2 * grain(x, y));
      put(BAR.x + x, BAR.y + y, [40, 40, 42], 0.9 + 0.15 * grain(x, y));
      put(SILVER.x + x, SILVER.y + y, [196, 198, 198], 0.92 + 0.1 * grain(x, y + 20));
    }
  }
  // The fire door: red all over, scuffed low down, EXIT painted on in off-white a quarter of the way down.
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 32; x++) {
      let m = 0.92 + 0.1 * grain(x, y + 120);
      if (y > 44 && grain(x + 7, y) > 0.93) m *= 0.75;
      put(FIRE_FACE.x + x, FIRE_FACE.y + y, FIRE_RED, m);
    }
  }
  [..."EXIT"].forEach((letter, i) => {
    LETTERS[letter].forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) {
        if (row[rx] === "#") put(FIRE_FACE.x + 9 + i * 4 + rx, FIRE_FACE.y + 14 + ry, [236, 230, 212]);
      }
    });
  });
  return { data };
})();

// ---- the exit signs and wet floor signs ----

/**
 * One atlas for both: the wet floor sign's face (CAUTION, a man slipping in a warning triangle, WET), the exit sign's
 * face (a man running out of a doorway, a big arrow), plain yellow, the exit sign's off-white casing, and grey for its rods.
 */
const WET_FACE: Rect = { x: 0, y: 0, w: 32, h: 56 };
const EXIT_FACE: Rect = { x: 32, y: 0, w: 56, h: 24 };
const YELLOW: Rect = { x: 32, y: 28, w: 16, h: 16 };
const CASING: Rect = { x: 48, y: 28, w: 16, h: 16 };
const ROD: Rect = { x: 64, y: 28, w: 16, h: 16 };
const SAFETY_ATLAS_W = 88;
const SAFETY_ATLAS_H = 56;

/** The same part of the atlas, read right to left. */
const mirrorRect = (r: Rect): Rect => ({ x: r.x + r.w - 1, y: r.y, w: 2 - r.w, h: r.h });

/** The exit sign's half width and height. */
const EXIT_HW = 0.12;
const EXIT_H = 0.117;

/**
 * How an exit sign is made: flat-backed for a wall, lit both sides and hung from the ceiling on two rods, or lit both
 * sides with nothing to hang from, for one lying about.
 */
type ExitMount = "wall" | "hanging" | "loose";

/** An exit sign, its foot at 0, its face toward +z; `mirrored`, the man runs (and the arrow points) the other way. */
function buildExit(mount: ExitMount, mirrored: boolean): StatueModel {
  const tris: number[] = [];
  const face = mirrored ? mirrorRect(EXIT_FACE) : EXIT_FACE;
  const z0 = mount === "wall" ? -0.035 : -0.0175;
  const z1 = mount === "wall" ? 0 : 0.0175;
  box(tris, -EXIT_HW, EXIT_HW, 0, EXIT_H, z0, z1, CASING, CASING, CASING);
  const fx = EXIT_HW - 0.012;
  const f0 = 0.012;
  const f1 = EXIT_H - 0.012;
  quad(tris, [-fx, f0, z1 + 0.002], [fx, f0, z1 + 0.002], [fx, f1, z1 + 0.002], [-fx, f1, z1 + 0.002], face);
  if (mount !== "wall") {
    // Seen from behind, the same picture the right way round, so the man runs the other way.
    quad(tris, [fx, f0, z0 - 0.002], [-fx, f0, z0 - 0.002], [-fx, f1, z0 - 0.002], [fx, f1, z0 - 0.002], face);
  }
  if (mount === "hanging") {
    for (const x of [-0.07, 0.07]) box(tris, x - 0.004, x + 0.004, EXIT_H, EXIT_H + 0.5, -0.004, 0.004, ROD, ROD, ROD);
  }
  return { tris, atlasWidth: SAFETY_ATLAS_W, atlasHeight: SAFETY_ATLAS_H, stone: [220, 218, 206] };
}

const EXIT_MODELS = new Map<string, StatueModel>();
const exitModel = (mount: ExitMount, mirrored: boolean) => {
  const key = `${mount}${mirrored}`;
  let model = EXIT_MODELS.get(key);
  if (!model) {
    model = buildExit(mount, mirrored);
    EXIT_MODELS.set(key, model);
  }
  return model;
};

/** The wet floor sign: two yellow boards leaning together, this tall and wide, their feet this far apart. */
const WET_H = 0.24;
const WET_HW = 0.065;
const WET_FEET = 0.06;

/** A wet floor sign standing open, its foot at 0, one face toward +z and the other toward −z. */
function buildWetFloor(): StatueModel {
  const tris: number[] = [];
  const top = 0.006;
  for (const side of [1, -1]) {
    const foot = side * WET_FEET;
    const head = side * top;
    // Corners as seen from outside: bottom left, bottom right, top right, top left.
    const x0 = -WET_HW * side;
    const x1 = WET_HW * side;
    quad(tris, [x0, 0, foot], [x1, 0, foot], [x1, WET_H, head], [x0, WET_H, head], WET_FACE);
    // The inside of the board, a hair further in.
    const inset = side * 0.003;
    quad(tris, [x1, 0, foot - inset], [x0, 0, foot - inset], [x0, WET_H, head - inset], [x1, WET_H, head - inset], YELLOW);
  }
  return { tris, atlasWidth: SAFETY_ATLAS_W, atlasHeight: SAFETY_ATLAS_H, stone: [236, 190, 30] };
}

const WET_FLOOR = buildWetFloor();

/** Whether (px, py) is within r of the line from a to b. */
function nearLine(px: number, py: number, a: readonly number[], b: readonly number[], r: number) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t) <= r;
}

/** A stick figure: a head, then lines, each a run of points joined up. */
function inFigure(px: number, py: number, head: readonly number[], lines: readonly (readonly number[])[][], r: number) {
  if (Math.hypot(px - head[0], py - head[1]) <= head[2]) return true;
  return lines.some((run) => run.slice(1).some((p, i) => nearLine(px, py, run[i], p, r)));
}

/** Running out through the doorway, to the right; drawn in green on the white of the door. */
const RUNNER_HEAD = [15.5, 6.3, 1.9];
const RUNNER = [
  [
    [14.2, 9],
    [12, 13.5],
  ],
  [
    [14.5, 9.5],
    [17.5, 10.3],
    [20.5, 10.3],
  ],
  [
    [13.8, 9.6],
    [10.8, 10.2],
    [9.2, 12.3],
  ],
  [
    [12, 13.5],
    [15, 15.5],
    [15, 19],
  ],
  [
    [12, 13.5],
    [9.6, 16.2],
    [6.6, 16.2],
  ],
];

/** Feet going out from under him, arms up. */
const SLIPPER_HEAD = [20.5, 26.5, 1.7];
const SLIPPER = [
  [
    [19.3, 29],
    [15.5, 33.5],
  ],
  [
    [18.8, 29.8],
    [22.5, 28.2],
  ],
  [
    [18.3, 30.3],
    [13.5, 30.8],
  ],
  [
    [15.5, 33.5],
    [20, 37],
  ],
  [
    [15.5, 33.5],
    [11.5, 36.5],
  ],
];

const EXIT_GREEN = [14, 112, 36];
const WET_YELLOW = [236, 190, 30];

export const SAFETY_SKIN: StatueSkin = (() => {
  const W = SAFETY_ATLAS_W;
  const data = new Uint8ClampedArray(W * SAFETY_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1, a = 255) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = a;
  };
  const fill = (r: Rect, c: readonly number[]) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) put(x, y, c, 0.93 + 0.1 * grain(x, y + 200));
    }
  };
  fill(YELLOW, WET_YELLOW);
  fill(CASING, [222, 220, 208]);
  fill(ROD, [120, 122, 122]);
  const print = (word: string, left: number, top: number, c: readonly number[]) => {
    [...word].forEach((letter, i) => {
      LETTERS[letter].forEach((row, ry) => {
        for (let rx = 0; rx < 3; rx++) if (row[rx] === "#") put(left + i * 4 + rx, top + ry, c);
      });
    });
  };

  // The exit sign, lit from inside (alpha 64–127): on the left a white doorway with a green man running out of it and
  // the white of the floor spilling out below; on the right a big white arrow the way he's going.
  for (let y = 0; y < EXIT_FACE.h; y++) {
    for (let x = 0; x < EXIT_FACE.w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const doorway = px > 6 && px < 20.5 && py > 3 && py < 19.5;
      const floor = py >= 19.5 && py < 21.8 && px > 6 - (py - 19.5) * 1.3 && px < 20.5 + (py - 19.5) * 1.3;
      const runner = inFigure(px, py, RUNNER_HEAD, RUNNER, 1.1);
      const arrow =
        (px > 26.5 && px < 41 && py > 9.2 && py < 14.3) || inTriangle(px, py, [38.5, 3.2], [51.5, 11.75], [38.5, 20.3]);
      const white = ((doorway || floor) && !runner) || arrow;
      put(EXIT_FACE.x + x, EXIT_FACE.y + y, white ? [240, 248, 240] : EXIT_GREEN, 1, 100);
    }
  }

  // The wet floor sign: yellow, a dark handle slot at the top, CAUTION, the warning triangle with the man slipping in
  // it, and WET.
  for (let y = 0; y < WET_FACE.h; y++) {
    for (let x = 0; x < WET_FACE.w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let c = WET_YELLOW;
      if (px > 11 && px < 21 && py > 2.5 && py < 6) c = [40, 34, 20];
      const apex = [16, 17.5];
      const left = [3, 41];
      const right = [29, 41];
      if (inTriangle(px, py, apex, left, right)) {
        const inner = inTriangle(px, py, [16, 21.5], [6.6, 39], [25.4, 39]);
        c = inner ? WET_YELLOW : SIGN_BLACK;
        if (inner && (inFigure(px, py, SLIPPER_HEAD, SLIPPER, 0.95) || nearLine(px, py, [9, 38], [23, 38], 0.5))) {
          c = SIGN_BLACK;
        }
      }
      put(WET_FACE.x + x, WET_FACE.y + y, c, 0.94 + 0.08 * grain(x, y + 300));
    }
  }
  print("CAUTION", WET_FACE.x + 3, WET_FACE.y + 9, SIGN_BLACK);
  print("WET", WET_FACE.x + 11, WET_FACE.y + 45, SIGN_BLACK);
  return { data };
})();

// ---- the filing cabinets, desks and wall sockets ----

/**
 * One atlas for the filing cabinets and the sockets: a drawer front (handle, label holder), steel, darker steel, a
 * manila folder, a wall socket's plate with two outlets, one above the other or side by side, and a light switch. The desks are wood, the chairs' own.
 */
const DRAWER: Rect = { x: 0, y: 0, w: 32, h: 16 };
const STEEL: Rect = { x: 32, y: 0, w: 16, h: 16 };
const STEEL_DARK: Rect = { x: 48, y: 0, w: 16, h: 16 };
const FOLDER: Rect = { x: 44, y: 16, w: 8, h: 8 };
const SOCKET: Rect = { x: 32, y: 16, w: 12, h: 20 };
/** The same two outlets side by side, on a plate the other way round. */
const SOCKET_WIDE: Rect = { x: 44, y: 24, w: 20, h: 12 };
/** A light switch on a wide plate. */
const SWITCH: Rect = { x: 0, y: 16, w: 20, h: 12 };
/** A corner of the socket's plate, plain, for its edges. */
const PLATE: Rect = { x: 32, y: 16, w: 2, h: 2 };
const OFFICE_ATLAS_W = 64;
/** An office desk's laminate top, and an office chair's fabric. */
const LAMINATE: Rect = { x: 0, y: 36, w: 32, h: 16 };
const FABRIC: Rect = { x: 32, y: 36, w: 32, h: 16 };
const OFFICE_ATLAS_H = 52;

/** One drawer's height, and the plinth under the bottom one. */
const DRAWER_H = 0.1;
const PLINTH = 0.012;

/** How a filing cabinet is made, or bent out of shape: drawers, width, depth, and how far out each drawer is. */
interface CabinetShape {
  drawers: number;
  width: number;
  depth: number;
  /** From the bottom drawer up. */
  pulled: readonly number[];
}

const cabinetHeight = (shape: CabinetShape) => PLINTH + shape.drawers * DRAWER_H;

/**
 * Most cabinets are ordinary, one in three with a drawer left open; the rest a tower of drawers up through the ceiling,
 * squat and wide, thin as a sheet, far too deep, or every drawer out like steps.
 */
function cabinetShape(a: number, b: number, c: number): CabinetShape {
  const ordinary = { drawers: 4, width: 0.15, depth: 0.2 };
  const open = (n: number) =>
    Array.from({ length: n }, (_, i) => (c < 0.35 && i === Math.floor((c / 0.35) * n) ? 0.04 + ((c * 7) % 1) * 0.1 : 0));
  if (a < 0.5) return { ...ordinary, pulled: open(4) };
  if (a < 0.62) {
    const drawers = 8 + Math.floor(b * 9);
    return { ...ordinary, drawers, pulled: open(drawers) };
  }
  if (a < 0.74) {
    const drawers = 1 + Math.floor(b * 2);
    return { ...ordinary, drawers, width: 0.3 + b * 0.25, pulled: open(drawers) };
  }
  if (a < 0.84) return { ...ordinary, width: 0.035 + b * 0.02, pulled: open(4) };
  if (a < 0.92) return { ...ordinary, depth: 0.55 + b * 0.5, pulled: open(4) };
  return { ...ordinary, pulled: [0.18, 0.135, 0.09, 0.045] };
}

/** A filing cabinet standing on the floor, its drawers toward +z. */
function buildCabinet(shape: CabinetShape): StatueModel {
  const tris: number[] = [];
  const hw = shape.width / 2;
  const hd = shape.depth / 2;
  const tall = cabinetHeight(shape);
  const inset = Math.min(0.012, hw * 0.3);
  box(tris, -hw, hw, 0, tall, -hd, hd - 0.004, STEEL, STEEL, STEEL);
  for (let i = 0; i < shape.drawers; i++) {
    const y0 = PLINTH + i * DRAWER_H + 0.004;
    const y1 = PLINTH + (i + 1) * DRAWER_H - 0.004;
    const out = shape.pulled[i] ?? 0;
    if (out > 0) {
      // The drawer itself, as far out as it's pulled: open at the top, a bottom, two sides and a back, and hanging
      // folders standing in it.
      const back = hd + out - Math.min(shape.depth * 0.9, 0.5);
      const front = hd + out - 0.004;
      const x0 = -hw + inset;
      const x1 = hw - inset;
      const floor = y0 + 0.006;
      const rim = y1 - 0.014;
      const T = Math.min(0.004, (x1 - x0) / 4);
      box(tris, x0, x1, floor, floor + T, back, front, STEEL_DARK, STEEL_DARK, STEEL_DARK);
      box(tris, x0, x0 + T, floor, rim, back, front, STEEL_DARK, STEEL_DARK, STEEL_DARK);
      box(tris, x1 - T, x1, floor, rim, back, front, STEEL_DARK, STEEL_DARK, STEEL_DARK);
      box(tris, x0, x1, floor, rim, back, back + T, STEEL_DARK, STEEL_DARK, STEEL_DARK);
      const folders = Math.max(1, Math.floor((front - back) / 0.03));
      for (let f = 0; f < folders; f++) {
        const z = back + ((f + 0.6) / folders) * (front - back - 0.01);
        box(tris, x0 + T, x1 - T, floor + T, rim + 0.006, z, z + 0.003, FOLDER, FOLDER, FOLDER);
      }
    }
    box(tris, -hw + 0.003, hw - 0.003, y0, y1, hd + out - 0.004, hd + out + 0.008, DRAWER, STEEL, STEEL);
  }
  return { tris, atlasWidth: OFFICE_ATLAS_W, atlasHeight: OFFICE_ATLAS_H, stone: [150, 152, 150] };
}

/** How a desk is made, or bent out of shape. */
interface DeskShape {
  length: number;
  depth: number;
  height: number;
  /** Pairs of legs, front and back, spread along it. */
  legs: number;
  /** A shallow drawer in the front rail. */
  drawer: boolean;
}

/**
 * Most desks are ordinary, half of them with a drawer; the rest on legs far too long, far too long themselves, down
 * almost to the carpet, on too many legs, or narrow as a plank.
 */
function deskShape(a: number, b: number, c: number): DeskShape {
  const ordinary = { length: 0.38, depth: 0.19, height: 0.23, legs: 2, drawer: c < 0.5 };
  if (a < 0.5) return ordinary;
  if (a < 0.62) return { ...ordinary, height: 0.45 + b * 0.45, drawer: false };
  if (a < 0.74) {
    const length = 0.8 + b * 0.9;
    return { ...ordinary, length, legs: 2 + Math.floor(length / 0.4) };
  }
  if (a < 0.84) return { ...ordinary, height: 0.04 + b * 0.05, drawer: false };
  if (a < 0.92) return { ...ordinary, legs: 4 + Math.floor(b * 5) };
  return { ...ordinary, depth: 0.04 + b * 0.03, drawer: false };
}

/**
 * A wooden desk to go with the chairs, standing on the floor, its length across and the side you'd sit at toward +z:
 * a top, square legs, a rail round under the top, and maybe a drawer in the front rail with a little knob. An office
 * one has a laminate top on steel.
 */
function buildDesk(shape: DeskShape, office = false): StatueModel {
  const tris: number[] = [];
  const hl = shape.length / 2;
  const hd = shape.depth / 2;
  const top = shape.height;
  const thick = 0.014;
  const L = Math.min(0.011, hd * 0.4);
  const frame = office ? STEEL : WOOD;
  const part = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r = frame) =>
    box(tris, x0, x1, y0, y1, z0, z1, r, r, r);
  // The top, a little proud of the legs all round.
  part(-hl, hl, top - thick, top, -hd, hd, office ? LAMINATE : WOOD);
  const under = top - thick;
  const inset = 0.008;
  for (let i = 0; i < shape.legs; i++) {
    const x = -hl + inset + L + (i / (shape.legs - 1)) * (shape.length - (inset + L) * 2);
    for (const z of [-hd + inset + L, hd - inset - L]) part(x - L, x + L, 0, under, z - L, z + L);
  }
  // The rail round under the top, as deep as there's room for.
  const rail = Math.min(0.035, under * 0.5);
  if (rail > 0.006) {
    const x0 = -hl + inset;
    const x1 = hl - inset;
    const z0 = -hd + inset;
    const z1 = hd - inset;
    part(x0, x1, under - rail, under, z1 - 0.006, z1);
    part(x0, x1, under - rail, under, z0, z0 + 0.006);
    part(x0, x0 + 0.006, under - rail, under, z0, z1);
    part(x1 - 0.006, x1, under - rail, under, z0, z1);
    if (shape.drawer) {
      const w = Math.min(0.16, shape.length * 0.4);
      part(-w / 2, w / 2, under - rail + 0.004, under - 0.004, z1, z1 + 0.004);
      const mid = under - rail / 2;
      part(-0.006, 0.006, mid - 0.005, mid + 0.005, z1 + 0.004, z1 + 0.012, office ? STEEL_DARK : WOOD);
    }
  }
  if (office) return { tris, atlasWidth: OFFICE_ATLAS_W, atlasHeight: OFFICE_ATLAS_H, stone: [198, 192, 176] };
  return { tris, atlasWidth: 32, atlasHeight: 32, stone: [120, 84, 50] };
}

/** A wall socket's plate, upright: its half width and its height; and how far it stands off the wall. */
const SOCKET_HW = 0.0175;
const SOCKET_H = 0.055;
const SOCKET_T = 0.012;

/** A wall socket, its back at z = 0 and its face toward +z, its foot at 0, `hw` across each way and `h` high. */
function buildSocket(face: Rect, hw: number, h: number): StatueModel {
  const tris: number[] = [];
  box(tris, -hw, hw, 0, h, 0, SOCKET_T, face, PLATE, PLATE);
  return { tris, atlasWidth: OFFICE_ATLAS_W, atlasHeight: OFFICE_ATLAS_H, stone: [226, 222, 208] };
}

/**
 * The three kinds, as likely as each other: the outlets one above the other on an upright plate, side by side on a
 * wide one, or a light switch on a wide one.
 */
const SOCKETS = [
  { model: buildSocket(SOCKET, SOCKET_HW, SOCKET_H), h: SOCKET_H },
  { model: buildSocket(SOCKET_WIDE, SOCKET_H / 2, SOCKET_HW * 2), h: SOCKET_HW * 2 },
  { model: buildSocket(SWITCH, SOCKET_H / 2, SOCKET_HW * 2), h: SOCKET_HW * 2 },
];

/** Steel, the drawer fronts, the sockets, the laminate and the fabric, drawn. */
export const OFFICE_SKIN: StatueSkin = (() => {
  const W = OFFICE_ATLAS_W;
  const data = new Uint8ClampedArray(W * OFFICE_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const GREY = [150, 152, 150];
  const noise = (x: number, y: number) => 0.94 + 0.08 * grain(x, y + 400);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      put(STEEL.x + x, STEEL.y + y, GREY, noise(x, y));
      put(STEEL_DARK.x + x, STEEL_DARK.y + y, [88, 90, 90], noise(x, y));
    }
  }
  // A drawer front: grey, a darker edge, a label holder with a white card, a dark handle under it.
  for (let y = 0; y < DRAWER.h; y++) {
    for (let x = 0; x < DRAWER.w; x++) {
      let c = GREY;
      let m = noise(x, y + 20);
      if (x === 0 || y === 0 || x === DRAWER.w - 1 || y === DRAWER.h - 1) m *= 0.72;
      if (x >= 12 && x <= 19 && y >= 3 && y <= 7) c = x === 12 || x === 19 || y === 3 || y === 7 ? [110, 112, 112] : [230, 228, 214];
      if (x >= 10 && x <= 21 && y >= 10 && y <= 11) c = [40, 40, 42];
      put(DRAWER.x + x, DRAWER.y + y, c, m);
    }
  }
  // Manila folders, a darker fold along the top.
  for (let y = 0; y < FOLDER.h; y++) {
    for (let x = 0; x < FOLDER.w; x++) put(FOLDER.x + x, FOLDER.y + y, [214, 184, 120], y === 0 ? 0.75 : noise(x, y + 40));
  }
  // The sockets: an off-white plate with a raised middle, two outlets, each two upright slots and the earth hole
  // under them; one above the other, or side by side.
  const DARK = [40, 36, 32];
  const plate = (r: Rect, outlets: readonly [number, number][]) => {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        let c = [226, 222, 208];
        let m = 1;
        if (x === 0 || y === 0 || x === r.w - 1 || y === r.h - 1) m = 0.8;
        else if (x === 1 || y === 1 || x === r.w - 2 || y === r.h - 2) m = 0.92;
        for (const [ox, oy] of outlets) {
          const lx = x - ox;
          const ly = y - oy;
          if (lx >= 0 && lx <= 7 && ly >= 0 && ly <= 6) m = 0.88;
          if ((lx === 2 || lx === 5) && ly >= 1 && ly <= 3) c = DARK;
          if ((lx === 3 || lx === 4) && ly === 5) c = DARK;
        }
        put(r.x + x, r.y + y, c, m);
      }
    }
  };
  plate(SOCKET, [
    [2, 2],
    [2, 11],
  ]);
  plate(SOCKET_WIDE, [
    [2, 3],
    [10, 3],
  ]);
  // The light switch: a beige plate, a small square frame in the middle, the rocker in it, and the little indicator
  // at its top.
  for (let y = 0; y < SWITCH.h; y++) {
    for (let x = 0; x < SWITCH.w; x++) {
      let c = [214, 208, 186];
      let m = 1;
      if (x === 0 || y === 0 || x === SWITCH.w - 1 || y === SWITCH.h - 1) m = 0.8;
      else if (x === 1 || y === 1 || x === SWITCH.w - 2 || y === SWITCH.h - 2) m = 0.93;
      if (x >= 7 && x <= 12 && y >= 2 && y <= 9) m = x === 7 || x === 12 || y === 2 || y === 9 ? 0.82 : 0.95;
      if (x >= 8 && x <= 11 && y >= 3 && y <= 8) {
        c = [232, 226, 206];
        m = y <= 5 ? 0.96 : 1.02;
      }
      if ((x === 9 || x === 10) && y === 4) c = [110, 64, 40];
      put(SWITCH.x + x, SWITCH.y + y, c, m);
    }
  }
  // Laminate: a pale grey-beige with a fine speckle, a darker edge band all round.
  for (let y = 0; y < LAMINATE.h; y++) {
    for (let x = 0; x < LAMINATE.w; x++) {
      const edge = x === 0 || y === 0 || x === LAMINATE.w - 1 || y === LAMINATE.h - 1;
      const m = edge ? 0.8 : 0.96 + 0.05 * grain(x, y + 600) - (grain(x + 7, y + 601) > 0.93 ? 0.08 : 0);
      put(LAMINATE.x + x, LAMINATE.y + y, [198, 192, 176], m);
    }
  }
  // Fabric: grey-blue, woven, so every other thread a shade darker each way, and worn in places.
  for (let y = 0; y < FABRIC.h; y++) {
    for (let x = 0; x < FABRIC.w; x++) {
      const weave = (x + y) % 2 === 0 ? 1 : 0.9;
      const worn = 0.94 + 0.1 * grain(Math.floor(x / 4), Math.floor(y / 4) + 700);
      put(FABRIC.x + x, FABRIC.y + y, [84, 96, 118], weave * worn);
    }
  }
  return { data };
})();

// ---- the chicken burger ----

/**
 * One atlas for the chicken burger: the top of the bun with its white sesame seeds, the bun's side, its cut face (the
 * crumb), the fried chicken, the lettuce, the mayonnaise, and the white meat inside the chicken, where it's bitten.
 */
const BUN_TOP: Rect = { x: 0, y: 0, w: 32, h: 32 };
const BUN_SIDE: Rect = { x: 32, y: 0, w: 32, h: 16 };
const CRUMB: Rect = { x: 32, y: 16, w: 16, h: 16 };
const CHICKEN: Rect = { x: 48, y: 16, w: 16, h: 16 };
const LETTUCE: Rect = { x: 64, y: 0, w: 16, h: 16 };
const MAYO: Rect = { x: 64, y: 16, w: 16, h: 16 };
const MEAT: Rect = { x: 80, y: 0, w: 16, h: 16 };
const BURGER_ATLAS_W = 96;
const BURGER_ATLAS_H = 32;

/** An ordinary one's width; its height against that; and how many sides each layer goes round in. */
const BURGER_W = 0.1;
const BURGER_TALL = 0.88;
const BURGER_SIDES = 36;

/**
 * A burger whole, or one part of it fallen off on its own: the bottom bun, the chicken, the lettuce (and its
 * mayonnaise), the top bun. Where each part's foot is up the whole one, and how tall it is.
 */
type BurgerPart = "whole" | "bottom" | "chicken" | "lettuce" | "top";
const PART_FOOT: Record<BurgerPart, number> = { whole: 0, bottom: 0, chicken: 0.125, lettuce: 0.4, top: 0.52 };
const PART_TALL: Record<BurgerPart, number> = { whole: BURGER_TALL, bottom: 0.15, chicken: 0.31, lettuce: 0.12, top: 0.36 };

/** A bite out of a burger: the way it was taken from, round the burger, and how big a mouthful (1, an ordinary one). */
interface Bite {
  at: number;
  big: number;
}

/**
 * A chicken burger `size` times the ordinary, its middle on its own axis, its foot at 0, as Kara would have it: a
 * soft bottom bun with rounded edges; the fried chicken, lumpy all round and sticking out well past the bun, further
 * on some sides than others; lettuce in clumps poking out between; mayonnaise squeezing out here and there; and the
 * tall soft dome of the top bun, tucked in at its edge. `bites`, the bites taken out of it, through every layer:
 * none, whole.
 */
function buildBurger(size: number, bites: readonly Bite[], part: BurgerPart = "whole"): StatueModel {
  const has = (layer: BurgerPart) => part === "whole" || part === layer;
  const tris: number[] = [];
  const s = BURGER_W * size;
  const N = BURGER_SIDES;
  const angle = (i: number) => (i / N) * Math.PI * 2;
  // A layer's radius r at side i, height y, after the bites. Each bite is a mouth: a circle out past the burger's
  // edge, and whatever of any layer is inside it is gone, so every layer is bitten as deep, however far it sticks out.
  // The mouth is widest at the middle of the burger, closing to nothing at the top of the dome and the foot of the
  // bun, so the bite's edge is round; torn a little unevenly at every height, its rim scalloped by teeth.
  const MOUTH = 0.95;
  const cutTo = (i: number, y: number, r: number) => {
    const h = 1 - ((y - 0.48) / 0.56) ** 2;
    if (h <= 0) return r;
    let left = r;
    bites.forEach(({ at: towards, big }, b) => {
      const tear = (k: number) => grain(Math.round(y * 200), k + b * 11) - 0.5;
      let d = angle(i) - towards - tear(3) * 0.14;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.cos(d) <= 0) return;
      const m = 0.66 * big * Math.sqrt(h) * (1 + tear(5) * 0.15) * (0.93 + 0.07 * Math.abs(Math.sin(d * 5)));
      const reach = m * m - (MOUTH * Math.sin(d)) ** 2;
      if (reach > 0) left = Math.min(left, Math.max(0.03, MOUTH * Math.cos(d) - Math.sqrt(reach)));
    });
    return left;
  };
  const at = (i: number, r: number, y: number): V3 => [Math.cos(angle(i)) * r * s, y * s, Math.sin(angle(i)) * r * s];
  const corner = (p: V3, rect: Rect, u: number, v: number): Corner => [
    ...p,
    rect.x + 0.5 + u * (rect.w - 1),
    rect.y + 0.5 + v * (rect.h - 1),
  ];
  // Round the side of a layer, from radius r0 at y0 up to r1 at y1 (each a function of the side's index). Each face
  // is painted with the whole of `rect`, or, given `patch`, with a patch that big from somewhere in it, so a pattern
  // (the sesame seeds) isn't squeezed small onto every face.
  const side = (
    y0: number,
    y1: number,
    r0: (i: number) => number,
    r1: (i: number) => number,
    rect: Rect,
    patch = 0,
    row = 0,
    cut: Rect | null = null,
  ) => {
    for (let i = 0; i < N; i++) {
      // Where the bite went, the face shows the inside instead.
      const bitten = (k: number, y: number, r: (i: number) => number) => cutTo(k, y, r(k)) < r(k) - 0.002;
      const inBite = cut && bitten(i, y0, r0) && bitten(i + 1, y0, r0) && bitten(i, y1, r1) && bitten(i + 1, y1, r1);
      const paint = inBite
        ? cut
        : patch
        ? {
            x: rect.x + ((i * 7 + row * 3) % (rect.w - patch)),
            y: rect.y + ((row * 9 + i * 5) % (rect.h - patch)),
            w: patch,
            h: patch,
          }
        : rect;
      quad(
        tris,
        at(i + 1, cutTo(i + 1, y0, r0(i + 1)), y0),
        at(i, cutTo(i, y0, r0(i)), y0),
        at(i, cutTo(i, y1, r1(i)), y1),
        at(i + 1, cutTo(i + 1, y1, r1(i + 1)), y1),
        paint,
      );
    }
  };
  // A flat face across a layer at y, facing up or down.
  const cap = (y: number, whole: (i: number) => number, rect: Rect, up: boolean) => {
    const r = (i: number) => cutTo(i, y, whole(i));
    const mid = corner([0, y * s, 0], rect, 0.5, 0.5);
    for (let i = 0; i < N; i++) {
      const p = (k: number) =>
        corner(at(k, r(k), y), rect, 0.5 + 0.5 * Math.cos(angle(k)) * r(k), 0.5 + 0.5 * Math.sin(angle(k)) * r(k));
      if (up) tri(tris, mid, p(i + 1), p(i));
      else tri(tris, mid, p(i), p(i + 1));
    }
  };
  // A ring closed off to a point in the middle at height `tip`, above it or below it: each face painted with the
  // whole of `rect`, as the sides are, so the pattern on it is the same size as theirs rather than one stretched disc.
  const peak = (y: number, tip: number, r: (i: number) => number, rect: Rect, up: boolean) => {
    for (let i = 0; i < N; i++) {
      const top = corner([0, tip * s, 0], rect, 0.5, 0.1);
      const a = corner(at(i, cutTo(i, y, r(i)), y), rect, 0, 0.9);
      const b = corner(at(i + 1, cutTo(i + 1, y, r(i + 1)), y), rect, 1, 0.9);
      if (up) tri(tris, top, b, a);
      else tri(tris, top, a, b);
    }
  };
  // A layer's outline as rings up its side: each a height and a radius at every side. Faces between each pair.
  type Ring = { y: number; r: (i: number) => number };
  // `cut` is what each band shows where it's bitten (by its index up the stack), or null to show its outside.
  const stack = (rings: readonly Ring[], rect: Rect, patch = 0, cut: (j: number) => Rect | null = () => null) => {
    for (let j = 0; j < rings.length - 1; j++) {
      side(rings[j].y, rings[j + 1].y, rings[j].r, rings[j + 1].r, rect, patch, j, cut(j));
    }
  };
  // Lumps that go slowly round: the same few waves for every ring of a layer, so it's lopsided, not just rough.
  const waves = (i: number, phase: number, a2: number, a3: number, a5: number) => {
    const t = angle(i);
    return a2 * Math.cos(2 * t + phase) + a3 * Math.cos(3 * t + phase * 1.7 + 1) + a5 * Math.cos(5 * t + phase * 0.6 + 2);
  };
  const scaled = (k: number, f: (i: number) => number) => (i: number) => k * f(i);

  // The bottom bun: soft, its edges rounded top and bottom.
  const bun = () => 0.5;
  const bottom: Ring[] = [
    { y: 0, r: scaled(0.84, bun) },
    { y: 0.025, r: scaled(0.95, bun) },
    { y: 0.07, r: bun },
    { y: 0.12, r: scaled(0.98, bun) },
    { y: 0.15, r: scaled(0.9, bun) },
  ];
  // Bitten, the crumb shows, inside a rim of crust.
  if (has("bottom")) {
    stack(bottom, BUN_SIDE, 0, (j) => (j === 0 || j === bottom.length - 2 ? null : CRUMB));
    cap(0, bottom[0].r, BUN_SIDE, false);
    // On its own, its cut face shows.
    if (part === "bottom") cap(0.15, bottom[bottom.length - 1].r, CRUMB, true);
  }

  // The fried chicken: lopsided, sticking out further on some sides, craggy all over, its top and bottom tucked in.
  const chicken = (salt: number, k: number) => (i: number) =>
    (0.55 + waves(i, 0.4, 0.045, 0.035, 0.02) + 0.06 * grain(i % N, salt)) * k;
  const crust: Ring[] = [
    { y: 0.14, r: chicken(17, 0.82) },
    { y: 0.18, r: chicken(19, 0.95) },
    { y: 0.26, r: chicken(23, 1.02) },
    { y: 0.34, r: chicken(29, 1) },
    { y: 0.39, r: chicken(31, 0.92) },
    { y: 0.42, r: chicken(37, 0.78) },
  ];
  // Bitten, the white meat shows, the crust still round its top and bottom.
  if (has("chicken")) {
    stack(crust, CHICKEN, 0, (j) => (j === 0 || j === crust.length - 2 ? null : MEAT));
    // Its top and bottom bulge a little, the way a fried piece of chicken does, rather than being cut flat.
    const first = crust[0];
    const lastRing = crust[crust.length - 1];
    const under: Ring[] = [
      { y: 0.14, r: first.r },
      { y: 0.13, r: scaled(0.65, first.r) },
      { y: 0.125, r: scaled(0.3, first.r) },
    ];
    const over: Ring[] = [
      { y: 0.42, r: lastRing.r },
      { y: 0.43, r: scaled(0.65, lastRing.r) },
      { y: 0.435, r: scaled(0.3, lastRing.r) },
    ];
    stack([...under].reverse(), CHICKEN);
    stack(over, CHICKEN);
    peak(0.125, 0.12, under[2].r, CHICKEN, false);
    peak(0.435, 0.44, over[2].r, CHICKEN, true);
  }

  // The lettuce, in clumps: out a long way on some sides, hardly past the chicken on others, rumpled up and down.
  const lettuce = (salt: number, k: number) => (i: number) =>
    (0.53 + 0.08 * Math.max(0, Math.cos(4 * angle(i) + 1)) + waves(i, 2.1, 0.03, 0.03, 0.04) + 0.05 * grain(i % N, salt)) *
    k;
  const leaves: Ring[] = [
    { y: 0.4, r: lettuce(41, 0.85) },
    { y: 0.43, r: lettuce(43, 1.04) },
    { y: 0.47, r: lettuce(47, 1) },
    { y: 0.5, r: lettuce(53, 0.8) },
  ];
  if (has("lettuce")) {
    stack(leaves, LETTUCE);
    cap(0.4, leaves[0].r, LETTUCE, false);
    cap(0.5, leaves[leaves.length - 1].r, LETTUCE, true);
  }

  // Mayonnaise, mostly hidden, squeezing out past the bun in a few blobs.
  const blobs = (k: number) => (i: number) => (0.46 + 0.1 * Math.max(0, Math.cos(6 * angle(i) + 0.7)) ** 3) * k;
  if (part === "whole") {
    stack(
      [
        { y: 0.48, r: blobs(0.95) },
        { y: 0.5, r: blobs(1) },
        { y: 0.53, r: blobs(0.9) },
      ],
      MAYO,
    );
  }
  // Fallen off on its own, the lettuce has the mayonnaise smeared over most of its top: an uneven blob, not a ring,
  // with the frilly edges of the leaves showing round it.
  if (part === "lettuce") {
    const smear = (k: number) => (i: number) =>
      (0.4 + waves(i, 4.2, 0.03, 0.025, 0.02) + 0.03 * grain(i % N, 61)) * k;
    stack(
      [
        { y: 0.5, r: smear(1) },
        { y: 0.51, r: smear(0.8) },
        { y: 0.515, r: smear(0.45) },
      ],
      MAYO,
    );
    cap(0.515, smear(0.45), MAYO, true);
  }

  // The top bun: its cut face underneath, then up from its tucked-in edge, round its shoulder and over the dome.
  const DOME: readonly [number, number][] = [
    [0.52, 0.86],
    [0.535, 0.95],
    [0.56, 1],
    [0.62, 0.99],
    [0.69, 0.93],
    [0.76, 0.8],
    [0.82, 0.6],
    [0.86, 0.36],
  ];
  const dome: Ring[] = DOME.map(([y, k]) => ({ y, r: scaled(k, bun) }));
  if (has("top")) {
    cap(0.52, dome[0].r, CRUMB, false);
    stack(dome, BUN_TOP, 10, (j) => (j >= 1 ? CRUMB : null));
    const last = dome[dome.length - 1];
    const crown = corner([0, BURGER_TALL * s, 0], BUN_TOP, 0.5, 0.5);
    for (let i = 0; i < N; i++) {
      const p = (k: number) => corner(at(k, cutTo(k, last.y, last.r(k)), last.y), BUN_TOP, (k % 2) * 0.9, 0.9);
      tri(tris, crown, p(i + 1), p(i));
    }
  }
  // A part on its own stands on its own foot.
  const foot = PART_FOOT[part] * s;
  for (let t = 0; t < tris.length; t += 16) for (let k = 0; k < 3; k++) tris[t + k * 5 + 1] -= foot;
  return { tris, atlasWidth: BURGER_ATLAS_W, atlasHeight: BURGER_ATLAS_H, stone: [212, 150, 76] };
}

const BURGERS = new Map<string, StatueModel>();
const burgerModel = (size: number, bites: readonly Bite[] = [], part: BurgerPart = "whole") => {
  const key = `${part}|${size.toFixed(2)}|${bites.map((b) => `${b.at.toFixed(2)},${b.big.toFixed(2)}`).join(";")}`;
  let model = BURGERS.get(key);
  if (!model) {
    model = buildBurger(size, bites, part);
    BURGERS.set(key, model);
  }
  return model;
};

export const BURGER_SKIN: StatueSkin = (() => {
  const W = BURGER_ATLAS_W;
  const data = new Uint8ClampedArray(W * BURGER_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const fill = (r: Rect, c: readonly number[], spread: number, salt: number) => {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) put(x, y, c, 1 - spread / 2 + spread * grain(x, y + salt));
    }
  };
  // Golden brown on top, paler down the side, the crumb paler still.
  fill(BUN_TOP, [212, 150, 76], 0.12, 500);
  fill(BUN_SIDE, [226, 180, 110], 0.1, 510);
  fill(CRUMB, [242, 222, 182], 0.08, 520);
  // The crumb is soft and airy: a few shallow holes, only a shade darker, a paler lip under each.
  const HOLES: readonly [number, number, number, number][] = [
    [4, 3, 1.4, 1],
    [12, 6, 1.6, 1.1],
    [3, 11, 1.2, 0.9],
    [10, 13, 1.8, 1.2],
  ];
  for (const [hx, hy, rx, ry] of HOLES) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = hx + dx;
        const y = hy + dy;
        if (x < 0 || y < 0 || x >= CRUMB.w || y >= CRUMB.h) continue;
        const e = (dx / rx) ** 2 + (dy / ry) ** 2;
        if (e <= 1) put(CRUMB.x + x, CRUMB.y + y, dy < 0 ? [218, 192, 148] : [228, 204, 162]);
        else if (e <= 1.8 && dy > 0) put(CRUMB.x + x, CRUMB.y + y, [248, 234, 202]);
      }
    }
  }
  // The chicken's crust: golden orange, craggy, light and dark.
  fill(CHICKEN, [204, 132, 52], 0.5, 530);
  // The lettuce: bright green, crinkled lighter and darker.
  fill(LETTUCE, [118, 186, 56], 0.3, 540);
  fill(MAYO, [246, 242, 226], 0.05, 550);
  // The white meat: pale, a little pink, in streaks of fibre running across.
  for (let y = 0; y < MEAT.h; y++) {
    for (let x = 0; x < MEAT.w; x++) {
      const fibre = grain(Math.floor(x / 4), y + 560) < 0.35;
      put(MEAT.x + x, MEAT.y + y, fibre ? [226, 192, 170] : [242, 224, 206], 0.96 + 0.06 * grain(x, y + 570));
    }
  }
  // White sesame seeds scattered thick over the bun: little slanted ovals, white, a faint shadow underneath.
  const SEEDS: readonly [number, number, number][] = [
    [4, 4, 0.6],
    [13, 3, -0.5],
    [23, 5, 0.9],
    [29, 12, -0.2],
    [8, 11, -0.3],
    [18, 12, 0.4],
    [3, 19, -0.8],
    [12, 20, 0.2],
    [22, 19, -0.6],
    [28, 24, 0.7],
    [7, 27, 0.1],
    [17, 28, -0.4],
  ];
  for (const [sx, sy, turn] of SEEDS) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const u = dx * Math.cos(turn) + dy * Math.sin(turn);
        const v = -dx * Math.sin(turn) + dy * Math.cos(turn);
        const e = (u / 1.7) ** 2 + (v / 0.95) ** 2;
        if (e > 1.5) continue;
        const c = e > 1 ? (v > 0 ? [164, 108, 50] : null) : [252, 250, 240];
        if (c) put(BUN_TOP.x + sx + dx, BUN_TOP.y + sy + dy, c);
      }
    }
  }
  return { data };
})();

// ---- where they are ----

export type JunkKind =
  | "monitor"
  | "chair"
  | "sign"
  | "door"
  | "exit"
  | "wetFloor"
  | "cabinet"
  | "desk"
  | "socket"
  | "burger"
  | "bedding"
  | "can"
  | "kitchen"
  | "board"
  | "storage"
  | "candle"
  | "flame"
  | "partition"
  | "vending"
  | "stairs";

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
  /** Where it's in the way on the floor plan; `overhead` if up at the ceiling, out of the visitor's way. */
  solid: Solid | null;
  /** A flat top XN can get up on (a chair's seat, a desk, a cabinet, a monitor lying back), if it has one. */
  perch?: Perch | null;
  /** A sign's plate where XN can stand and look at it: its face out in the room, not to a wall. */
  plate?: Plate | null;
  /** A door XN can stand at, sit or crouch by: flat against a wall, or standing on its own in a room. */
  doorway?: Doorway | null;
  /** XN's seat at a burger room's party: across the table from Kara's, where a bitten burger's been left. */
  partySeat?: boolean;
  /** It lights itself (a candle's flame), whatever the light where it is. */
  glow?: boolean;
  /** A desk or chair of the office kind, steel and laminate and fabric, not wood: it's drawn with the office's atlas. */
  office?: boolean;
  /** A whiteboard XN has written on: which of her boards it is, and the dice for her hand (whiteboard.ts). */
  writing?: { index: number; seed: number };
}

/**
 * The flat top of something, for XN: the middle of it, the way its front faces, how far its front edge is from the
 * middle, and whether it's upside down in the ceiling (then the top is underneath, and she hangs from it).
 */
export interface Perch {
  x: number;
  y: number;
  z: number;
  yaw: number;
  edge: number;
  ceiling: boolean;
}

/** The middle of a sign's plate, and the way its face looks. */
export interface Plate {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** A door's foot, the way its front faces, and whether its back is free too (standing in a room) or on a wall. */
export interface Doorway {
  x: number;
  y: number;
  yaw: number;
  both: boolean;
}

/**
 * The part of a piece of junk that's in the way: a circle of radius r round (x, y), or, given `along`, every point
 * within r of the line from (x, y) − along to (x, y) + along (a door, edge on).
 */
export interface Solid {
  x: number;
  y: number;
  r: number;
  along?: readonly [number, number];
  overhead?: boolean;
}

/** How far (x, y) is from the middle of what's in the way: closer than its r is inside it. */
export function solidDistance(solid: Solid, x: number, y: number): number {
  const dx = x - solid.x;
  const dy = y - solid.y;
  if (!solid.along) return Math.hypot(dx, dy);
  const [ax, ay] = solid.along;
  const t = clamp((dx * ax + dy * ay) / (ax * ax + ay * ay), -1, 1);
  return Math.hypot(dx - ax * t, dy - ay * t);
}

/**
 * What of a piece of junk the visitor walks into: its shape on the floor plan, every part of it between what they
 * can step over and what they can walk under, wrapped round (its convex hull), as [x, y] corners round it.
 */
const BODY_LOW = 0.08;
const BODY_HIGH = 0.55;
const footprints = new WeakMap<Junk, readonly (readonly [number, number])[]>();

function footprintOf(junk: Junk): readonly (readonly [number, number])[] {
  const known = footprints.get(junk);
  if (known) return known;
  const tris = junk.model.tris;
  const points: [number, number][] = [];
  const corner: [number, number, number][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const at = junkPoints(junk);
  for (let o = 0; o < tris.length; o += 16) {
    for (let k = 0; k < 3; k++) corner[k] = at(tris[o + k * 5], tris[o + k * 5 + 1], tris[o + k * 5 + 2]);
    for (let k = 0; k < 3; k++) {
      const a = corner[k];
      const b = corner[(k + 1) % 3];
      if (a[2] >= BODY_LOW && a[2] <= BODY_HIGH) points.push([a[0], a[1]]);
      // Where an edge crosses into the band: a tall pole has no corner in it, only its sides going through.
      for (const level of [BODY_LOW, BODY_HIGH]) {
        if ((a[2] - level) * (b[2] - level) < 0) {
          const t = (level - a[2]) / (b[2] - a[2]);
          points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
    }
  }
  const hull = convexHull(points);
  footprints.set(junk, hull);
  return hull;
}

/** The convex hull of some points, anticlockwise (Andrew's monotone chain). */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  points.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: readonly number[], a: readonly number[], b: readonly number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** How far (x, y) is from what of the junk the visitor walks into: 0 inside it, Infinity if nothing's in the way. */
export function bodyDistance(junk: Junk, x: number, y: number): number {
  const hull = footprintOf(junk);
  if (!hull.length) return Infinity;
  if (hull.length === 1) return Math.hypot(x - hull[0][0], y - hull[0][1]);
  let best = Infinity;
  let inside = hull.length >= 3;
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i];
    const [bx, by] = hull[(i + 1) % hull.length];
    const ex = bx - ax;
    const ey = by - ay;
    if (ex * (y - ay) - ey * (x - ax) < 0) inside = false;
    const t = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - ex * t, y - ay - ey * t));
  }
  return inside ? 0 : best;
}

/** Junk is worked out a square block at a time, this many cells across; each block has at most one of each kind. */
const BLOCK = 12;
/**
 * How many blocks have a monitor, a chair, a sign, a door, an exit sign, a wet floor sign, a filing cabinet, a desk;
 * and for each of two tries, how many have sockets. In the yellow; the other zones weigh them (zones.ts).
 */
const MONITOR_CHANCE = 0.09;
const CHAIR_CHANCE = 0.18;
const SIGN_CHANCE = 0.15;
const DOOR_CHANCE = 0.1;
const EXIT_CHANCE = 0.12;
const WET_CHANCE = 0.12;
const CABINET_CHANCE = 0.12;
const DESK_CHANCE = 0.12;
const SOCKET_CHANCE = 0.45;
/**
 * How many blocks have chicken burgers: rare. Of those, how many are one on its own, a stack, one fallen apart, a
 * pyramid (the rest are a row); and how many of the burgers are bitten.
 */
const BURGER_CHANCE = 0.03;
const BURGER_ALONE = 0.65;
const BURGER_STACKED = 0.1;
const BURGER_FALLEN = 0.1;
const BURGER_PYRAMID = 0.07;
const BURGER_BITTEN = 0.3;
/** How many blocks have boxes, mugs, empty tins lying about. */
const BOX_CHANCE = 0.12;
const MUG_CHANCE = 0.1;
const TIN_CHANCE = 0.08;

const OUT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

const blocks = new WeakMap<WorldMap, Map<string, Junk[]>>();

/**
 * What's been laid out on a map, under `key` in `stores`: worked out by `lay` the first time it's asked for, then
 * kept, so it's the same every time.
 */
function laidOut<K>(stores: WeakMap<WorldMap, Map<K, Junk[]>>, map: WorldMap, key: K, lay: () => Junk[]): Junk[] {
  let known = stores.get(map);
  if (!known) {
    known = new Map();
    stores.set(map, known);
  }
  let found = known.get(key);
  if (!found) {
    found = lay();
    known.set(key, found);
  }
  return found;
}

/** Adds to `out` each of `found` within `radius` of (x, y). */
function within(found: readonly Junk[], x: number, y: number, radius: number, out: Junk[]) {
  for (const junk of found) if (Math.hypot(junk.x - x, junk.y - y) <= radius) out.push(junk);
}

/** Every piece of junk within `radius` of (x, y). The same every time for this map. */
export function junkAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  for (let by = Math.floor((y - radius) / BLOCK); by <= Math.floor((y + radius) / BLOCK); by++) {
    for (let bx = Math.floor((x - radius) / BLOCK); bx <= Math.floor((x + radius) / BLOCK); bx++) {
      within(laidOut(blocks, map, `${bx},${by}`, () => junkIn(map, bx, by)), x, y, radius, out);
    }
  }
  out.push(...partiesAround(map, x, y, radius));
  out.push(...fittedAround(map, x, y, radius));
  out.push(...candleSignsAround(map, x, y, radius));
  out.push(...hallsAround(map, x, y, radius));
  out.push(...deadEndsAround(map, x, y, radius));
  out.push(...stairsAround(map, x, y, radius));
  return out;
}

/** How far junk keeps from the thing at a corridor's walled-off end, from the middle of its cell to the wall. */
const CORRIDOR_END_CLEAR = 1.8;

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
    // Not in a special room that keeps junk out (in a pit room, it would hang over the pits).
    // Nor on a candle sign.
    // Nor in a hall with things of its own.
    if (map.wall(cx, cy) || !map.allows(cx, cy, "junk") || map.underSign(cx, cy) || map.bareHall(cx, cy)) continue;
    // Nor in a room with a stair, nor at a dead end, set out as it is with its one thing and its one light.
    if (map.stairsIn(Math.floor(cx / 5), Math.floor(cy / 5)) || map.deadEndRoom(Math.floor(cx / 5), Math.floor(cy / 5))) {
      continue;
    }
    // Nor by the end of a corridor walled across, where its door, chair or vending machine stands.
    if (map.deadEndsNear(cx + 0.5, cy + 0.5, CORRIDOR_END_CLEAR).length) continue;
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

/**
 * Where in block (bx, by) the junk this die is for lies, or null if the block has none: the die against its chance,
 * weighed by the zone of the spot it picked (zones.ts).
 */
function spotFor(
  map: WorldMap,
  bx: number,
  by: number,
  roll: (k: number) => number,
  chance: number,
  weights: ZoneWeights,
): Spot | null {
  if (roll(0) >= chance * heaviest(weights)) return null;
  const spot = spotIn(map, bx, by, roll);
  return spot && roll(0) < chance * weights[map.zoneAt(spot.cx, spot.cy)] ? spot : null;
}

/** Whether a desk or chair at the spot is an office one, as likely as its zone says (zones.ts). */
const officeAt = (map: WorldMap, spot: Spot, roll: (k: number) => number) =>
  roll(90) < OFFICE_FURNITURE[map.zoneAt(spot.cx, spot.cy)];

function junkIn(map: WorldMap, bx: number, by: number): Junk[] {
  const found: Junk[] = [];
  const monitorRoll = (k: number) => map.noise(bx * 31 + k, by, 700);
  const monitorSpot = spotFor(map, bx, by, monitorRoll, MONITOR_CHANCE, JUNK_WEIGHTS.monitor);
  if (monitorSpot) found.push(placeMonitor(`m${bx},${by}`, monitorSpot, monitorRoll));
  const chairRoll = (k: number) => map.noise(bx * 31 + k, by, 710);
  const chairSpot = spotFor(map, bx, by, chairRoll, CHAIR_CHANCE, JUNK_WEIGHTS.chair);
  if (chairSpot) found.push(placeChair(`c${bx},${by}`, chairSpot, chairRoll, officeAt(map, chairSpot, chairRoll)));
  const signRoll = (k: number) => map.noise(bx * 31 + k, by, 720);
  const signSpot = spotFor(map, bx, by, signRoll, SIGN_CHANCE, JUNK_WEIGHTS.sign);
  if (signSpot) found.push(placeSign(`s${bx},${by}`, signSpot, signRoll));
  const doorRoll = (k: number) => map.noise(bx * 31 + k, by, 730);
  const doorSpot = spotFor(map, bx, by, doorRoll, DOOR_CHANCE, JUNK_WEIGHTS.door);
  if (doorSpot) found.push(placeDoor(`d${bx},${by}`, doorSpot, doorRoll, FIRE_DOOR[map.zoneAt(doorSpot.cx, doorSpot.cy)]));
  const exitRoll = (k: number) => map.noise(bx * 31 + k, by, 740);
  const exitSpot = spotFor(map, bx, by, exitRoll, EXIT_CHANCE, JUNK_WEIGHTS.exit);
  if (exitSpot) found.push(placeExit(`e${bx},${by}`, exitSpot, exitRoll));
  const wetRoll = (k: number) => map.noise(bx * 31 + k, by, 750);
  const wetSpot = spotFor(map, bx, by, wetRoll, WET_CHANCE, JUNK_WEIGHTS.wet);
  if (wetSpot) found.push(placeWetFloor(`w${bx},${by}`, wetSpot, wetRoll));
  const cabinetRoll = (k: number) => map.noise(bx * 31 + k, by, 760);
  const cabinetSpot = spotFor(map, bx, by, cabinetRoll, CABINET_CHANCE, JUNK_WEIGHTS.cabinet);
  const cabinet = cabinetSpot ? placeCabinet(`f${bx},${by}`, cabinetSpot, cabinetRoll) : null;
  if (cabinet) found.push(cabinet);
  const deskRoll = (k: number) => map.noise(bx * 31 + k, by, 770);
  const deskSpot = spotFor(map, bx, by, deskRoll, DESK_CHANCE, JUNK_WEIGHTS.desk);
  const desk = deskSpot ? placeDesk(`t${bx},${by}`, deskSpot, deskRoll, officeAt(map, deskSpot, deskRoll)) : null;
  if (desk) found.push(desk);
  for (const salt of [780, 790]) {
    const socketRoll = (k: number) => map.noise(bx * 31 + k, by, salt);
    const spot = spotFor(map, bx, by, socketRoll, SOCKET_CHANCE, JUNK_WEIGHTS.socket);
    if (spot) found.push(...placeSockets(`o${salt}.${bx},${by}`, spot, socketRoll));
  }
  const burgerRoll = (k: number) => map.noise(bx * 31 + k, by, 800);
  const burgerSpot = spotFor(map, bx, by, burgerRoll, BURGER_CHANCE, JUNK_WEIGHTS.burger);
  if (burgerSpot) found.push(...placeBurgers(`b${bx},${by}`, burgerSpot, burgerRoll));
  const boxRoll = (k: number) => map.noise(bx * 31 + k, by, 810);
  const boxSpot = spotFor(map, bx, by, boxRoll, BOX_CHANCE, JUNK_WEIGHTS.box);
  if (boxSpot) found.push(...clearOf(found, placeBoxes(`k${bx},${by}`, boxSpot, boxRoll)));
  // A mug can be left on the block's desk or cabinet, if it's standing up straight on the floor.
  const tops: Top[] = [];
  if (desk?.perch && !desk.pitch && !desk.roll && !desk.h) tops.push({ perch: desk.perch, half: 0.17 });
  if (cabinet?.perch && !cabinet.pitch && !cabinet.roll && !cabinet.h) tops.push({ perch: cabinet.perch, half: 0.06 });
  const mugRoll = (k: number) => map.noise(bx * 31 + k, by, 820);
  const mugSpot = spotFor(map, bx, by, mugRoll, MUG_CHANCE, JUNK_WEIGHTS.mug);
  if (mugSpot) found.push(...clearOf(found, placeMugs(`g${bx},${by}`, mugSpot, mugRoll, tops)));
  const tinRoll = (k: number) => map.noise(bx * 31 + k, by, 830);
  const tinSpot = spotFor(map, bx, by, tinRoll, TIN_CHANCE, JUNK_WEIGHTS.tin);
  if (tinSpot) found.push(...clearOf(found, placeTins(`n${bx},${by}`, tinSpot, tinRoll)));
  return found;
}

/**
 * The small things put down after the rest (boxes, mugs, tins), or none of them if any on the floor is in something
 * else's way: what's up on something (a mug on a desk, a box on a box) is let be.
 */
function clearOf(found: readonly Junk[], things: Junk[]): Junk[] {
  const blocked = things.some((t) => {
    // Standing up straight off the floor, it's up on something; anything tipped over is on the floor, however high
    // its middle is.
    if (t.h > 0.05 && !t.pitch && !t.roll) return false;
    const { x, y, r } = t.solid ?? { x: t.x, y: t.y, r: 0.04 };
    return found.some((f) => f.solid && !f.solid.overhead && solidDistance(f.solid, x, y) < f.solid.r + r);
  });
  return blocked ? [] : things;
}

/**
 * How deep into the carpet, the ceiling or a wall something `size` long goes, for a roll of 0–1: anything from a
 * sliver of it to all but a sliver.
 */
const BURY_LEAST = 0.05;
const BURY_MOST = 0.95;
const buried = (size: number, r: number) => size * (BURY_LEAST + r * (BURY_MOST - BURY_LEAST));

/** Something hanging from the ceiling lower than this is in the visitor's way. */
const HEAD_ROOM = 0.55;

/** Where a piece of junk is and how it's turned. */
type Pose = Pick<Junk, "x" | "y" | "h" | "yaw" | "pitch" | "roll">;

/** A point of a piece of junk's own (x across, y up, z out of its front), where it is in the place. */
function junkPoint(pose: Pose, X: number, Y: number, Z: number): [number, number, number] {
  return junkPoints(pose)(X, Y, Z);
}

/** junkPoint for many points of the one piece of junk: its turn worked out once. */
function junkPoints(pose: Pose): (X: number, Y: number, Z: number) => [number, number, number] {
  // All of the pose read now, where it is as well as how it's turned, so the two always go together.
  const { x, y, h } = pose;
  const fx = Math.cos(pose.yaw);
  const fy = Math.sin(pose.yaw);
  const cr = Math.cos(pose.roll);
  const sr = Math.sin(pose.roll);
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  return (X, Y, Z) => {
    const x1 = X * cr - Y * sr;
    const y1 = X * sr + Y * cr;
    const y2 = y1 * cp - Z * sp;
    const z2 = y1 * sp + Z * cp;
    return [x + x1 * fy + z2 * fx, y - x1 * fx + z2 * fy, h + y2];
  };
}

/**
 * The top of a piece of junk `top` up its own height (its middle `mid` out toward its front), for XN to get up on;
 * `edge` from there to its front edge. Upright it has to be near enough level (`tilt`) and between the carpet and
 * the ceiling; upside down in the ceiling (only where `hangs`), hanging low enough for her to hang from.
 */
function perchOn(pose: Pose, top: number, edge: number, tilt: number, hangs = false, mid = 0): Perch | null {
  const upright = Math.abs(pose.pitch) <= tilt && Math.abs(pose.roll) <= 0.15;
  const flipped = Math.abs(Math.abs(pose.roll) - Math.PI) <= 0.2 && Math.abs(pose.pitch) <= 0.2;
  if (!upright && !(hangs && flipped)) return null;
  const [x, y, z] = junkPoint(pose, 0, top, mid);
  if (upright ? z < 0.1 || z > 0.95 : z < 0.3 || z > 0.95) return null;
  return { x, y, z, yaw: pose.yaw, edge, ceiling: !upright };
}

/** A sign's plate, `middle` up its pole, for XN to look at. */
function plateOf(pose: Pose, middle: number): Plate | null {
  const [x, y, z] = junkPoint(pose, 0, middle, -0.013);
  return z < 0.05 || z > 0.98 ? null : { x, y, z, yaw: pose.yaw };
}

/**
 * Where a piece of junk's own upright goes through the carpet (level 0) or the ceiling (level 1). Sunk deep and
 * leaning, it comes up some way from where its foot is, so that's where it's in the way.
 */
function through(pose: Pose, level: number): [number, number] {
  // Its upright, (0, 1, 0) in its own frame, turned as placeJunk turns it.
  const across = -Math.sin(pose.roll);
  const up = Math.cos(pose.roll) * Math.cos(pose.pitch);
  const out = Math.cos(pose.roll) * Math.sin(pose.pitch);
  if (Math.abs(up) < 0.2) return [pose.x, pose.y];
  const t = clamp((level - pose.h) / up, -1.2, 1.2);
  const fx = Math.cos(pose.yaw);
  const fy = Math.sin(pose.yaw);
  return [pose.x + t * (across * fy + out * fx), pose.y + t * (-across * fx + out * fy)];
}

/** In the way where it goes through the carpet or the ceiling, a circle of radius r. */
function solidThrough(pose: Pose, level: number, r: number, overhead = false): Solid {
  const [x, y] = through(pose, level);
  return { x, y, r, overhead };
}

/** Anything sticking out of the carpet lower than this the visitor just steps over. */
const STEP = 0.08;

/** In the way where it comes up through the carpet, unless what's showing of it is low enough to step over. */
function solidAbove(pose: Pose, showing: number, r: number): Solid | null {
  return showing < STEP ? null : solidThrough(pose, 0, r);
}

/**
 * Something `size` deep driven into the wall beside the spot, from a sliver of it to nearly all: where its middle
 * goes, and how far it still comes out into the room.
 */
function intoWall(fx: number, fy: number, [ox, oy]: readonly [number, number], size: number, r: number) {
  const out = size - buried(size, r);
  const p = out - size / 2;
  return { x: fx - ox * p, y: fy - oy * p, out };
}

/** In the way as far as something comes out of the wall at (fx, fy); not at all if it's hardly out. */
function wallSolid(fx: number, fy: number, [ox, oy]: readonly [number, number], out: number): Solid | null {
  if (out < 0.05) return null;
  return { x: fx - (ox * out) / 2, y: fy - (oy * out) / 2, r: out / 2 };
}

/** A point on the wall's face beside the cell, `along` (0–1) of the way along it. */
function wallFace(spot: Spot, [ox, oy]: readonly [number, number], along: number): [number, number] {
  return [
    spot.cx + 0.5 + ox * 0.5 + (oy !== 0 ? along - 0.5 : 0),
    spot.cy + 0.5 + oy * 0.5 + (ox !== 0 ? along - 0.5 : 0),
  ];
}

/** The monitor from the back of its case to the front of its screen, the middle of that, and its height. */
const MONITOR_DEPTH = 0.332;
const MONITOR_MIDDLE = -0.024;
const MONITOR_TALL = 0.33;

/** Monitors: into a wall facing out of it, sunk into the carpet looking up, or upside down in the ceiling. */
function placeMonitor(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const base = { key, kind: "monitor" as const, model: MONITOR };
  const how = roll(40);
  if (how < 0.5 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.25 + roll(42) * 0.5);
    const w = intoWall(fx, fy, spot.wall, MONITOR_DEPTH, roll(47));
    const h = 0.12 + roll(43) * 0.45;
    return {
      ...base,
      // Its middle where intoWall says; its own origin is a little in front of that.
      x: w.x + ox * MONITOR_MIDDLE,
      y: w.y + oy * MONITOR_MIDDLE,
      h,
      yaw: Math.atan2(-oy, -ox),
      pitch: (roll(44) - 0.5) * 0.4,
      roll: (roll(45) - 0.5) * 0.7,
      solid: h < 0.85 ? wallSolid(fx, fy, spot.wall, w.out) : null,
    };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  if (how < 0.8) {
    const sunk = buried(MONITOR_TALL, roll(56));
    const pose = {
      x,
      y,
      h: -sunk,
      yaw: roll(52) * Math.PI * 2,
      pitch: -0.25 - roll(54) * 0.45,
      roll: (roll(53) - 0.5) * 0.5,
    };
    return {
      ...base,
      ...pose,
      solid: solidAbove(pose, MONITOR_TALL - sunk, 0.2),
      perch: perchOn(pose, MONITOR_TALL, 0.17, 0.42, false, -0.03),
    };
  }
  const pose = {
    x,
    y,
    h: 1 + buried(MONITOR_TALL, roll(56)),
    yaw: roll(62) * Math.PI * 2,
    pitch: (roll(63) - 0.5) * 0.4,
    roll: Math.PI,
  };
  return { ...base, ...pose, solid: solidThrough(pose, 1, 0.2, pose.h - MONITOR_TALL > HEAD_ROOM) };
}

/** How much of a chair is reckoned to go into a wall, whichever way it's turned. */
const CHAIR_REACH = 0.35;

/**
 * Chairs: into a wall at any angle, sunk aslant into the carpet, upside down with their legs in the ceiling, or just
 * standing there, pushed up to a wall and facing it.
 */
function placeChair(key: string, spot: Spot, roll: (k: number) => number, office: boolean): Junk {
  const shape = chairShape(roll(70), roll(71));
  const base = { key, kind: "chair" as const, model: buildChair(shape, office), office };
  const tall = chairHeight(shape);
  const seat = chairSeat(shape);
  const how = roll(40);
  if (spot.wall && how < 0.35) {
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const w = intoWall(fx, fy, spot.wall, CHAIR_REACH, roll(47));
    const h = -0.05 + roll(43) * 0.35;
    return {
      ...base,
      x: w.x,
      y: w.y,
      h,
      yaw: roll(44) * Math.PI * 2,
      pitch: (roll(45) - 0.5) * 0.8,
      roll: (roll(46) - 0.5) * 1.2,
      solid: h < 0.8 ? wallSolid(fx, fy, spot.wall, w.out) : null,
    };
  }
  if (spot.wall && how < 0.55) {
    // Facing the wall, close up, as if someone had been made to sit there.
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const x = fx - ox * 0.2;
    const y = fy - oy * 0.2;
    const pose = { x, y, h: 0, yaw: Math.atan2(oy, ox), pitch: 0, roll: 0 };
    return { ...base, ...pose, solid: { x, y, r: 0.2 }, perch: perchOn(pose, seat, CHAIR_EDGE, 0.1) };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  if (how < 0.8) {
    const sunk = buried(tall, roll(53));
    const pose = {
      x,
      y,
      h: -sunk,
      yaw: roll(52) * Math.PI * 2,
      pitch: (roll(54) - 0.5) * 1.2,
      roll: (roll(55) - 0.5) * 1.2,
    };
    return { ...base, ...pose, solid: solidAbove(pose, tall - sunk, 0.22), perch: perchOn(pose, seat, CHAIR_EDGE, 0.1) };
  }
  // Upside down, legs in the ceiling; one hanging low enough is in the visitor's way too.
  const pose = {
    x,
    y,
    h: 1 + buried(tall, roll(60)),
    yaw: roll(62) * Math.PI * 2,
    pitch: (roll(63) - 0.5) * 0.3,
    roll: Math.PI,
  };
  return {
    ...base,
    ...pose,
    solid: solidThrough(pose, 1, 0.22, pose.h - tall > HEAD_ROOM),
    perch: perchOn(pose, seat, CHAIR_EDGE, 0.1, true),
  };
}

/** How many signs are printed back to front. */
const SIGN_MIRRORED = 0.3;

/** Where a sign's plate is, on an ordinary one: above head height, as on a street. */
const SIGN_MIDDLE = 0.72;

/** How much of a sign aslant in a wall is reckoned to go into it. */
const SIGN_REACH = 0.3;

/**
 * Road signs, indoors: standing in the middle of a room as if on a street corner, turned to face a wall, the pole
 * running up through the ceiling, aslant in a wall, or sunk into the carpet. Sunk ones and ceiling ones go in any
 * distance: from only an edge of the plate showing to hardly at all.
 */
function placeSign(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const kind = SIGN_KINDS[Math.floor(roll(70) * SIGN_KINDS.length)];
  // Only STOP and no cats show it; the others are the same either way round.
  const mirrored = roll(71) < SIGN_MIRRORED;
  const R = signRadius(kind);
  const how = roll(40);
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  const yaw = roll(52) * Math.PI * 2;
  const base = { key, kind: "sign" as const, pitch: 0, roll: 0 };
  if (how < 0.15) {
    const model = signModel(kind, SIGN_MIDDLE, mirrored);
    const plate = plateOf({ x, y, h: 0, yaw, pitch: 0, roll: 0 }, SIGN_MIDDLE);
    return { ...base, model, x, y, h: 0, yaw, solid: { x, y, r: 0.1 }, plate };
  }
  if (how < 0.35 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const sx = fx - ox * 0.18;
    const sy = fy - oy * 0.18;
    const model = signModel(kind, SIGN_MIDDLE, mirrored);
    return { ...base, model, x: sx, y: sy, h: 0, yaw: Math.atan2(oy, ox), solid: { x: sx, y: sy, r: 0.1 } };
  }
  if (how < 0.55) {
    // The pole on up through the ceiling, anything from a sliver of the plate's lower edge hanging down into the room
    // to the whole sign, pole running from the carpet to the ceiling.
    const middle = 1 + R - buried(1 + R, roll(53));
    const model = signModel(kind, middle, mirrored, 1.3);
    const plate = plateOf({ x, y, h: 0, yaw, pitch: 0, roll: 0 }, middle);
    return { ...base, model, x, y, h: 0, yaw, solid: { x, y, r: 0.1 }, plate };
  }
  if (how < 0.7 && spot.wall) {
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const w = intoWall(fx, fy, spot.wall, SIGN_REACH, roll(47));
    return {
      ...base,
      model: signModel(kind, SIGN_MIDDLE, mirrored),
      x: w.x,
      y: w.y,
      h: -0.1 + roll(43) * 0.3,
      yaw: roll(44) * Math.PI * 2,
      pitch: (roll(45) - 0.5) * 1.4,
      roll: (roll(46) - 0.5) * 1.4,
      solid: wallSolid(fx, fy, spot.wall, w.out),
    };
  }
  // Sunk into the carpet, from hardly at all to only a sliver of the plate's top edge showing. Half of them straight
  // down, half leaning. The pole's foot is kept just under the carpet, so a lean swings the plate about the spot where
  // the pole goes in.
  const plate = SIGN_MIDDLE - buried(SIGN_MIDDLE + R, roll(53));
  const foot = 0.1;
  const leans = roll(56) < 0.5;
  const pose = {
    x,
    y,
    h: -foot,
    yaw,
    pitch: leans ? (roll(54) - 0.5) * 1.2 : 0,
    roll: leans ? (roll(55) - 0.5) * 1.2 : 0,
  };
  return {
    ...base,
    ...pose,
    model: signModel(kind, plate + foot, mirrored),
    solid: plate + R < STEP ? null : { x, y, r: 0.12 },
    plate: plateOf(pose, plate + foot),
  };
}

/**
 * Doors, closed and going nowhere: standing on their own in the middle of a room, flat against a wall as if there
 * were somewhere behind it, driven aslant into a wall, upside down in the ceiling, or sunk aslant into the carpet.
 * In the way edge on, across their width.
 */
function placeDoor(key: string, spot: Spot, roll: (k: number) => number, fireShare: number): Junk {
  const model = DOORS[roll(70) < fireShare ? "fire" : "wood"];
  const base = { key, kind: "door" as const, model, pitch: 0, roll: 0 };
  const how = roll(40);
  const reach = DOOR_W / 2 + FRAME;
  const tall = DOOR_H + FRAME;
  /** In the way across its width at (x, y), turned to `yaw`. */
  const solid = (x: number, y: number, yaw: number, overhead = false): Solid => ({
    x,
    y,
    r: FRAME_DEPTH + 0.01,
    along: [Math.sin(yaw) * reach, -Math.cos(yaw) * reach],
    overhead,
  });
  if (how < 0.2 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.35 + roll(42) * 0.3);
    const x = fx - ox * FRAME_DEPTH;
    const y = fy - oy * FRAME_DEPTH;
    const yaw = Math.atan2(-oy, -ox);
    return { ...base, x, y, h: 0, yaw, solid: solid(x, y, yaw), doorway: { x, y, yaw, both: false } };
  }
  if (how < 0.4 && spot.wall) {
    // Driven into the wall at any angle, anything from a corner of it to nearly all.
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const w = intoWall(fx, fy, spot.wall, reach * 2, roll(47));
    const yaw = roll(44) * Math.PI * 2;
    return {
      ...base,
      x: w.x,
      y: w.y,
      h: -0.1 + roll(43) * 0.25,
      yaw,
      pitch: (roll(45) - 0.5) * 1.2,
      roll: (roll(46) - 0.5) * 1.4,
      solid: w.out < 0.05 ? null : solid(w.x, w.y, yaw),
    };
  }
  // Not far off the middle of the cell, so there's room to get round it in a corridor.
  const x = spot.cx + 0.4 + roll(50) * 0.2;
  const y = spot.cy + 0.4 + roll(51) * 0.2;
  // Half of them square to the walls, the rest at any angle.
  const yaw =
    roll(52) < 0.5 ? Math.floor(roll(53) * 4) * (Math.PI / 2) + (roll(54) - 0.5) * 0.1 : roll(53) * Math.PI * 2;
  if (how < 0.6) return { ...base, x, y, h: 0, yaw, solid: solid(x, y, yaw), doorway: { x, y, yaw, both: true } };
  if (how < 0.8) {
    // Upside down, its foot up in the ceiling space; one hanging low enough is in the visitor's way too.
    const pose = {
      x,
      y,
      h: 1 + buried(tall, roll(55)),
      yaw,
      pitch: (roll(56) - 0.5) * 0.5,
      roll: Math.PI + (roll(57) - 0.5) * 0.5,
    };
    const [sx, sy] = through(pose, 1);
    return { ...base, ...pose, solid: solid(sx, sy, yaw, pose.h - tall > HEAD_ROOM) };
  }
  const sunk = buried(tall, roll(55));
  const pose = {
    x,
    y,
    h: -sunk,
    yaw,
    pitch: (roll(56) - 0.5) * 1,
    roll: (roll(57) - 0.5) * 1,
  };
  const [sx, sy] = through(pose, 0);
  return { ...base, ...pose, solid: tall - sunk < STEP ? null : solid(sx, sy, yaw) };
}

/**
 * Exit signs, lit, pointing the way out of nowhere: high on a wall where they belong, low on a wall just over the
 * carpet, hung from the ceiling, the box itself stuck up into the ceiling, or sunk aslant into the carpet. Half of
 * them point the other way.
 */
function placeExit(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const mirrored = roll(71) < 0.5;
  const base = { key, kind: "exit" as const, pitch: 0, roll: 0 };
  const how = roll(40);
  if (how < 0.6 && spot.wall) {
    // High on the wall most of the time; now and then down by the skirting.
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.25 + roll(42) * 0.5);
    const low = how >= 0.45;
    return {
      ...base,
      model: exitModel("wall", mirrored),
      // Its back against the wall, not in it.
      x: fx - ox * 0.036,
      y: fy - oy * 0.036,
      h: low ? 0.02 + roll(43) * 0.1 : 0.78 + roll(43) * 0.1,
      yaw: Math.atan2(-oy, -ox),
      solid: null,
    };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  const yaw = roll(52) * Math.PI * 2;
  if (how < 0.75) {
    // Up out of the way: only XN on the ceiling has to mind it.
    const model = exitModel("hanging", mirrored);
    return { ...base, model, x, y, h: 0.8 + roll(53) * 0.06, yaw, solid: { x, y, r: 0.12, overhead: true } };
  }
  const model = exitModel("loose", mirrored);
  if (how < 0.85) {
    // The box upside down and up into the ceiling, at a slant.
    const pose = {
      x,
      y,
      h: 1 + buried(EXIT_H, roll(53)),
      yaw,
      pitch: (roll(54) - 0.5) * 1.2,
      roll: Math.PI + (roll(55) - 0.5) * 1.2,
    };
    return { ...base, ...pose, model, solid: solidThrough(pose, 1, 0.12, true) };
  }
  const sunk = buried(EXIT_H, roll(53));
  const pose = {
    x,
    y,
    h: -sunk,
    yaw,
    pitch: (roll(54) - 0.5) * 1.2,
    roll: (roll(55) - 0.5) * 1.2,
  };
  return { ...base, ...pose, model, solid: solidAbove(pose, EXIT_H - sunk, 0.12) };
}

/**
 * Wet floor signs, where nothing is wet: standing open, knocked over on their side, sunk aslant into the carpet, or
 * upside down in the ceiling.
 */
function placeWetFloor(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const base = { key, kind: "wetFloor" as const, model: WET_FLOOR, pitch: 0, roll: 0 };
  const how = roll(40);
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  const yaw = roll(52) * Math.PI * 2;
  if (how < 0.45) return { ...base, x, y, h: 0, yaw, solid: { x, y, r: 0.1 } };
  if (how < 0.65) {
    // Over on one side, still open.
    const side = roll(53) < 0.5 ? 1 : -1;
    return { ...base, x, y, h: WET_HW, yaw, roll: (side * Math.PI) / 2, solid: { x, y, r: 0.12 } };
  }
  if (how < 0.85) {
    const sunk = buried(WET_H, roll(53));
    const pose = {
      x,
      y,
      h: -sunk,
      yaw,
      pitch: (roll(54) - 0.5) * 1.2,
      roll: (roll(55) - 0.5) * 1.2,
    };
    return { ...base, ...pose, solid: solidAbove(pose, WET_H - sunk, 0.1) };
  }
  // Upside down, its feet up in the ceiling space.
  const pose = { x, y, h: 1 + buried(WET_H, roll(53)), yaw, pitch: 0, roll: Math.PI };
  return { ...base, ...pose, solid: solidThrough(pose, 1, 0.1, pose.h - WET_H > HEAD_ROOM) };
}

/** In the way along a line through (x, y) half `ax, ay` each way, r either side of it. */
const slab = (x: number, y: number, ax: number, ay: number, r: number, overhead = false): Solid => ({
  x,
  y,
  r,
  along: [ax, ay],
  overhead,
});

/**
 * Something that stands, put somewhere: back against the wall facing out (`wall`), aslant into the wall, standing
 * in the room, sunk into the carpet, or upside down in the ceiling. `inWay` gives what's in the way at a point, for
 * a yaw; `reach` is how much of it is reckoned to go into a wall; `back` is how far its middle stands off the wall
 * when it's up against it.
 */
function placeFurniture(
  spot: Spot,
  roll: (k: number) => number,
  tall: number,
  reach: number,
  back: number,
  inWay: (x: number, y: number, yaw: number, overhead?: boolean) => Solid,
): Pose & { solid: Solid | null } {
  const how = roll(40);
  if (how < 0.3 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const x = fx - ox * back;
    const y = fy - oy * back;
    const yaw = Math.atan2(-oy, -ox);
    return { x, y, h: 0, yaw, pitch: 0, roll: 0, solid: tall < STEP ? null : inWay(x, y, yaw) };
  }
  if (how < 0.5 && spot.wall) {
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const w = intoWall(fx, fy, spot.wall, reach, roll(47));
    return {
      x: w.x,
      y: w.y,
      h: -0.1 + roll(43) * 0.25,
      yaw: roll(44) * Math.PI * 2,
      pitch: (roll(45) - 0.5) * 1.2,
      roll: (roll(46) - 0.5) * 1.2,
      solid: wallSolid(fx, fy, spot.wall, w.out),
    };
  }
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  // Half of them square to the walls, the rest at any angle.
  const yaw =
    roll(52) < 0.5 ? Math.floor(roll(53) * 4) * (Math.PI / 2) + (roll(54) - 0.5) * 0.1 : roll(53) * Math.PI * 2;
  if (how < 0.65) return { x, y, h: 0, yaw, pitch: 0, roll: 0, solid: tall < STEP ? null : inWay(x, y, yaw) };
  if (how < 0.85) {
    const sunk = buried(tall, roll(55));
    const pose = { x, y, h: -sunk, yaw, pitch: (roll(56) - 0.5) * 1, roll: (roll(57) - 0.5) * 1 };
    const [sx, sy] = through(pose, 0);
    return { ...pose, solid: tall - sunk < STEP ? null : inWay(sx, sy, yaw) };
  }
  const pose = {
    x,
    y,
    h: 1 + buried(tall, roll(55)),
    yaw,
    pitch: (roll(56) - 0.5) * 0.5,
    roll: Math.PI + (roll(57) - 0.5) * 0.5,
  };
  const [sx, sy] = through(pose, 1);
  return { ...pose, solid: inWay(sx, sy, yaw, pose.h - tall > HEAD_ROOM) };
}

/** Filing cabinets: backed up to a wall, aslant in one, standing about, sunk in the carpet, or in the ceiling. */
function placeCabinet(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const shape = cabinetShape(roll(70), roll(71), roll(72));
  const hd = shape.depth / 2;
  // In the way from back to front, as wide as it is.
  const inWay = (x: number, y: number, yaw: number, overhead = false) =>
    slab(x, y, Math.cos(yaw) * hd, Math.sin(yaw) * hd, shape.width / 2 + 0.01, overhead);
  const reach = Math.max(shape.width, Math.min(shape.depth, 0.6), 0.2);
  const placed = placeFurniture(spot, roll, cabinetHeight(shape), reach, hd + 0.005, inWay);
  // Not the towers up through the ceiling, nor the ones thin as a sheet.
  const perch = shape.drawers < 8 && shape.width >= 0.1 ? perchOn(placed, cabinetHeight(shape), hd, 0.1) : null;
  return { key, kind: "cabinet", model: buildCabinet(shape), ...placed, perch };
}

/** Desks: pushed up to a wall to be worked at, aslant in one, standing about, sunk in the carpet, or in the ceiling. */
function placeDesk(key: string, spot: Spot, roll: (k: number) => number, office: boolean): Junk {
  const shape = deskShape(roll(70), roll(71), roll(72));
  const hl = shape.length / 2;
  // In the way from end to end, as deep as it is.
  const inWay = (x: number, y: number, yaw: number, overhead = false) =>
    slab(x, y, Math.sin(yaw) * hl, -Math.cos(yaw) * hl, shape.depth / 2 + 0.01, overhead);
  const reach = Math.max(Math.min(shape.length, 0.6), 0.25);
  const placed = placeFurniture(spot, roll, shape.height, reach, shape.depth / 2 + 0.005, inWay);
  // Not the ones narrow as a plank.
  const perch = shape.depth >= 0.1 ? perchOn(placed, shape.height, shape.depth / 2, 0.1) : null;
  return { key, kind: "desk", model: buildDesk(shape, office), ...placed, perch, office };
}

/**
 * Wall sockets, by the skirting where they belong, or somewhere no one could reach, now and then upside down, and
 * once in a while a whole run of them up the wall or along it. Never in the way.
 */
function placeSockets(key: string, spot: Spot, roll: (k: number) => number): Junk[] {
  if (!spot.wall) return [];
  const [ox, oy] = spot.wall;
  // Along the wall.
  const tx = oy !== 0 ? 1 : 0;
  const ty = ox !== 0 ? 1 : 0;
  const [fx, fy] = wallFace(spot, spot.wall, 0.2 + roll(42) * 0.6);
  const yaw = Math.atan2(-oy, -ox);
  const kind = SOCKETS[Math.floor(roll(49) * SOCKETS.length)];
  // Which way up: upright, upside down, on its side (either side), or crooked at any angle.
  const way = roll(44);
  const turn =
    way < 0.55
      ? 0
      : way < 0.65
        ? Math.PI
        : way < 0.85
          ? (roll(48) < 0.5 ? 1 : -1) * (Math.PI / 2)
          : (roll(48) - 0.5) * Math.PI * 2;
  // It turns about its foot; moved so it turns about its middle instead, and stays where it was put.
  const lift = kind.h / 2;
  const sideways = Math.sin(turn) * lift;
  const one = (i: number, along: number, h: number): Junk => ({
    key: `${key}.${i}`,
    kind: "socket",
    model: kind.model,
    x: fx + tx * along + Math.sin(yaw) * sideways,
    y: fy + ty * along - Math.cos(yaw) * sideways,
    h: h + lift - Math.cos(turn) * lift,
    yaw,
    pitch: 0,
    roll: turn,
    solid: null,
  });
  const how = roll(40);
  if (how < 0.6) return [one(0, 0, 0.06 + roll(43) * 0.04)];
  if (how < 0.85) return [one(0, 0, 0.1 + roll(43) * 0.8)];
  if (how < 0.95) {
    // A column of them, up from the skirting.
    const count = 3 + Math.floor(roll(45) * 6);
    const gap = 0.07 + roll(46) * 0.05;
    return Array.from({ length: count }, (_, i) => one(i, 0, 0.06 + i * gap)).filter((s) => s.h < 0.95);
  }
  // A row of them along the wall, all at one height.
  const count = 3 + Math.floor(roll(45) * 4);
  const gap = 0.06 + roll(46) * 0.04;
  const h = 0.06 + roll(43) * 0.6;
  const start = Math.max(-0.45 + roll(42) * 0.1, -((count - 1) * gap) / 2);
  return Array.from({ length: count }, (_, i) => one(i, start + i * gap, h)).filter(
    (s) => Math.abs((tx ? s.x : s.y) - (tx ? spot.cx : spot.cy) - 0.5) < 0.47,
  );
}

/**
 * Chicken burgers, as if someone left them: mostly one on its own; now and then two or three stacked up, one fallen
 * apart into its parts across the carpet, or a neat row of them.
 */
function placeBurgers(key: string, spot: Spot, roll: (k: number) => number): Junk[] {
  const how = roll(70);
  if (how < BURGER_ALONE) return [placeBurger(key, spot, roll)];
  const cx = spot.cx + 0.5;
  const cy = spot.cy + 0.5;
  const out: Junk[] = [];
  const add = (n: number, model: StatueModel, x: number, y: number, h: number, yaw: number, tall: number, r: number) =>
    out.push({ key: `${key}.${n}`, kind: "burger", model, x, y, h, yaw, pitch: 0, roll: 0, solid: tall < STEP ? null : { x, y, r } });
  if (how < BURGER_ALONE + BURGER_STACKED) {
    // Stacked: each sitting on the dome of the one below, a little off true.
    const size = 1 + roll(71) * 1.5;
    const w = BURGER_W * size;
    const tall = w * BURGER_TALL;
    const count = 2 + Math.floor(roll(72) * 2);
    for (let n = 0; n < count; n++) {
      const top = n === count - 1;
      const model = burgerModel(size, top && roll(73) < BURGER_BITTEN ? bitesOf(roll) : []);
      const x = cx + (roll(74 + n) - 0.5) * w * 0.15;
      const y = cy + (roll(78 + n) - 0.5) * w * 0.15;
      add(n, model, x, y, n * tall * 0.95, roll(82 + n) * Math.PI * 2, n ? 0 : tall * count, w / 2);
    }
    const tilt = out.slice(1);
    tilt.forEach((burger, n) => {
      burger.pitch = (roll(86 + n) - 0.5) * 0.12;
      burger.roll = (roll(90 + n) - 0.5) * 0.12;
    });
    return out;
  }
  if (how < BURGER_ALONE + BURGER_STACKED + BURGER_FALLEN) {
    // Fallen apart: bun, chicken, lettuce and bun, each where it landed; the top bun as often as not on its back.
    const size = 1 + roll(71) * 1.5;
    const w = BURGER_W * size;
    (["bottom", "chicken", "lettuce", "top"] as const).forEach((part, n) => {
      const turn = roll(72 + n) * Math.PI * 2;
      const far = w * 0.6 + roll(76 + n) * 0.25;
      const x = cx + Math.cos(turn) * far;
      const y = cy + Math.sin(turn) * far;
      const tall = PART_TALL[part] * w;
      add(n, burgerModel(size, [], part), x, y, 0, roll(80 + n) * Math.PI * 2, tall, w * 0.3);
      if (part === "top" && roll(84) < 0.5) {
        out[n].roll = Math.PI;
        out[n].h = tall;
      }
    });
    return out;
  }
  if (how < BURGER_ALONE + BURGER_STACKED + BURGER_FALLEN + BURGER_PYRAMID) {
    // A pyramid, stacked like tins: a row along the bottom, each row above one fewer, every burger sitting in the dip
    // between the two under it.
    const size = 1 + roll(71) * 1.2;
    const w = BURGER_W * size;
    const tall = w * BURGER_TALL;
    const base = 2 + Math.floor(roll(72) * 3);
    const gap = w * 1.12;
    const along = roll(73) * Math.PI * 2;
    let n = 0;
    for (let level = 0; level < base; level++) {
      const across = base - level;
      for (let k = 0; k < across; k++) {
        const t = (k - (across - 1) / 2) * gap;
        const model = burgerModel(size, level === base - 1 && roll(74) < BURGER_BITTEN ? bitesOf(roll) : []);
        add(n, model, cx + Math.cos(along) * t, cy + Math.sin(along) * t, level * tall * 0.8, along + Math.PI / 2, level ? 0 : tall * base, w / 2);
        n++;
      }
    }
    return out;
  }
  // A neat row, all facing the same way, as if laid out for someone; now and then one of them bitten.
  const size = 1 + roll(71) * 0.8;
  const w = BURGER_W * size;
  const tall = w * BURGER_TALL;
  const gap = w * 1.8;
  const count = Math.min(3 + Math.floor(roll(72) * 4), Math.floor(0.8 / gap) + 1);
  const along = roll(73) * Math.PI * 2;
  const bitten = roll(74) < 0.25 ? Math.floor(roll(75) * count) : -1;
  for (let n = 0; n < count; n++) {
    const t = (n - (count - 1) / 2) * gap;
    const model = burgerModel(size, n === bitten ? bitesOf(roll) : []);
    add(n, model, cx + Math.cos(along) * t, cy + Math.sin(along) * t, 0, along + Math.PI / 2, tall, w / 2);
  }
  return out;
}

/**
 * A chicken burger on its own: any size from an ordinary one to seven times it, mostly smallish; on the carpet, now
 * and then with bites out of it, sunk into the carpet, or stuck upside down in the ceiling.
 */
function placeBurger(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const size = 1 + 6 * roll(43) ** 2.5;
  const model = burgerModel(size, roll(41) < BURGER_BITTEN ? bitesOf(roll) : []);
  const r = (BURGER_W * size) / 2;
  const tall = BURGER_W * size * BURGER_TALL;
  const base = { key, kind: "burger" as const, model };
  const x = spot.cx + 0.3 + roll(50) * 0.4;
  const y = spot.cy + 0.3 + roll(51) * 0.4;
  const yaw = roll(52) * Math.PI * 2;
  const how = roll(40);
  if (how < 0.7) return { ...base, x, y, h: 0, yaw, pitch: 0, roll: 0, solid: tall < STEP ? null : { x, y, r } };
  if (how < 0.88) {
    const sunk = buried(tall, roll(53));
    const pose = { x, y, h: -sunk, yaw, pitch: (roll(54) - 0.5) * 1, roll: (roll(55) - 0.5) * 1 };
    return { ...base, ...pose, solid: solidAbove(pose, tall - sunk, r) };
  }
  const pose = { x, y, h: 1 + buried(tall, roll(53)), yaw, pitch: 0, roll: Math.PI };
  return { ...base, ...pose, solid: solidThrough(pose, 1, r, pose.h - tall > HEAD_ROOM) };
}

/**
 * The bites out of a bitten burger: mostly one, sometimes two, now and then three, each taken next to the last, as
 * someone eating their way round it would; each its own size, from a nibble to a big mouthful.
 */
function bitesOf(roll: (k: number) => number): Bite[] {
  const count = roll(60) < 0.55 ? 1 : roll(60) < 0.85 ? 2 : 3;
  const bites: Bite[] = [];
  let at = roll(44) * Math.PI * 2;
  const way = roll(61) < 0.5 ? 1 : -1;
  for (let b = 0; b < count; b++) {
    bites.push({ at, big: 0.75 + roll(62 + b) * 0.55 });
    at += way * (0.9 + roll(66 + b) * 0.6);
  }
  return bites;
}

// ---- the burger room ----

/*
 * A burger room is a little room, two cells by two inside its walls, with one way in, laid out for a party nobody
 * explains: a long wooden table, a pyramid of burgers on it and a few more beside, two chairs facing each other across
 * it and a third left empty at the far end, turned to the doorway as if kept for whoever comes in; burgers crowded
 * round on the carpet, stuck into the walls, upside down in the ceiling and sunk in the carpet, with a narrow way left
 * from the doorway to the table; most often a huge one wedged in a wall, half in the room and half out; and a few
 * dropped outside, trailing away from the doorway. Every room is turned and strewn its own way.
 */

/** The long table: its length, depth and height, and pairs of legs. */
const PARTY_TABLE: DeskShape = { length: 0.9, depth: 0.36, height: 0.23, legs: 3, drawer: false };
/** The table stands this far from the room's middle, at most, either way. */
const PARTY_OFF_MIDDLE = 0.08;
/** The chairs at its sides stand this far out from its edge, and this far along from its middle, at most. */
const PARTY_CHAIR_OUT = 0.2;
const PARTY_CHAIR_ALONG = 0.18;
/** The burgers round about: how many lots, at least and at most, and from how far out from the table to how far. */
const PARTY_BURGERS = [6, 9] as const;
const PARTY_NEAR = 0.45;
const PARTY_FAR = 1.3;
/** Kept clear: either side of the way from the doorway to the table, and in from the walls. */
const PARTY_WAY = 0.2;
const PARTY_WALL = 0.04;
/**
 * How likely a room is to have a huge burger wedged in one of its walls (not the doorway's), half in and half out, and
 * how big it is: wider than the wall is thick, so it shows on both sides.
 */
const PARTY_GIANT = 0.7;
const PARTY_GIANT_SIZE = [13, 15] as const;
/** How deep it's sunk in the carpet, so it's under the ceiling. */
const PARTY_GIANT_SUNK = 0.35;
/** More on the table besides the pyramid, at least and at most. */
const PARTY_ON_TABLE = [1, 2] as const;
/** Stuck into the walls, upside down in the ceiling, and sunk in the carpet: how many, at least and at most. */
const PARTY_IN_WALLS = [2, 4] as const;
const PARTY_IN_CEILING = [2, 3] as const;
const PARTY_SUNK = [1, 2] as const;
/** Dropped outside, away from the doorway, in half the rooms: how many, at least and at most, and how far apart. */
const PARTY_TRAILED = 0.5;
const PARTY_TRAIL = [3, 6] as const;
const PARTY_TRAIL_STEP = [0.5, 0.9] as const;
/** Sizes of the rest, from an ordinary one to this many times it, mostly small: the room is small. */
const PARTY_BIGGEST = 2;

/** How far (x, y) is from the line from a to b. */
function fromLine(x: number, y: number, [ax, ay]: readonly number[], [bx, by]: readonly number[]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

/** Everything in the burger room in lattice room (lx, ly), the same every time for this map. */
function partyIn(map: WorldMap, lx: number, ly: number, plan: BurgerPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 37 + k, ly, 900);
  const out: Junk[] = [];
  const key = (name: string) => `p${lx},${ly}.${name}`;
  // Inside the walls: from (x0, y0) to (x0 + ROOM, y0 + ROOM).
  const { x0, y0 } = plan;
  const ROOM = 2;
  // In the doorway.
  const [dx, dy] = map.burgerDoorway(plan);
  const door = [dx + 0.5, dy + 0.5];

  // The table, square to the walls, give or take.
  const tx = x0 + ROOM / 2 + (roll(1) * 2 - 1) * PARTY_OFF_MIDDLE;
  const ty = y0 + ROOM / 2 + (roll(2) * 2 - 1) * PARTY_OFF_MIDDLE;
  const yaw = Math.floor(roll(3) * 4) * (Math.PI / 2) + (roll(4) - 0.5) * 0.3;
  const fx = Math.cos(yaw);
  const fy = Math.sin(yaw);
  // Along its length.
  const ax = Math.sin(yaw);
  const ay = -Math.cos(yaw);
  const hl = PARTY_TABLE.length / 2;
  const hd = PARTY_TABLE.depth / 2;
  const table = { x: tx, y: ty, h: 0, yaw, pitch: 0, roll: 0 };
  out.push({
    key: key("table"),
    kind: "desk",
    model: buildDesk(PARTY_TABLE),
    ...table,
    solid: slab(tx, ty, ax * hl, ay * hl, hd + 0.01),
    perch: perchOn(table, PARTY_TABLE.height, hd, 0.1),
  });

  // The pyramid on it, along its length, its top one bitten.
  const size = 1.2 + roll(5) * 0.3;
  const w = BURGER_W * size;
  const tall = w * BURGER_TALL;
  const gap = w * 1.12;
  let n = 0;
  for (let level = 0; level < 3; level++) {
    const across = 3 - level;
    for (let k = 0; k < across; k++) {
      const t = (k - (across - 1) / 2) * gap;
      const model = burgerModel(size, level === 2 ? bitesOf((j) => roll(10 + j)) : []);
      const x = tx + ax * t;
      const y = ty + ay * t;
      const h = PARTY_TABLE.height + level * tall * 0.8;
      out.push({ key: key(`pyramid${n++}`), kind: "burger", model, x, y, h, yaw, pitch: 0, roll: 0, solid: null });
    }
  }

  // Two chairs across the table from each other, pulled out a little, one of them askew, with a bitten burger left
  // on its seat.
  const chair = buildChair(ORDINARY);
  const seat = chairSeat(ORDINARY);
  const askew = roll(20) < 0.5 ? 0 : 1;
  for (const side of [0, 1]) {
    const away = side ? -1 : 1;
    const along = (roll(21 + side) * 2 - 1) * PARTY_CHAIR_ALONG;
    const far = hd + PARTY_CHAIR_OUT + (side === askew ? 0.12 : 0);
    const x = tx + fx * away * far + ax * along;
    const y = ty + fy * away * far + ay * along;
    // Facing the table.
    const turn = side === askew ? (roll(23) - 0.5) * 1 : (roll(24) - 0.5) * 0.15;
    const pose = { x, y, h: 0, yaw: Math.atan2(-fy * away, -fx * away) + turn, pitch: 0, roll: 0 };
    const left = side === askew;
    out.push({
      key: key(`chair${side}`),
      kind: "chair",
      model: chair,
      ...pose,
      solid: { x, y, r: 0.2 },
      // XN doesn't sit on the burger: that's Kara's seat, left mid-bite. She sits across from it.
      perch: left ? null : perchOn(pose, seat, CHAIR_EDGE, 0.1),
      partySeat: !left,
    });
    if (left) {
      out.push({
        key: key("left"),
        kind: "burger",
        model: burgerModel(1, bitesOf((j) => roll(30 + j))),
        x,
        y,
        h: seat,
        yaw: roll(25) * Math.PI * 2,
        pitch: 0,
        roll: 0,
        solid: null,
      });
    }
  }

  // The third chair, at the end of the table further from the doorway, out of the way in, turned to it.
  const toDoor = (k: number) => Math.hypot(tx + ax * hl * k - door[0], ty + ay * hl * k - door[1]);
  const end = toDoor(1) < toDoor(-1) ? -1 : 1;
  const cx = tx + ax * end * (hl + 0.25);
  const cy = ty + ay * end * (hl + 0.25);
  const third = { x: cx, y: cy, h: 0, yaw: Math.atan2(door[1] - cy, door[0] - cx), pitch: 0, roll: 0 };
  out.push({
    key: key("chair2"),
    kind: "chair",
    model: chair,
    ...third,
    solid: { x: cx, y: cy, r: 0.2 },
    perch: perchOn(third, seat, CHAIR_EDGE, 0.1),
  });

  // Burgers round about: where nothing else is, out of the way in.
  const taken = out.filter((junk) => junk.solid).map((junk) => ({ x: junk.x, y: junk.y, r: junk.solid?.r ?? 0.2 }));
  // The table's ends, as well as its middle.
  taken.push({ x: tx + ax * hl, y: ty + ay * hl, r: hd + 0.05 }, { x: tx - ax * hl, y: ty - ay * hl, r: hd + 0.05 });
  const free = (x: number, y: number, r: number) =>
    x - r > x0 + PARTY_WALL &&
    y - r > y0 + PARTY_WALL &&
    x + r < x0 + ROOM - PARTY_WALL &&
    y + r < y0 + ROOM - PARTY_WALL &&
    fromLine(x, y, door, [tx, ty]) > PARTY_WAY + r &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r + 0.03);


  // How many, at least and at most, by the die numbered k.
  const many = ([least, most]: readonly [number, number], k: number) =>
    least + Math.floor(roll(k) * (most - least + 1));
  const burger = (name: string, model: StatueModel, x: number, y: number, h: number, turn: Turn, solid: Solid | null) =>
    out.push({ key: key(name), kind: "burger", model, x, y, h, ...turn, solid });

  // The walls inside, each as a cell of it seen from inside: north, south, west, east, and which of its two cells.
  const wallSpots: [number, number][] = [];
  for (let side = 0; side < 4; side++) {
    for (let cell = 0; cell < 2; cell++) if (!(side === plan.side && cell === plan.cell)) wallSpots.push([side, cell]);
  }
  /** A point on that wall's face, `along` (0–1) of the way along its cell, and the way out of it into the room. */
  const onWall = ([side, cell]: readonly [number, number], along: number): [number, number, number, number] => {
    const a = (side < 2 ? x0 : y0) + cell + along;
    if (side === 0) return [a, y0, 0, 1];
    if (side === 1) return [a, y0 + ROOM, 0, -1];
    if (side === 2) return [x0, a, 1, 0];
    return [x0 + ROOM, a, -1, 0];
  };

  // A huge one wedged in a wall, half in the room and half out.
  if (roll(200) < PARTY_GIANT) {
    const sides = [0, 1, 2, 3].filter((side) => side !== plan.side);
    const side = sides[Math.floor(roll(201) * sides.length)];
    const size = PARTY_GIANT_SIZE[0] + roll(202) * (PARTY_GIANT_SIZE[1] - PARTY_GIANT_SIZE[0]);
    const r = (BURGER_W * size) / 2;
    // The middle of the wall cells' run, half a cell out from its face, inside the wall.
    const [wx, wy, ox, oy] = onWall([side, 0], 1);
    const x = wx - ox * 0.5;
    const y = wy - oy * 0.5;
    const model = burgerModel(size, roll(203) < BURGER_BITTEN ? bitesOf((j) => roll(204 + j)) : []);
    const turn = { yaw: roll(208) * Math.PI * 2, pitch: 0, roll: 0 };
    burger("giant", model, x, y, -PARTY_GIANT_SUNK, turn, { x, y, r });
    taken.push({ x, y, r });
  }


  const count = PARTY_BURGERS[0] + Math.floor(roll(50) * (PARTY_BURGERS[1] - PARTY_BURGERS[0] + 1));
  let placed = 0;
  for (let k = 0; k < count * 30 && placed < count; k++) {
    const r1 = (j: number) => map.noise(lx * 37 + k, ly * 41 + j, 910);
    const dist = PARTY_NEAR + (PARTY_FAR - PARTY_NEAR) * r1(0);
    const angle = r1(1) * Math.PI * 2;
    const x = tx + Math.cos(angle) * dist;
    const y = ty + Math.sin(angle) * dist;
    const how = r1(2);
    const size = 1 + (PARTY_BIGGEST - 1) * r1(3) ** 2;
    const bw = BURGER_W * size;
    const r = how < 0.7 ? bw / 2 : how < 0.88 ? bw * 0.6 : bw * 1.4;
    if (!free(x, y, r)) continue;
    taken.push({ x, y, r });
    const name = `b${placed++}`;
    const turn = r1(4) * Math.PI * 2;
    const bites = (j: number) => r1(20 + j);
    if (how < 0.7) {
      // On its own, now and then bitten.
      const model = burgerModel(size, r1(5) < BURGER_BITTEN ? bitesOf(bites) : []);
      const solid = bw * BURGER_TALL < STEP ? null : { x, y, r };
      out.push({ key: key(name), kind: "burger", model, x, y, h: 0, yaw: turn, pitch: 0, roll: 0, solid });
    } else if (how < 0.88) {
      // Two or three stacked.
      const small = 1 + r1(6);
      const sw = BURGER_W * small;
      const high = sw * BURGER_TALL;
      const stack = 2 + Math.floor(r1(7) * 2);
      for (let s = 0; s < stack; s++) {
        const model = burgerModel(small, s === stack - 1 && r1(8) < BURGER_BITTEN ? bitesOf(bites) : []);
        out.push({
          key: key(`${name}.${s}`),
          kind: "burger",
          model,
          x: x + (r1(9 + s) - 0.5) * sw * 0.15,
          y: y + (r1(12 + s) - 0.5) * sw * 0.15,
          h: s * high * 0.95,
          yaw: turn + s,
          pitch: s ? (r1(15 + s) - 0.5) * 0.12 : 0,
          roll: 0,
          solid: s ? null : { x, y, r: sw / 2 },
        });
      }
    } else {
      // Fallen apart: its buns, chicken and lettuce each where they landed, the top bun as often as not on its back.
      const small = 1 + r1(6);
      const sw = BURGER_W * small;
      (["bottom", "chicken", "lettuce", "top"] as const).forEach((part, s) => {
        const a = r1(9 + s) * Math.PI * 2;
        const far = sw * 0.6 + r1(13 + s) * 0.15;
        const high = PART_TALL[part] * sw;
        const flipped = part === "top" && r1(17) < 0.5;
        const px = x + Math.cos(a) * far;
        const py = y + Math.sin(a) * far;
        out.push({
          key: key(`${name}.${s}`),
          kind: "burger",
          model: burgerModel(small, [], part),
          x: px,
          y: py,
          h: flipped ? high : 0,
          yaw: r1(18 + s) * Math.PI * 2,
          pitch: 0,
          roll: flipped ? Math.PI : 0,
          solid: high < STEP ? null : { x: px, y: py, r: sw * 0.3 },
        });
      });
    }
  }
  // More on the table, toward its ends, one of them bitten.
  const onTable = many(PARTY_ON_TABLE, 60);
  for (let k = 0; k < onTable; k++) {
    const t = (k ? -1 : 1) * (hl - 0.09) + (roll(61 + k) - 0.5) * 0.04;
    const d = (roll(63 + k) - 0.5) * (hd - 0.08);
    const model = burgerModel(0.9 + roll(65 + k) * 0.3, k === 0 ? bitesOf((j) => roll(70 + j)) : []);
    const turn = { yaw: roll(67 + k) * Math.PI * 2, pitch: 0, roll: 0 };
    burger(`table${k}`, model, tx + ax * t + fx * d, ty + ay * t + fy * d, PARTY_TABLE.height, turn, null);
  }

  // Stuck into the walls at any height and any angle, some of them deep in.
  const inWalls = many(PARTY_IN_WALLS, 80);
  for (let k = 0; k < inWalls; k++) {
    const r = (j: number) => roll(81 + k * 9 + j);
    const spot = wallSpots[Math.floor(r(0) * wallSpots.length)];
    const [wx, wy, ox, oy] = onWall(spot, 0.2 + r(1) * 0.6);
    const size = 1 + r(2) * 1.5;
    const w = BURGER_W * size;
    const sticks = w / 2 - buried(w, r(3));
    const turn = { yaw: r(4) * Math.PI * 2, pitch: (r(5) - 0.5) * 2.4, roll: (r(6) - 0.5) * 2.4 };
    burger(`wall${k}`, burgerModel(size), wx + ox * sticks, wy + oy * sticks, 0.1 + r(7) * 0.7, turn, null);
  }

  // Upside down in the ceiling.
  const inCeiling = many(PARTY_IN_CEILING, 120);
  for (let k = 0; k < inCeiling; k++) {
    const r = (j: number) => roll(121 + k * 7 + j);
    const size = 1 + r(0) * 1.5;
    const tall = BURGER_W * size * BURGER_TALL;
    const x = x0 + 0.2 + r(1) * (ROOM - 0.4);
    const y = y0 + 0.2 + r(2) * (ROOM - 0.4);
    const turn = { yaw: r(3) * Math.PI * 2, pitch: (r(4) - 0.5) * 0.4, roll: Math.PI + (r(5) - 0.5) * 0.4 };
    const model = burgerModel(size, r(6) < BURGER_BITTEN ? bitesOf((j) => r(10 + j)) : []);
    burger(`ceiling${k}`, model, x, y, 1 + buried(tall, r(7)), turn, null);
  }

  // Sunk in the carpet, only their tops showing, where nothing else is.
  const sunkCount = many(PARTY_SUNK, 150);
  for (let k = 0, made = 0; k < 20 && made < sunkCount; k++) {
    const r = (j: number) => roll(151 + k * 7 + j);
    const size = 1 + r(0) * 1.2;
    const w = BURGER_W * size;
    const x = x0 + 0.15 + r(1) * (ROOM - 0.3);
    const y = y0 + 0.15 + r(2) * (ROOM - 0.3);
    if (!free(x, y, w / 2)) continue;
    taken.push({ x, y, r: w / 2 });
    const turn = { yaw: r(3) * Math.PI * 2, pitch: (r(4) - 0.5) * 0.8, roll: (r(5) - 0.5) * 0.8 };
    burger(`sunk${made++}`, burgerModel(size), x, y, -w * BURGER_TALL * (0.55 + r(6) * 0.3), turn, null);
  }

  // Dropped outside, a few at a time, trailing away from the doorway as if from someone carrying too many.
  const outward = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ][plan.side];
  const trail = roll(219) < PARTY_TRAILED ? many(PARTY_TRAIL, 220) : 0;
  let px = door[0];
  let py = door[1];
  let heading = Math.atan2(outward[1], outward[0]);
  for (let k = 0; k < trail; k++) {
    const r = (j: number) => roll(221 + k * 7 + j);
    const stepBy = PARTY_TRAIL_STEP[0] + r(0) * (PARTY_TRAIL_STEP[1] - PARTY_TRAIL_STEP[0]);
    heading += (r(1) - 0.5) * 0.9;
    const nx = px + Math.cos(heading) * stepBy;
    const ny = py + Math.sin(heading) * stepBy;
    // Into a wall: it ends there.
    if (map.wall(Math.floor(nx), Math.floor(ny)) || map.burgerAt(Math.floor(nx), Math.floor(ny))) break;
    px = nx;
    py = ny;
    const size = 0.9 + r(2) * 0.4;
    const fallen = r(3) < 0.25;
    const bites = r(5) < 0.4 ? bitesOf((j) => r(10 + j)) : [];
    const model = fallen ? burgerModel(size, [], r(4) < 0.5 ? "top" : "bottom") : burgerModel(size, bites);
    burger(`trail${k}`, model, px, py, 0, { yaw: r(6) * Math.PI * 2, pitch: 0, roll: 0 }, null);
  }
  return out;
}

/** How big the burger XN holds is: small enough for her hands, which are small. */
const HELD_SIZE = 0.6;

/** The bite out of the burger XN holds: one, on the side toward her (its back, as it faces the way she does). */
const HELD_BITE: readonly Bite[] = [{ at: -Math.PI / 2, big: 1 }];

/**
 * The burger XN holds: its middle at (x, y, z), facing `yaw` as she does, with a bite out of the side toward her,
 * tipped `tip` so that side turns up toward her.
 */
export function heldBurger(
  x: number,
  y: number,
  z: number,
  yaw: number,
  tip: number,
): { mesh: StatueMesh; model: StatueModel } {
  const model = burgerModel(HELD_SIZE, HELD_BITE);
  const h = z - (BURGER_W * HELD_SIZE * BURGER_TALL) / 2;
  const junk: Junk = { key: "held", kind: "burger", model, x, y, h, yaw, pitch: tip, roll: 0, solid: null };
  return { mesh: placeJunk(model, junk), model };
}

/** Which way a piece of junk is turned. */
type Turn = Pick<Junk, "yaw" | "pitch" | "roll">;

/** The burger rooms' contents, by room and map: laid out once. */
const parties = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** Everything in the burger rooms within `radius` of (x, y). */
function partiesAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  for (let ly = Math.floor((y - radius) / 5); ly <= Math.floor((y + radius) / 5); ly++) {
    for (let lx = Math.floor((x - radius) / 5); lx <= Math.floor((x + radius) / 5); lx++) {
      const plan = map.burgerPlan(lx, ly);
      if (plan) within(laidOut(parties, map, `${lx},${ly}`, () => partyIn(map, lx, ly, plan)), x, y, radius, out);
    }
  }
  return out;
}

// ---- fitted rooms ----

/*
 * A fitted room is a lattice room walled in, with a door or two, fitted out for a use (map.ts says which and where).
 * Its furniture stands where it belongs, mostly back to a wall in sets, as if somebody worked there until not long
 * ago; now and then one thing is wrong.
 *
 * A workroom: one desk against the wall facing the way in, a monitor on it and a chair pulled up to it, its back to
 * whoever comes in; a row of filing cabinets along a wall beside it; a socket behind the desk and a light switch by
 * the door; sometimes a chair against a wall for a visitor. Now and then the chair has been turned round to face the
 * door, the monitor turned to the wall, or the chair taken away from the desk and put in a corner, facing into it.
 */

/** Inward from each side of a fitted room: north, south, west, east. */
const INWARD = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

/** A point `out` into fitted room `plan` from the inside face of its wall on side `side`, `t` along that wall. */
function onWall(plan: FittedPlan, side: number, t: number, out: number): [number, number] {
  const { x0, y0 } = plan;
  if (side === 0) return [x0 + t, y0 + out];
  if (side === 1) return [x0 + t, y0 + plan.h - out];
  if (side === 2) return [x0 + out, y0 + t];
  return [x0 + plan.w - out, y0 + t];
}

/** The way out of the wall on side `side`, into the room. */
const inward = (side: number) => Math.atan2(INWARD[side][1], INWARD[side][0]);

/** The side across the room from each side. */
const ACROSS = [1, 0, 3, 2] as const;

/** The workroom's desk: bigger than the ones lying about, and higher than the chair's seat, as a desk should be. */
const WORK_DESK: DeskShape = { length: 0.75, depth: 0.36, height: 0.34, legs: 2, drawer: true };
/** How far the chair stands out from the desk's front, and how far it's turned off square, at most. */
const WORK_CHAIR_OUT = 0.2;
const WORK_CHAIR_TURN = 0.25;
/** How likely the chair is turned round to face the door, the monitor turned to the wall, the chair in a corner. */
const WORK_CHAIR_TURNED = 0.15;
const WORK_MONITOR_AWAY = 0.1;
const WORK_CHAIR_CORNER = 0.08;
/** How many filing cabinets in the row, at least and at most; how likely a visitor's chair is. */
const WORK_CABINETS = [1, 3] as const;
const WORK_VISITOR = 0.35;
/** The light switch by the door: how far along the wall from the door's middle, and how high. */
const SWITCH_ALONG = 0.75;
const SWITCH_H = 0.42;
/** Kept clear in front of each door: how far into the room its middle is, and how far round that. */
const DOOR_CLEAR_OUT = 0.45;
const DOOR_CLEAR = 0.6;

/** Everything in workroom `plan` in lattice room (lx, ly), the same every time for this map. */
function workroomIn(map: WorldMap, lx: number, ly: number, plan: FittedPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 41 + k, ly, 950);
  const out: Junk[] = [];
  const key = (name: string) => `w${lx},${ly}.${name}`;
  const turned = roll(1) < WORK_CHAIR_TURNED;
  const away = roll(2) < WORK_MONITOR_AWAY;
  const corner = !turned && roll(3) < WORK_CHAIR_CORNER;
  const visitor = roll(4) < WORK_VISITOR;
  const [least, most] = WORK_CABINETS;
  const cabinets = least + Math.floor(roll(5) * (most - least + 1));
  // Its desk and chairs all one kind, office or wooden, as likely as its zone says.
  const office = roll(6) < OFFICE_FURNITURE[map.zoneAt(plan.x0, plan.y0)];

  // What's taken, as circles; the doors kept clear.
  const taken: { x: number; y: number; r: number }[] = [];
  const doorSides = new Set(plan.doors.map(([side]) => side));
  for (const [side, cell] of plan.doors) {
    const [x, y] = onWall(plan, side, cell - 0.5, DOOR_CLEAR_OUT);
    taken.push({ x, y, r: DOOR_CLEAR });
  }
  const free = (x: number, y: number, r: number) =>
    x - r > plan.x0 &&
    y - r > plan.y0 &&
    x + r < plan.x0 + FITTED_SIZE &&
    y + r < plan.y0 + FITTED_SIZE &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const [doorSide, doorCell] = plan.doors[0];
  const door = onWall(plan, doorSide, doorCell - 0.5, 0.5);

  // The desk, against the wall across from the way in; or, if there's a door there too, against another.
  const sides = [ACROSS[doorSide], ...[0, 1, 2, 3].filter((s) => s !== ACROSS[doorSide])];
  const deskSide = sides.find((s) => !doorSides.has(s)) ?? ACROSS[doorSide];
  const hl = WORK_DESK.length / 2;
  const hd = WORK_DESK.depth / 2;
  const deskT = 1 + roll(10) * 2;
  const [tx, ty] = onWall(plan, deskSide, deskT, hd + 0.005);
  const face = inward(deskSide);
  const [fx, fy] = INWARD[deskSide];
  // Along the wall.
  const ax = -fy;
  const ay = fx;
  const desk = { x: tx, y: ty, h: 0, yaw: face, pitch: 0, roll: 0 };
  out.push({
    key: key("desk"),
    kind: "desk",
    model: buildDesk(WORK_DESK, office),
    office,
    ...desk,
    solid: slab(tx, ty, ax * hl, ay * hl, hd + 0.01),
    perch: perchOn(desk, WORK_DESK.height, hd, 0.1),
  });
  for (const k of [-1, 0, 1]) taken.push({ x: tx + ax * hl * 0.7 * k, y: ty + ay * hl * 0.7 * k, r: hd + 0.02 });

  // The monitor on it, its back to the wall; or turned round, its screen to the wall.
  const mt = deskT + (roll(11) - 0.5) * 0.2;
  const [mx, my] = onWall(plan, deskSide, mt, MONITOR_DEPTH / 2 + 0.01);
  const monitorYaw = (away ? face + Math.PI : face) + (roll(12) - 0.5) * 0.2;
  const monitor = {
    x: mx - Math.cos(monitorYaw) * MONITOR_MIDDLE,
    y: my - Math.sin(monitorYaw) * MONITOR_MIDDLE,
    h: WORK_DESK.height,
    yaw: monitorYaw,
    pitch: 0,
    roll: 0,
  };
  out.push({
    key: key("monitor"),
    kind: "monitor",
    model: MONITOR,
    ...monitor,
    solid: null,
    perch: perchOn(monitor, MONITOR_TALL, 0.17, 0.42, false, -0.03),
  });

  // The chair: pulled up to the desk, facing it; turned round to face the door; or in a corner, facing into it.
  const chair = buildChair(ORDINARY, office);
  const seat = chairSeat(ORDINARY);
  const putChair = (name: string, x: number, y: number, yaw: number) => {
    const pose = { x, y, h: 0, yaw, pitch: 0, roll: 0 };
    out.push({
      key: key(name),
      kind: "chair",
      model: chair,
      office,
      ...pose,
      solid: { x, y, r: 0.2 },
      perch: perchOn(pose, seat, CHAIR_EDGE, 0.1),
    });
    taken.push({ x, y, r: 0.22 });
  };
  if (corner) {
    // The corner furthest from the way in, away from the desk if it can be.
    const corners: [number, number][] = [
      [plan.x0 + 0.3, plan.y0 + 0.3],
      [plan.x0 + FITTED_SIZE - 0.3, plan.y0 + 0.3],
      [plan.x0 + 0.3, plan.y0 + FITTED_SIZE - 0.3],
      [plan.x0 + FITTED_SIZE - 0.3, plan.y0 + FITTED_SIZE - 0.3],
    ];
    corners.sort((a, b) => Math.hypot(b[0] - door[0], b[1] - door[1]) - Math.hypot(a[0] - door[0], a[1] - door[1]));
    const spot = corners.find(([x, y]) => free(x, y, 0.22)) ?? corners[0];
    const cx = spot[0] < plan.x0 + 2 ? plan.x0 : plan.x0 + FITTED_SIZE;
    const cy = spot[1] < plan.y0 + 2 ? plan.y0 : plan.y0 + FITTED_SIZE;
    putChair("chair", spot[0], spot[1], Math.atan2(cy - spot[1], cx - spot[0]));
  } else {
    const along = (roll(13) - 0.5) * 0.2;
    const [cx, cy] = onWall(plan, deskSide, deskT + along, WORK_DESK.depth + WORK_CHAIR_OUT);
    const yaw = turned
      ? Math.atan2(door[1] - cy, door[0] - cx) + (roll(14) - 0.5) * 0.2
      : face + Math.PI + (roll(14) - 0.5) * 2 * WORK_CHAIR_TURN;
    putChair("chair", cx, cy, yaw);
  }

  // Sockets: one low on the wall beside the desk, and the light switch by the way in.
  const socket = (name: string, model: StatueModel, side: number, t: number, h: number) => {
    const [x, y] = onWall(plan, side, t, 0);
    out.push({ key: key(name), kind: "socket", model, x, y, h, yaw: inward(side), pitch: 0, roll: 0, solid: null });
  };
  const socketT = deskT + (roll(21) < 0.5 ? -1 : 1) * (hl + 0.15);
  socket("socket", SOCKETS[Math.floor(roll(20) * 2)].model, deskSide, socketT, 0.07);
  const switchT = doorCell - 0.5 + (roll(22) < 0.5 ? -1 : 1) * SWITCH_ALONG;
  socket("switch", SOCKETS[2].model, doorSide, switchT, SWITCH_H);

  // The filing cabinets, in a row back to a wall beside the desk's, from the corner they share; or wherever the row
  // fits.
  const cabinetSides = [0, 1, 2, 3].filter((s) => s !== deskSide && s !== ACROSS[deskSide]);
  if (roll(30) < 0.5) cabinetSides.reverse();
  cabinetSides.push(ACROSS[deskSide], deskSide);
  const shape = cabinetShape(roll(31) * 0.5, 0, roll(32));
  const cw = shape.width + 0.01;
  const chd = shape.depth / 2;
  for (const side of cabinetSides) {
    // From the end by the desk's wall, or from the far end.
    const nearDesk = side === 0 || side === 1 ? (deskSide === 3 ? FITTED_SIZE : 0) : deskSide === 1 ? FITTED_SIZE : 0;
    const starts = [nearDesk, FITTED_SIZE - nearDesk];
    let placed = false;
    for (const start of starts) {
      const step = start === 0 ? 1 : -1;
      const first = start + step * (0.1 + cw / 2);
      const spots = Array.from({ length: cabinets }, (_, i) => onWall(plan, side, first + step * cw * i, chd + 0.005));
      if (!spots.every(([x, y]) => free(x, y, Math.max(cw, shape.depth) / 2))) continue;
      const yaw = inward(side);
      const [sx, sy] = INWARD[side];
      spots.forEach(([x, y], i) => {
        const pose = { x, y, h: 0, yaw, pitch: 0, roll: 0 };
        const one = i === 0 ? shape : { ...shape, pulled: shape.pulled.map(() => 0) };
        out.push({
          key: key(`cabinet${i}`),
          kind: "cabinet",
          model: buildCabinet(one),
          ...pose,
          solid: slab(x, y, sx * chd, sy * chd, shape.width / 2 + 0.01),
          perch: perchOn(pose, cabinetHeight(one), chd, 0.1),
        });
        taken.push({ x, y, r: Math.max(cw, shape.depth) / 2 });
      });
      placed = true;
      break;
    }
    if (placed) break;
  }

  // A visitor's chair, back to a wall, facing the desk.
  if (visitor) {
    for (let k = 0; k < 12; k++) {
      const side = [0, 1, 2, 3].filter((s) => s !== deskSide)[Math.floor(roll(40 + k) * 3)];
      const [x, y] = onWall(plan, side, 0.4 + roll(52 + k) * 3.2, 0.24);
      if (!free(x, y, 0.22)) continue;
      putChair("visitor", x, y, Math.atan2(ty - y, tx - x) + (roll(64 + k) - 0.5) * 0.3);
      break;
    }
  }
  return out;
}

/** The fitted rooms' contents, by room and map: laid out once. */
const fittings = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** How each kind of fitted room is furnished. */
const FURNISH = { workroom: workroomIn, camp: campIn, pantry: pantryIn, meeting: meetingIn, storage: storageIn };

/** Everything in the fitted rooms within `radius` of (x, y). */
function fittedAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  const seen = new Set<FittedPlan>();
  for (let ly = Math.floor((y - radius) / 5); ly <= Math.floor((y + radius) / 5); ly++) {
    for (let lx = Math.floor((x - radius) / 5); lx <= Math.floor((x + radius) / 5); lx++) {
      const plan = map.fittedPlan(lx, ly);
      // A long room's halves are the one plan: furnished once, by its first lattice room.
      if (!plan || seen.has(plan)) continue;
      seen.add(plan);
      const [bx, by] = [(plan.x0 - 1) / 5, (plan.y0 - 1) / 5];
      const furnish = FURNISH[plan.kind];
      within(laidOut(fittings, map, `${bx},${by}`, () => furnish(map, bx, by, plan)), x, y, radius, out);
    }
  }
  return out;
}

// ---- the halls ----

/*
 * Two of the kinds of big room have things of their own (map.ts says which is which). A floor of office cubicles:
 * rows of them back to back, fabric partitions a little under eye height, a desk in each with its monitor still on,
 * and whoever worked there gone, their chair pushed back or turned to the aisle or knocked over, a mug left on the
 * desk. And a hall with every light out but one in the middle, and under it a chair, or a monitor, or nothing.
 */

/** A partition: how high, and how thick. A little under the visitor's eyes, so they see over the rows. */
const PARTITION_H = 0.44;
const PARTITION_T = 0.03;
/** A cubicle: its width along the row, and its depth from the partition at its back to the aisle. */
const CUBE_W = 1.4;
const CUBE_D = 1.3;
/** How many cubicles in a row either side of the aisle across the middle, and how wide that aisle is. */
const CUBES_IN_ROW = 3;
const CROSS_AISLE = 1.4;
/** How many rows of cubicles back to back, and the aisle between each two. */
const CUBE_PAIRS = 3;
const CUBE_AISLE = 1.3;
const CUBE_DESK: DeskShape = { length: 0.9, depth: 0.4, height: 0.34, legs: 2, drawer: true };
/** How far a chair at a desk stands out from its front. */
const CUBE_CHAIR_OUT = 0.2;
/**
 * How likely a cubicle is to have nothing in it but its partitions; its monitor; a mug left on the desk; its chair
 * pushed well back and turned, turned round to the aisle, or knocked over on its side.
 */
const CUBE_EMPTY = 0.08;
const CUBE_MONITOR = 0.75;
const CUBE_MUG = 0.3;
const CUBE_PUSHED = 0.25;
const CUBE_TURNED = 0.12;
const CUBE_TIPPED = 0.07;

const PARTITIONS = new Map<number, StatueModel>();
/** A partition `length` long, fabric both sides, its edges steel. */
function partitionModel(length: number): StatueModel {
  let model = PARTITIONS.get(length);
  if (!model) {
    const tris: number[] = [];
    const hl = length / 2;
    const ht = PARTITION_T / 2;
    const H = PARTITION_H;
    // Its two faces, cut only across, its ends and its top; nobody sees under it.
    quad(tris, [-hl, 0, ht], [hl, 0, ht], [hl, H, ht], [-hl, H, ht], FABRIC, H);
    quad(tris, [hl, 0, -ht], [-hl, 0, -ht], [-hl, H, -ht], [hl, H, -ht], FABRIC, H);
    quad(tris, [hl, 0, ht], [hl, 0, -ht], [hl, H, -ht], [hl, H, ht], STEEL, H);
    quad(tris, [-hl, 0, -ht], [-hl, 0, ht], [-hl, H, ht], [-hl, H, -ht], STEEL, H);
    quad(tris, [-hl, H, ht], [hl, H, ht], [hl, H, -ht], [-hl, H, -ht], STEEL);
    model = { tris, atlasWidth: OFFICE_ATLAS_W, atlasHeight: OFFICE_ATLAS_H, stone: [120, 128, 140] };
    PARTITIONS.set(length, model);
  }
  return model;
}

/** Everything on a floor of cubicles in block (bx, by), the same every time for this map. */
function cubiclesIn(map: WorldMap, bx: number, by: number): Junk[] {
  const roll = (k: number) => map.noise(bx * 53 + k, by, 960);
  const out: Junk[] = [];
  const key = (name: string) => `h${bx},${by}.${name}`;
  // The rows run along x or along y. In the hall's own terms, u is along the rows and v across them, from its corner.
  const alongX = roll(0) < 0.5;
  const x0 = bx * ROOM_BLOCK;
  const y0 = by * ROOM_BLOCK;
  const at = (u: number, v: number): [number, number] => (alongX ? [x0 + u, y0 + v] : [x0 + v, y0 + u]);
  /** A way in the hall's terms (an angle from u toward v) as a way in the place. */
  const way = (a: number) => (alongX ? a : Math.PI / 2 - a);
  /** Half a length along u, or along v, as a vector in the place. */
  const alongU = (h: number): [number, number] => (alongX ? [h, 0] : [0, h]);
  const alongV = (h: number): [number, number] => (alongX ? [0, h] : [h, 0]);
  const seat = chairSeat(ORDINARY);
  const chair = buildChair(ORDINARY, true);
  const desk = buildDesk(CUBE_DESK, true);

  const partition = (name: string, u: number, v: number, length: number, acrossRows: boolean) => {
    const [x, y] = at(u, v);
    // Its length along its own x, which the yaw turns to run along u (yaw toward v) or along v (yaw toward u).
    const yaw = way(acrossRows ? 0 : Math.PI / 2);
    const [ax, ay] = acrossRows ? alongV(length / 2) : alongU(length / 2);
    out.push({
      key: key(name),
      kind: "partition",
      model: partitionModel(length),
      office: true,
      x,
      y,
      h: 0,
      yaw,
      pitch: 0,
      roll: 0,
      solid: slab(x, y, ax, ay, PARTITION_T / 2 + 0.01),
    });
  };

  const inside = ROOM_BLOCK - 1;
  const rowsSpan = CUBE_PAIRS * CUBE_D * 2 + (CUBE_PAIRS - 1) * CUBE_AISLE;
  const rowLength = CUBES_IN_ROW * CUBE_W;
  const firstV = 1 + (inside - rowsSpan) / 2;
  const firstU = 1 + (inside - rowLength * 2 - CROSS_AISLE) / 2;
  for (let p = 0; p < CUBE_PAIRS; p++) {
    // The partitions between the two rows of the pair.
    const back = firstV + p * (CUBE_D * 2 + CUBE_AISLE) + CUBE_D;
    for (let g = 0; g < 2; g++) {
      const u0 = firstU + g * (rowLength + CROSS_AISLE);
      partition(`back${p}.${g}`, u0 + rowLength / 2, back, rowLength, false);
      for (let i = 0; i <= CUBES_IN_ROW; i++) partition(`side${p}.${g}.${i}`, u0 + i * CUBE_W, back, CUBE_D * 2, true);
      for (const side of [-1, 1]) {
        for (let i = 0; i < CUBES_IN_ROW; i++) {
          const name = `${p}.${g}.${side}.${i}`;
          const r = (k: number) => roll(100 + (p * 2 + g) * 400 + (side + 1) * 100 + i * 20 + k);
          if (r(0) < CUBE_EMPTY) continue;
          const u = u0 + (i + 0.5) * CUBE_W;
          // Facing out of the cubicle, to the aisle.
          const face = way(side > 0 ? Math.PI / 2 : -Math.PI / 2);
          const deskV = back + side * (PARTITION_T / 2 + CUBE_DESK.depth / 2 + 0.005);
          const [dx, dy] = at(u + (r(1) - 0.5) * 0.2, deskV);
          const deskPose = { x: dx, y: dy, h: 0, yaw: face, pitch: 0, roll: 0 };
          const [hx, hy] = alongU(CUBE_DESK.length / 2);
          out.push({
            key: key(`desk${name}`),
            kind: "desk",
            model: desk,
            office: true,
            ...deskPose,
            solid: slab(dx, dy, hx, hy, CUBE_DESK.depth / 2 + 0.01),
            perch: perchOn(deskPose, CUBE_DESK.height, CUBE_DESK.depth / 2, 0.1),
          });
          // The monitor, its back to the partition, somewhere along the desk.
          const mu = u + (r(2) - 0.5) * 0.4;
          if (r(3) < CUBE_MONITOR) {
            const mv = back + side * (PARTITION_T / 2 + MONITOR_DEPTH / 2 + 0.01);
            const monitorYaw = face + (r(4) - 0.5) * 0.3;
            const [mx, my] = at(mu, mv);
            const monitor = {
              x: mx - Math.cos(monitorYaw) * MONITOR_MIDDLE,
              y: my - Math.sin(monitorYaw) * MONITOR_MIDDLE,
              h: CUBE_DESK.height,
              yaw: monitorYaw,
              pitch: 0,
              roll: 0,
            };
            out.push({
              key: key(`monitor${name}`),
              kind: "monitor",
              model: MONITOR,
              ...monitor,
              solid: null,
              perch: perchOn(monitor, MONITOR_TALL, 0.17, 0.42, false, -0.03),
            });
          }
          // A mug left by it, at the other end of the desk.
          if (r(5) < CUBE_MUG) {
            const side2 = mu < u ? 1 : -1;
            const [gx, gy] = at(u + side2 * (0.25 + r(6) * 0.15), deskV + side * (r(7) - 0.3) * 0.15);
            const mug = { x: gx, y: gy, h: CUBE_DESK.height, yaw: r(8) * Math.PI * 2, pitch: 0, roll: 0 };
            out.push({ key: key(`mug${name}`), kind: "kitchen", model: MUG_MODEL, ...mug, solid: null });
          }
          // The chair: pulled up to the desk; pushed back and turned; turned round to the aisle; or knocked over.
          const how = r(10);
          const pushed = how < CUBE_PUSHED;
          const chairV = deskV + side * (CUBE_DESK.depth / 2 + CUBE_CHAIR_OUT + (pushed ? 0.25 + r(11) * 0.2 : 0));
          const [cx, cy] = at(u + (r(12) - 0.5) * (pushed ? 0.5 : 0.15), chairV);
          const toDesk = face + Math.PI;
          if (how < CUBE_PUSHED + CUBE_TURNED + CUBE_TIPPED && how >= CUBE_PUSHED + CUBE_TURNED) {
            // On its side, its seat to the aisle or along it.
            const pose = { x: cx, y: cy, h: 0.11, yaw: r(13) * Math.PI * 2, pitch: 0, roll: Math.PI / 2 };
            const solid = { x: cx, y: cy, r: 0.25 };
            out.push({ key: key(`chair${name}`), kind: "chair", model: chair, office: true, ...pose, solid });
            continue;
          }
          const yaw =
            how < CUBE_PUSHED
              ? toDesk + (r(13) - 0.5) * 1.8
              : how < CUBE_PUSHED + CUBE_TURNED
                ? face + (r(13) - 0.5) * 0.6
                : toDesk + (r(13) - 0.5) * 0.4;
          const pose = { x: cx, y: cy, h: 0, yaw, pitch: 0, roll: 0 };
          out.push({
            key: key(`chair${name}`),
            kind: "chair",
            model: chair,
            office: true,
            ...pose,
            solid: { x: cx, y: cy, r: 0.2 },
            perch: perchOn(pose, seat, CHAIR_EDGE, 0.1),
          });
        }
      }
    }
  }
  return out;
}

/** Under a one-light hall's light: a chair, a monitor on the floor, or nothing. */
const LAMP_CHAIR = 0.4;
const LAMP_MONITOR = 0.2;

/** What's under the light of the one-light hall in block (bx, by). */
function lampHallIn(map: WorldMap, bx: number, by: number): Junk[] {
  const roll = (k: number) => map.noise(bx * 59 + k, by, 970);
  const x = bx * ROOM_BLOCK + HALL_LAMP + 0.5 + (roll(1) - 0.5) * 0.3;
  const y = by * ROOM_BLOCK + HALL_LAMP + 0.5 + (roll(2) - 0.5) * 0.3;
  const yaw = roll(3) * Math.PI * 2;
  const what = roll(0) < LAMP_CHAIR ? "chair" : roll(0) < LAMP_CHAIR + LAMP_MONITOR ? "monitor" : null;
  if (what === "chair") {
    const office = roll(4) < OFFICE_FURNITURE[map.zoneAt(Math.floor(x), Math.floor(y))];
    const pose = { x, y, h: 0, yaw, pitch: 0, roll: 0 };
    return [
      {
        key: `l${bx},${by}`,
        kind: "chair",
        model: buildChair(ORDINARY, office),
        office,
        ...pose,
        solid: { x, y, r: 0.2 },
        perch: perchOn(pose, chairSeat(ORDINARY), CHAIR_EDGE, 0.1),
      },
    ];
  }
  if (what === "monitor") {
    // On the floor, still on, facing somewhere.
    const pose = { x, y, h: 0, yaw, pitch: 0, roll: 0 };
    return [
      {
        key: `l${bx},${by}`,
        kind: "monitor",
        model: MONITOR,
        ...pose,
        solid: { x, y, r: 0.2 },
        perch: perchOn(pose, MONITOR_TALL, 0.17, 0.42, false, -0.03),
      },
    ];
  }
  return [];
}

/** The halls' things, by block and map: laid out once. */
const hallThings = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** Everything in the halls within `radius` of (x, y). */
function hallsAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  for (let by = Math.floor((y - radius) / ROOM_BLOCK); by <= Math.floor((y + radius) / ROOM_BLOCK); by++) {
    for (let bx = Math.floor((x - radius) / ROOM_BLOCK); bx <= Math.floor((x + radius) / ROOM_BLOCK); bx++) {
      const kind = map.hallKind(bx, by);
      if (kind !== "cubicles" && kind !== "lamp") continue;
      const lay = () => (kind === "cubicles" ? cubiclesIn(map, bx, by) : lampHallIn(map, bx, by));
      within(laidOut(hallThings, map, `${bx},${by}`, lay), x, y, radius, out);
    }
  }
  return out;
}

// ---- dead ends ----

/*
 * At the end of a dead end (map.ts), something: a door flat on the far wall that doesn't open, a chair facing that
 * wall, or a vending machine still lit, a snack machine or a drink machine or the two side by side, back to the wall.
 * The machines after the plain ones in offices everywhere: a black one with crisps and sweets in rows behind its glass
 * and a keypad, a red one with its bottles lit from behind, a lit band across its top, a coin box and a flap to reach
 * in for what you bought. No names on them.
 */

/** The machines' atlas: what's behind each one's glass, the lit band, the keypad, the coin box, their bodies. */
const SNACKS: Rect = { x: 0, y: 0, w: 24, h: 40 };
const DRINKS: Rect = { x: 24, y: 0, w: 24, h: 40 };
const BAND: Rect = { x: 48, y: 0, w: 16, h: 8 };
const KEYPAD: Rect = { x: 48, y: 8, w: 8, h: 16 };
const COINS: Rect = { x: 56, y: 8, w: 8, h: 16 };
const VEND_BLACK: Rect = { x: 48, y: 24, w: 8, h: 8 };
const VEND_RED: Rect = { x: 56, y: 24, w: 8, h: 8 };
const VEND_DARK: Rect = { x: 48, y: 32, w: 8, h: 8 };
const VEND_STEEL: Rect = { x: 56, y: 32, w: 8, h: 8 };
const VENDING_ATLAS_W = 64;
const VENDING_ATLAS_H = 40;

/** Bags of crisps and sweets, in the colours they come in. */
const BAG_COLOURS = [
  [214, 52, 40],
  [238, 176, 36],
  [52, 110, 210],
  [226, 84, 160],
  [56, 160, 76],
  [236, 122, 34],
  [196, 196, 206],
];
/** Bottles, a row of each: cola, green, orange, water, and a mix. */
const BOTTLE_ROWS = [
  [[58, 24, 20]],
  [[58, 24, 20], [40, 160, 90]],
  [[236, 128, 30], [220, 226, 230]],
  [[140, 186, 230]],
  [[58, 24, 20], [200, 60, 110], [140, 186, 230]],
];

/**
 * Alpha marks what lights itself (statue.ts): 64–127, like a screen. Everything behind the glass is lit, the band
 * across the drink machine's top, and the little screens on the keypad and the coin box.
 */
export const VENDING_SKIN: StatueSkin = (() => {
  const W = VENDING_ATLAS_W;
  const data = new Uint8ClampedArray(W * VENDING_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], a = 255) => {
    const o = (y * W + x) * 4;
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = a;
  };
  const fill = (r: Rect, c: (x: number, y: number) => readonly number[], a = 255) => {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) put(r.x + x, r.y + y, c(x, y), a);
  };
  const shade = (c: readonly number[], m: number) => c.map((v) => v * m);
  const lit = 100;

  // Snacks: five shelves, each a row of six bags on their coils, dim inside.
  fill(
    SNACKS,
    (x, y) => {
      const row = Math.floor(y / 8);
      const v = y % 8;
      if (v === 7) return [110, 110, 114];
      const bag = Math.floor(x / 4);
      if (x % 4 === 3 || v === 0) return [26, 26, 30];
      const colour = BAG_COLOURS[Math.floor(grain(bag + 17, row + 31) * BAG_COLOURS.length)];
      // Crinkled at the top, a little logo in the middle.
      if (v === 1) return shade(colour, 1.25);
      if (v === 3 && x % 4 === 1) return [240, 236, 224];
      return shade(colour, 0.9 + 0.15 * grain(x, y + 200));
    },
    lit,
  );
  // Drinks: five shelves of bottles in a row, a cap and a label on each, lit from behind.
  fill(
    DRINKS,
    (x, y) => {
      const row = Math.floor(y / 8);
      const v = y % 8;
      if (v === 7) return [170, 172, 176];
      if (x % 3 === 2 || v === 0) return [214, 220, 226];
      const kinds = BOTTLE_ROWS[row];
      const colour = kinds[Math.floor(x / 3) % kinds.length];
      if (v === 1) return [200, 40, 36];
      if (v === 2) return shade(colour, 1.1);
      if (v === 4) return [236, 236, 230];
      return shade(colour, 0.95 + 0.1 * grain(x, y + 300));
    },
    lit,
  );
  // The band: red, darker at its edges, a white wave across.
  fill(
    BAND,
    (x, y) => {
      const wave = Math.round(3.5 + Math.sin(x * 0.8) * 1.5);
      if (y === wave) return [244, 240, 236];
      return shade([210, 40, 32], y === 0 || y === 7 ? 0.7 : 1);
    },
    120,
  );
  // The keypad: a green screen up top, buttons below.
  fill(KEYPAD, (x, y) =>
    y >= 6 && y <= 13 && x % 2 === 1 && y % 2 === 0 ? [206, 206, 200] : [72, 72, 76],
  );
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 6; x++) put(KEYPAD.x + x, KEYPAD.y + y, [70, 196, 96], lit);
  // The coin box: light grey, a screen, a slot, a column of buttons.
  fill(COINS, (x, y) => {
    if (y >= 6 && y <= 7 && x >= 3 && x <= 4) return [20, 20, 22];
    if (y >= 10 && y <= 14 && x >= 2 && x <= 5 && (x + y) % 2 === 0) return [120, 120, 124];
    return [188, 190, 192];
  });
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 6; x++) put(COINS.x + x, COINS.y + y, [70, 200, 130], lit);
  fill(VEND_BLACK, (x, y) => shade([36, 36, 38], 0.92 + 0.12 * grain(x, y + 400)));
  fill(VEND_RED, (x, y) => shade([196, 34, 28], 0.92 + 0.12 * grain(x, y + 500)));
  fill(VEND_DARK, () => [14, 14, 16]);
  fill(VEND_STEEL, (x, y) => shade([160, 162, 166], 0.94 + 0.1 * grain(x, y + 600)));
  return { data };
})();

/** A hole in a front: where, how deep it goes back, and what its back and its sides are. */
interface Hole {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  depth: number;
  back: Rect;
  sides: Rect;
}

/**
 * A front facing +z at z, from (x0, y0) to (x1, y1), painted `body`, with holes set back into it: a window with
 * the glass behind its frame, a flap to reach in. The front is cut round the holes into a grid of pieces.
 */
function frontWithHoles(
  out: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  body: Rect,
  holes: readonly Hole[],
) {
  const xs = [...new Set([x0, x1, ...holes.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const my = (ys[j] + ys[j + 1]) / 2;
      if (holes.some((h) => mx > h.x0 && mx < h.x1 && my > h.y0 && my < h.y1)) continue;
      quad(out, [xs[i], ys[j], z], [xs[i + 1], ys[j], z], [xs[i + 1], ys[j + 1], z], [xs[i], ys[j + 1], z], body);
    }
  }
  for (const h of holes) {
    const b = z - h.depth;
    // Its back, then its floor, its top, and its two sides, all facing into it.
    quad(out, [h.x0, h.y0, b], [h.x1, h.y0, b], [h.x1, h.y1, b], [h.x0, h.y1, b], h.back);
    quad(out, [h.x0, h.y0, z], [h.x1, h.y0, z], [h.x1, h.y0, b], [h.x0, h.y0, b], h.sides);
    quad(out, [h.x0, h.y1, b], [h.x1, h.y1, b], [h.x1, h.y1, z], [h.x0, h.y1, z], h.sides);
    quad(out, [h.x0, h.y0, z], [h.x0, h.y0, b], [h.x0, h.y1, b], [h.x0, h.y1, z], h.sides);
    quad(out, [h.x1, h.y0, b], [h.x1, h.y0, z], [h.x1, h.y1, z], [h.x1, h.y1, b], h.sides);
  }
}

/** A vending machine: how wide, how deep, how tall, and how high its feet hold it off the floor. */
const VEND_W = { snack: 0.34, drink: 0.36 } as const;
const VEND_D = 0.3;
const VEND_H = { snack: 0.7, drink: 0.72 } as const;
const VEND_FEET = 0.02;
type Vending = keyof typeof VEND_W;

/** A machine's body, its back and sides and top, from its feet up; its front is left to frontWithHoles. */
function vendingBody(out: number[], kind: Vending, body: Rect): [number, number, number] {
  const hw = VEND_W[kind] / 2;
  const hd = VEND_D / 2;
  const y0 = VEND_FEET;
  const y1 = VEND_H[kind];
  quad(out, [hw, y0, -hd], [-hw, y0, -hd], [-hw, y1, -hd], [hw, y1, -hd], body);
  quad(out, [hw, y0, hd], [hw, y0, -hd], [hw, y1, -hd], [hw, y1, hd], body);
  quad(out, [-hw, y0, -hd], [-hw, y0, hd], [-hw, y1, hd], [-hw, y1, -hd], body);
  quad(out, [-hw, y1, hd], [hw, y1, hd], [hw, y1, -hd], [-hw, y1, -hd], body);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const fx = sx * (hw - 0.03);
      const fz = sz * (hd - 0.03);
      box(out, fx - 0.012, fx + 0.012, 0, y0, fz - 0.012, fz + 0.012, VEND_DARK, VEND_DARK, VEND_DARK);
    }
  }
  return [hw, hd, y1];
}

function buildVending(kind: Vending): StatueModel {
  const tris: number[] = [];
  if (kind === "snack") {
    const [hw, hd, top] = vendingBody(tris, kind, VEND_BLACK);
    // The glass, the flap under it, and the keypad to the right of the glass.
    frontWithHoles(tris, -hw, hw, VEND_FEET, top, hd, VEND_BLACK, [
      { x0: -hw + 0.02, x1: hw - 0.1, y0: 0.24, y1: 0.64, depth: 0.02, back: SNACKS, sides: VEND_BLACK },
      { x0: -hw + 0.03, x1: hw - 0.12, y0: 0.08, y1: 0.16, depth: 0.05, back: VEND_DARK, sides: VEND_DARK },
    ]);
    box(tris, hw - 0.085, hw - 0.02, 0.44, 0.58, hd, hd + 0.01, KEYPAD, VEND_STEEL, VEND_STEEL);
    return { tris, atlasWidth: VENDING_ATLAS_W, atlasHeight: VENDING_ATLAS_H, stone: [40, 40, 44] };
  }
  const [hw, hd, top] = vendingBody(tris, kind, VEND_RED);
  // The glass, nearly the whole front; to its right the coin box, and the flap under it.
  frontWithHoles(tris, -hw, hw, VEND_FEET, top, hd, VEND_RED, [
    { x0: -hw + 0.02, x1: hw - 0.1, y0: 0.17, y1: 0.6, depth: 0.015, back: DRINKS, sides: VEND_STEEL },
    { x0: hw - 0.08, x1: hw - 0.02, y0: 0.25, y1: 0.32, depth: 0.04, back: VEND_DARK, sides: VEND_DARK },
  ]);
  box(tris, hw - 0.08, hw - 0.02, 0.4, 0.52, hd, hd + 0.012, COINS, VEND_STEEL, VEND_STEEL);
  // The lit band over the glass, just proud of the front.
  const z = hd + 0.003;
  quad(tris, [-hw + 0.02, 0.615, z], [hw - 0.1, 0.615, z], [hw - 0.1, 0.69, z], [-hw + 0.02, 0.69, z], BAND);
  return { tris, atlasWidth: VENDING_ATLAS_W, atlasHeight: VENDING_ATLAS_H, stone: [196, 34, 28] };
}

const VENDING: Record<Vending, StatueModel> = { snack: buildVending("snack"), drink: buildVending("drink") };
/** How likely a dead end's machines are a pair, side by side; of one alone, how likely it's the drink machine. */
const VEND_PAIR = 0.3;
const VEND_DRINK = 0.5;
/** How much of a dead end's far wall either side of its middle something can be moved along it by. */
const END_SHIFT = 0.5;

/** What's at dead end `end`, the same every time for this map. */
function deadEndIn(map: WorldMap, end: DeadEnd): Junk[] {
  const roll = (k: number) => map.noise(end.cx * 67 + k, end.cy, 980 + end.side);
  const key = (name: string) => `x${end.cx},${end.cy},${end.side}.${name}`;
  const { nx, ny } = end;
  // Along the wall, and somewhere along it, not too far from its middle.
  const ax = -ny;
  const ay = nx;
  const shift = (roll(1) - 0.5) * 2 * Math.min(END_SHIFT, end.half - 0.5);
  const fx = end.x + ax * shift;
  const fy = end.y + ay * shift;
  const facing = Math.atan2(ny, nx);
  if (end.thing === "door") {
    const fire = roll(2) < FIRE_DOOR[map.zoneAt(end.cx, end.cy)];
    const x = fx + nx * FRAME_DEPTH;
    const y = fy + ny * FRAME_DEPTH;
    const reach = DOOR_W / 2 + FRAME;
    return [
      {
        key: key("door"),
        kind: "door",
        model: DOORS[fire ? "fire" : "wood"],
        x,
        y,
        h: 0,
        yaw: facing,
        pitch: 0,
        roll: 0,
        solid: { x, y, r: FRAME_DEPTH + 0.01, along: [ax * reach, ay * reach] },
        doorway: { x, y, yaw: facing, both: false },
      },
    ];
  }
  if (end.thing === "chair") {
    // Close up to the wall, facing it.
    const x = fx + nx * 0.2;
    const y = fy + ny * 0.2;
    const office = roll(3) < OFFICE_FURNITURE[map.zoneAt(end.cx, end.cy)];
    const pose = { x, y, h: 0, yaw: facing + Math.PI + (roll(4) - 0.5) * 0.2, pitch: 0, roll: 0 };
    return [
      {
        key: key("chair"),
        kind: "chair",
        model: buildChair(ORDINARY, office),
        office,
        ...pose,
        solid: { x, y, r: 0.2 },
        perch: perchOn(pose, chairSeat(ORDINARY), CHAIR_EDGE, 0.1),
      },
    ];
  }
  if (end.thing !== "vending") return [];
  // Back to the wall: one, or the two side by side, either way round.
  const pair = roll(5) < VEND_PAIR;
  const kinds: Vending[] = pair
    ? roll(6) < 0.5
      ? ["snack", "drink"]
      : ["drink", "snack"]
    : [roll(7) < VEND_DRINK ? "drink" : "snack"];
  const width = kinds.reduce((sum, k) => sum + VEND_W[k], 0) + (kinds.length - 1) * 0.01;
  let along = (pair ? 0 : shift) - width / 2;
  return kinds.map((kind, i) => {
    const t = along + VEND_W[kind] / 2;
    along += VEND_W[kind] + 0.01;
    const x = end.x + ax * t + nx * (VEND_D / 2 + 0.005);
    const y = end.y + ay * t + ny * (VEND_D / 2 + 0.005);
    const hw = VEND_W[kind] / 2;
    return {
      key: key(`vending${i}`),
      kind: "vending" as const,
      model: VENDING[kind],
      x,
      y,
      h: 0,
      yaw: facing,
      pitch: 0,
      roll: 0,
      solid: slab(x, y, ax * hw, ay * hw, VEND_D / 2 + 0.01),
    };
  });
}

/** The dead ends' things, by dead end and map: laid out once. */
const deadEndThings = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** Everything at the dead ends within `radius` of (x, y). */
function deadEndsAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  // Things stand a little off the far wall's middle: look a little further for the walls.
  for (const end of map.deadEndsNear(x, y, radius + 1)) {
    const key = `${end.cx},${end.cy},${end.side}`;
    within(laidOut(deadEndThings, map, key, () => deadEndIn(map, end)), x, y, radius, out);
  }
  return out;
}

// ---- the stairs ----

/*
 * A stair up, rarely, along a wall of a plain room (map.ts): bare concrete steps with a pale edge to each, a handrail
 * on the open side, the thirteenth step at the ceiling and the rest going on up through it to nowhere. Nobody goes up:
 * a no entry sign stands at its foot, or someone has heaped chairs on the bottom steps.
 */

/** The stair's atlas: a step's top with its pale front edge, a step's front, its side, the handrail. */
const TREAD: Rect = { x: 0, y: 0, w: 8, h: 8 };
const RISER: Rect = { x: 8, y: 0, w: 8, h: 8 };
const STRINGER: Rect = { x: 16, y: 0, w: 8, h: 8 };
const RAIL: Rect = { x: 24, y: 0, w: 8, h: 8 };
const STAIRS_ATLAS_W = 32;
const STAIRS_ATLAS_H = 8;

export const STAIRS_SKIN: StatueSkin = (() => {
  const W = STAIRS_ATLAS_W;
  const data = new Uint8ClampedArray(W * STAIRS_ATLAS_H * 4);
  const fill = (r: Rect, c: (x: number, y: number) => readonly number[]) => {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const o = ((r.y + y) * W + r.x + x) * 4;
        const [cr, cg, cb] = c(x, y);
        data[o] = cr;
        data[o + 1] = cg;
        data[o + 2] = cb;
        data[o + 3] = 255;
      }
    }
  };
  const concrete = (x: number, y: number, base: number) => {
    const v = base * (0.9 + 0.18 * grain(x, y + 700));
    return [v, v * 0.98, v * 0.94];
  };
  // The top of a step, its front edge (the atlas's top row, as the step's top is laid) worn pale.
  fill(TREAD, (x, y) => (y === 0 ? [196, 190, 170] : concrete(x, y, 150)));
  fill(RISER, (x, y) => concrete(x, y + 8, 118));
  fill(STRINGER, (x, y) => concrete(x, y + 16, 134));
  fill(RAIL, (x, y) => {
    const v = 150 * (0.94 + 0.1 * grain(x, y + 800));
    return [v, v, v * 1.04];
  });
  return { data };
})();

/** How many steps, how high each, how deep; the thirteenth's top is at the ceiling. */
const STAIRS_STEPS = 16;
const STEP_RISE = 1 / 13;
const STEP_TREAD = 0.127;
const STAIRS_LONG = STAIRS_STEPS * STEP_TREAD;
/** The handrail: how high over the steps' front edges, how thick, and a post every this many steps. */
const RAIL_H = 0.2;
const RAIL_T = 0.012;
const POST_EVERY = 4;

/** Makes the triangles pushed since `from` drawn from both sides. */
function bothSides(out: number[], from: number) {
  for (let i = from; i < out.length; i += 16) out[i + 15] = 2;
}

/**
 * The stair, its foot at the origin, going up along +z, `rail` the side its handrail is on (+1 for +x). Each step is
 * its top, its front, and its sides down to the floor; the back is one face up the far end.
 */
function buildStairs(rail: number): StatueModel {
  const tris: number[] = [];
  const hw = STAIRS_W / 2;
  for (let k = 0; k < STAIRS_STEPS; k++) {
    const y0 = k * STEP_RISE;
    const y1 = y0 + STEP_RISE;
    const zf = k * STEP_TREAD;
    const zb = zf + STEP_TREAD;
    quad(tris, [-hw, y1, zb], [hw, y1, zb], [hw, y1, zf], [-hw, y1, zf], TREAD);
    quad(tris, [hw, y0, zf], [-hw, y0, zf], [-hw, y1, zf], [hw, y1, zf], RISER);
    // Its band of the sides, from its front to the far end.
    quad(tris, [hw, y0, STAIRS_LONG], [hw, y0, zf], [hw, y1, zf], [hw, y1, STAIRS_LONG], STRINGER, Infinity);
    quad(tris, [-hw, y0, zf], [-hw, y0, STAIRS_LONG], [-hw, y1, STAIRS_LONG], [-hw, y1, zf], STRINGER, Infinity);
  }
  const top = STAIRS_STEPS * STEP_RISE;
  quad(tris, [-hw, 0, STAIRS_LONG], [hw, 0, STAIRS_LONG], [hw, top, STAIRS_LONG], [-hw, top, STAIRS_LONG], STRINGER);
  // The handrail: posts up from the steps' front edges, and the rail along their tops.
  const rx = rail * (hw - 0.02);
  for (let k = 0; k < STAIRS_STEPS; k += POST_EVERY) {
    const z = k * STEP_TREAD + STEP_TREAD / 2;
    const y = (k + 1) * STEP_RISE;
    box(tris, rx - 0.008, rx + 0.008, y, y + RAIL_H, z - 0.008, z + 0.008, RAIL, RAIL, RAIL);
  }
  const slope = STEP_RISE / STEP_TREAD;
  const at = (z: number, dy: number): V3 => [rx, STEP_RISE + RAIL_H + (z - STEP_TREAD / 2) * slope + dy, z];
  const from = tris.length;
  const [z0, z1] = [STEP_TREAD / 2 - 0.02, STAIRS_LONG];
  for (const [dx0, dy0, dx1, dy1] of [
    [-RAIL_T, RAIL_T, RAIL_T, RAIL_T],
    [-RAIL_T, -RAIL_T, RAIL_T, -RAIL_T],
    [-RAIL_T, -RAIL_T, -RAIL_T, RAIL_T],
    [RAIL_T, -RAIL_T, RAIL_T, RAIL_T],
  ]) {
    const a = at(z0, dy0 / 2);
    const b = at(z1, dy0 / 2);
    const c = at(z1, dy1 / 2);
    const d = at(z0, dy1 / 2);
    a[0] += dx0 / 2;
    b[0] += dx0 / 2;
    c[0] += dx1 / 2;
    d[0] += dx1 / 2;
    quad(tris, a, b, c, d, RAIL, Infinity);
  }
  bothSides(tris, from);
  return { tris, atlasWidth: STAIRS_ATLAS_W, atlasHeight: STAIRS_ATLAS_H, stone: [140, 136, 128] };
}

const STAIRS_MODELS: Record<number, StatueModel> = { [-1]: buildStairs(-1), 1: buildStairs(1) };

/** The stair in `plan`, and what blocks it, the same every time for this map. */
function stairsIn(map: WorldMap, plan: StairsPlan): Junk[] {
  const roll = (k: number) => map.noise(plan.cx * 71 + k, plan.cy, 990);
  const key = (name: string) => `u${plan.cx},${plan.cy}.${name}`;
  const { x, y, ax, ay, nx, ny } = plan;
  const yaw = Math.atan2(ay, ax);
  // Its own +x, in the place, is (sin yaw, −cos yaw): the rail goes on whichever side is away from the wall.
  const rail = Math.sin(yaw) * nx - Math.cos(yaw) * ny > 0 ? 1 : -1;
  const half = STAIRS_LONG / 2;
  const out: Junk[] = [
    {
      key: key("stairs"),
      kind: "stairs",
      model: STAIRS_MODELS[rail],
      x,
      y,
      h: 0,
      yaw,
      pitch: 0,
      roll: 0,
      solid: slab(x + ax * half, y + ay * half, ax * half, ay * half, STAIRS_W / 2 + 0.01),
    },
  ];
  if (plan.block === "sign") {
    // No entry, standing just off its foot, facing whoever comes.
    const sx = x - ax * 0.22 + (roll(1) - 0.5) * 0.06;
    const sy = y - ay * 0.22 + (roll(2) - 0.5) * 0.06;
    const facing = yaw + Math.PI + (roll(3) - 0.5) * 0.3;
    const pose = { x: sx, y: sy, h: 0, yaw: facing, pitch: 0, roll: 0 };
    out.push({
      key: key("sign"),
      kind: "sign",
      model: signModel("noEntry", SIGN_MIDDLE, false),
      ...pose,
      solid: { x: sx, y: sy, r: 0.1 },
      plate: plateOf(pose, SIGN_MIDDLE),
    });
    return out;
  }
  // A heap of chairs: one at the foot, facing up the stair, another upside down on its seat, one on its side up the
  // steps, and now and then one more on top of that.
  const office = roll(4) < OFFICE_FURNITURE[map.zoneAt(plan.cx, plan.cy)];
  const model = buildChair(ORDINARY, office);
  const seat = chairSeat(ORDINARY);
  const chair = (name: string, cx: number, cy: number, h: number, turn: number, tilt: number, solid: Solid | null) =>
    out.push({ key: key(name), kind: "chair", model, office, x: cx, y: cy, h, yaw: turn, pitch: 0, roll: tilt, solid });
  const bx = x + ax * 0.05;
  const by = y + ay * 0.05;
  chair("chair0", bx, by, 0, yaw + (roll(5) - 0.5) * 0.4, 0, { x: bx, y: by, r: 0.22 });
  chair("chair1", bx, by, seat * 2 + 0.01, yaw + (roll(6) - 0.5) * 1.2, Math.PI, null);
  // On its side two steps up, as if thrown.
  const up = 2.5 * STEP_TREAD;
  chair("chair2", x + ax * up, y + ay * up, 3 * STEP_RISE + 0.11, roll(7) * Math.PI * 2, Math.PI / 2, null);
  if (roll(8) < 0.5) {
    const higher = 4.5 * STEP_TREAD;
    const turn = yaw + Math.PI + (roll(9) - 0.5) * 0.8;
    chair("chair3", x + ax * higher, y + ay * higher, 5 * STEP_RISE, turn, 0, null);
  }
  return out;
}

/** The stairs' things, by room and map: laid out once. */
const stairsThings = new WeakMap<WorldMap, Map<string, Junk[]>>();

/** Every stair, and what blocks it, within `radius` of (x, y). */
function stairsAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  for (let ly = Math.floor((y - radius) / 5); ly <= Math.floor((y + radius) / 5); ly++) {
    for (let lx = Math.floor((x - radius) / 5); lx <= Math.floor((x + radius) / 5); lx++) {
      const plan = map.stairsIn(lx, ly);
      if (plan) within(laidOut(stairsThings, map, `${lx},${ly}`, () => stairsIn(map, plan)), x, y, radius, out);
    }
  }
  return out;
}

// ---- the camp ----

/*
 * A camp, where one of the lost lived for a while, and isn't any more: a bare mattress on the floor in a corner, a
 * blanket thrown back off it and a pillow at its head; empty tins everywhere round it, some stood up, some on their
 * sides, and sometimes a careful pyramid of them against a wall; sometimes a small cabinet at the bed's head with a
 * tin on it, a chair by the bed turned to the wall with the count on it (graffiti.ts), and, where there's a second
 * door, a desk turned over and pushed across it, so there's only one way in.
 */

/** The camp's atlas: mattress ticking, the blanket, the pillow, a tin's label, its bare metal. */
const TICKING: Rect = { x: 0, y: 0, w: 32, h: 16 };
const BLANKET: Rect = { x: 32, y: 0, w: 32, h: 16 };
const PILLOW: Rect = { x: 0, y: 16, w: 16, h: 16 };
const LABEL: Rect = { x: 16, y: 16, w: 16, h: 16 };
const TIN: Rect = { x: 32, y: 16, w: 8, h: 8 };
const CAMP_ATLAS_W = 64;
const CAMP_ATLAS_H = 32;

export const CAMP_SKIN: StatueSkin = (() => {
  const W = CAMP_ATLAS_W;
  const data = new Uint8ClampedArray(W * CAMP_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const noise = (x: number, y: number) => 0.92 + 0.1 * grain(x, y + 800);
  // Ticking: off-white with thin blue-grey stripes along it, and brown stains spreading where someone lay.
  for (let y = 0; y < TICKING.h; y++) {
    for (let x = 0; x < TICKING.w; x++) {
      let c = y % 4 === 1 ? [120, 130, 150] : [214, 206, 186];
      const stain = Math.hypot((x - 11) / 7, (y - 8) / 5) + 0.3 * grain(x, y + 801);
      if (stain < 1) c = c.map((v, i) => v * (0.7 + 0.25 * stain) * [1, 0.92, 0.8][i]);
      put(TICKING.x + x, TICKING.y + y, c, noise(x, y));
    }
  }
  // The blanket: a dull army green wool, a darker stripe near each end.
  for (let y = 0; y < BLANKET.h; y++) {
    for (let x = 0; x < BLANKET.w; x++) {
      const band = x === 3 || x === 4 || x === BLANKET.w - 5 || x === BLANKET.w - 4;
      put(BLANKET.x + x, BLANKET.y + y, [92, 98, 66], (band ? 0.72 : 1) * (0.9 + 0.12 * grain(x, y + 802)));
    }
  }
  // The pillow: a grey-white case gone yellow in the middle.
  for (let y = 0; y < PILLOW.h; y++) {
    for (let x = 0; x < PILLOW.w; x++) {
      const yellow = Math.hypot(x - 8, y - 8) < 4;
      put(PILLOW.x + x, PILLOW.y + y, yellow ? [200, 188, 150] : [204, 204, 198], noise(x, y + 30));
    }
  }
  // A tin's label: red, a white band round the middle with a few dark marks for the writing; rust at the rims.
  for (let y = 0; y < LABEL.h; y++) {
    for (let x = 0; x < LABEL.w; x++) {
      let c = [168, 40, 32];
      if (y >= 6 && y <= 9) c = [228, 222, 204];
      if (y === 7 && x % 3 !== 0 && x > 2 && x < 13) c = [60, 40, 36];
      if (y === 0 || y === LABEL.h - 1) c = [120, 84, 56];
      put(LABEL.x + x, LABEL.y + y, c, noise(x, y + 60));
    }
  }
  for (let y = 0; y < TIN.h; y++) {
    for (let x = 0; x < TIN.w; x++) put(TIN.x + x, TIN.y + y, [170, 172, 168], noise(x, y + 90));
  }
  return { data };
})();

/** A box painted all round with one rect of the camp's atlas. */
function campBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, rect: Rect) {
  const tris: number[] = [];
  box(tris, x0, x1, y0, y1, z0, z1, rect, rect, rect);
  return tris;
}

/** The mattress: its length, width (across, along z) and thickness. */
const MATTRESS = [0.95, 0.45, 0.11] as const;
/** The blanket: length, width, thickness; and the part of it folded back over itself. */
const BLANKET_SIZE = [0.6, 0.47, 0.02] as const;
const BLANKET_FOLD = 0.16;
const PILLOW_SIZE = [0.13, 0.22, 0.045] as const;
/** A tin's radius and height. */
const TIN_R = 0.024;
const TIN_H = 0.06;

const campModel = (tris: number[], stone: readonly [number, number, number]): StatueModel => ({
  tris,
  atlasWidth: CAMP_ATLAS_W,
  atlasHeight: CAMP_ATLAS_H,
  stone,
});

const MATTRESS_MODEL = campModel(
  campBox(-MATTRESS[0] / 2, MATTRESS[0] / 2, 0, MATTRESS[2], -MATTRESS[1] / 2, MATTRESS[1] / 2, TICKING),
  [214, 206, 186],
);
const BLANKET_MODEL = (() => {
  const [l, w, t] = BLANKET_SIZE;
  const tris = campBox(-l / 2, l / 2, 0, t, -w / 2, w / 2, BLANKET);
  // Its end folded back on top of it, at the head end.
  tris.push(...campBox(-l / 2, -l / 2 + BLANKET_FOLD, t, t * 2, -w / 2, w / 2, BLANKET));
  return campModel(tris, [92, 98, 66]);
})();
const PILLOW_MODEL = campModel(
  campBox(-PILLOW_SIZE[0] / 2, PILLOW_SIZE[0] / 2, 0, PILLOW_SIZE[2], -PILLOW_SIZE[1] / 2, PILLOW_SIZE[1] / 2, PILLOW),
  [204, 204, 198],
);
/**
 * An open cup of eight sides, its foot at 0 and its mouth at `h`, hollow so it can be seen into: `side` round the
 * outside, `inside` on its inner wall and floor, `rim` round its lip and under its foot; its wall `wall` thick and
 * its floor `floor` thick.
 */
function hollowCup(
  out: number[],
  r: number,
  h: number,
  wall: number,
  floor: number,
  side: Rect,
  inside: Rect,
  rim: Rect,
) {
  const n = 8;
  const ri = r - wall;
  const at = (k: number, radius: number, y: number): V3 => {
    const a = (k / n) * Math.PI * 2;
    return [Math.cos(a) * radius, y, Math.sin(a) * radius];
  };
  for (let k = 0; k < n; k++) {
    const u = { x: side.x + (k * side.w) / n, y: side.y, w: side.w / n, h: side.h };
    quad(out, at(k + 1, r, 0), at(k, r, 0), at(k, r, h), at(k + 1, r, h), u);
    // The inner wall, facing in; the lip; the floor inside; the foot. Fans from the middle are quads with their
    // first and last corners the same.
    quad(out, at(k, ri, floor), at(k + 1, ri, floor), at(k + 1, ri, h), at(k, ri, h), inside);
    quad(out, at(k + 1, ri, h), at(k + 1, r, h), at(k, r, h), at(k, ri, h), rim);
    quad(out, [0, floor, 0], at(k + 1, ri, floor), at(k, ri, floor), [0, floor, 0], inside);
    quad(out, [0, 0, 0], at(k, r, 0), at(k + 1, r, 0), [0, 0, 0], rim);
  }
}

/** A tin, opened and empty: its label round it, bare metal inside. */
const TIN_MODEL = (() => {
  const tris: number[] = [];
  hollowCup(tris, TIN_R, TIN_H, 0.0015, 0.003, LABEL, TIN, TIN);
  return campModel(tris, [168, 40, 32]);
})();

/** How many tins lie about, at least and at most; how likely a pyramid of them, a cabinet, a chair, a barricade. */
const CAMP_TINS = [8, 14] as const;
const CAMP_PYRAMID = 0.5;
const CAMP_STAND = 0.5;
const CAMP_CHAIR = 0.4;
const CAMP_BARRICADE = 0.7;
/** How many tins lie on their sides. */
const TIN_FALLEN = 0.4;

/** Everything in camp `plan` in lattice room (lx, ly), the same every time for this map. */
function campIn(map: WorldMap, lx: number, ly: number, plan: FittedPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 43 + k, ly, 960);
  const out: Junk[] = [];
  const key = (name: string) => `w${lx},${ly}.${name}`;
  const pyramid = roll(1) < CAMP_PYRAMID;
  const stand = roll(2) < CAMP_STAND;
  const withChair = roll(3) < CAMP_CHAIR;
  const barricade = plan.doors.length > 1 && roll(4) < CAMP_BARRICADE;
  const office = roll(6) < OFFICE_FURNITURE[map.zoneAt(plan.x0, plan.y0)];

  const taken: { x: number; y: number; r: number }[] = [];
  plan.doors.forEach(([side, cell], i) => {
    // The barricaded door needn't be kept clear: the barricade's in it.
    if (barricade && i === 1) return;
    const [x, y] = onWall(plan, side, cell - 0.5, DOOR_CLEAR_OUT);
    taken.push({ x, y, r: DOOR_CLEAR });
  });
  // Clear of everything else by r, and of the walls by `wall` (less, for what's backed up to one).
  const free = (x: number, y: number, r: number, wall = r) =>
    x - wall > plan.x0 &&
    y - wall > plan.y0 &&
    x + wall < plan.x0 + FITTED_SIZE &&
    y + wall < plan.y0 + FITTED_SIZE &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const put = (
    name: string,
    kind: JunkKind,
    model: StatueModel,
    pose: Pose,
    solid: Solid | null,
    perch: Perch | null = null,
  ) => {
    out.push({ key: key(name), kind, model, ...pose, solid, perch });
  };

  // The bed: from its corner, `ux` along the wall it lies on, `uy` out from that wall.
  const bed = campBed(plan, (k) => map.noise(plan.x0, plan.y0, 940 + k));
  const west = bed.corner % 2 === 0;
  const north = bed.corner < 2;
  const cx = west ? plan.x0 : plan.x0 + FITTED_SIZE;
  const cy = north ? plan.y0 : plan.y0 + FITTED_SIZE;
  const [ux, uy] = bed.alongX ? [west ? 1 : -1, 0] : [0, north ? 1 : -1];
  const [vx, vy] = bed.alongX ? [0, north ? 1 : -1] : [west ? 1 : -1, 0];
  // A point a along the wall from the corner and b out from it.
  const at = (a: number, b: number): [number, number] => [cx + ux * a + vx * b, cy + uy * a + vy * b];
  const outward = Math.atan2(vy, vx);
  const [ml, mw, mt] = MATTRESS;
  const [bx, by] = at(0.03 + ml / 2, 0.03 + mw / 2);
  const mattress = { x: bx, y: by, h: 0, yaw: outward + (roll(10) - 0.5) * 0.06, pitch: 0, roll: 0 };
  const bedSolid = slab(bx, by, ux * (ml / 2), uy * (ml / 2), mw / 2);
  // XN sits on it (xnPlaces.ts): its perch is its middle, facing out into the room.
  put("mattress", "bedding", MATTRESS_MODEL, mattress, bedSolid, perchOn(mattress, mt, mw / 2, 0.1));
  for (const k of [-1, 0, 1]) taken.push({ x: bx + ux * k * 0.33, y: by + uy * k * 0.33, r: mw / 2 + 0.02 });
  // The blanket over its foot end, thrown back askew; its folded end toward the head.
  const along = 0.03 + ml - BLANKET_SIZE[0] / 2 + (roll(11) - 0.5) * 0.1;
  const [kx, ky] = at(along, 0.03 + mw / 2 + (roll(12) - 0.5) * 0.06);
  // The blanket's own length runs along x, which a yaw turns to (sin, −cos): this one from the head to the foot.
  const toFoot = Math.atan2(ux, -uy);
  const blanket = { x: kx, y: ky, h: mt, yaw: toFoot + (roll(13) - 0.5) * 0.3, pitch: 0, roll: 0 };
  put("blanket", "bedding", BLANKET_MODEL, blanket, null);
  // The pillow at its head, crooked.
  const [px, py] = at(0.03 + 0.1, 0.03 + mw / 2 + (roll(14) - 0.5) * 0.08);
  const pillow = { x: px, y: py, h: mt, yaw: outward + (roll(15) - 0.5) * 0.5, pitch: 0, roll: 0 };
  put("pillow", "bedding", PILLOW_MODEL, pillow, null);

  // A tin, standing or on its side.
  let tins = 0;
  const tin = (x: number, y: number, h: number, r: (k: number) => number, fallen = r(0) < TIN_FALLEN) => {
    const pose = { x, y, h: fallen ? h + TIN_R : h, yaw: r(1) * Math.PI * 2, pitch: fallen ? Math.PI / 2 : 0, roll: 0 };
    put(`tin${tins++}`, "can", TIN_MODEL, pose, null);
  };

  // A small cabinet at the bed's head, against the wall there, a tin on top.
  if (stand) {
    const shape: CabinetShape = { drawers: 2, width: 0.2, depth: 0.2, pulled: [0, roll(20) < 0.3 ? 0.06 : 0] };
    const [sx, sy] = at(0.005 + shape.depth / 2, 0.03 + mw + 0.06 + shape.width / 2);
    const yaw = Math.atan2(uy, ux);
    if (free(sx, sy, 0.13, 0.1)) {
      const pose = { x: sx, y: sy, h: 0, yaw, pitch: 0, roll: 0 };
      const solid = slab(sx, sy, ux * 0.1, uy * 0.1, 0.11);
      put("stand", "cabinet", buildCabinet(shape), pose, solid, perchOn(pose, cabinetHeight(shape), 0.1, 0.1));
      taken.push({ x: sx, y: sy, r: 0.14 });
      tin(sx, sy, cabinetHeight(shape), (k) => roll(21 + k), false);
    }
  }

  // A chair by the foot of the bed, turned to the wall it lies along, where the count is.
  if (withChair) {
    const [hx, hy] = at(0.03 + ml + 0.35, 0.32);
    if (free(hx, hy, 0.22)) {
      const chair = { x: hx, y: hy, h: 0, yaw: Math.atan2(-vy, -vx) + (roll(25) - 0.5) * 0.3, pitch: 0, roll: 0 };
      out.push({
        key: key("chair"),
        kind: "chair",
        model: buildChair(ORDINARY, office),
        office,
        ...chair,
        solid: { x: hx, y: hy, r: 0.2 },
        perch: perchOn(chair, chairSeat(ORDINARY), CHAIR_EDGE, 0.1),
      });
      taken.push({ x: hx, y: hy, r: 0.22 });
    }
  }

  // The second door barricaded: a desk tipped over onto its back and pushed up to the doorway, its legs to it, its
  // top standing across it.
  if (barricade) {
    const [side, cell] = plan.doors[1];
    const shape = WORK_DESK;
    const hl = shape.length / 2;
    const into = inward(side);
    const [dx, dy] = onWall(plan, side, cell - 0.5, 0.01);
    const [fx, fy] = INWARD[side];
    // Tipped back about its own width-wise axis: up becomes out of the door, into the room.
    const pose = { x: dx, y: dy, h: shape.depth / 2, yaw: into + (roll(30) - 0.5) * 0.12, pitch: Math.PI / 2, roll: 0 };
    const [tx, ty] = [dx + fx * shape.height, dy + fy * shape.height];
    out.push({
      key: key("barricade"),
      kind: "desk",
      model: buildDesk(shape, office),
      office,
      ...pose,
      solid: slab(dx + fx * shape.height * 0.5, dy + fy * shape.height * 0.5, -fy * hl, fx * hl, shape.height * 0.5 + 0.02),
    });
    taken.push({ x: tx, y: ty, r: 0.45 });
  }

  // A pyramid of tins against a wall, a row of four, three, two, one; wherever there's room for it.
  if (pyramid) {
    const step = TIN_R * 2 + 0.004;
    for (let k = 0; k < 10; k++) {
      const side = Math.floor(roll(40 + k) * 4);
      const t = 0.4 + roll(50 + k) * 3.2;
      const [mx, my] = onWall(plan, side, t, TIN_R + 0.01);
      if (!free(mx, my, step * 2.2, TIN_R)) continue;
      const [fx, fy] = INWARD[side];
      for (let level = 0; level < 4; level++) {
        for (let i = 0; i < 4 - level; i++) {
          const a = (i - (3 - level) / 2) * step;
          tin(mx - fy * a, my + fx * a, level * TIN_H, (j) => roll(60 + level * 4 + i + j * 7), false);
        }
      }
      out[out.length - 10].solid = slab(mx, my, -fy * step * 2, fx * step * 2, TIN_R + 0.01);
      taken.push({ x: mx, y: my, r: step * 2.2 });
      break;
    }
  }

  // Empty tins about the bed, thinning out away from it.
  const [least, most] = CAMP_TINS;
  const count = least + Math.floor(roll(80) * (most - least + 1));
  let strewn = 0;
  for (let k = 0; k < count * 3 && strewn < count; k++) {
    const r = (j: number) => roll(100 + k * 5 + j);
    const a = 0.03 + r(0) * (ml + 0.4);
    const b = 0.03 + mw + 0.04 + r(1) * r(1) * 0.9;
    const [x, y] = at(a, b);
    if (!free(x, y, TIN_R + 0.01)) continue;
    tin(x, y, 0, (j) => r(2 + j));
    taken.push({ x, y, r: TIN_R + 0.01 });
    strewn++;
  }
  return out;
}

// ---- the pantry ----

/*
 * A pantry, the little kitchen off an office corridor: a run of base cupboards along one wall with a worktop, a sink
 * let into it and a tap, wall cupboards over it, a microwave on it; a fridge in the corner at its end; a water cooler
 * against another wall; a small table with two chairs; mugs left about. Sometimes the chairs are up on the table
 * upside down, as if someone closed up for the night; sometimes a wet floor sign by the sink; sometimes thirteen mugs
 * in a row along the worktop's edge, all their handles the same way; now and then the fridge turned to the wall.
 */

/** The pantry's atlas: cupboard doors, the worktop, the sink, bright steel, the fridge, white sides, the microwave's
 * front, the water cooler, its bottle, a mug. */
const CUPBOARD: Rect = { x: 0, y: 0, w: 32, h: 16 };
const WORKTOP: Rect = { x: 32, y: 0, w: 32, h: 16 };
const SINK: Rect = { x: 0, y: 16, w: 16, h: 16 };
const CHROME: Rect = { x: 16, y: 16, w: 8, h: 8 };
const FRIDGE: Rect = { x: 32, y: 16, w: 16, h: 32 };
const WHITE: Rect = { x: 48, y: 16, w: 8, h: 8 };
const MICROWAVE: Rect = { x: 0, y: 32, w: 16, h: 8 };
/** The water cooler's drip tray grille, the inside of its recess, and its two taps. */
const GRILLE: Rect = { x: 16, y: 32, w: 8, h: 8 };
const RECESS: Rect = { x: 16, y: 40, w: 4, h: 8 };
const TAP_HOT: Rect = { x: 20, y: 40, w: 2, h: 8 };
const TAP_COLD: Rect = { x: 22, y: 40, w: 2, h: 8 };
const BOTTLE: Rect = { x: 24, y: 32, w: 8, h: 16 };
const MUG: Rect = { x: 56, y: 16, w: 8, h: 8 };
const KITCHEN_ATLAS_W = 64;
const KITCHEN_ATLAS_H = 48;

export const KITCHEN_SKIN: StatueSkin = (() => {
  const W = KITCHEN_ATLAS_W;
  const data = new Uint8ClampedArray(W * KITCHEN_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const noise = (x: number, y: number) => 0.94 + 0.08 * grain(x, y + 900);
  // `shade` darkens or lightens each pixel; by default, none.
  const fill = (r: Rect, colour: (x: number, y: number) => readonly number[], shade?: (x: number, y: number) => number) => {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) put(r.x + x, r.y + y, colour(x, y), (shade?.(x, y) ?? 1) * noise(x + r.x, y + r.y));
    }
  };
  const CREAM = [222, 216, 196];
  // Two cupboard doors: cream, a dark gap between them and round the edge, a short bar handle each by the gap.
  fill(CUPBOARD, (x, y) => {
    if (x === 0 || x === 15 || x === 16 || x === 31 || y === 0 || y === 15) return [96, 92, 82];
    if ((x === 13 || x === 18) && y >= 3 && y <= 6) return [150, 152, 150];
    return CREAM;
  });
  // The worktop: grey laminate with a fine dark speckle.
  fill(WORKTOP, (x, y) => (grain(x, y + 910) > 0.9 ? [92, 92, 90] : [168, 166, 160]));
  // The sink: a steel basin in a rim, darker toward the drain in the middle.
  fill(SINK, (x, y) => {
    const rim = x <= 1 || y <= 1 || x >= 14 || y >= 14;
    if (rim) return [186, 188, 188];
    const d = Math.hypot(x - 7.5, y - 7.5);
    return d < 1.5 ? [40, 40, 42] : [120 + d * 6, 122 + d * 6, 124 + d * 6];
  });
  fill(CHROME, () => [200, 204, 206]);
  // The fridge's door: white, the freezer's door at the top, a long handle down each.
  fill(FRIDGE, (x, y) => {
    if (y === 9 || x === 0 || x === 15 || y === 0 || y === 31) return [150, 150, 146];
    if (x === 2 && ((y >= 2 && y <= 7) || (y >= 12 && y <= 22))) return [120, 120, 118];
    return [232, 232, 226];
  });
  fill(WHITE, () => [226, 226, 220]);
  // The microwave: a dark window on the left, a panel of buttons on the right.
  fill(MICROWAVE, (x, y) => {
    if (x >= 1 && x <= 10 && y >= 1 && y <= 6) return [34, 36, 34];
    if (x >= 12 && x <= 14 && y % 2 === 1) return [70, 70, 70];
    return [214, 212, 204];
  });
  // The water cooler: a dark grey grille over its drip tray, a paler grey inside its recess, a red tap and a blue.
  fill(GRILLE, (x) => (x % 2 === 0 ? [40, 42, 44] : [96, 98, 100]));
  fill(RECESS, () => [150, 152, 150]);
  fill(TAP_HOT, () => [190, 40, 34]);
  fill(TAP_COLD, () => [40, 80, 190]);
  // Its bottle: pale clear blue, darker where it's thicker at the sides, a band of label.
  fill(
    BOTTLE,
    (_x, y) => (y >= 6 && y <= 8 ? [220, 232, 240] : [120, 170, 210]),
    (x) => 1 - 0.12 * Math.abs(x - 3.5) / 3.5,
  );
  // A mug: white, a ring of colour round its rim.
  fill(MUG, (_x, y) => (y <= 1 ? [180, 60, 50] : [236, 234, 228]));
  return { data };
})();

/** A box as `box` makes it, but its top painted with `top`. */
function topBox(
  out: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  front: Rect,
  side: Rect,
  top: Rect,
) {
  quad(out, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front);
  quad(out, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side);
  quad(out, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side);
  quad(out, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
  quad(out, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  quad(out, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], side);
}

/** An upright cylinder of eight sides, its foot at 0: `side` round it, `top` on its lid and its foot. */
function cylinder(out: number[], r: number, y0: number, y1: number, side: Rect, top: Rect) {
  const n = 8;
  const at = (k: number): [number, number] => {
    const a = (k / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  for (let k = 0; k < n; k++) {
    const [ax, az] = at(k);
    const [bx, bz] = at(k + 1);
    const u = { x: side.x + (k * side.w) / n, y: side.y, w: side.w / n, h: side.h };
    quad(out, [bx, y0, bz], [ax, y0, az], [ax, y1, az], [bx, y1, bz], u);
    quad(out, [0, y1, 0], [bx, y1, bz], [ax, y1, az], [0, y1, 0], top);
    quad(out, [0, y0, 0], [ax, y0, az], [bx, y0, bz], [0, y0, 0], top);
  }
}

const kitchenModel = (tris: number[], stone: readonly [number, number, number]): StatueModel => ({
  tris,
  atlasWidth: KITCHEN_ATLAS_W,
  atlasHeight: KITCHEN_ATLAS_H,
  stone,
});

/** A unit of the counter: how long, deep and high; the worktop's thickness and how far it overhangs the doors. */
const UNIT = 0.5;
const COUNTER_D = 0.3;
const COUNTER_H = 0.36;
const WORKTOP_T = 0.025;
const WORKTOP_OVER = 0.015;
/** The sink's basin: half its width, how far its mouth is from the worktop's back and front edges, how deep it is. */
const SINK_HALF = 0.16;
const SINK_BACK = 0.06;
const SINK_FRONT = 0.035;
const SINK_DEEP = 0.09;
/** Wall cupboards: from how high to how high, and how deep. */
const WALL_UNIT_Y = [0.6, 0.84] as const;
const WALL_UNIT_D = 0.15;

/** One unit of the counter, its back at z = −COUNTER_D / 2: cupboards under a length of worktop, or the sink. */
function counterUnit(sink: boolean): StatueModel {
  const tris: number[] = [];
  const hl = UNIT / 2;
  const hd = COUNTER_D / 2;
  const under = COUNTER_H - WORKTOP_T;
  const x0 = -hl + 0.002;
  const x1 = hl - 0.002;
  const z1 = hd - WORKTOP_OVER;
  if (!sink) {
    box(tris, x0, x1, 0, under, -hd, z1, CUPBOARD, WHITE, WHITE);
    topBox(tris, -hl, hl, under, COUNTER_H, -hd, hd, WORKTOP, WORKTOP, WORKTOP);
  } else {
    // The cupboards, with no top: the basin sinks down into them.
    quad(tris, [x0, 0, z1], [x1, 0, z1], [x1, under, z1], [x0, under, z1], CUPBOARD);
    quad(tris, [x1, 0, -hd], [x0, 0, -hd], [x0, under, -hd], [x1, under, -hd], WHITE);
    quad(tris, [x1, 0, z1], [x1, 0, -hd], [x1, under, -hd], [x1, under, z1], WHITE);
    quad(tris, [x0, 0, -hd], [x0, 0, z1], [x0, under, z1], [x0, under, -hd], WHITE);
    quad(tris, [x0, 0, -hd], [x1, 0, -hd], [x1, 0, z1], [x0, 0, z1], WHITE);
    // The worktop round the basin's mouth: a strip behind it (for the tap), one in front, one either side.
    const [bw, b0, b1] = [SINK_HALF, -hd + SINK_BACK, hd - SINK_FRONT];
    const top = (xa: number, xb: number, za: number, zb: number) =>
      topBox(tris, xa, xb, under, COUNTER_H, za, zb, WORKTOP, WORKTOP, WORKTOP);
    top(-hl, hl, -hd, b0);
    top(-hl, hl, b1, hd);
    top(-hl, -bw, b0, b1);
    top(bw, hl, b0, b1);
    // The basin under the mouth, its walls facing in, down to its floor with the drain in it. Its walls stop at the
    // worktop's underside; the worktop's own edges go on up from there.
    const yb = COUNTER_H - SINK_DEEP;
    quad(tris, [-bw, yb, b0], [bw, yb, b0], [bw, under, b0], [-bw, under, b0], CHROME);
    quad(tris, [bw, yb, b1], [-bw, yb, b1], [-bw, under, b1], [bw, under, b1], CHROME);
    quad(tris, [-bw, yb, b1], [-bw, yb, b0], [-bw, under, b0], [-bw, under, b1], CHROME);
    quad(tris, [bw, yb, b0], [bw, yb, b1], [bw, under, b1], [bw, under, b0], CHROME);
    quad(tris, [-bw, yb, b1], [bw, yb, b1], [bw, yb, b0], [-bw, yb, b0], SINK);
  }
  if (sink) {
    // The tap at the back: a post, and a spout out over the basin.
    box(tris, -0.008, 0.008, COUNTER_H, COUNTER_H + 0.08, -hd + 0.02, -hd + 0.036, CHROME, CHROME, CHROME);
    box(tris, -0.006, 0.006, COUNTER_H + 0.066, COUNTER_H + 0.078, -hd + 0.036, -hd + 0.1, CHROME, CHROME, CHROME);
  }
  return kitchenModel(tris, [222, 216, 196]);
}
const COUNTER_UNIT = counterUnit(false);
const SINK_UNIT = counterUnit(true);
const WALL_UNIT = (() => {
  const tris: number[] = [];
  box(tris, -UNIT / 2 + 0.002, UNIT / 2 - 0.002, WALL_UNIT_Y[0], WALL_UNIT_Y[1], -WALL_UNIT_D / 2, WALL_UNIT_D / 2, CUPBOARD, WHITE, WHITE);
  return kitchenModel(tris, [222, 216, 196]);
})();
/** The fridge: width, depth, height. */
const FRIDGE_SIZE = [0.32, 0.3, 0.86] as const;
const FRIDGE_MODEL = (() => {
  const [w, d, h] = FRIDGE_SIZE;
  const tris: number[] = [];
  box(tris, -w / 2, w / 2, 0, h, -d / 2, d / 2, FRIDGE, WHITE, WHITE);
  return kitchenModel(tris, [232, 232, 226]);
})();
const MICROWAVE_SIZE = [0.2, 0.12, 0.14] as const;
const MICROWAVE_MODEL = (() => {
  const [w, h, d] = MICROWAVE_SIZE;
  const tris: number[] = [];
  box(tris, -w / 2, w / 2, 0, h, -d / 2, d / 2, MICROWAVE, WHITE, WHITE);
  return kitchenModel(tris, [214, 212, 204]);
})();
/** The water cooler: its body's width and height, its bottle's radius and height. */
const COOLER_W = 0.16;
const COOLER_H = 0.46;
const BOTTLE_R = 0.065;
const BOTTLE_H = 0.2;
/** The recess in its front the taps are in: from how high to how high, half its width, and how deep. */
const COOLER_RECESS = [0.25, 0.36] as const;
const COOLER_RECESS_HALF = 0.055;
const COOLER_RECESS_DEEP = 0.06;
const COOLER_MODEL = (() => {
  const tris: number[] = [];
  const h = COOLER_W / 2;
  const [r0, r1] = COOLER_RECESS;
  const a = COOLER_RECESS_HALF;
  const back = h - COOLER_RECESS_DEEP;
  const white = (x0: number, x1: number, y0: number, y1: number) => box(tris, x0, x1, y0, y1, -h, h, WHITE, WHITE, WHITE);
  // Below the recess and above it, whole; beside it, a post either side; behind it, its back. Its floor is the top of
  // the part below, its roof the underside of the part above.
  white(-h, h, 0, r0);
  white(-h, h, r1, COOLER_H);
  white(-h, -a, r0, r1);
  white(a, h, r0, r1);
  box(tris, -a, a, r0, r1, -h, back, RECESS, RECESS, RECESS);
  // The drip tray's grille on its floor, and the two taps hanging from its roof.
  topBox(tris, -a + 0.004, a - 0.004, r0, r0 + 0.008, back + 0.004, h - 0.004, WHITE, WHITE, GRILLE);
  for (const [x, tap] of [[-0.024, TAP_HOT], [0.024, TAP_COLD]] as const) {
    box(tris, x - 0.008, x + 0.008, r1 - 0.03, r1, back + 0.012, back + 0.03, tap, tap, tap);
  }
  cylinder(tris, BOTTLE_R, COOLER_H, COOLER_H + BOTTLE_H, BOTTLE, BOTTLE);
  return kitchenModel(tris, [226, 226, 220]);
})();
/** A mug: radius and height; its handle is toward −x. */
const MUG_R = 0.018;
const MUG_H = 0.036;
const MUG_MODEL = (() => {
  const tris: number[] = [];
  hollowCup(tris, MUG_R, MUG_H, 0.003, 0.005, MUG, WHITE, WHITE);
  // The handle, a loop: an arm out at the top and at the bottom, and the grip down between them, a hole inside.
  const part = (x0: number, x1: number, y0: number, y1: number) =>
    box(tris, x0, x1, y0, y1, -0.003, 0.003, WHITE, WHITE, WHITE);
  const reach = -MUG_R - 0.012;
  part(reach, -MUG_R + 0.002, MUG_H - 0.01, MUG_H - 0.004);
  part(reach, -MUG_R + 0.002, 0.008, 0.014);
  part(reach, reach + 0.005, 0.014, MUG_H - 0.01);
  return kitchenModel(tris, [236, 234, 228]);
})();
/** The table: small and square, and its height. */
const PANTRY_TABLE: DeskShape = { length: 0.42, depth: 0.42, height: 0.3, legs: 2, drawer: false };

/** How many units of counter, at least and at most; how likely each extra. */
const PANTRY_UNITS = [3, 4] as const;
const PANTRY_WALL_UNITS = 0.7;
const PANTRY_COOLER = 0.6;
const PANTRY_TABLE_CHANCE = 0.8;
const PANTRY_CHAIRS_UP = 0.2;
const PANTRY_WET = 0.35;
const PANTRY_MUG_ROW = 0.25;
const PANTRY_FRIDGE_AWAY = 0.12;
/** How many mugs in the row, all handles one way. */
const MUG_ROW = 13;

/** Everything in pantry `plan` in lattice room (lx, ly), the same every time for this map. */
function pantryIn(map: WorldMap, lx: number, ly: number, plan: FittedPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 47 + k, ly, 970);
  const out: Junk[] = [];
  const key = (name: string) => `w${lx},${ly}.${name}`;
  const wallUnits = roll(1) < PANTRY_WALL_UNITS;
  const cooler = roll(2) < PANTRY_COOLER;
  const table = roll(3) < PANTRY_TABLE_CHANCE;
  const chairsUp = table && roll(4) < PANTRY_CHAIRS_UP;
  const wet = roll(5) < PANTRY_WET;
  const mugRow = roll(6) < PANTRY_MUG_ROW;
  const fridgeAway = roll(7) < PANTRY_FRIDGE_AWAY;
  const office = roll(8) < OFFICE_FURNITURE[map.zoneAt(plan.x0, plan.y0)];

  const taken: { x: number; y: number; r: number }[] = [];
  for (const [side, cell] of plan.doors) {
    const [x, y] = onWall(plan, side, cell - 0.5, DOOR_CLEAR_OUT);
    taken.push({ x, y, r: DOOR_CLEAR });
  }
  const free = (x: number, y: number, r: number, wall = r) =>
    x - wall > plan.x0 &&
    y - wall > plan.y0 &&
    x + wall < plan.x0 + FITTED_SIZE &&
    y + wall < plan.y0 + FITTED_SIZE &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const put = (name: string, kind: JunkKind, model: StatueModel, pose: Pose, solid: Solid | null = null) => {
    out.push({ key: key(name), kind, model, ...pose, solid });
  };
  const level = (x: number, y: number, h: number, yaw: number): Pose => ({ x, y, h, yaw, pitch: 0, roll: 0 });

  // The counter, along the wall across from the way in (or another without a door), from one of its corners: the
  // fridge in the corner, then the units.
  const side = mountedWall(plan, (k) => map.noise(plan.x0, plan.y0, 945 + k));
  const into = inward(side);
  const [fx, fy] = INWARD[side];
  // Along the wall, from the corner it starts in.
  const fromEnd = roll(10) < 0.5;
  const t = (along: number) => (fromEnd ? FITTED_SIZE - along : along);
  const [least, most] = PANTRY_UNITS;
  const units = least + Math.floor(roll(11) * (most - least + 1));
  const [w, d] = FRIDGE_SIZE;
  const [frx, fry] = onWall(plan, side, t(0.02 + w / 2), d / 2 + 0.01);
  const fridgeYaw = fridgeAway ? into + Math.PI : into;
  put("fridge", "kitchen", FRIDGE_MODEL, level(frx, fry, 0, fridgeYaw), slab(frx, fry, fx * (d / 2), fy * (d / 2), w / 2));
  taken.push({ x: frx, y: fry, r: w / 2 + 0.02 });
  const sinkAt = Math.floor(roll(12) * units);
  const microwaveAt = (sinkAt + 1 + Math.floor(roll(13) * (units - 1))) % units;
  const start = 0.02 + w + 0.02;
  const [ax, ay] = [-fy, fx];
  for (let i = 0; i < units; i++) {
    const [ux, uy] = onWall(plan, side, t(start + UNIT * (i + 0.5)), COUNTER_D / 2 + 0.005);
    const unit = level(ux, uy, 0, into);
    out.push({
      key: key(`unit${i}`),
      kind: "kitchen",
      model: i === sinkAt ? SINK_UNIT : COUNTER_UNIT,
      ...unit,
      solid: slab(ux, uy, ax * (UNIT / 2), ay * (UNIT / 2), COUNTER_D / 2),
      // XN can sit on the worktop (as on a desk), not by the tap.
      perch: i === sinkAt ? null : perchOn(unit, COUNTER_H, COUNTER_D / 2, 0.1),
    });
    taken.push({ x: ux, y: uy, r: COUNTER_D / 2 + 0.03 }, { x: ux + ax * 0.2, y: uy + ay * 0.2, r: COUNTER_D / 2 });
    taken.push({ x: ux - ax * 0.2, y: uy - ay * 0.2, r: COUNTER_D / 2 });
    if (wallUnits) {
      const [wx, wy] = onWall(plan, side, t(start + UNIT * (i + 0.5)), WALL_UNIT_D / 2 + 0.005);
      put(`wallUnit${i}`, "kitchen", WALL_UNIT, level(wx, wy, 0, into));
    }
    if (i === microwaveAt) {
      const [mx, my] = onWall(plan, side, t(start + UNIT * (i + 0.5) + (roll(14) - 0.5) * 0.15), MICROWAVE_SIZE[2] / 2 + 0.04);
      put("microwave", "kitchen", MICROWAVE_MODEL, level(mx, my, COUNTER_H, into + (roll(15) - 0.5) * 0.15));
    }
  }
  // The worktop that isn't the sink, as one length: d along it is this far along the wall, the sink skipped.
  const dry = UNIT * (units - 1);
  const onDry = (d: number) => start + d + (d >= UNIT * sinkAt ? UNIT : 0);

  // Mugs: a row of thirteen along the worktop's front edge, handles all one way, past the sink if it's in the way;
  // or a couple left on it, toward its front, clear of the microwave.
  if (mugRow) {
    const gap = Math.min(0.06, (dry - 0.1) / MUG_ROW);
    const handle = into + Math.PI / 2;
    for (let i = 0; i < MUG_ROW; i++) {
      const [mx, my] = onWall(plan, side, t(onDry(0.05 + gap * (i + 0.5))), COUNTER_D - 0.04);
      put(`row${i}`, "kitchen", MUG_MODEL, level(mx, my, COUNTER_H, handle));
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const [mx, my] = onWall(plan, side, t(onDry(0.05 + roll(20 + i) * (dry - 0.1))), 0.21 + roll(22 + i) * 0.05);
      put(`mug${i}`, "kitchen", MUG_MODEL, level(mx, my, COUNTER_H, roll(24 + i) * Math.PI * 2));
    }
  }

  // A wet floor sign out in front of the sink.
  if (wet) {
    const [sx, sy] = onWall(plan, side, t(start + UNIT * (sinkAt + 0.5) + (roll(30) - 0.5) * 0.3), COUNTER_D + 0.35);
    if (free(sx, sy, 0.12)) {
      put("wet", "wetFloor", WET_FLOOR, level(sx, sy, 0, roll(31) * Math.PI * 2), { x: sx, y: sy, r: 0.1 });
      taken.push({ x: sx, y: sy, r: 0.12 });
    }
  }

  // The water cooler against another wall, near one of its ends.
  if (cooler) {
    for (let k = 0; k < 8; k++) {
      const wall = [0, 1, 2, 3].filter((s) => s !== side)[Math.floor(roll(40 + k) * 3)];
      const along = roll(48 + k) < 0.5 ? 0.3 : FITTED_SIZE - 0.3;
      const [cx, cy] = onWall(plan, wall, along, COOLER_W / 2 + 0.02);
      if (!free(cx, cy, 0.14, 0.09)) continue;
      put("cooler", "kitchen", COOLER_MODEL, level(cx, cy, 0, inward(wall)), { x: cx, y: cy, r: 0.11 });
      taken.push({ x: cx, y: cy, r: 0.14 });
      break;
    }
  }

  // The table and its two chairs, out in the room, square to the walls; or the chairs upside down on it.
  if (table) {
    const chair = buildChair(ORDINARY, office);
    const seat = chairSeat(ORDINARY);
    const hd = PANTRY_TABLE.depth / 2;
    for (let k = 0; k < 10; k++) {
      const [tx, ty] = onWall(plan, side, 1 + roll(60 + k) * 2, 1.9 + roll(70 + k) * 0.8);
      if (!free(tx, ty, 0.5)) continue;
      const yaw = into + (roll(80) - 0.5) * 0.1;
      const tablePose = level(tx, ty, 0, yaw);
      out.push({
        key: key("table"),
        kind: "desk",
        model: buildDesk(PANTRY_TABLE, office),
        office,
        ...tablePose,
        solid: { x: tx, y: ty, r: hd + 0.02 },
        perch: perchOn(tablePose, PANTRY_TABLE.height, hd, 0.1),
      });
      taken.push({ x: tx, y: ty, r: 0.5 });
      // Either side of it, along the counter's wall.
      for (const s of [-1, 1]) {
        const ex = Math.sin(yaw) * s;
        const ey = -Math.cos(yaw) * s;
        if (chairsUp) {
          // Seat down on the table, legs up, its back over the edge.
          const cx = tx + ex * (hd - 0.09);
          const cy = ty + ey * (hd - 0.09);
          const up = { x: cx, y: cy, h: PANTRY_TABLE.height + seat, yaw: Math.atan2(-ey, -ex), pitch: 0, roll: Math.PI };
          out.push({ key: key(`chair${s}`), kind: "chair", model: chair, office, ...up, solid: null });
        } else {
          const cx = tx + ex * (hd + 0.2);
          const cy = ty + ey * (hd + 0.2);
          const pose = level(cx, cy, 0, Math.atan2(-ey, -ex) + (roll(81 + s) - 0.5) * 0.4);
          out.push({
            key: key(`chair${s}`),
            kind: "chair",
            model: chair,
            office,
            ...pose,
            solid: { x: cx, y: cy, r: 0.2 },
            perch: perchOn(pose, seat, CHAIR_EDGE, 0.1),
          });
        }
      }
      put("tableMug", "kitchen", MUG_MODEL, level(tx + (roll(85) - 0.5) * 0.2, ty + (roll(86) - 0.5) * 0.2, PANTRY_TABLE.height, roll(87) * 6.3));
      break;
    }
  }
  return out;
}

// ---- the meeting room ----

/*
 * A meeting room, sometimes a long one: a long table down the middle with chairs both sides and one at each end, a
 * whiteboard on an end wall, wiped clean or written on by XN (whiteboard.ts), mugs left at a few places. Now and
 * then every chair has been turned to face the door, or one is standing on the table; often a chair or two is missing.
 */

/** The meeting room's atlas: the whiteboard, its aluminium frame. */
const BOARD: Rect = { x: 0, y: 0, w: 64, h: 32 };
const BOARD_FRAME: Rect = { x: 0, y: 32, w: 8, h: 8 };
const MEETING_ATLAS_W = 64;
const MEETING_ATLAS_H = 40;

export const MEETING_SKIN: StatueSkin = (() => {
  const W = MEETING_ATLAS_W;
  const data = new Uint8ClampedArray(W * MEETING_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[]) => {
    const o = (y * W + x) * 4;
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = 255;
  };
  // Wiped clean: white, but for the faintest grain.
  for (let y = 0; y < BOARD.h; y++) {
    for (let x = 0; x < BOARD.w; x++) {
      const m = 0.97 + 0.04 * grain(x, y + 1000);
      put(BOARD.x + x, BOARD.y + y, [236 * m, 238 * m, 236 * m]);
    }
  }
  for (let y = 0; y < BOARD_FRAME.h; y++) {
    for (let x = 0; x < BOARD_FRAME.w; x++) put(BOARD_FRAME.x + x, BOARD_FRAME.y + y, [168, 170, 172]);
  }
  return { data };
})();

/** The whiteboard: from how high to how high, how wide at most, how thick; and its tray for the markers. */
const BOARD_Y = [0.38, 0.82] as const;
const BOARD_W = 1.4;
const BOARD_T = 0.02;
const BOARD_RIM = 0.015;

/** How many of the whiteboards XN has written on. */
const BOARD_WRITTEN = 0.4;

/**
 * A whiteboard `width` wide, its back against the wall at z = 0, its face toward +z. A written one has an atlas of its
 * own, bigger, for her writing to be read.
 */
function buildBoard(width: number, written = false): StatueModel {
  const tris: number[] = [];
  const hw = width / 2;
  const [y0, y1] = BOARD_Y;
  const face = written ? WRITTEN_FACE : BOARD;
  const frame = written ? WRITTEN_FRAME : BOARD_FRAME;
  box(tris, -hw, hw, y0, y1, 0, BOARD_T, face, frame, frame);
  // The frame round its face, and the tray along its foot.
  const rim = (x0: number, x1: number, ya: number, yb: number, z1: number) =>
    box(tris, x0, x1, ya, yb, BOARD_T, z1, frame, frame, frame);
  rim(-hw, hw, y1 - BOARD_RIM, y1, BOARD_T + 0.006);
  rim(-hw, hw, y0, y0 + BOARD_RIM, BOARD_T + 0.006);
  rim(-hw, -hw + BOARD_RIM, y0 + BOARD_RIM, y1 - BOARD_RIM, BOARD_T + 0.006);
  rim(hw - BOARD_RIM, hw, y0 + BOARD_RIM, y1 - BOARD_RIM, BOARD_T + 0.006);
  rim(-hw * 0.6, hw * 0.6, y0 - 0.012, y0, BOARD_T + 0.04);
  const [atlasWidth, atlasHeight] = written ? [WRITTEN_W, WRITTEN_H] : [MEETING_ATLAS_W, MEETING_ATLAS_H];
  return { tris, atlasWidth, atlasHeight, stone: [236, 238, 236] };
}

/** Where a whiteboard's face is, for XN to stand and read it: its middle, and the way it looks. */
export function boardFace(junk: Junk): { x: number; y: number; z: number; nx: number; ny: number } {
  const nx = Math.cos(junk.yaw);
  const ny = Math.sin(junk.yaw);
  return { x: junk.x + nx * BOARD_T, y: junk.y + ny * BOARD_T, z: (BOARD_Y[0] + BOARD_Y[1]) / 2, nx, ny };
}


/** The table: its height, its depth in a room of one lattice room and in a long one, and how long it is at most. */
const MEETING_TABLE_H = 0.32;
const MEETING_TABLE_D = [0.55, 0.65] as const;
const MEETING_TABLE_MOST = 5;
/** How much of the room's length is left round the table's ends. */
const MEETING_TABLE_ROOM = 2.2;
/** Chairs: how far apart along the sides, how far out from the table's edge, and pulled out up to this much more. */
const MEETING_SEAT_GAP = 0.45;
const MEETING_SEAT_OUT = 0.17;
const MEETING_PULLED = 0.12;
/** How likely: every chair turned to the door, one standing on the table, a chair or two missing, a mug at a place. */
const MEETING_FACING_DOOR = 0.08;
const MEETING_ON_TABLE = 0.1;
const MEETING_MISSING = 0.3;
const MEETING_MUG = 0.3;

/** Everything in meeting room `plan` in lattice room (lx, ly), the same every time for this map. */
function meetingIn(map: WorldMap, lx: number, ly: number, plan: FittedPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 53 + k, ly, 980);
  const out: Junk[] = [];
  const key = (name: string) => `w${lx},${ly}.${name}`;
  const facingDoor = roll(1) < MEETING_FACING_DOOR;
  const onTable = roll(2) < MEETING_ON_TABLE;
  const missing = roll(3) < MEETING_MISSING;
  const office = roll(4) < OFFICE_FURNITURE[map.zoneAt(plan.x0, plan.y0)];

  const taken: { x: number; y: number; r: number }[] = [];
  for (const [side, cell] of plan.doors) {
    const [x, y] = onWall(plan, side, cell - 0.5, DOOR_CLEAR_OUT);
    taken.push({ x, y, r: DOOR_CLEAR });
  }
  const free = (x: number, y: number, r: number) =>
    x - r > plan.x0 &&
    y - r > plan.y0 &&
    x + r < plan.x0 + plan.w &&
    y + r < plan.y0 + plan.h &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  const [doorSide, doorCell] = plan.doors[0];
  const door = onWall(plan, doorSide, doorCell - 0.5, 0.5);

  // The table down the middle, the long way (either way, in a square room).
  const shared = (k: number) => map.noise(plan.x0, plan.y0, 945 + k);
  const alongX = meetingAlongX(plan, shared);
  const long = alongX ? plan.w : plan.h;
  const [ax, ay] = alongX ? [1, 0] : [0, 1];
  const [px, py] = [-ay, ax];
  const length = Math.min(MEETING_TABLE_MOST, long - MEETING_TABLE_ROOM);
  const depth = MEETING_TABLE_D[long > FITTED_SIZE ? 1 : 0];
  const shape: DeskShape = {
    length,
    depth,
    height: MEETING_TABLE_H,
    legs: 2 + Math.floor(length / 0.9),
    drawer: false,
  };
  const cx = plan.x0 + plan.w / 2 + (roll(11) - 0.5) * 0.1;
  const cy = plan.y0 + plan.h / 2 + (roll(12) - 0.5) * 0.1;
  // The desk's length runs along its own x, which a yaw turns to (sin, −cos).
  const tablePose = { x: cx, y: cy, h: 0, yaw: Math.atan2(ax, -ay), pitch: 0, roll: 0 };
  out.push({
    key: key("table"),
    kind: "desk",
    model: buildDesk(shape, office),
    office,
    ...tablePose,
    solid: slab(cx, cy, ax * (length / 2), ay * (length / 2), depth / 2 + 0.01),
    perch: perchOn(tablePose, MEETING_TABLE_H, depth / 2, 0.1),
  });
  for (let d = -length / 2; d <= length / 2; d += 0.3) taken.push({ x: cx + ax * d, y: cy + ay * d, r: depth / 2 + 0.02 });

  // The chairs: down both sides, and one at each end, facing the table, pulled out a little or more; or all turned
  // to face the door. A chair or two missing, here and there.
  const chair = buildChair(ORDINARY, office);
  const seat = chairSeat(ORDINARY);
  // Each place: where the chair goes, the way to the table, and where a mug left there would be.
  const places: [number, number, number, number, number][] = [];
  const perSide = Math.max(1, Math.floor((length - 0.1) / MEETING_SEAT_GAP));
  for (const s of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const d = (i - (perSide - 1) / 2) * MEETING_SEAT_GAP;
      const outBy = depth / 2 + MEETING_SEAT_OUT + roll(20 + i * 2 + (s > 0 ? 1 : 0)) * MEETING_PULLED;
      const mug = depth / 2 - 0.07;
      places.push([
        cx + ax * d + px * s * outBy,
        cy + ay * d + py * s * outBy,
        Math.atan2(-py * s, -px * s),
        cx + ax * d + px * s * mug,
        cy + ay * d + py * s * mug,
      ]);
    }
  }
  for (const s of [-1, 1]) {
    const outBy = length / 2 + 0.22 + roll(60 + (s > 0 ? 1 : 0)) * MEETING_PULLED;
    const mug = length / 2 - 0.07;
    places.push([cx + ax * s * outBy, cy + ay * s * outBy, Math.atan2(-ay * s, -ax * s), cx + ax * s * mug, cy + ay * s * mug]);
  }
  const gone = new Set<number>(missing ? [Math.floor(roll(64) * places.length), Math.floor(roll(65) * places.length)] : []);
  places.forEach(([x, y, toTable, mx, my], i) => {
    if (gone.has(i) || !free(x, y, 0.2)) return;
    const yaw = facingDoor ? Math.atan2(door[1] - y, door[0] - x) : toTable + (roll(70 + i) - 0.5) * 0.4;
    const pose = { x, y, h: 0, yaw, pitch: 0, roll: 0 };
    out.push({
      key: key(`chair${i}`),
      kind: "chair",
      model: chair,
      office,
      ...pose,
      solid: { x, y, r: 0.2 },
      perch: perchOn(pose, seat, CHAIR_EDGE, 0.1),
    });
    taken.push({ x, y, r: 0.22 });
    // A mug left on the table in front of it.
    if (roll(120 + i) < MEETING_MUG) {
      const mug = { x: mx, y: my, h: MEETING_TABLE_H, yaw: roll(180 + i) * Math.PI * 2, pitch: 0, roll: 0 };
      out.push({ key: key(`mug${i}`), kind: "kitchen", model: MUG_MODEL, ...mug, solid: null });
    }
  });

  // One standing on the table.
  if (onTable) {
    const d = (roll(80) - 0.5) * (length - 0.4);
    const pose = { x: cx + ax * d, y: cy + ay * d, h: MEETING_TABLE_H, yaw: roll(81) * Math.PI * 2, pitch: 0, roll: 0 };
    out.push({ key: key("onTable"), kind: "chair", model: chair, office, ...pose, solid: null });
  }

  // The whiteboard: on an end wall with no door, or else any wall with none (map.ts).
  const boardSide = mountedWall(plan, shared);
  if (boardSide >= 0) {
    const wallLong = boardSide < 2 ? plan.w : plan.h;
    const width = Math.min(BOARD_W, wallLong - 0.6);
    const [bx, by] = onWall(plan, boardSide, wallLong / 2 + (roll(90) - 0.5) * 0.3, 0);
    const pose = { x: bx, y: by, h: 0, yaw: inward(boardSide), pitch: 0, roll: 0 };
    // Wiped clean, or something of hers on it.
    const written = roll(91) < BOARD_WRITTEN;
    const writing = written ? { index: Math.floor(roll(92) * WRITINGS), seed: lx * 31 + ly } : undefined;
    out.push({ key: key("board"), kind: "board", model: buildBoard(width, !!writing), ...pose, solid: null, writing });
  }
  return out;
}

// ---- the storeroom ----

/*
 * A storeroom: steel shelving all round the walls, but where the doors are, and sometimes a double row back to back
 * down the middle; cardboard boxes on the shelves, a few gaps, and stacks of them on the floor, some opened and left
 * open; sometimes a stepladder leant against a wall. Its lights are mostly out or failing (map.ts). Now and then the
 * boxes are piled up to the ceiling in a corner, or one shelf's boxes have all come down onto the floor in front of
 * it.
 */

/** The storeroom's atlas: cardboard, its top with the tape across, its inside, a label, the shelves' steel. */
const CARD: Rect = { x: 0, y: 0, w: 16, h: 16 };
const CARD_TOP: Rect = { x: 16, y: 0, w: 16, h: 16 };
const CARD_IN: Rect = { x: 32, y: 0, w: 16, h: 16 };
/** Twice as fine as the rest, for the handwriting on the label. */
const CARD_LABEL: Rect = { x: 32, y: 16, w: 32, h: 32 };
const SHELF_POST: Rect = { x: 0, y: 16, w: 8, h: 32 };
const SHELF_STEEL: Rect = { x: 8, y: 16, w: 16, h: 8 };
const STORAGE_ATLAS_W = 64;
const STORAGE_ATLAS_H = 48;

export const STORAGE_SKIN: StatueSkin = (() => {
  const W = STORAGE_ATLAS_W;
  const data = new Uint8ClampedArray(W * STORAGE_ATLAS_H * 4);
  const put = (x: number, y: number, c: readonly number[], m = 1) => {
    const o = (y * W + x) * 4;
    data[o] = c[0] * m;
    data[o + 1] = c[1] * m;
    data[o + 2] = c[2] * m;
    data[o + 3] = 255;
  };
  const BROWN = [176, 136, 88];
  const noise = (x: number, y: number) => 0.92 + 0.1 * grain(x, y + 1300);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Cardboard: brown, a darker edge where the flaps fold.
      put(CARD.x + x, CARD.y + y, BROWN, (y === 0 || y === 15 ? 0.8 : 1) * noise(x, y));
      // The top: the two flaps meeting down the middle under a band of tape.
      const tape = x >= 6 && x <= 9;
      put(CARD_TOP.x + x, CARD_TOP.y + y, tape ? [196, 170, 120] : BROWN, (x === 7 || x === 8 ? 0.85 : 1) * noise(x + 20, y));
      // Inside: darker, in shadow.
      put(CARD_IN.x + x, CARD_IN.y + y, BROWN, 0.62 * noise(x + 40, y));
    }
  }
  // A side with a white label on it, scrawled on in marker: three lines of quick, thin, wobbly handwriting, too
  // small to read, the last line short.
  const L = CARD_LABEL;
  const PAPER = [226, 224, 214];
  const INK = [88, 92, 120];
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      const paper = x >= 6 && x <= 25 && y >= 9 && y <= 22;
      put(L.x + x, L.y + y, paper ? PAPER : BROWN, noise(x + 60, y + 20));
    }
  }
  [12, 16, 20].forEach((base, line) => {
    const end = line === 2 ? 15 + Math.floor(grain(line, 1320) * 5) : 22 + Math.floor(grain(line, 1321) * 3);
    let x = 8 + Math.floor(grain(line, 1322) * 2);
    let word = 0;
    while (x < end) {
      const len = 2 + Math.floor(grain(word, line + 1323) * 4);
      for (let i = 0; i < len && x < end; i++, x++) {
        const y = base + Math.round(Math.sin(x * 1.7 + line * 2.3) * 0.7 + (grain(x, line + 1330) - 0.5) * 1.4);
        put(L.x + x, L.y + y, INK);
        // Now and then a letter reaching up or down.
        if (grain(x, line + 1340) > 0.8) put(L.x + x, L.y + y + (grain(x, line + 1341) < 0.5 ? -1 : 1), INK);
      }
      x += 1 + Math.floor(grain(word, line + 1350) * 2);
      word++;
    }
  });
  // The shelving's uprights: grey steel angle with a row of slots up it; its shelves plain grey.
  for (let y = 0; y < SHELF_POST.h; y++) {
    for (let x = 0; x < SHELF_POST.w; x++) {
      const slot = x >= 3 && x <= 4 && y % 4 < 2;
      put(SHELF_POST.x + x, SHELF_POST.y + y, slot ? [50, 52, 54] : [140, 144, 146], noise(x, y + 80));
    }
  }
  for (let y = 0; y < SHELF_STEEL.h; y++) {
    for (let x = 0; x < SHELF_STEEL.w; x++) {
      put(SHELF_STEEL.x + x, SHELF_STEEL.y + y, [150, 154, 156], (y === 0 ? 0.8 : 1) * noise(x, y + 100));
    }
  }
  return { data };
})();

const storageModel = (tris: number[], stone: readonly [number, number, number]): StatueModel => ({
  tris,
  atlasWidth: STORAGE_ATLAS_W,
  atlasHeight: STORAGE_ATLAS_H,
  stone,
});

/** A shelving unit: how long, how deep, its uprights' width, and the height of each shelf from the floor. */
const SHELF_L = 0.9;
const SHELF_D = 0.26;
const SHELF_POST_W = 0.018;
const SHELF_LEVELS = [0.03, 0.3, 0.57, 0.84] as const;
const SHELF_T = 0.012;
/** A shelving unit, its back at z = −SHELF_D / 2 and its front toward +z. */
const SHELF_MODEL = (() => {
  const tris: number[] = [];
  const hl = SHELF_L / 2;
  const hd = SHELF_D / 2;
  const top = SHELF_LEVELS[SHELF_LEVELS.length - 1] + SHELF_T;
  for (const x of [-hl, hl - SHELF_POST_W]) {
    for (const z of [-hd, hd - SHELF_POST_W]) {
      box(tris, x, x + SHELF_POST_W, 0, top, z, z + SHELF_POST_W, SHELF_POST, SHELF_POST, SHELF_POST);
    }
  }
  // The shelves sit between the uprights, so no face of one lies on a face of a post.
  for (const y of SHELF_LEVELS) {
    box(tris, -hl + SHELF_POST_W, hl - SHELF_POST_W, y, y + SHELF_T, -hd + 0.002, hd - 0.002, SHELF_STEEL, SHELF_STEEL, SHELF_STEEL);
  }
  return storageModel(tris, [150, 154, 156]);
})();

/** The boxes' sizes: width, depth, height. Each fits on a shelf. */
const BOX_SIZES: readonly (readonly [number, number, number])[] = [
  [0.22, 0.16, 0.14],
  [0.18, 0.18, 0.18],
  [0.3, 0.2, 0.12],
  [0.14, 0.1, 0.1],
  [0.26, 0.2, 0.2],
];
/** An opened box's walls, and how far its flaps lie out flat. */
const BOX_WALL = 0.004;

/**
 * A box of `size` put down at (x, y), its front facing `yaw`: standing, or tipped onto its front, where it lies half
 * its depth up with its top the way its front faced. Its pose, and the round on the floor it keeps inside however
 * it's turned (its flaps too, if it's open), about its middle.
 */
function lyingBox(size: number, x: number, y: number, yaw: number, tipped: boolean, open: boolean) {
  const [w, d, tall] = BOX_SIZES[size];
  const pose: Pose = { x, y, h: tipped ? d / 2 : 0, yaw, pitch: tipped ? Math.PI / 2 : 0, roll: 0 };
  const round = {
    x: tipped ? x + (Math.cos(yaw) * tall) / 2 : x,
    y: tipped ? y + (Math.sin(yaw) * tall) / 2 : y,
    r: open ? Math.hypot(w + d, d * 2) / 2 : Math.hypot(w, tipped ? tall : d) / 2,
  };
  return { pose, round };
}

/**
 * A cardboard box, its foot at 0: shut and taped, with or without a label on its front; or opened, hollow, its four
 * flaps folded out flat round its mouth.
 */
function buildBox([w, d, h]: readonly [number, number, number], open: boolean, label: boolean): StatueModel {
  const tris: number[] = [];
  const hw = w / 2;
  const hd = d / 2;
  if (!open) {
    topBox(tris, -hw, hw, 0, h, -hd, hd, label ? CARD_LABEL : CARD, CARD, CARD_TOP);
    return storageModel(tris, [176, 136, 88]);
  }
  // Only the faces that can be seen, each once: boxes put together here would leave faces hidden a wall's thickness
  // behind others, which show through up close.
  const t = BOX_WALL;
  const [a, b, ai, bi, rim] = [hw, hd, hw - t, hd - t, h - t];
  const up = (x0: number, x1: number, z0: number, z1: number, y: number, r: Rect) =>
    quad(tris, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], r);
  const down = (x0: number, x1: number, z0: number, z1: number, y: number, r: Rect) =>
    quad(tris, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], r);
  const east = (x: number, y0: number, y1: number, z0: number, z1: number, r: Rect) =>
    quad(tris, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], r);
  const west = (x: number, y0: number, y1: number, z0: number, z1: number, r: Rect) =>
    quad(tris, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], r);
  const south = (z: number, x0: number, x1: number, y0: number, y1: number, r: Rect) =>
    quad(tris, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], r);
  const north = (z: number, x0: number, x1: number, y0: number, y1: number, r: Rect) =>
    quad(tris, [x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], r);
  // Underneath, and the floor inside.
  down(-a, a, -b, b, 0, CARD);
  up(-ai, ai, -bi, bi, t, CARD_IN);
  // The walls outside, up to where the flaps fold out; the label on the front.
  south(b, -a, a, 0, rim, label ? CARD_LABEL : CARD);
  north(-b, -a, a, 0, rim, CARD);
  east(a, 0, rim, -b, b, CARD);
  west(-a, 0, rim, -b, b, CARD);
  // The walls inside, from the floor to the lip.
  east(-ai, t, h, -bi, bi, CARD_IN);
  west(ai, t, h, -bi, bi, CARD_IN);
  south(-bi, -ai, ai, t, h, CARD_IN);
  north(bi, -ai, ai, t, h, CARD_IN);
  // The lip all round, the sides' running the whole depth and the front's and back's between them.
  up(-a, -ai, -b, b, h, CARD);
  up(ai, a, -b, b, h, CARD);
  up(-ai, ai, bi, b, h, CARD);
  up(-ai, ai, -b, -bi, h, CARD);
  // The flaps, out flat from the lip: the sides' as deep as the box, the front's and back's as wide; top, underside,
  // and their three free edges.
  up(-a - b, -a, -b, b, h, CARD);
  down(-a - b, -a, -b, b, rim, CARD);
  west(-a - b, rim, h, -b, b, CARD);
  south(b, -a - b, -a, rim, h, CARD);
  north(-b, -a - b, -a, rim, h, CARD);
  up(a, a + b, -b, b, h, CARD);
  down(a, a + b, -b, b, rim, CARD);
  east(a + b, rim, h, -b, b, CARD);
  south(b, a, a + b, rim, h, CARD);
  north(-b, a, a + b, rim, h, CARD);
  up(-a, a, b, b + b, h, CARD);
  down(-a, a, b, b + b, rim, CARD);
  south(b + b, -a, a, rim, h, CARD);
  east(a, rim, h, b, b + b, CARD);
  west(-a, rim, h, b, b + b, CARD);
  up(-a, a, -b - b, -b, h, CARD);
  down(-a, a, -b - b, -b, rim, CARD);
  north(-b - b, -a, a, rim, h, CARD);
  east(a, rim, h, -b - b, -b, CARD);
  west(-a, rim, h, -b - b, -b, CARD);
  return storageModel(tris, [176, 136, 88]);
}
const BOXES = new Map<string, StatueModel>();
/** One model for each size, opened or not, labelled or not. */
function boxModel(size: number, open: boolean, label: boolean): StatueModel {
  const key = `${size}${open ? "o" : ""}${label ? "l" : ""}`;
  let model = BOXES.get(key);
  if (!model) {
    model = buildBox(BOX_SIZES[size], open, label);
    BOXES.set(key, model);
  }
  return model;
}

/** A stepladder's height, its rails' spread, and the gap between its rungs. */
const LADDER_H = 0.95;
const LADDER_HALF = 0.12;
const LADDER_RUNG = 0.16;
/** A ladder of two rails and rungs between them, upright, its foot at 0. */
const LADDER_MODEL = (() => {
  const tris: number[] = [];
  for (const x of [-LADDER_HALF, LADDER_HALF - 0.02]) box(tris, x, x + 0.02, 0, LADDER_H, -0.012, 0.012, SHELF_POST, SHELF_POST, SHELF_POST);
  for (let y = LADDER_RUNG; y < LADDER_H - 0.05; y += LADDER_RUNG) {
    box(tris, -LADDER_HALF + 0.02, LADDER_HALF - 0.02, y, y + 0.012, -0.015, 0.015, SHELF_STEEL, SHELF_STEEL, SHELF_STEEL);
  }
  return storageModel(tris, [140, 144, 146]);
})();
/** How far its foot stands out from the wall it leans on. */
const LADDER_OUT = 0.3;

/** How likely: a shelf filled where a box could go; a double row down the middle; a ladder; a pile to the ceiling. */
const STORE_FILLED = 0.6;
const STORE_MIDDLE = 0.5;
const STORE_LADDER = 0.4;
const STORE_PILE = 0.15;
const STORE_SPILLED = 0.15;
/** How likely a box is opened, and labelled; stacks on the floor: how many, and how many boxes high, at most. */
const BOX_OPEN = 0.25;
const BOX_LABELLED = 0.4;
const STORE_STACKS = [2, 4] as const;
const STACK_MOST = 4;

/** Everything in storeroom `plan` in lattice room (lx, ly), the same every time for this map. */
function storageIn(map: WorldMap, lx: number, ly: number, plan: FittedPlan): Junk[] {
  const roll = (k: number) => map.noise(lx * 59 + k, ly, 990);
  const out: Junk[] = [];
  const key = (name: string) => `w${lx},${ly}.${name}`;
  const middle = roll(1) < STORE_MIDDLE;
  const ladder = roll(2) < STORE_LADDER;
  const pile = roll(3) < STORE_PILE;
  const spilled = roll(4) < STORE_SPILLED;

  const taken: { x: number; y: number; r: number }[] = [];
  for (const [side, cell] of plan.doors) {
    const [x, y] = onWall(plan, side, cell - 0.5, DOOR_CLEAR_OUT);
    taken.push({ x, y, r: DOOR_CLEAR });
  }
  const free = (x: number, y: number, r: number, wall = r) =>
    x - wall > plan.x0 &&
    y - wall > plan.y0 &&
    x + wall < plan.x0 + plan.w &&
    y + wall < plan.y0 + plan.h &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r);
  let n = 0;
  const put = (name: string, model: StatueModel, pose: Pose, solid: Solid | null = null) => {
    out.push({ key: key(`${name}${n++}`), kind: "storage", model, ...pose, solid });
  };
  // Boxes in a row along a shelf at height h, its middle at (x, y), along (ax, ay), facing `yaw`; most places filled.
  const shelfBoxes = (x: number, y: number, h: number, ax: number, ay: number, yaw: number, k: number) => {
    let at = -SHELF_L / 2 + SHELF_POST_W + 0.01;
    for (let i = 0; i < 4; i++) {
      const r = (j: number) => roll(k + i * 5 + j);
      const size = Math.floor(r(0) * BOX_SIZES.length);
      const [w] = BOX_SIZES[size];
      if (at + w > SHELF_L / 2 - SHELF_POST_W - 0.01) break;
      if (r(1) < STORE_FILLED) {
        const mid = at + w / 2;
        const pose = { x: x + ax * mid, y: y + ay * mid, h, yaw: yaw + (r(2) - 0.5) * 0.15, pitch: 0, roll: 0 };
        put("box", boxModel(size, r(3) < BOX_OPEN * 0.4, r(4) < BOX_LABELLED), pose);
      }
      at += w + 0.02;
    }
  };
  // A shelving unit at (x, y) facing `yaw`, along (ax, ay), its shelves filled, or its boxes all come down in front.
  let units = 0;
  const shelf = (x: number, y: number, yaw: number, ax: number, ay: number) => {
    const k = 100 + units * 40;
    const down = spilled && units === 0;
    units++;
    put("shelf", SHELF_MODEL, { x, y, h: 0, yaw, pitch: 0, roll: 0 }, slab(x, y, ax * (SHELF_L / 2), ay * (SHELF_L / 2), SHELF_D / 2));
    taken.push(
      { x, y, r: SHELF_D / 2 + 0.02 },
      { x: x + ax * 0.3, y: y + ay * 0.3, r: SHELF_D / 2 + 0.02 },
      { x: x - ax * 0.3, y: y - ay * 0.3, r: SHELF_D / 2 + 0.02 },
    );
    SHELF_LEVELS.forEach((level, i) => {
      // The bottom shelf too, but not the top, under the ceiling.
      if (i === SHELF_LEVELS.length - 1 || down) return;
      shelfBoxes(x, y, level + SHELF_T, ax, ay, yaw, k + i * 10);
    });
    if (down) {
      // Fallen off onto the floor in front, every which way.
      const fx = Math.cos(yaw);
      const fy = Math.sin(yaw);
      // Clear of the doorways and of everything else but the unit they fell from, and of each other: they're in the
      // way now (game.ts goes by their shape).
      const others = taken.slice(0, -3);
      for (let i = 0; i < 7; i++) {
        const r = (j: number) => roll(900 + i * 6 + j);
        const size = Math.floor(r(0) * BOX_SIZES.length);
        const along = (r(1) - 0.5) * SHELF_L;
        const outBy = SHELF_D / 2 + 0.1 + r(2) * 0.4;
        const tipped = r(3) < 0.5;
        const open = r(5) < BOX_OPEN;
        const bx = x + ax * along + fx * outBy;
        const by = y + ay * along + fy * outBy;
        const { pose, round } = lyingBox(size, bx, by, r(4) * Math.PI * 2, tipped, open);
        const inRoom =
          round.x - round.r > plan.x0 &&
          round.y - round.r > plan.y0 &&
          round.x + round.r < plan.x0 + plan.w &&
          round.y + round.r < plan.y0 + plan.h;
        if (!inRoom || !others.every((t) => Math.hypot(t.x - round.x, t.y - round.y) > t.r + round.r)) continue;
        others.push(round);
        taken.push(round);
        put("box", boxModel(size, open, false), pose);
      }
    }
  };

  // Shelving all along the walls, unit by unit, but where a door is; the north and south walls' run the whole way,
  // the west and east walls' stop short of them.
  for (let side = 0; side < 4; side++) {
    const len = side < 2 ? plan.w : plan.h;
    const yaw = inward(side);
    const [fx, fy] = INWARD[side];
    const [ax, ay] = [-fy, fx];
    const start = side < 2 ? 0.02 : SHELF_D + 0.04;
    const end = side < 2 ? len - 0.02 : len - SHELF_D - 0.04;
    for (let t = start; t + SHELF_L <= end + 1e-6; t += SHELF_L + 0.02) {
      const [x, y] = onWall(plan, side, t + SHELF_L / 2, SHELF_D / 2 + 0.01);
      // Clear of the doors: the whole unit, not only its middle.
      const clear = [-0.3, 0, 0.3].every((d) => free(x + ax * d, y + ay * d, SHELF_D / 2, 0));
      if (clear) shelf(x, y, yaw, ax, ay);
    }
  }

  // A double row back to back down the middle, the long way across the doors' line, with aisles either side.
  if (middle) {
    const alongX = roll(20) < 0.5;
    const [ax, ay] = alongX ? [1, 0] : [0, 1];
    const [px, py] = [-ay, ax];
    const cx = plan.x0 + plan.w / 2;
    const cy = plan.y0 + plan.h / 2;
    const count = Math.max(1, Math.floor((Math.min(plan.w, plan.h) - 2 * (SHELF_D + 0.9)) / SHELF_L) + 1);
    for (let i = 0; i < count; i++) {
      const d = (i - (count - 1) / 2) * (SHELF_L + 0.02);
      for (const s of [-1, 1]) {
        const x = cx + ax * d + px * s * (SHELF_D / 2 + 0.01);
        const y = cy + ay * d + py * s * (SHELF_D / 2 + 0.01);
        if ([-0.3, 0, 0.3].every((e) => free(x + ax * e, y + ay * e, SHELF_D / 2))) {
          shelf(x, y, Math.atan2(py * s, px * s), ax, ay);
        }
      }
    }
  }

  // Stacks of boxes on the floor, wherever there's room, a little askew one on another; the top one sometimes open.
  const stack = (x: number, y: number, high: number, k: number) => {
    let h = 0;
    for (let i = 0; i < high; i++) {
      const r = (j: number) => roll(k + i * 5 + j);
      const size = Math.min(BOX_SIZES.length - 1, Math.floor(r(0) * BOX_SIZES.length));
      const top = i === high - 1;
      const pose = { x: x + (r(1) - 0.5) * 0.03, y: y + (r(2) - 0.5) * 0.03, h, yaw: r(3) * 0.5, pitch: 0, roll: 0 };
      put("box", boxModel(size, top && r(4) < BOX_OPEN, r(5) < BOX_LABELLED), pose, i === 0 ? { x, y, r: 0.16 } : null);
      h += BOX_SIZES[size][2];
      if (h > 0.9) break;
    }
  };
  const [least, most] = STORE_STACKS;
  const stacks = least + Math.floor(roll(30) * (most - least + 1));
  let placed = 0;
  for (let k = 0; k < 30 && placed < stacks; k++) {
    const x = plan.x0 + 0.4 + roll(31 + k) * (plan.w - 0.8);
    const y = plan.y0 + 0.4 + roll(61 + k) * (plan.h - 0.8);
    if (!free(x, y, 0.2)) continue;
    stack(x, y, 1 + Math.floor(roll(91 + k) * STACK_MOST), 300 + placed * 30);
    taken.push({ x, y, r: 0.2 });
    placed++;
  }

  // Piled to the ceiling in a corner: a column of the biggest boxes.
  if (pile) {
    const corners: [number, number][] = [
      [plan.x0 + 0.5, plan.y0 + 0.5],
      [plan.x0 + plan.w - 0.5, plan.y0 + 0.5],
      [plan.x0 + 0.5, plan.y0 + plan.h - 0.5],
      [plan.x0 + plan.w - 0.5, plan.y0 + plan.h - 0.5],
    ];
    const spot = corners.find(([x, y]) => free(x, y, 0.18)) ?? null;
    if (spot) {
      let h = 0;
      for (let i = 0; h + BOX_SIZES[4][2] <= 1; i++) {
        const pose = { x: spot[0] + (roll(500 + i) - 0.5) * 0.02, y: spot[1], h, yaw: (roll(520 + i) - 0.5) * 0.2, pitch: 0, roll: 0 };
        put("box", boxModel(4, false, roll(540 + i) < BOX_LABELLED), pose, i === 0 ? { x: spot[0], y: spot[1], r: 0.18 } : null);
        h += BOX_SIZES[4][2];
      }
      taken.push({ x: spot[0], y: spot[1], r: 0.2 });
    }
  }

  // A stepladder leant against a wall, or against the shelving along it: its foot out from it, its top against it.
  if (ladder) {
    for (let k = 0; k < 12; k++) {
      const side = Math.floor(roll(600 + k) * 4);
      const len = side < 2 ? plan.w : plan.h;
      const t = 0.4 + roll(620 + k) * (len - 0.8);
      const [wx, wy] = onWall(plan, side, t, 0.05);
      const against = free(wx, wy, 0.04, 0) ? 0 : SHELF_D + 0.02;
      const [x, y] = onWall(plan, side, t, against + LADDER_OUT);
      if (!free(x, y, 0.15)) continue;
      const tilt = Math.asin(LADDER_OUT / LADDER_H);
      put("ladder", LADDER_MODEL, { x, y, h: 0, yaw: inward(side), pitch: -tilt, roll: 0 }, { x, y, r: 0.14 });
      break;
    }
  }
  return out;
}

// ---- boxes, mugs and tins lying about ----

/*
 * The storeroom's boxes, the pantry's mugs and the camp's tins, out in the halls with the rest of the junk: boxes
 * mostly in the bare plasterboard, mugs where the offices and kitchens are, tins in the old house (zones.ts).
 */

/** Where in the spot's cell something small goes, from two dice: well inside it. */
const inCell = (spot: Spot, a: number, b: number): [number, number] => [
  spot.cx + 0.25 + a * 0.5,
  spot.cy + 0.25 + b * 0.5,
];

/** How likely: boxes stacked against a wall, a few strewn about, one on its own (the rest sunk in the carpet). */
const LOOSE_BOX_STACK = 0.4;
const LOOSE_BOX_STREWN = 0.7;
const LOOSE_BOX_ALONE = 0.88;

/** Boxes: a stack or two against a wall, a few strewn about and knocked over, one on its own, or one sunk in. */
function placeBoxes(key: string, spot: Spot, roll: (k: number) => number): Junk[] {
  const out: Junk[] = [];
  const put = (pose: Pose, size: number, open: boolean, label: boolean, solid: Solid | null) =>
    out.push({ key: `${key}.${out.length}`, kind: "storage", model: boxModel(size, open, label), ...pose, solid });
  const reach = (size: number) => Math.max(BOX_SIZES[size][0], BOX_SIZES[size][1]) / 2 + 0.01;
  const how = roll(40);
  if (how < LOOSE_BOX_STACK && spot.wall) {
    const [ox, oy] = spot.wall;
    const stacks = roll(41) < 0.5 ? 1 : 2;
    for (let s = 0; s < stacks; s++) {
      const [fx, fy] = wallFace(spot, spot.wall, 0.28 + s * 0.4 + roll(42) * 0.04);
      const x = fx - ox * 0.14;
      const y = fy - oy * 0.14;
      const high = 2 + Math.floor(roll(43 + s) * 3);
      let h = 0;
      for (let i = 0; i < high; i++) {
        const r = (j: number) => roll(100 + s * 40 + i * 6 + j);
        const size = Math.floor(r(0) * BOX_SIZES.length);
        const pose = { x: x + (r(1) - 0.5) * 0.03, y: y + (r(2) - 0.5) * 0.03, h, yaw: Math.atan2(-oy, -ox) + (r(3) - 0.5) * 0.4, pitch: 0, roll: 0 };
        // Shut, all of them: an open one's flaps would go into the wall, or into the stack beside it.
        put(pose, size, false, r(5) < BOX_LABELLED, i === 0 ? { x, y, r: 0.15 } : null);
        h += BOX_SIZES[size][2];
      }
    }
    return out;
  }
  if (how < LOOSE_BOX_STREWN) {
    // Knocked about: some on their sides, one opened; none where another already lies.
    const count = 2 + Math.floor(roll(41) * 3);
    const lying: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r = (j: number) => roll(100 + i * 7 + j);
      const size = Math.floor(r(0) * BOX_SIZES.length);
      const [x, y] = inCell(spot, r(1), r(2));
      const tipped = r(3) < 0.4;
      const open = i === 0 && !tipped && r(5) < 0.5;
      const { pose, round } = lyingBox(size, x, y, r(4) * Math.PI * 2, tipped, open);
      if (lying.some((l) => Math.hypot(l.x - round.x, l.y - round.y) < l.r + round.r)) continue;
      lying.push(round);
      put(pose, size, open, r(6) < BOX_LABELLED, { x: round.x, y: round.y, r: reach(size) });
    }
    return out;
  }
  const size = Math.floor(roll(41) * BOX_SIZES.length);
  const [x, y] = inCell(spot, roll(50), roll(51));
  const yaw = roll(52) * Math.PI * 2;
  if (how < LOOSE_BOX_ALONE) {
    put({ x, y, h: 0, yaw, pitch: 0, roll: 0 }, size, roll(53) < BOX_OPEN, roll(54) < BOX_LABELLED, { x, y, r: reach(size) });
    return out;
  }
  // Sunk into the carpet, aslant, as if it had been dropped from a height into water.
  const tall = BOX_SIZES[size][2];
  const sunk = buried(tall, roll(53));
  const pose = { x, y, h: -sunk, yaw, pitch: (roll(55) - 0.5) * 1, roll: (roll(56) - 0.5) * 1 };
  put(pose, size, false, roll(54) < BOX_LABELLED, solidAbove(pose, tall - sunk, reach(size)));
  return out;
}

/** The top of an upright desk or cabinet nearby, a mug could be left on: where, and how far along it either way. */
interface Top {
  perch: Perch;
  half: number;
}

/** How likely: a mug left on a desk or cabinet (if the block has one standing), one on the floor; a row on the floor. */
const LOOSE_MUG_TOP = 0.4;
const LOOSE_MUG_FLOOR = 0.75;
/** How many of the mugs on the floor have fallen over; how many in a row, at least and at most, and how far apart. */
const LOOSE_MUG_FALLEN = 0.35;
const LOOSE_MUG_ROW = [5, 13] as const;
const LOOSE_MUG_GAP = 0.06;

/** Mugs: one left on a desk or cabinet, one on the floor, or a row of them along the skirting, handles all one way. */
function placeMugs(key: string, spot: Spot, roll: (k: number) => number, tops: readonly Top[]): Junk[] {
  const mug = (name: string, pose: Pose): Junk => ({ key: `${key}.${name}`, kind: "kitchen", model: MUG_MODEL, ...pose, solid: null });
  const how = roll(40);
  if (how < LOOSE_MUG_TOP && tops.length) {
    const { perch, half } = tops[Math.floor(roll(41) * tops.length)];
    const fx = Math.cos(perch.yaw);
    const fy = Math.sin(perch.yaw);
    const a = (roll(42) - 0.5) * 2 * Math.max(0, half - MUG_R - 0.02);
    const b = (roll(43) - 0.5) * 2 * Math.max(0, perch.edge - MUG_R - 0.02);
    const x = perch.x + fy * a + fx * b;
    const y = perch.y - fx * a + fy * b;
    return [mug("top", { x, y, h: perch.z, yaw: roll(44) * Math.PI * 2, pitch: 0, roll: 0 })];
  }
  if (how >= LOOSE_MUG_FLOOR && spot.wall) {
    // Lined up along the skirting, a hand's breadth out, every handle the same way.
    const [ox, oy] = spot.wall;
    const count = LOOSE_MUG_ROW[0] + Math.floor(roll(41) * (LOOSE_MUG_ROW[1] - LOOSE_MUG_ROW[0] + 1));
    const [fx, fy] = wallFace(spot, spot.wall, 0.5);
    const [ax, ay] = [-oy, ox];
    const handle = roll(42) * Math.PI * 2;
    return Array.from({ length: count }, (_, i) => {
      const d = (i - (count - 1) / 2) * LOOSE_MUG_GAP;
      return mug(`row${i}`, { x: fx - ox * 0.06 + ax * d, y: fy - oy * 0.06 + ay * d, h: 0, yaw: handle, pitch: 0, roll: 0 });
    });
  }
  const [x, y] = inCell(spot, roll(50), roll(51));
  const fallen = roll(52) < LOOSE_MUG_FALLEN;
  return [mug("floor", { x, y, h: fallen ? MUG_R : 0, yaw: roll(53) * Math.PI * 2, pitch: fallen ? Math.PI / 2 : 0, roll: 0 })];
}

/** How likely: a few tins strewn about, one on its own; the rest a little pyramid against a wall. */
const LOOSE_TIN_STREWN = 0.45;
const LOOSE_TIN_ALONE = 0.75;

/** Empty tins: a few strewn about, some on their sides; one on its own; or a pyramid of six against a wall. */
function placeTins(key: string, spot: Spot, roll: (k: number) => number): Junk[] {
  const out: Junk[] = [];
  const tin = (x: number, y: number, h: number, yaw: number, fallen: boolean) =>
    out.push({
      key: `${key}.${out.length}`,
      kind: "can",
      model: TIN_MODEL,
      x,
      y,
      h: fallen ? h + TIN_R : h,
      yaw,
      pitch: fallen ? Math.PI / 2 : 0,
      roll: 0,
      solid: null,
    });
  const how = roll(40);
  if (how < LOOSE_TIN_STREWN || (how >= LOOSE_TIN_ALONE && !spot.wall)) {
    const count = 3 + Math.floor(roll(41) * 4);
    const [cx, cy] = inCell(spot, roll(50), roll(51));
    const lying: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < count; i++) {
      const r = (j: number) => roll(100 + i * 4 + j);
      const a = r(0) * Math.PI * 2;
      const d = 0.04 + r(1) * 0.22;
      const [x, y] = [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
      const yaw = r(2) * Math.PI * 2;
      const fallen = r(3) < TIN_FALLEN;
      // Not where another lies. One on its side lies the way it faced, its middle half its height along.
      const mid = fallen ? TIN_H / 2 : 0;
      const at = { x: x + Math.cos(yaw) * mid, y: y + Math.sin(yaw) * mid, r: fallen ? Math.hypot(TIN_H / 2, TIN_R) : TIN_R };
      if (lying.some((l) => Math.hypot(l.x - at.x, l.y - at.y) < l.r + at.r + 0.005)) continue;
      lying.push(at);
      tin(x, y, 0, yaw, fallen);
    }
    return out;
  }
  if (how < LOOSE_TIN_ALONE || !spot.wall) {
    const [x, y] = inCell(spot, roll(50), roll(51));
    tin(x, y, 0, roll(52) * Math.PI * 2, roll(53) < 0.5);
    return out;
  }
  // Three, two and one, each row on the one below, against the skirting.
  const [ox, oy] = spot.wall;
  const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(41) * 0.4);
  const [ax, ay] = [-oy, ox];
  const gap = TIN_R * 2 + 0.004;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const d = (i - (2 - row) / 2) * gap;
      const off = TIN_R + 0.01;
      tin(fx - ox * off + ax * d, fy - oy * off + ay * d, row * TIN_H, roll(60 + row * 3 + i) * Math.PI * 2, false);
    }
  }
  return out;
}

// ---- the candle sign ----

/*
 * The cult's sign laid out in candles on the floor in front of a statue, its ears toward it (map.ts says which and
 * where): the candles all one model, their flames another (they light themselves); a few burnt down to stubs with
 * nothing left to light.
 */

/** The candles' atlas: wax, flame. */
const WAX: Rect = { x: 0, y: 0, w: 8, h: 8 };
const FLAME: Rect = { x: 8, y: 0, w: 8, h: 8 };

export const CANDLE_SKIN: StatueSkin = (() => {
  const data = new Uint8ClampedArray(16 * 8 * 4);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const o = (y * 16 + x) * 4;
      const m = 0.9 + 0.1 * grain(x, y);
      // Dark green wax; a green flame, paler in the middle.
      const c = x < 8 ? [38, 74, 40] : Math.abs(x - 11.5) < 1.5 && y > 2 ? [214, 255, 170] : [90, 230, 110];
      data[o] = c[0] * m;
      data[o + 1] = c[1] * m;
      data[o + 2] = c[2] * m;
      data[o + 3] = 255;
    }
  }
  return { data };
})();

/** The cult's sign as candles: points across it and down it, as shares of its height, its top toward the altar. */
const SIGN_CANDLES: readonly (readonly [number, number])[] = [
  [-0.057, -0.48], [0.04, -0.48], [0.073, -0.457], [-0.027, -0.453], [-0.08, -0.443], [0.023, -0.443],
  [0.073, -0.417], [-0.04, -0.413], [-0.093, -0.403], [0.007, -0.403], [0.097, -0.383], [-0.1, -0.363],
  [0.09, -0.343], [-0.103, -0.323], [0.09, -0.303], [-0.1, -0.283], [-0.347, -0.277], [0.337, -0.277],
  [0.087, -0.263], [-0.31, -0.257], [0.3, -0.253], [-0.097, -0.243], [0.353, -0.24], [-0.353, -0.237],
  [-0.277, -0.233], [0.267, -0.227], [0.087, -0.223], [-0.25, -0.203], [-0.09, -0.203], [0.333, -0.203],
  [-0.337, -0.2], [0.24, -0.193], [-0.183, -0.183], [0.08, -0.183], [0.167, -0.183], [-0.223, -0.173],
  [0.313, -0.167], [-0.317, -0.163], [-0.147, -0.163], [-0.08, -0.163], [0.213, -0.163], [0.133, -0.153],
  [-0.197, -0.143], [0.067, -0.143], [0.18, -0.14], [0.287, -0.137], [-0.29, -0.133], [-0.123, -0.13],
  [-0.063, -0.127], [0.11, -0.12], [0.257, -0.11], [-0.26, -0.107], [0.05, -0.103], [-0.097, -0.1],
  [-0.047, -0.09], [0.087, -0.087], [0.223, -0.087], [-0.227, -0.083], [0.027, -0.07], [-0.19, -0.063],
  [0.183, -0.063], [-0.02, -0.06], [-0.15, -0.05], [0.137, -0.047], [-0.067, -0.043], [0.053, -0.04],
  [-0.11, -0.037], [0.01, -0.033], [0.093, -0.033], [-0.033, -0.02], [-0.187, -0.013], [0.16, -0.013],
  [0.2, -0.007], [0.033, 0.0], [-0.23, 0.003], [-0.007, 0.01], [0.237, 0.01], [-0.057, 0.017],
  [0.067, 0.023], [-0.26, 0.03], [-0.093, 0.037], [0.103, 0.04], [0.017, 0.043], [0.26, 0.043],
  [-0.143, 0.05], [-0.023, 0.05], [0.143, 0.05], [0.04, 0.077], [-0.047, 0.083], [-0.143, 0.09],
  [0.14, 0.09], [-0.01, 0.103], [0.07, 0.103], [-0.077, 0.11], [0.16, 0.127], [-0.16, 0.13],
  [0.103, 0.13], [-0.117, 0.133], [0.013, 0.137], [-0.027, 0.153], [0.007, 0.177], [-0.02, 0.207],
  [0.023, 0.213], [-0.003, 0.243], [0.02, 0.277], [-0.023, 0.28], [0.037, 0.313], [-0.033, 0.32],
  [0.003, 0.337], [-0.007, 0.377], [-0.007, 0.417], [-0.007, 0.457],
];
/** A candle's half width, its height (on the floor), and its flame's half width and height. */
const CANDLE_HW = 0.011;
const CANDLE_TALL = [0.03, 0.06] as const;
const FLAME_HW = 0.007;
const FLAME_TALL = 0.026;
/** How many have burnt down to a stub, unlit. */
const BURNT = 0.08;

/** A flame: two crossed sheets, each seen from both sides, narrowing to a point. */
function flame(out: number[], x: number, y: number, z: number) {
  const top = y + FLAME_TALL;
  for (const [ax, az] of [
    [FLAME_HW, 0],
    [0, FLAME_HW],
  ]) {
    quad(out, [x - ax, y, z - az], [x + ax, y, z + az], [x, top, z], [x, top, z], FLAME);
    quad(out, [x + ax, y, z + az], [x - ax, y, z - az], [x, top, z], [x, top, z], FLAME);
  }
}

/**
 * A candle sign: its candles as one model round the sign's middle with yaw 0 (its z is the place's x, its x
 * the place's −y), and their flames as another.
 */
function candleSign(map: WorldMap, key: string, seedX: number, seedY: number, sign: CandleSign): Junk[] {
  const roll = (k: number) => map.noise(seedX * 13 + k, seedY, 960);
  const model = (tris: number[]): StatueModel => ({ tris, atlasWidth: 16, atlasHeight: 8, stone: [40, 78, 40] });
  const { x, y, dirX, dirY } = sign;
  const wax: number[] = [];
  const flames: number[] = [];
  SIGN_CANDLES.forEach(([across, down], i) => {
    const r = (k: number) => roll(100 + i * 4 + k);
    const tall = CANDLE_TALL[0] + r(3) * (CANDLE_TALL[1] - CANDLE_TALL[0]);
    const burnt = r(0) < BURNT;
    const high = burnt ? tall * 0.3 : tall;
    // Across it, then down it from the ears; each a little off where it was meant to go.
    const cx = (-dirY * across + dirX * down) * CANDLE_SIGN_SIZE;
    const cy = (dirX * across + dirY * down) * CANDLE_SIGN_SIZE;
    const X = -cy + (r(1) - 0.5) * 0.03;
    const Z = cx + (r(2) - 0.5) * 0.03;
    box(wax, X - CANDLE_HW, X + CANDLE_HW, 0, high, Z - CANDLE_HW, Z + CANDLE_HW, WAX, WAX, WAX);
    if (!burnt) flame(flames, X, high, Z);
  });
  const at = { x, y, h: 0, yaw: 0, pitch: 0, roll: 0, solid: null };
  return [
    { key, kind: "candle", model: model(wax), ...at },
    { key: `${key}.flames`, kind: "flame", model: model(flames), ...at, glow: true },
  ];
}

/** The candle signs, by statue and map: laid out once. */
const candleSigns = new WeakMap<WorldMap, Map<Statue, Junk[]>>();

/** The candle signs in front of the statues near (x, y), whole: a sign's candles are one piece. */
function candleSignsAround(map: WorldMap, x: number, y: number, radius: number): Junk[] {
  const out: Junk[] = [];
  for (const statue of map.statuesAround(x, y, radius)) {
    const { sign } = statue;
    // Only the ones that could be in reach; a statue's region is far bigger.
    if (!sign || Math.hypot(sign.x - x, sign.y - y) > radius + CANDLE_SIGN_SIZE / 2) continue;
    const key = `candles${statue.cx},${statue.cy}`;
    out.push(...laidOut(candleSigns, map, statue, () => candleSign(map, key, statue.cx, statue.cy, sign)));
  }
  return out;
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
  // How far its furthest corner is from where it stands. The drawing leaves out whatever stands well behind the eye,
  // going by where it stands: a long table standing behind, or a candle sign laid out round its middle, would go with
  // its far end still in view.
  let reach = 0;
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
      reach = Math.max(reach, Math.hypot(X * rx + Z * fx, X * ry + Z * fy));
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
  return { x: junk.x, y: junk.y, count, corners, normals, centres, flags, reach };
}
