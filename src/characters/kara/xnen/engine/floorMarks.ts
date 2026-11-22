import { tileGone } from "./decay";
import { hash3, mod } from "./hash";
import type { WorldMap } from "./map";
import { blank, blotch, put, within, type Dice, type WallMark } from "./wallMarks";
import { FLOOR_MARKED, FLOOR_MARKED_WEIGHTS, FLOOR_MARKS, type FloorMarkKind } from "./zones";

/*
 * What's happened to the floor, over its own picture: by zone (zones.ts), damp and mildew, spills and burns, coffee,
 * oil and paint, cracks, scuffs, a square of lino gone; and a puddle's stain under every ceiling tile gone. A mark
 * belongs to a cell, from that cell's dice, but spreads onto the cells round it, so it isn't cut off at the cell's
 * edge; though only onto those of its own zone, whose floor it was made for.
 */

/**
 * A mark on the floor, in the floor's own pixels (64 to a cell) on the map: its top left corner, its size, and its
 * picture, as a wall's mark (wallMarks.ts); and the zone whose floor it's on, or null for any (a puddle's stain).
 */
export interface FloorMark extends WallMark {
  zone: number | null;
}

/**
 * How far a mark's middle is from its cell's, and how far it reaches from there, at most, in cells. Together under
 * 1.5, so a mark reaches no further than the cells right round its own: those are all floorMarksAt looks in.
 */
const OFF_MIDDLE = 0.25;
const REACH = 1.2;

/** Each cell's own marks, those whose middle is in it, as worked out; and the marks reaching each cell, from those. */
const anchors = new WeakMap<WorldMap, Map<string, FloorMark[] | null>>();
const cells = new WeakMap<WorldMap, Map<string, { cx: number; cy: number; marks: FloorMark[] | null }>>();
/** Past this many cells kept, those further than CELLS_NEAR from the one asked for are let go; if none are, all. */
const CELLS_KEPT = 8000;
const CELLS_NEAR = 48;

/**
 * How many cells' own marks may still be worked out this frame (floorMarksFrame). Past that, a cell whose marks would
 * need more is left without them for now, and asked for again next frame: so a whole new stretch seen at once comes
 * in over a few frames rather than holding one up.
 */
let budget = Infinity;
const NOT_YET = Symbol("not yet");

/** Starts a frame: `most` cells' own marks may be worked out in it. */
export function floorMarksFrame(most: number) {
  budget = most;
}

/**
 * The marks on the floor of cell (cx, cy), from it and the cells round it, or null for none; or undefined if they
 * aren't all worked out yet and this frame's had its share (floorMarksFrame).
 */
export function floorMarksAt(map: WorldMap, cx: number, cy: number): FloorMark[] | null | undefined {
  let known = cells.get(map);
  if (!known) {
    known = new Map();
    cells.set(map, known);
  }
  const key = `${cx},${cy}`;
  let found = known.get(key);
  if (!found) {
    if (known.size >= CELLS_KEPT) {
      const before = known.size;
      for (const [k, c] of known) {
        if (Math.abs(c.cx - cx) > CELLS_NEAR || Math.abs(c.cy - cy) > CELLS_NEAR) known.delete(k);
      }
      if (known.size === before) known.clear();
      // What the cells were made from goes too; it's the same worked out again.
      anchors.get(map)?.clear();
    }
    if (map.roomAt(cx, cy) === "pit") {
      found = { cx, cy, marks: null };
      known.set(key, found);
      return null;
    }
    const zone = map.zoneAt(cx, cy);
    let marks: FloorMark[] | null = null;
    const [x0, y0] = [cx * 64, cy * 64];
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const own = anchoredAt(map, cx + i, cy + j);
        if (own === NOT_YET) return undefined;
        for (const mark of own ?? []) {
          if (mark.zone !== null && mark.zone !== zone) continue;
          if (mark.x >= x0 + 64 || mark.y >= y0 + 64 || mark.x + mark.w <= x0 || mark.y + mark.h <= y0) continue;
          (marks ??= []).push(mark);
        }
      }
    }
    found = { cx, cy, marks };
    known.set(key, found);
  }
  return found.marks;
}

