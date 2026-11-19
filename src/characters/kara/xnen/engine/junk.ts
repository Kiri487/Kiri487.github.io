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
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
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

// ---- where they are ----

export type JunkKind = "monitor" | "chair" | "sign" | "door" | "exit" | "wetFloor";

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
  const t = Math.max(-1, Math.min(1, (dx * ax + dy * ay) / (ax * ax + ay * ay)));
  return Math.hypot(dx - ax * t, dy - ay * t);
}

/** Junk is worked out a square block at a time, this many cells across; each block has at most one of each kind. */
const BLOCK = 12;
/** How many blocks have a monitor, a chair, a sign, a door, an exit sign, a wet floor sign. */
const MONITOR_CHANCE = 0.09;
const CHAIR_CHANCE = 0.18;
const SIGN_CHANCE = 0.15;
const DOOR_CHANCE = 0.1;
const EXIT_CHANCE = 0.12;
const WET_CHANCE = 0.12;

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
  const signRoll = (k: number) => map.noise(bx * 31 + k, by, 720);
  if (signRoll(0) < SIGN_CHANCE) {
    const spot = spotIn(map, bx, by, signRoll);
    if (spot) found.push(placeSign(`s${bx},${by}`, spot, signRoll));
  }
  const doorRoll = (k: number) => map.noise(bx * 31 + k, by, 730);
  if (doorRoll(0) < DOOR_CHANCE) {
    const spot = spotIn(map, bx, by, doorRoll);
    if (spot) found.push(placeDoor(`d${bx},${by}`, spot, doorRoll));
  }
  const exitRoll = (k: number) => map.noise(bx * 31 + k, by, 740);
  if (exitRoll(0) < EXIT_CHANCE) {
    const spot = spotIn(map, bx, by, exitRoll);
    if (spot) found.push(placeExit(`e${bx},${by}`, spot, exitRoll));
  }
  const wetRoll = (k: number) => map.noise(bx * 31 + k, by, 750);
  if (wetRoll(0) < WET_CHANCE) {
    const spot = spotIn(map, bx, by, wetRoll);
    if (spot) found.push(placeWetFloor(`w${bx},${by}`, spot, wetRoll));
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

/** How many signs are printed back to front. */
const SIGN_MIRRORED = 0.3;

/** Where a sign's plate is, on an ordinary one: above head height, as on a street. */
const SIGN_MIDDLE = 0.72;

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
    return { ...base, model, x, y, h: 0, yaw, solid: { x, y, r: 0.1 } };
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
    // The pole on up through the ceiling, the plate anywhere from a little above its usual height to only its lower
    // edge hanging down into the room.
    const middle = SIGN_MIDDLE + 0.05 + roll(53) * (1 + R * 0.5 - SIGN_MIDDLE - 0.05);
    const model = signModel(kind, middle, mirrored, 1.3);
    return { ...base, model, x, y, h: 0, yaw, solid: { x, y, r: 0.1 } };
  }
  if (how < 0.7 && spot.wall) {
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    return {
      ...base,
      model: signModel(kind, SIGN_MIDDLE, mirrored),
      x: fx,
      y: fy,
      h: -0.1 + roll(43) * 0.3,
      yaw: roll(44) * Math.PI * 2,
      pitch: (roll(45) - 0.5) * 1.4,
      roll: (roll(46) - 0.5) * 1.4,
      solid: { x: fx - ox * 0.1, y: fy - oy * 0.1, r: 0.1 },
    };
  }
  // Sunk into the carpet, the plate anywhere from a little below its usual height to only its top edge showing. Half
  // of them straight down, half leaning. The pole's foot is kept just under the carpet, so a lean swings the plate
  // about the spot where the pole goes in.
  const plate = -R * 0.7 + roll(53) * (SIGN_MIDDLE - 0.05 + R * 0.7);
  const foot = 0.1;
  const leans = roll(56) < 0.5;
  return {
    ...base,
    model: signModel(kind, plate + foot, mirrored),
    x,
    y,
    h: -foot,
    yaw,
    pitch: leans ? (roll(54) - 0.5) * 1.2 : 0,
    roll: leans ? (roll(55) - 0.5) * 1.2 : 0,
    solid: { x, y, r: 0.12 },
  };
}

