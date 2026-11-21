import type { Lighting } from "./lighting";
import { PIT_COUNT, PIT_PITCH, PIT_RIM, ROOM_BLOCK, overPit, type PitField, type WorldMap } from "./map";
import { CARPET, CARPET_FLIP, CARPET_SIZE, PIT_SIDE } from "./textures";

/*
 * The pits in a pit room, drawn over the floor the raycaster has already filled in. Each screen column's ray is cut
 * where it crosses the edge of a rim, and the stretches between are rims or pits. Going front to back, a rim's top
 * fills the rows nothing nearer has, and the far side of each pit stands up behind it, going down into the dark
 * until it can't be seen: the pits have no bottom to see. From down in a pit (eye below 0) the rims' tops can't be
 * seen, and the pit's sides hide everything beyond them.
 */

/** How quickly a pit's sides go dark, per ceiling height down. */
const PIT_DARKEN = 2.2;
/** Below this the sides are black, and drawing stops. */
const PIT_BLACK = 0.02;
/** The sides are a little darker than the floor above them, those running one way more than the other. */
const PIT_SIDE_SHADE = [0.85, 0.7];
/** Down a pit, past where its sides go black. */
const VOID: readonly [number, number, number] = [3, 3, 2];

/** The carpet picture's size, for wrapping pixels into it, as in render.ts. */
const CARPET_MASK = CARPET_SIZE - 1;
const CARPET_SHIFT = Math.log2(CARPET_SIZE);

/** What the pits need from the frame being drawn. */
export interface PitView {
  pixels: Uint8ClampedArray;
  /** How far off each pixel is, filled in where a rim or a pit's side is drawn, for what's drawn over them. */
  depth: Float32Array;
  width: number;
  height: number;
  /** How far each column's ray goes before a wall. */
  wallDepth: Float32Array;
  camX: number;
  camY: number;
  /** Eye height: 0 is the floor, below 0 down in a pit. */
  eye: number;
  dirX: number;
  dirY: number;
  /** The camera plane: half the picture's width, one cell ahead. */
  planeX: number;
  planeY: number;
  focal: number;
  horizon: number;
  fogK: number;
  fog: readonly [number, number, number];
  /** Nothing is drawn past this many cells. */
  far: number;
}

/** The fields of pits in every pit room within `radius` of (x, y). */
export function pitFieldsNear(map: WorldMap, x: number, y: number, radius: number): PitField[] {
  const out: PitField[] = [];
  for (let by = Math.floor((y - radius) / ROOM_BLOCK); by <= Math.floor((y + radius) / ROOM_BLOCK); by++) {
    for (let bx = Math.floor((x - radius) / ROOM_BLOCK); bx <= Math.floor((x + radius) / ROOM_BLOCK); bx++) {
      const field = map.pitFieldAt(bx * ROOM_BLOCK, by * ROOM_BLOCK);
      if (field) out.push(field);
    }
  }
  return out;
}

/**
 * Where a ray from (px, py) going (rx, ry) per unit enters and leaves a field, and which way the edge it leaves by
 * runs (0 along y, 1 along x). It misses if the first is past the second.
 */
function crossing(field: PitField, px: number, py: number, rx: number, ry: number): [number, number, number] {
  let tin = -Infinity;
  let tout = Infinity;
  let outAxis = 0;
  for (let axis = 0; axis < 2; axis++) {
    const p = axis === 0 ? px : py;
    const r = axis === 0 ? rx : ry;
    const lo = axis === 0 ? field.x0 : field.y0;
    if (r === 0) {
      if (p < lo || p > lo + field.size) return [1, 0, 0];
      continue;
    }
    let a = (lo - p) / r;
    let b = (lo + field.size - p) / r;
    if (a > b) [a, b] = [b, a];
    if (a > tin) tin = a;
    if (b < tout) {
      tout = b;
      outAxis = axis;
    }
  }
  return [tin, tout, outAxis];
}

