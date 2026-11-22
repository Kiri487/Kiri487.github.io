import { hash3, mod } from "./hash";
import type { WorldMap } from "./map";
import { WALL_MARKED, WALL_MARKED_WEIGHTS, WALL_MARKS, type WallMarkKind } from "./zones";

/*
 * What's happened to the walls, over their clean paper: damp, drips, tears, scuffs, cracks, tiles gone, mould. Each
 * face of wall rolls its own dice for whether it has any, which (by its zone, zones.ts), and where, and each mark is
 * drawn from its own dice, so no two are the same. Graffiti and posters go over them.
 */

/**
 * A mark on a face of wall, in the wall's own pixels (64 to a cell): across the face as its paper runs, and down from
 * where a ceiling 1 high would meet it (above that, negative). Its top left corner, its size, and its picture: a
 * colour for each pixel and how much of it covers the paper, 0–255. A `shade` mark's colours darken and tint the
 * paper, its pattern showing through, rather than cover it: a stain, not a patch.
 */
export interface WallMark {
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: Uint8ClampedArray;
  alpha: Uint8Array;
  shade?: boolean;
}

/** Most faces with marks have one; this many have a second. */
const SECOND_MARK = 0.25;
/** How far marks keep in from the face's sides, and from its top and the floor, in pixels. */
const MARGIN = 3;
/** The tiles are this many pixels a side, grout lines on the multiples. */
const TILE = 16;

/** The way out of each face of a wall cell: where it's seen from. */
const FACE_OUT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/**
 * Each face's marks, kept as worked out, and the cell they're on. Past FACES_KEPT faces, those further than FACES_NEAR
 * cells from the one asked for are let go: a long walk would keep every face it ever passed, and they're the same
 * worked out again.
 */
const known = new WeakMap<WorldMap, Map<string, { cx: number; cy: number; marks: WallMark[] | null }>>();
const FACES_KEPT = 6000;
const FACES_NEAR = 48;

/** The marks on face `face` of wall cell (cx, cy), or null for a clean one. The same every time for this map. */
export function wallMarksOn(map: WorldMap, cx: number, cy: number, face: number): WallMark[] | null {
  let faces = known.get(map);
  if (!faces) {
    faces = new Map();
    known.set(map, faces);
  }
  const key = `${cx},${cy},${face}`;
  let found = faces.get(key);
  if (!found) {
    if (faces.size >= FACES_KEPT) {
      for (const [k, f] of faces) {
        if (Math.abs(f.cx - cx) > FACES_NEAR || Math.abs(f.cy - cy) > FACES_NEAR) faces.delete(k);
      }
    }
    found = { cx, cy, marks: marksOf(map, cx, cy, face) };
    faces.set(key, found);
  }
  return found.marks;
}

function marksOf(map: WorldMap, cx: number, cy: number, face: number): WallMark[] | null {
  const fx = cx + FACE_OUT[face][0];
  const fy = cy + FACE_OUT[face][1];
  if (map.wall(fx, fy)) return null;
  const zone = map.zoneAt(fx, fy);
  const kinds = WALL_MARKS[zone];
  const die = (k: number) => map.noise(cx * 4 + face, cy, 610 + k);
  if (!kinds.length || die(0) >= WALL_MARKED * WALL_MARKED_WEIGHTS[zone]) return null;
  // From just under the ceiling, however high it is, to the floor.
  const top = Math.ceil((1 - map.ceilingAt(fx, fy)) * 64) + MARGIN;
  const bottom = 64 - MARGIN;
  const count = die(1) < SECOND_MARK ? 2 : 1;
  const marks: WallMark[] = [];
  for (let n = 0; n < count; n++) {
    const seed = Math.floor(die(2 + n * 2) * 0x7fffffff);
    const kind = pick(kinds, die(3 + n * 2));
    const mark = MAKERS[kind]((k) => hash3(seed, k, 811), top, bottom);
    if (!mark) continue;
    if (!SQUARE[kind]) fadeSides(mark);
    marks.push(mark);
  }
  return marks.length ? marks : null;
}