/** The marks whose middle is in cell (cx, cy); NOT_YET if they'd need working out and this frame's had its share. */
function anchoredAt(map: WorldMap, cx: number, cy: number): FloorMark[] | null | typeof NOT_YET {
  let known = anchors.get(map);
  if (!known) {
    known = new Map();
    anchors.set(map, known);
  }
  const key = `${cx},${cy}`;
  let marks = known.get(key);
  if (marks === undefined) {
    if (budget <= 0) return NOT_YET;
    marks = marksOf(map, cx, cy);
    if (marks) budget--;
    known.set(key, marks);
  }
  return marks;
}

function marksOf(map: WorldMap, cx: number, cy: number): FloorMark[] | null {
  if (map.wall(cx, cy) || map.roomAt(cx, cy) === "pit") return null;
  const marks: FloorMark[] = [];
  // Under each ceiling tile gone (a light's never is), where the drips have landed: on whatever floor is there.
  if (!map.lampAt(cx, cy)) {
    for (let k = 0; k < 4; k++) {
      const [tx, ty] = [cx * 2 + (k & 1), cy * 2 + (k >> 1)];
      if (!tileGone(map, tx, ty)) continue;
      const mark = puddle((n) => map.noise(tx, ty, 900 + n), tx * 32 + 16, ty * 32 + 16);
      marks.push({ ...mark, zone: null });
    }
  }
  const zone = map.zoneAt(cx, cy);
  const kinds = FLOOR_MARKS[zone];
  const die = (k: number) => map.noise(cx, cy, 640 + k);
  if (kinds.length && die(0) < FLOOR_MARKED * FLOOR_MARKED_WEIGHTS[zone]) {
    const seed = Math.floor(die(1) * 0x7fffffff);
    const r: Dice = (k) => hash3(seed, k, 821);
    const mx = (cx + 0.5 + (r(0) - 0.5) * 2 * OFF_MIDDLE) * 64;
    const my = (cy + 0.5 + (r(1) - 0.5) * 2 * OFF_MIDDLE) * 64;
    marks.push({ ...MAKERS[pick(kinds, die(2))](r, mx, my), zone });
  }
  return marks.length ? marks : null;
}

/** Which of `kinds` a die picks, by their shares. */
function pick(kinds: readonly (readonly [FloorMarkKind, number])[], die: number): FloorMarkKind {
  let left = die * kinds.reduce((sum, [, share]) => sum + share, 0);
  for (const [kind, share] of kinds) {
    if (left < share) return kind;
    left -= share;
  }
  return kinds[kinds.length - 1][0];
}

type Maker = (r: Dice, mx: number, my: number) => WallMark;
const MAKERS: Record<FloorMarkKind, Maker> = {
  wet,
  mildew: floorMildew,
  spill,
  burns,
  rug,
  tileSwap,
  coffee,
  crack: floorCrack,
  oil,
  paint,
  scuffs,
  linoGone,
  yellowed,
};

/** REACH in pixels: no mark reaches further from its middle than this. */
const FURTHEST = REACH * 64;

/**
 * A stain, blotchy, `rx` × `ry` round (mx, my), fading out to nothing at its edge: `colour` darkens and tints the
 * floor, as much as `most` (0–255) at its thickest.
 */
function stain(
  r: Dice,
  mx: number,
  my: number,
  rx: number,
  ry: number,
  colour: readonly [number, number, number],
  most: number,
  grain = 12,
  box = Math.max(rx, ry),
): WallMark {
  const seed = Math.floor(r(90) * 100000);
  const mark = around(mx, my, Math.max(rx, ry, box), true);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [mark.x + i, mark.y + j];
      const d = ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2;
      if (d >= 0.89) continue;
      const s = (1 - d) * (0.5 + 0.9 * blotch(x, y, grain, seed)) - 0.15;
      if (s <= 0) continue;
      // Thickest at the middle, thinning out all the way to its edge.
      put(mark, x, y, colour[0], colour[1], colour[2], Math.min(1, s * 1.5) * most);
    }
  }
  return mark;
}

/** Round drops of `colour` round (mx, my), `count` of them out to `spread`, each 1–`size` pixels across. */
function drops(
  mark: WallMark,
  r: Dice,
  k: number,
  mx: number,
  my: number,
  count: number,
  spread: number,
  size: number,
  colour: readonly [number, number, number],
  most: number,
) {
  for (let n = 0; n < count; n++) {
    const a = r(k + n) * Math.PI * 2;
    const t = within(r(k + 40 + n), 0.2, 1) * spread;
    const [sx, sy] = [Math.round(mx + Math.cos(a) * t), Math.round(my + Math.sin(a) * t)];
    const radius = 0.6 + r(k + 80 + n) * size;
    for (let j = -Math.ceil(radius); j <= radius; j++) {
      for (let i = -Math.ceil(radius); i <= radius; i++) {
        const e = Math.hypot(i, j) / (radius + 0.4);
        if (e < 1) put(mark, sx + i, sy + j, colour[0], colour[1], colour[2], Math.min(1, (1 - e) * 2.5) * most);
      }
    }
  }
}