/** How many doors are fire doors; the rest are wooden. */
const FIRE_DOORS = 0.3;

/**
 * Doors, closed and going nowhere: standing on their own in the middle of a room, flat against a wall as if there
 * were somewhere behind it, driven aslant into a wall, upside down halfway through the ceiling, or sunk aslant into
 * the carpet. In the way edge on, across their width.
 */
function placeDoor(key: string, spot: Spot, roll: (k: number) => number): Junk {
  const model = DOORS[roll(70) < FIRE_DOORS ? "fire" : "wood"];
  const base = { key, kind: "door" as const, model, pitch: 0, roll: 0 };
  const how = roll(40);
  const reach = DOOR_W / 2 + FRAME;
  /** In the way across its width, turned to `yaw`. */
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
    return { ...base, x, y, h: 0, yaw, solid: solid(x, y, yaw) };
  }
  if (how < 0.4 && spot.wall) {
    // Driven into the wall at any angle, as far as its middle.
    const [ox, oy] = spot.wall;
    const [fx, fy] = wallFace(spot, spot.wall, 0.3 + roll(42) * 0.4);
    const yaw = roll(44) * Math.PI * 2;
    return {
      ...base,
      x: fx,
      y: fy,
      h: -0.1 + roll(43) * 0.25,
      yaw,
      pitch: (roll(45) - 0.5) * 1.2,
      roll: (roll(46) - 0.5) * 1.4,
      solid: solid(fx - ox * 0.12, fy - oy * 0.12, yaw),
    };
  }
  // Not far off the middle of the cell, so there's room to get round it in a corridor.
  const x = spot.cx + 0.4 + roll(50) * 0.2;
  const y = spot.cy + 0.4 + roll(51) * 0.2;
  // Half of them square to the walls, the rest at any angle.
  const yaw =
    roll(52) < 0.5 ? Math.floor(roll(53) * 4) * (Math.PI / 2) + (roll(54) - 0.5) * 0.1 : roll(53) * Math.PI * 2;
  if (how < 0.6) return { ...base, x, y, h: 0, yaw, solid: solid(x, y, yaw) };
  if (how < 0.8) {
    // Upside down, its foot up in the ceiling space; one hanging low enough is in the visitor's way too.
    const h = 1.1 + roll(55) * 0.3;
    return {
      ...base,
      x,
      y,
      h,
      yaw,
      pitch: (roll(56) - 0.5) * 0.5,
      roll: Math.PI + (roll(57) - 0.5) * 0.5,
      solid: solid(x, y, yaw, h - DOOR_H - FRAME > 0.55),
    };
  }
  return {
    ...base,
    x,
    y,
    h: -0.2 - roll(55) * 0.25,
    yaw,
    pitch: (roll(56) - 0.5) * 1,
    roll: (roll(57) - 0.5) * 1,
    solid: solid(x, y, yaw),
  };
}

/**
 * Exit signs, lit, pointing the way out of nowhere: high on a wall where they belong, hung from the ceiling, low on a
 * wall just over the carpet, or sunk aslant into the carpet. Half of them point the other way.
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
  if (how < 0.8) {
    // Up out of the way: only XN on the ceiling has to mind it.
    const model = exitModel("hanging", mirrored);
    return { ...base, model, x, y, h: 0.8 + roll(53) * 0.06, yaw, solid: { x, y, r: 0.12, overhead: true } };
  }
  return {
    ...base,
    model: exitModel("loose", mirrored),
    x,
    y,
    h: -0.02 - roll(53) * 0.05,
    yaw,
    pitch: (roll(54) - 0.5) * 1.2,
    roll: (roll(55) - 0.5) * 1.2,
    solid: { x, y, r: 0.12 },
  };
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
    return {
      ...base,
      x,
      y,
      h: -0.04 - roll(53) * 0.1,
      yaw,
      pitch: (roll(54) - 0.5) * 1.2,
      roll: (roll(55) - 0.5) * 1.2,
      solid: { x, y, r: 0.1 },
    };
  }
  // Upside down, its feet up in the ceiling space.
  return {
    ...base,
    x,
    y,
    h: 1.04 + roll(53) * 0.1,
    yaw,
    roll: Math.PI,
    solid: { x, y, r: 0.1, overhead: true },
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