/**
 * The marks that keep to the wall's own lines (the tiles, the panelling's boards, the screws), whose edges are where
 * they are. Every other fades out toward the face's sides, so the face beside it, clean, doesn't cut it off straight.
 */
const SQUARE: Partial<Record<WallMarkKind, boolean>> = { missing: true, panel: true, screwPop: true, ghost: true };
const SIDE_FADE = 8;

function fadeSides(mark: WallMark) {
  for (let i = 0; i < mark.w; i++) {
    const x = mark.x + i;
    const fade = Math.min(1, Math.max(0, Math.min(x, 63 - x) / SIDE_FADE));
    if (fade >= 1) continue;
    for (let j = 0; j < mark.h; j++) mark.alpha[j * mark.w + i] *= fade;
  }
}

/** Which of `kinds` a die picks, by their shares. */
function pick(kinds: readonly (readonly [WallMarkKind, number])[], die: number): WallMarkKind {
  let left = die * kinds.reduce((sum, [, share]) => sum + share, 0);
  for (const [kind, share] of kinds) {
    if (left < share) return kind;
    left -= share;
  }
  return kinds[kinds.length - 1][0];
}

export type Dice = (k: number) => number;
type Maker = (r: Dice, top: number, bottom: number) => WallMark | null;

const MAKERS: Record<WallMarkKind, Maker> = {
  crack,
  missing,
  mould,
  damp,
  drips,
  mildew,
  ghost,
  panel,
  scuff,
  leak,
  mud,
  screwPop,
  pencil,
};

/** A blank mark, w × h pixels from (x, y). */
export function blank(x: number, y: number, w: number, h: number, shade = false): WallMark {
  return { x, y, w, h, rgb: new Uint8ClampedArray(w * h * 3), alpha: new Uint8Array(w * h), shade };
}

/** A blank mark covering the face from row y0 to y1, to be painted anywhere across it. */
const band = (y0: number, y1: number, shade = false) => blank(0, y0, 64, Math.max(1, y1 - y0 + 1), shade);

/** Paints pixel (x, y) of the wall, if it's in the mark, this colour, at least this much covered. */
export function put(mark: WallMark, x: number, y: number, r: number, g: number, b: number, a: number) {
  const i = x - mark.x;
  const j = y - mark.y;
  if (i < 0 || j < 0 || i >= mark.w || j >= mark.h) return;
  const k = j * mark.w + i;
  if (mark.alpha[k] >= a) return;
  mark.alpha[k] = a;
  mark.rgb[k * 3] = r;
  mark.rgb[k * 3 + 1] = g;
  mark.rgb[k * 3 + 2] = b;
}

/** Between lo and hi, by a die. */
export const within = (die: number, lo: number, hi: number) => lo + die * (hi - lo);

/**
 * A crack in the glaze: a thin grey line wandering from where it starts, mostly one way, sometimes with a branch off
 * it, a faint shadow under it.
 */
function crack(r: Dice, top: number, bottom: number): WallMark | null {
  const points: [number, number][] = [];
  const walk = (x: number, y: number, angle: number, steps: number, k: number) => {
    for (let s = 0; s < steps; s++) {
      angle += (r(k + s) - 0.5) * 0.7;
      x += Math.cos(angle);
      y += Math.sin(angle);
      if (x < MARGIN || x > 63 - MARGIN || y < top || y > bottom) return;
      points.push([Math.round(x), Math.round(y)]);
    }
  };
  const x0 = within(r(0), 12, 52);
  const y0 = within(r(1), top + 6, bottom - 6);
  // Mostly across or aslant: cracks in a tiled wall run with the weight on it more than up and down.
  const angle = (r(2) - 0.5) * 2.2 + (r(3) < 0.5 ? 0 : Math.PI);
  walk(x0, y0, angle, Math.round(within(r(4), 24, 70)), 100);
  if (r(5) < 0.5 && points.length > 8) {
    const [bx, by] = points[Math.floor(within(r(6), 0.2, 0.8) * points.length)];
    walk(bx, by, angle + (r(7) < 0.5 ? 1 : -1) * within(r(8), 0.5, 1.1), Math.round(within(r(9), 8, 22)), 300);
  }
  if (points.length < 6) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const mark = blank(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) - Math.min(...xs) + 3,
    Math.max(...ys) - Math.min(...ys) + 3);
  for (const [x, y] of points) put(mark, x, y + 1, 120, 116, 104, 30);
  for (const [x, y] of points) put(mark, x, y, 82, 78, 68, 165);
  return mark;
}