/** A blank mark round (mx, my), reaching `reach` pixels every way. */
const around = (mx: number, my: number, reach: number, shade: boolean) =>
  blank(Math.floor(mx - reach), Math.floor(my - reach), Math.ceil(reach * 2) + 1, Math.ceil(reach * 2) + 1, shade);

/** A patch wetter than the rest, darker and a little greener, blotchy, fading out to nothing at its edge. */
function wet(r: Dice, mx: number, my: number): WallMark {
  const rx = within(r(2), 26, REACH * 64 * 0.9);
  const ry = within(r(3), 26, REACH * 64 * 0.9);
  const seed = Math.floor(r(4) * 100000);
  const mark = around(mx, my, Math.max(rx, ry), true);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [mark.x + i, mark.y + j];
      const d = ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2;
      // Out past where even the blotchiest of it could reach.
      if (d >= 0.89) continue;
      const s = (1 - d) * (0.5 + 0.9 * blotch(x, y, 14, seed)) - 0.15;
      if (s <= 0) continue;
      put(mark, x, y, 150, 138, 96, Math.min(1, s * 2.5) * 150);
    }
  }
  return mark;
}

/** Mildew in the pile: dark, a little green, in specks thick at the middle and thinning out. */
function floorMildew(r: Dice, mx: number, my: number): WallMark {
  const radius = within(r(2), 18, 36);
  const seed = Math.floor(r(3) * 100000);
  const mark = around(mx, my, radius, false);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [mark.x + i, mark.y + j];
      const d = Math.hypot(x - mx, y - my) / radius;
      if (d >= 1) continue;
      const near = (1 - d) * (0.6 + 0.8 * blotch(x, y, 6, seed));
      if (hash3(x, y, seed + 1) < near * 0.8) put(mark, x, y, 40, 46, 22, within(hash3(x, y, seed + 2), 170, 240));
      else put(mark, x, y, 76, 80, 40, Math.min(1, near * 1.4) * 110);
    }
  }
  return mark;
}

/**
 * Where it's dripped through a ceiling tile gone, at (mx, my): a dark round stain, darkest at its middle, and a few
 * splashes round it.
 */
function puddle(r: Dice, mx: number, my: number): WallMark {
  const radius = within(r(0), 18, 34);
  const seed = Math.floor(r(1) * 100000);
  const mark = around(mx, my, radius * 1.6, true);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [mark.x + i, mark.y + j];
      const far = Math.hypot(x - mx, y - my);
      if (far >= radius * 1.2) continue;
      const d = far / (radius * (0.8 + 0.4 * blotch(x, y, 9, seed)));
      if (d < 1) put(mark, x, y, 118, 108, 84, Math.min(1, (1 - d) * 3) * 190);
    }
  }
  // Splashes: small dark spots round it.
  const splashes = 3 + Math.floor(r(2) * 6);
  for (let n = 0; n < splashes; n++) {
    const a = r(10 + n) * Math.PI * 2;
    const t = within(r(20 + n), 1.05, 1.5) * radius;
    const [sx, sy] = [Math.round(mx + Math.cos(a) * t), Math.round(my + Math.sin(a) * t)];
    const size = 1 + Math.floor(r(30 + n) * 3);
    for (let j = -size; j <= size; j++) {
      for (let i = -size; i <= size; i++) {
        const k = Math.hypot(i, j) / (size + 0.5);
        if (k < 1) put(mark, sx + i, sy + j, 118, 108, 84, (1 - k) * 170);
      }
    }
  }
  return mark;
}

// ---- house: the old dark red carpet ----

/** Something spilled and soaked in long ago: darker, a little browner, splashes round it. */
function spill(r: Dice, mx: number, my: number): WallMark {
  const rx = within(r(2), 14, 34);
  const ry = within(r(3), 10, 26);
  // The box takes in the furthest drop, and all of it.
  const spread = Math.max(rx, ry) * 1.3;
  const mark = stain(r, mx, my, rx * 1.4, ry * 1.4, [150, 116, 108], 170, 9, spread + 4);
  drops(mark, r, 100, mx, my, 2 + Math.floor(r(4) * 5), spread, 2, [150, 116, 108], 150);
  return mark;
}