/** Fog for something this far off, 0–1. */
function fogAt(t: number, fogK: number): number {
  const f = Math.max(1 - Math.exp(-t * fogK), (t - 20) / 8);
  return f > 1 ? 1 : f;
}

/** Where a rim's edges are, from its line: either side between pits, and all on the inside along the walls. */
const RIM_SIDES = [-PIT_RIM, PIT_RIM];
const WALL_RIM_IN = [PIT_RIM * 2];
const WALL_RIM_OUT = [-PIT_RIM * 2];

// Reused from column to column: where the ray crosses an edge, which way that edge runs (0 along y, 1 along x, -1
// where the ray stops short of one), and whether the stretch after each cut is over a pit.
const cuts: number[] = [];
const cutAxis: number[] = [];
const overHole: boolean[] = [];

export function drawPits(v: PitView, fields: readonly PitField[], light: Lighting) {
  if (!fields.length) return;
  const { pixels: d, depth, width: W, height: H, wallDepth, camX: px, camY: py, eye: z, focal, horizon, fogK } = v;
  const [FR, FG, FB] = v.fog;
  const seen: { field: PitField; tin: number; tout: number; outAxis: number }[] = [];
  for (let x = 0; x < W; x++) {
    const cam = (2 * (x + 0.5)) / W - 1;
    const rx = v.dirX + v.planeX * cam;
    const ry = v.dirY + v.planeY * cam;
    const end = Math.min(wallDepth[x], v.far);
    // Rows from here down are taken by something nearer.
    let ymax = H;
    // The column's fields, nearest first. Rarely more than one.
    seen.length = 0;
    for (const field of fields) {
      const [tin, tout, outAxis] = crossing(field, px, py, rx, ry);
      const t0 = Math.max(0.01, tin);
      // The field's edges are the room's walls, so a ray that reaches one ends there; a hair's leeway either way.
      const stops = tout <= end + 1e-4;
      const t1 = Math.min(end, tout);
      if (t0 < t1) seen.push({ field, tin: t0, tout: t1, outAxis: stops ? outAxis : -1 });
    }
    if (seen.length > 1) seen.sort((a, b) => a.tin - b.tin);
    for (const { field, tin, tout, outAxis } of seen) {
      cuts.length = 0;
      cutAxis.length = 0;
      cuts.push(tin);
      cutAxis.push(-1);
      for (let k = 0; k <= PIT_COUNT; k++) {
        // Along the walls the rim is all on the inside.
        for (const s of k === 0 ? WALL_RIM_IN : k === PIT_COUNT ? WALL_RIM_OUT : RIM_SIDES) {
          if (rx !== 0) {
            const t = (field.x0 + k * PIT_PITCH + s - px) / rx;
            if (t > tin && t < tout) {
              cuts.push(t);
              cutAxis.push(0);
            }
          }
          if (ry !== 0) {
            const t = (field.y0 + k * PIT_PITCH + s - py) / ry;
            if (t > tin && t < tout) {
              cuts.push(t);
              cutAxis.push(1);
            }
          }
        }
      }
      cuts.push(tout);
      cutAxis.push(outAxis);
      // A couple of dozen cuts at most: an insertion sort, keeping each cut's axis with it.
      for (let a = 1; a < cuts.length; a++) {
        const t = cuts[a];
        const axis = cutAxis[a];
        let b = a - 1;
        for (; b >= 0 && cuts[b] > t; b--) {
          cuts[b + 1] = cuts[b];
          cutAxis[b + 1] = cutAxis[b];
        }
        cuts[b + 1] = t;
        cutAxis[b + 1] = axis;
      }
      overHole.length = 0;
      for (let c = 0; c + 1 < cuts.length; c++) {
        const mid = (cuts[c] + cuts[c + 1]) / 2;
        overHole.push(overPit(field, px + rx * mid, py + ry * mid));
      }
      for (let c = 0; c + 1 < cuts.length; c++) {
        const near = cuts[c];
        const far = cuts[c + 1];
        if (far - near < 1e-6) continue;
        if (!overHole[c]) {
          // A rim's top, the same carpet as the floor round it. Only seen from above.
          if (z <= 0) continue;
          const ya = Math.max(0, Math.floor(horizon + (z * focal) / far - 0.5) + 1);
          const yb = Math.min(ymax - 1, H - 1, Math.floor(horizon + (z * focal) / near - 0.5));
          for (let y = ya; y <= yb; y++) {
            const t = (z * focal) / (y + 0.5 - horizon);
            const wx = px + rx * t;
            const wy = py + ry * t;
            const f = fogAt(t, fogK);
            const li = light.at(wx, wy) * (1 - f);
            const tx = Math.floor(wx * 64);
            const ty = Math.floor(wy * 64);
            let cu = tx & CARPET_MASK;
            let cv = ty & CARPET_MASK;
            if (CARPET_FLIP[(tx >> CARPET_SHIFT) & 255]) cu = CARPET_MASK - cu;
            if (CARPET_FLIP[(ty >> CARPET_SHIFT) & 255]) cv = CARPET_MASK - cv;
            const ti = (cv * CARPET_SIZE + cu) * 3;
            depth[y * W + x] = t;
            const o = (y * W + x) * 4;
            d[o] = CARPET[ti] * li + FR * f;
            d[o + 1] = CARPET[ti + 1] * li + FG * f;
            d[o + 2] = CARPET[ti + 2] * li + FB * f;
          }
          if (ya < ymax) ymax = ya;
          continue;
        }
        // Over a pit: below the near rim it's dark all the way down, which shows only where nothing nearer covers it.
        // The pit's far side then stands from the rim down into that dark, unless the ray goes on over more pit.
        const axis = cutAxis[c + 1];
        if (axis < 0) {
          // The ray gives out over the pit, too far off to draw its far side: just the dark, up to where it would be.
          const ya = Math.max(0, Math.ceil(horizon + (z * focal) / far - 0.5));
          for (let y = ya; y < Math.min(ymax, H); y++) {
            const o = (y * W + x) * 4;
            d[o] = VOID[0];
            d[o + 1] = VOID[1];
            d[o + 2] = VOID[2];
          }
          if (ya < ymax) ymax = ya;
          continue;
        }
        const yTop = Math.max(0, Math.floor(horizon + (z * focal) / far - 0.5) + 1);
        const yb = Math.min(ymax - 1, H - 1);
        const wx = px + rx * far;
        const wy = py + ry * far;
        const along = axis === 0 ? wy : wx;
        const tx = Math.floor((along - Math.floor(along)) * 64) & 63;
        const f = fogAt(far, fogK);
        // Light from just in front of the side.
        const l = light.at(px + rx * (far - 0.05), py + ry * (far - 0.05)) * PIT_SIDE_SHADE[axis] * (1 - f);
        for (let y = yTop; y <= yb; y++) {
          const down = ((y + 0.5 - horizon) * far) / focal - z;
          const dark = Math.exp(-PIT_DARKEN * Math.max(0, down));
          depth[y * W + x] = far;
          const o = (y * W + x) * 4;
          if (dark < PIT_BLACK) {
            d[o] = VOID[0];
            d[o + 1] = VOID[1];
            d[o + 2] = VOID[2];
            continue;
          }
          const ti = (((Math.floor(down * 64) & 63) << 6) + tx) * 3;
          const li = l * dark;
          d[o] = PIT_SIDE[ti] * li + FR * f * dark;
          d[o + 1] = PIT_SIDE[ti + 1] * li + FG * f * dark;
          d[o + 2] = PIT_SIDE[ti + 2] * li + FB * f * dark;
        }
        if (yTop < ymax) ymax = yTop;
      }
    }
  }
}