/**
 * Tiles gone, one to three side by side or one above another: the combed glue behind, a dark edge where the
 * neighbours' thickness shades it, and now and then a shard of the tile still stuck in a corner.
 */
function missing(r: Dice, top: number, bottom: number): WallMark | null {
  const rowFirst = Math.ceil(top / TILE);
  const rowLast = Math.floor(bottom / TILE) - 1;
  if (rowLast < rowFirst) return null;
  const count = 1 + Math.floor(r(0) * 3);
  const across = r(1) < 0.6;
  const col0 = Math.floor(r(2) * (across ? 5 - count : 4));
  const row0 = rowFirst + Math.floor(r(3) * (rowLast - rowFirst + 1 - (across ? 0 : count - 1)));
  if (row0 < rowFirst) return null;
  const cols = across ? count : 1;
  const rows = across ? 1 : Math.min(count, rowLast - row0 + 1);
  const mark = blank(col0 * TILE, row0 * TILE, cols * TILE + 1, rows * TILE + 1);
  // Which way the glue was combed: across, up and down, or aslant.
  const comb = Math.floor(r(4) * 3);
  for (let t = 0; t < cols * rows; t++) {
    const tx = (col0 + (t % cols)) * TILE;
    const ty = (row0 + Math.floor(t / cols)) * TILE;
    // A shard left in one corner, cut off along a slant.
    const shard = r(10 + t) < 0.35 ? Math.floor(r(20 + t) * 4) : -1;
    const shardSize = within(r(30 + t), 5, 11);
    for (let j = 0; j <= TILE; j++) {
      for (let i = 0; i <= TILE; i++) {
        const fromCorner = [i + j, TILE - i + j, i + TILE - j, 2 * TILE - i - j][shard] ?? Infinity;
        if (fromCorner < shardSize) continue;
        const grain = hash3(tx + i, ty + j, 977);
        // Up a high wall the rows are negative: a remainder that stays positive keeps the combing even.
        const ridge = comb === 0 ? mod(ty + j, 4) < 2 : comb === 1 ? mod(tx + i, 4) < 2 : mod(tx + i + ty + j, 5) < 2;
        let m = (0.82 + 0.22 * grain) * (ridge ? 0.78 : 1);
        // A faint shadow under the tile above, which stands out from the glue.
        if (j === 1) m *= 0.78;
        put(mark, tx + i, ty + j, 128 * m, 118 * m, 96 * m, 255);
      }
    }
  }
  return mark;
}

/** Smooth noise over the wall's pixels, `size` pixels to a step, for this mark's dice. */
export function blotch(x: number, y: number, size: number, seed: number): number {
  const gx = x / size;
  const gy = y / size;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let u = gx - ix;
  let v = gy - iy;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const at = (i: number, j: number) => hash3(ix + i, iy + j, seed);
  return (at(0, 0) * (1 - u) + at(1, 0) * u) * (1 - v) + (at(0, 1) * (1 - u) + at(1, 1) * u) * v;
}

/**
 * Mould, black and a little green, in the grout lines where it's damp, mostly low down, thinning out at its edges, and
 * a faint stain on the tiles over it.
 */