/** Cigarette burns, one to three: a black pit melted into the pile, fading brown round it. */
function burns(r: Dice, mx: number, my: number): WallMark {
  const mark = around(mx, my, 30, false);
  const count = 1 + Math.floor(r(2) * 3);
  for (let n = 0; n < count; n++) {
    const sx = Math.round(mx + (r(10 + n) - 0.5) * 40);
    const sy = Math.round(my + (r(20 + n) - 0.5) * 40);
    const long = within(r(30 + n), 3.5, 6.5);
    const angle = r(40 + n) * Math.PI;
    for (let j = -9; j <= 9; j++) {
      for (let i = -9; i <= 9; i++) {
        // A little long, the way the ash lay.
        const along = i * Math.cos(angle) + j * Math.sin(angle);
        const across = -i * Math.sin(angle) + j * Math.cos(angle);
        const e = Math.hypot(along / long, across / 3);
        if (e < 0.6) put(mark, sx + i, sy + j, 26, 18, 16, 235);
        else if (e < 1.4) put(mark, sx + i, sy + j, 62, 34, 26, (1.4 - e) * 220);
      }
    }
  }
  return mark;
}

/** Where a rug lay for years: the carpet under it less worn, a soft-edged rectangle a little richer than round it. */
function rug(r: Dice, mx: number, my: number): WallMark {
  const w = within(r(2), 60, FURTHEST * 1.6);
  const h = within(r(3), 44, FURTHEST * 1.3);
  const mark = around(mx, my, Math.max(w, h) / 2 + 2, true);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [mark.x + i, mark.y + j];
      const inX = w / 2 - Math.abs(x + 0.5 - mx);
      const inY = h / 2 - Math.abs(y + 0.5 - my);
      const cover = Math.min(1, inX / 3, inY / 3);
      if (cover > 0) put(mark, x, y, 214, 196, 196, cover * 150);
    }
  }
  return mark;
}

// ---- office: carpet tiles ----

/** A carpet tile put in since, a newer blue than the rest, lined up with the tiles round it. */
function tileSwap(r: Dice, mx: number, my: number): WallMark {
  const x0 = Math.floor(mx / 32) * 32;
  const y0 = Math.floor(my / 32) * 32;
  // Now and then two side by side.
  const two = r(2) < 0.3;
  const across = r(3) < 0.5;
  const mark = blank(x0, y0, two && across ? 64 : 32, two && !across ? 64 : 32, true);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      // The seams between tiles stay the seams.
      if (i % 32 === 0 || j % 32 === 0) continue;
      put(mark, x0 + i, y0 + j, 212, 224, 250, 210);
    }
  }
  return mark;
}

/** Coffee spilled: a brown stain, darker where it pooled, a few drops round it. */
function coffee(r: Dice, mx: number, my: number): WallMark {
  const rx = within(r(2), 8, 20);
  const ry = within(r(3), 7, 16);
  const spread = Math.max(rx, ry) * 2;
  const mark = stain(r, mx, my, rx * 1.4, ry * 1.4, [196, 158, 120], 200, 6, spread + 4);
  drops(mark, r, 100, mx, my, 3 + Math.floor(r(4) * 6), spread, 1.5, [196, 158, 120], 190);
  return mark;
}

// ---- drywall: bare concrete ----

/** A crack in the slab: a thin dark line wandering across a cell or so, sometimes forking. */
function floorCrack(r: Dice, mx: number, my: number): WallMark {
  const points: [number, number][] = [];
  const walk = (x: number, y: number, angle: number, steps: number, k: number) => {
    for (let n = 0; n < steps; n++) {
      angle += (r(k + n) - 0.5) * 0.5;
      x += Math.cos(angle);
      y += Math.sin(angle);
      if (Math.hypot(x - mx, y - my) > FURTHEST - 2) return;
      points.push([Math.round(x), Math.round(y)]);
    }
  };
  const angle = r(2) * Math.PI * 2;
  const half = within(r(3), 30, FURTHEST - 4);
  // Out from the middle both ways.
  walk(mx, my, angle, Math.round(half), 100);
  walk(mx, my, angle + Math.PI, Math.round(half * within(r(4), 0.4, 1)), 300);
  if (r(5) < 0.5 && points.length > 10) {
    const [bx, by] = points[Math.floor(r(6) * points.length)];
    walk(bx, by, angle + (r(7) < 0.5 ? 1 : -1) * within(r(8), 0.4, 1), Math.round(within(r(9), 10, 30)), 500);
  }
  const mark = around(mx, my, FURTHEST, false);
  for (const [x, y] of points) put(mark, x + 1, y, 92, 88, 80, 50);
  for (const [x, y] of points) put(mark, x, y, 64, 62, 56, 175);
  return mark;
}