function mould(r: Dice, top: number, bottom: number): WallMark | null {
  const rx = within(r(0), 10, 26);
  const ry = within(r(1), 7, 18);
  const cx = within(r(2), MARGIN + rx * 0.5, 63 - MARGIN - rx * 0.5);
  // Mostly near the floor, where it's wettest; now and then anywhere up the wall.
  const low = r(3) < 0.7;
  const cy = low ? within(r(4), bottom - ry * 0.8, bottom) : within(r(4), top + ry * 0.5, bottom - ry * 0.5);
  const seed = Math.floor(r(5) * 100000);
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(63, Math.ceil(cx + rx));
  const y0 = Math.max(top, Math.floor(cy - ry));
  const y1 = Math.min(63, Math.ceil(cy + ry));
  if (x1 <= x0 || y1 <= y0) return null;
  const mark = blank(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const s = (1 - d) * (0.5 + 0.9 * blotch(x, y, 5, seed)) - 0.1;
      if (s <= 0) continue;
      // The grout and a pixel either side of it, where the damp sits; dots of it out on the tiles.
      const gx = x % TILE;
      const gy = ((y % TILE) + TILE) % TILE;
      const grout = gx === 0 || gy === 0;
      const beside = gx === 1 || gx === TILE - 1 || gy === 1 || gy === TILE - 1;
      const speck = hash3(x, y, seed + 1);
      if (grout) put(mark, x, y, 26, 34, 24, Math.min(255, s * 520));
      else if (beside || speck < s * 0.35) put(mark, x, y, 40, 50, 34, Math.min(220, s * 300));
      else put(mark, x, y, 118, 124, 92, Math.min(150, s * 190));
    }
  }
  return mark;
}

// ---- stains: shade marks, the paper showing through ----

/**
 * A patch of damp, anywhere up the wall or rising from the floor: the paper browned, most at the middle and fading
 * out to its edge, with a soft darker band near the edge where the water stopped and dried.
 */
function damp(r: Dice, top: number, bottom: number): WallMark | null {
  const rx = within(r(0), 14, 34);
  const ry = within(r(1), 12, 30);
  const cx = within(r(2), 8, 56);
  const rising = r(3) < 0.4;
  const cy = rising ? bottom : within(r(4), top + ry * 0.4, bottom - ry * 0.4);
  const seed = Math.floor(r(5) * 100000);
  const mark = band(Math.max(top, Math.floor(cy - ry)), Math.min(63, Math.ceil(cy + ry)), true);
  for (let y = mark.y; y < mark.y + mark.h; y++) {
    for (let x = 0; x < 64; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const s = (1 - d) * (0.55 + 0.9 * blotch(x, y, 9, seed)) - 0.2;
      if (s <= -0.05) continue;
      const inside = Math.min(1, Math.max(0, s) * 2.2) * 95;
      const tide = Math.exp(-(((s - 0.06) / 0.05) ** 2)) * 60;
      const a = inside + tide;
      if (a < 2) continue;
      // Browner where it's the tide line, yellower inside.
      const t = tide / a;
      put(mark, x, y, 200 - 40 * t, 182 - 46 * t, 132 - 40 * t, a);
    }
  }
  return mark;
}

/** Brown streaks of water run down from the ceiling, a few close together, each fading out where it dried. */
function drips(r: Dice, top: number, bottom: number): WallMark | null {
  const from = top - MARGIN;
  const count = 2 + Math.floor(r(0) * 5);
  const cx = within(r(1), 10, 54);
  let longest = 0;
  const streaks: [number, number, number][] = [];
  for (let n = 0; n < count; n++) {
    const x = Math.round(cx + (r(10 + n) - 0.5) * 22);
    const length = within(r(20 + n), 10, 56);
    streaks.push([x, 1 + Math.floor(r(30 + n) * 2), length]);
    longest = Math.max(longest, length);
  }
  const mark = band(from, Math.min(bottom, Math.ceil(from + longest)), true);
  // Where it came in: a band across the top of them.
  for (let y = from; y < from + 3; y++) {
    for (let x = Math.floor(cx - 14); x <= cx + 14; x++) put(mark, x, y, 170, 146, 98, 110 - (y - from) * 25);
  }
  for (const [x, w, length] of streaks) {
    for (let y = from; y < from + length && y <= bottom; y++) {
      const t = (y - from) / length;
      for (let i = 0; i < w; i++) put(mark, x + i, y, 168, 142, 92, (1 - t ** 1.5) * 150);
    }
  }
  return mark;
}

/** Water from the ceiling: a brown stain spreading down from the top, fading out at its edge, drips under it. */
function leak(r: Dice, top: number, bottom: number): WallMark | null {
  const from = top - MARGIN;
  const rx = within(r(0), 12, 28);
  const ry = within(r(1), 8, 22);
  const cx = within(r(2), 14, 50);
  const seed = Math.floor(r(3) * 100000);
  const runs = Math.floor(r(4) * 4);
  const mark = band(from, Math.min(bottom, Math.ceil(from + ry + 30)), true);
  for (let y = from; y < from + ry; y++) {
    for (let x = 0; x < 64; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - from) / ry) ** 2;
      const s = (1 - d) * (0.6 + 0.8 * blotch(x, y, 8, seed)) - 0.15;
      if (s <= -0.05) continue;
      const inside = Math.min(1, Math.max(0, s) * 2.2) * 100;
      const tide = Math.exp(-(((s - 0.06) / 0.05) ** 2)) * 50;
      const a = inside + tide;
      if (a < 2) continue;
      const t = tide / a;
      put(mark, x, y, 214 - 40 * t, 192 - 46 * t, 140 - 44 * t, a);
    }
  }
  // Runs out of it, starting well inside it in its own colour, so there's no seam where they leave it.
  for (let n = 0; n < runs; n++) {
    const x = Math.round(cx + (r(10 + n) - 0.5) * rx);
    const start = Math.floor(from + ry * 0.35);
    const length = within(r(20 + n), 12, 34) + ry * 0.4;
    for (let y = start; y < start + length && y <= bottom; y++) {
      const t = (y - start) / length;
      put(mark, x, y, 200, 176, 122, Math.min(1, t * 4) * (1 - t) * 150);
    }
  }
  return mark;
}

/** Chairs and bags rubbed against it: short grey and black strokes, mostly at chair height, some at a hand's. */
function scuff(r: Dice, top: number, bottom: number): WallMark | null {
  const high = r(0) < 0.3;
  const cy = high ? within(r(1), 18, 30) : within(r(1), 36, 48);
  if (cy < top || cy > bottom) return null;
  const cx = within(r(2), 12, 52);
  const count = 4 + Math.floor(r(3) * 9);
  const mark = band(Math.max(top, Math.floor(cy - 8)), Math.min(bottom, Math.ceil(cy + 8)), true);
  for (let n = 0; n < count; n++) {
    const x0 = cx + (r(10 + n) - 0.5) * 30;
    const y0 = cy + (r(30 + n) - 0.5) * 12;
    const length = within(r(50 + n), 3, 13);
    const slope = (r(70 + n) - 0.5) * 0.4;
    const dark = r(90 + n) < 0.3;
    const a = within(r(110 + n), 80, 180);
    for (let i = 0; i < length; i++) {
      const c = dark ? 70 : 140;
      put(mark, Math.round(x0 + i), Math.round(y0 + i * slope), c, c, c + 4, a * (1 - (i / length) * 0.5));
    }
  }
  return mark;
}

// ---- patches: what covers the paper ----

/** Mildew: a scatter of dark specks, thick in the middle and thinning out, a faint grey bloom round them. */
function mildew(r: Dice, top: number, bottom: number): WallMark | null {
  const radius = within(r(0), 7, 18);
  const cx = within(r(1), 8, 56);
  const cy = within(r(2), top + radius * 0.5, bottom - radius * 0.3);
  if (cy < top || cy > bottom) return null;
  const seed = Math.floor(r(3) * 100000);
  const mark = band(Math.max(top, Math.floor(cy - radius)), Math.min(bottom, Math.ceil(cy + radius)), true);
  for (let y = mark.y; y < mark.y + mark.h; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2) / radius;
      if (d >= 1) continue;
      const near = (1 - d) * (0.5 + 0.8 * blotch(x, y, 4, seed));
      put(mark, x, y, 150, 140, 100, near * 50);
      if (hash3(x, y, seed + 1) < near * near * 0.7) put(mark, x, y, 96, 86, 52, within(hash3(x, y, seed + 2), 110, 190));
    }
  }
  return mark;
}

/**
 * Where a picture hung for years: the paper under it never faded, so a rectangle of it is a little richer than the
 * rest, with the nail it hung from above.
 */