/** An oil stain soaked into the concrete: dark, blotchy, darkest in the middle. */
function oil(r: Dice, mx: number, my: number): WallMark {
  return stain(r, mx, my, within(r(2), 18, 42), within(r(3), 16, 36), [128, 126, 120], 160, 7);
}

/**
 * The painters were here: old specks of paint, mostly off-white, gone grey with the dirt walked over them, in a
 * scatter or along the way a can was carried.
 */
function paint(r: Dice, mx: number, my: number): WallMark {
  const colours = [
    [170, 168, 158],
    [170, 168, 158],
    [166, 160, 132],
    [134, 144, 152],
  ] as const;
  const colour = colours[Math.floor(r(2) * colours.length)];
  const mark = around(mx, my, FURTHEST, false);
  if (r(3) < 0.5) {
    drops(mark, r, 100, mx, my, 8 + Math.floor(r(4) * 18), within(r(5), 14, 40), 0.9, colour, 170);
  } else {
    // Along a line: drips every so often as someone walked.
    const angle = r(4) * Math.PI * 2;
    const length = within(r(5), 40, FURTHEST * 1.6);
    const count = 5 + Math.floor(r(6) * 10);
    for (let n = 0; n < count; n++) {
      const t = (n / count - 0.5) * length;
      drops(mark, r, 200 + n * 3, mx + Math.cos(angle) * t, my + Math.sin(angle) * t, 1, 3, 0.8, colour, 170);
    }
  }
  return mark;
}

// ---- tiles: checked lino ----

/** Black heel marks: short curved strokes, a few together, all ways. */
function scuffs(r: Dice, mx: number, my: number): WallMark {
  const mark = around(mx, my, 42, false);
  const count = 3 + Math.floor(r(2) * 7);
  for (let n = 0; n < count; n++) {
    let x = mx + (r(10 + n) - 0.5) * 50;
    let y = my + (r(30 + n) - 0.5) * 50;
    let angle = r(50 + n) * Math.PI * 2;
    const bend = (r(70 + n) - 0.5) * 0.3;
    const length = within(r(90 + n), 4, 15);
    const a = within(r(110 + n), 130, 210);
    for (let k = 0; k < length; k++) {
      put(mark, Math.round(x), Math.round(y), 34, 34, 36, a * (1 - (k / length) * 0.6));
      angle += bend;
      x += Math.cos(angle);
      y += Math.sin(angle);
    }
  }
  return mark;
}

/** A square of lino come up and gone, one or two, the brown adhesive under it, combed. */
function linoGone(r: Dice, mx: number, my: number): WallMark {
  const x0 = Math.floor(mx / 16) * 16;
  const y0 = Math.floor(my / 16) * 16;
  const two = r(2) < 0.35;
  const across = r(3) < 0.5;
  const mark = blank(x0, y0, two && across ? 32 : 16, two && !across ? 32 : 16, false);
  const comb = Math.floor(r(4) * 3);
  const seed = Math.floor(r(5) * 100000);
  for (let j = 0; j < mark.h; j++) {
    for (let i = 0; i < mark.w; i++) {
      const [x, y] = [x0 + i, y0 + j];
      const ridge = comb === 0 ? mod(y, 4) < 2 : comb === 1 ? mod(x, 4) < 2 : mod(x + y, 5) < 2;
      const m = (0.84 + 0.2 * hash3(x, y, seed)) * (ridge ? 0.82 : 1);
      put(mark, x, y, 146 * m, 126 * m, 88 * m, 255);
    }
  }
  return mark;
}

/** A patch gone yellow, where the sun or something spilt got at it. */
function yellowed(r: Dice, mx: number, my: number): WallMark {
  return stain(r, mx, my, within(r(2), 20, 46), within(r(3), 16, 40), [244, 224, 160], 150, 14);
}