function ghost(r: Dice, top: number, bottom: number): WallMark | null {
  const w = Math.round(within(r(0), 14, 32));
  const h = Math.round(within(r(1), 12, 24));
  const x0 = Math.round(within(r(2), 4, 60 - w));
  const lowest = Math.min(bottom, 32) - h;
  const highest = Math.max(top + 6, 6);
  if (lowest < highest) return null;
  const y0 = Math.round(within(r(3), highest, lowest));
  const tilt = (r(4) - 0.5) * 0.06;
  const mark = band(y0 - 6, y0 + h + 1, true);
  for (let y = y0 - 1; y <= y0 + h + 1; y++) {
    for (let x = x0 - 1; x <= x0 + w + 1; x++) {
      // A slight tilt, as it hung; its edge one pixel soft.
      const sx = x - x0 - (y - y0) * tilt;
      const sy = y - y0 + (x - x0) * tilt;
      const inX = Math.min(sx + 0.5, w + 0.5 - sx);
      const inY = Math.min(sy + 0.5, h + 0.5 - sy);
      const cover = Math.max(0, Math.min(1, inX, inY));
      if (cover <= 0) continue;
      put(mark, x, y, 226, 200, 190, cover * 170);
    }
  }
  // The nail, a little above the middle of its top.
  const nx = Math.round(x0 + w / 2);
  const ny = y0 - 3 - Math.floor(r(5) * 3);
  put(mark, nx, ny, 60, 50, 46, 230);
  put(mark, nx, ny + 1, 150, 130, 120, 120);
  return mark;
}

/** The panelling: a board with a piece broken out of it, dark behind; or split along its grain. */
function panel(r: Dice, top: number, bottom: number): WallMark | null {
  const board = Math.floor(r(0) * 4) * 16;
  const mark = band(Math.max(37, top), Math.min(63, bottom + 3));
  if (r(1) < 0.5) {
    const y0 = Math.round(within(r(2), 40, 54));
    const y1 = Math.min(62, Math.round(y0 + within(r(3), 5, 14)));
    const seed = Math.floor(r(4) * 100000);
    for (let y = y0; y <= y1; y++) {
      const a = board + 2 + blotch(0, y, 3, seed) * 3;
      const b = board + 14 - blotch(7, y, 3, seed) * 3;
      // Darker up under the board left above it; its sides blend into the wood.
      const m = 0.6 + (0.4 * (y - y0)) / Math.max(1, y1 - y0);
      for (let x = Math.floor(a); x <= Math.ceil(b); x++) {
        const side = x === Math.floor(a) || x === Math.ceil(b) ? 150 : 255;
        put(mark, x, y, 44 * m, 33 * m, 22 * m, side);
      }
    }
  } else {
    const x = board + 4 + Math.floor(r(2) * 9);
    const y0 = Math.round(within(r(3), 38, 50));
    const length = within(r(4), 8, 22);
    for (let y = y0; y < Math.min(63, y0 + length); y++) {
      const wx = x + Math.round((blotch(0, y, 5, x) - 0.5) * 2);
      put(mark, wx, y, 30, 22, 14, 230);
      put(mark, wx + 1, y, 150, 108, 70, 120);
    }
  }
  return mark;
}

/** Joint compound slapped on and never sanded: over a seam, over a screw, or smeared wide and thin. */
function mud(r: Dice, top: number, bottom: number): WallMark | null {
  const where = r(0);
  let cx: number;
  let cy: number;
  let rx: number;
  let ry: number;
  if (where < 0.35) {
    // Down the seam at one side.
    cx = r(1) < 0.5 ? 2 : 62;
    cy = within(r(2), top + 10, bottom - 10);
    rx = within(r(3), 5, 9);
    ry = within(r(4), 10, 24);
  } else if (where < 0.7) {
    // Over a screw.
    cx = r(1) < 0.5 ? 20 : 44;
    cy = 6 + 14 * Math.floor(within(r(2), Math.max(0, (top - 6) / 14), 4));
    rx = within(r(3), 5, 9);
    ry = within(r(4), 4, 8);
  } else {
    cx = within(r(1), 14, 50);
    cy = within(r(2), top + 10, bottom - 10);
    rx = within(r(3), 10, 20);
    ry = within(r(4), 6, 14);
  }
  if (cy < top || cy > bottom) return null;
  const seed = Math.floor(r(5) * 100000);
  const thin = where >= 0.7;
  const mark = band(Math.max(top, Math.floor(cy - ry)), Math.min(bottom, Math.ceil(cy + ry)));
  for (let y = mark.y; y < mark.y + mark.h; y++) {
    for (let x = 0; x < 64; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const s = (1 - d) * (0.6 + 0.7 * blotch(x, y, 4, seed)) - 0.2;
      if (s <= 0) continue;
      // Knife marks through it, its edge feathered out thin.
      const g = (0.9 + 0.08 * hash3(x, y, seed)) * (0.94 + 0.1 * blotch(x * 3, y, 4, seed + 1));
      const cover = thin ? Math.min(170, s * 400) : Math.min(240, s * 900);
      put(mark, x, y, 226 * g, 224 * g, 216 * g, cover);
    }
  }
  return mark;
}

/** Screws pushed back out through the board: a raised ring round each, cracked, one to three down a row. */
function screwPop(r: Dice, top: number, bottom: number): WallMark | null {
  const x = r(0) < 0.5 ? 20 : 44;
  const rows: number[] = [];
  for (let y = 6; y <= bottom; y += 14) if (y >= top + 2) rows.push(y);
  if (!rows.length) return null;
  const first = Math.floor(r(1) * rows.length);
  const count = Math.min(rows.length - first, 1 + Math.floor(r(2) * 3));
  const mark = blank(x - 5, rows[first] - 5, 11, (count - 1) * 14 + 11);
  for (let n = 0; n < count; n++) {
    const y = rows[first + n];
    for (let j = -4; j <= 4; j++) {
      for (let i = -4; i <= 4; i++) {
        const d = Math.hypot(i, j);
        if (d < 1) put(mark, x + i, y + j, 70, 68, 64, 230);
        else if (d < 2.6) put(mark, x + i, y + j, j < 0 ? 232 : 186, j < 0 ? 230 : 182, j < 0 ? 224 : 172, 200);
        else if (d < 3.6 && j > 0) put(mark, x + i, y + j, 150, 146, 138, 110);
      }
    }
    // Hairline cracks out from the ring.
    for (let c = 0; c < 2; c++) {
      const a = r(10 + n * 3 + c) * Math.PI * 2;
      for (let t = 2.5; t < 5; t += 0.7) {
        put(mark, Math.round(x + Math.cos(a) * t), Math.round(y + Math.sin(a) * t), 110, 106, 98, 150);
      }
    }
  }
  return mark;
}

/** The builders' pencil: a level line with ticks along it, and now and then a cross or another line. */
function pencil(r: Dice, top: number, bottom: number): WallMark | null {
  const y = Math.round(within(r(0), Math.max(top, 10), Math.min(bottom, 52)));
  if (y < top || y > bottom) return null;
  const x0 = Math.round(within(r(1), 4, 30));
  const x1 = Math.min(60, Math.round(x0 + within(r(2), 16, 46)));
  const mark = band(Math.max(top, y - 12), Math.min(bottom, y + 12));
  const line = (x: number, yy: number, a = 140) => put(mark, x, yy, 92, 92, 98, a);
  for (let x = x0; x <= x1; x++) if (hash3(x, y, 401) > 0.12) line(x, y + (x - x0 > 30 && r(3) < 0.5 ? 1 : 0));
  const ticks = 2 + Math.floor(r(4) * 4);
  for (let n = 0; n < ticks; n++) {
    const tx = Math.round(within(r(10 + n), x0, x1));
    for (let j = -2; j <= 1; j++) line(tx, y + j);
  }
  if (r(5) < 0.4) {
    const cx = Math.round(within(r(6), 8, 56));
    const cy = y + (r(7) < 0.5 ? -7 : 7);
    for (let k = -2; k <= 2; k++) {
      line(cx + k, cy + k);
      line(cx + k, cy - k);
    }
  }
  if (r(8) < 0.3) {
    const y2 = y + (r(9) < 0.5 ? -9 : 9);
    for (let x = x0 + 4; x <= x1 - 6; x++) line(x, y2, 100);
  }
  return mark;
}
