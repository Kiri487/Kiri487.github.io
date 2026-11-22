import { clamp } from "../../../../shared/math";
import { hash3 } from "./hash";

/* Every surface is drawn by code when the place first opens: no image files. Textures are flat RGB arrays. */

type Rgb = [number, number, number];

const grain = (x: number, y: number, s: number) => hash3(x, y, s + 9001);

/**
 * Each noise's lattice of random values, per × per, worked out once: the big carpet asks for millions of them, and
 * hashing each one afresh made opening the door stall.
 */
const lattices = new Map<number, Float64Array>();

function lattice(per: number, s: number): Float64Array {
  // Every `per` used is well under 100 000.
  const key = s * 100_000 + per;
  let values = lattices.get(key);
  if (!values) {
    values = new Float64Array(per * per);
    for (let j = 0; j < per; j++) {
      for (let i = 0; i < per; i++) values[i + j * per] = grain(i, j, s);
    }
    lattices.set(key, values);
  }
  return values;
}

/** Smooth noise that wraps every `per` steps, so the texture tiles. */
function valueNoise(u: number, v: number, per: number, s: number): number {
  const x = u * per;
  const y = v * per;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let xf = x - xi;
  let yf = y - yi;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  const wrap = (n: number) => ((n % per) + per) % per;
  const values = lattice(per, s);
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi) * per;
  const y1 = wrap(yi + 1) * per;
  const a = values[x0 + y0];
  const b = values[x1 + y0];
  const c = values[x0 + y1];
  const d = values[x1 + y1];
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

const layered = (u: number, v: number, per: number, s: number) =>
  0.5 * valueNoise(u, v, per, s) +
  0.25 * valueNoise(u, v, per * 2, s + 1) +
  0.125 * valueNoise(u, v, per * 4, s + 2) +
  0.125 * valueNoise(u, v, per * 8, s + 3);

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeTexture(size: number, pixel: (x: number, y: number) => Rgb): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = (y * size + x) * 3;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
    }
  }
  return out;
}

/*
 * The walls, one clean wall to a zone. What's happened to them (damp, stains, scuffs, tears, cracks) is laid over
 * them a face of wall at a time (wallMarks.ts), so it's never twice the same. Each also comes `upper`: the wall alone,
 * without what's only at its foot (a skirting, the panelling, the shadow toward the floor) or its top edge, to go on
 * up a wall higher than 1 (see WALL_TEXTURES).
 */

/** Yellow wallpaper with a faint diamond pattern, darker toward the floor, over a brown skirting board. */
function wallPixel(upper: boolean) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    let base: Rgb = [202, 176, 86];
    let m = 1;
    if (x % 8 === 0) m *= 0.94;
    const ddx = Math.abs((x % 16) - 8);
    const ddy = Math.abs((y % 16) - 8);
    if (ddx + ddy === 4) m *= 0.9;
    if (ddx + ddy < 2) m *= 0.93;
    m *= 0.94 + 0.12 * grain(x, y, 1);
    const g = layered(u, v, 4, 10);
    m *= 0.82 + 0.3 * g;
    if (!upper) m *= 1 - 0.3 * Math.max(0, (v - 0.55) / 0.45) * (0.4 + g);
    if (!upper && y >= 57) {
      base = [104, 84, 46];
      m = 0.88 + 0.12 * grain(x, y, 2);
      if (y === 57) m *= 0.6;
    }
    if (!upper && y < 1) m *= 0.75;
    return [base[0] * m, base[1] * m, base[2] * m];
  };
}

/** Faded striped wallpaper above a dado rail, dark wood panelling below. */
function housePixel(upper: boolean) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    const g = layered(u, v, 4, 200);
    if (upper || y < 34) {
      // Wide dusty-rose bands, a thin line either side of each.
      const sx = x % 16;
      let base: Rgb = sx < 6 ? [164, 128, 112] : [184, 162, 132];
      if (sx === 7 || sx === 15) base = [150, 120, 100];
      let m = (0.93 + 0.1 * grain(x, y, 201)) * (0.84 + 0.28 * g);
      if (!upper && y < 1) m *= 0.75;
      return [base[0] * m, base[1] * m, base[2] * m];
    }
    // The rail, then boards with grooves between them, the grain running down them.
    let m = (0.86 + 0.14 * valueNoise(u * 4, v * 0.25, 16, 210 + (x >> 4))) * (0.92 + 0.12 * grain(x, y, 211));
    if (y < 37) m *= y === 34 ? 0.6 : 1.12;
    else if (x % 16 === 0) m *= 0.5;
    else if (x % 16 === 1) m *= 1.1;
    if (y >= 60) m *= 0.7;
    m *= 1 - 0.25 * Math.max(0, (v - 0.6) / 0.4) * (0.4 + g);
    return [104 * m, 70 * m, 44 * m];
  };
}

/** Off-white paint over plasterboard, over a black rubber skirting. */
function officePixel(upper: boolean) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    if (!upper && y >= 58) {
      const m = (y === 58 ? 0.7 : 1) * (0.9 + 0.12 * grain(x, y, 220));
      return [46 * m, 46 * m, 48 * m];
    }
    const g = layered(u, v, 4, 221);
    let m = (0.95 + 0.06 * grain(x, y, 222)) * (0.88 + 0.2 * g);
    if (!upper && y < 1) m *= 0.75;
    if (!upper) m *= 1 - 0.22 * Math.max(0, (v - 0.6) / 0.4) * (0.4 + g);
    return [192 * m, 192 * m, 184 * m];
  };
}

/** Plasterboard never painted: a taped seam, a row of screws down each board. Upper, the screws go on up 14 apart. */
function drywallPixel(upper: boolean) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    const g = layered(u, v, 4, 233);
    let m = (0.94 + 0.08 * grain(x, y, 234)) * (0.86 + 0.2 * g);
    let base: Rgb = [196, 192, 182];
    // The seam where two boards meet, filled and taped, in whiter mud.
    if (x < 5 || x >= 61) {
      base = [212, 210, 202];
      if (x === 0) m *= 0.85;
    }
    if ((x === 20 || x === 44) && y % 14 === (upper ? 0 : 6)) m *= 0.55;
    if (!upper) m *= 1 - 0.3 * Math.max(0, (v - 0.7) / 0.3) * (0.5 + g);
    if (!upper && y < 1) m *= 0.75;
    return [base[0] * m, base[1] * m, base[2] * m];
  };
}

/** White tiles all the way up, the grout between them grubby, the bottom row darker. */
function tilesPixel(upper: boolean) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    const tx = x >> 4;
    const ty = y >> 4;
    const g = layered(u, v, 4, 240);
    if (x % 16 === 0 || y % 16 === 0) {
      const m = (0.8 + 0.2 * grain(x, y, 241)) * (0.8 + 0.3 * g) * (upper ? 1 : 1 - 0.3 * v);
      return [150 * m, 146 * m, 132 * m];
    }
    // Each tile a touch its own shade, its top and left edges catching the light like a glaze.
    let m = (0.93 + 0.08 * grain(tx, ty, 242)) * (0.97 + 0.04 * grain(x, y, 243));
    if (x % 16 === 1 || y % 16 === 1) m *= 1.06;
    if (x % 16 === 15 || y % 16 === 15) m *= 0.92;
    if (!upper) m *= 1 - 0.25 * Math.max(0, (v - 0.6) / 0.4) * (0.4 + g);
    const base: Rgb = !upper && ty === 3 ? [150, 156, 150] : [210, 212, 202];
    return [base[0] * m, base[1] * m, base[2] * m];
  };
}

/**
 * Each zone's wall (zones.ts), 64 pixels wide and 128 high: rows 64 on are the usual wall, from the ceiling (1 high)
 * down to the floor; rows 0–63 above them, the wall alone, that goes on up over and over where the ceiling's higher,
 * and joins the usual wall without a seam.
 */
export const WALL_TEXTURES = [wallPixel, housePixel, officePixel, drywallPixel, tilesPixel].map((pixel) => {
  const both = new Uint8ClampedArray(64 * 128 * 3);
  both.set(makeTexture(64, pixel(true)));
  both.set(makeTexture(64, pixel(false)), 64 * 64 * 3);
  return both;
});

/*
 * The tops of the low walls, a cell a side, one to a zone; and the trim each has along an edge over open floor, which
 * turns down over the top of the face below it (render.ts).
 */

/** Painted boards, the paint the wallpaper's yellow gone brown, the grain showing through. */
function yellowCap(x: number, y: number): Rgb {
  let m = (0.86 + 0.14 * valueNoise(x / 64, (y / 64) * 8, 4, 300)) * (0.94 + 0.08 * grain(x, y, 301));
  if (y % 16 === 0) m *= 0.7;
  m *= 0.88 + 0.2 * layered(x / 64, y / 64, 2, 302);
  return [166 * m, 138 * m, 72 * m];
}

/** Dark varnished wood, a groove between each two boards, worn paler here and there. */
function houseCap(x: number, y: number): Rgb {
  let m = (0.84 + 0.16 * valueNoise((x / 64) * 8, y / 64, 4, 310 + (x >> 4))) * (0.93 + 0.1 * grain(x, y, 311));
  if (x % 16 === 0) m *= 0.55;
  m *= 1 + 0.18 * smoothstep(0.6, 0.75, layered(x / 64, y / 64, 2, 312));
  return [108 * m, 72 * m, 46 * m];
}

/** Grey laminate, flecked. */
function officeCap(x: number, y: number): Rgb {
  let m = (0.95 + 0.06 * grain(x, y, 320)) * (0.9 + 0.14 * layered(x / 64, y / 64, 2, 321));
  if (grain(x, y, 322) > 0.96) m *= 0.85;
  return [164 * m, 162 * m, 156 * m];
}

/** The bare top of a stud wall boxed in with plasterboard, smeared with filler and dust. */
function drywallCap(x: number, y: number): Rgb {
  const g = layered(x / 64, y / 64, 4, 330);
  const m = (0.92 + 0.1 * grain(x, y, 331)) * (0.86 + 0.2 * g);
  const mud = smoothstep(0.55, 0.65, layered(x / 64, y / 64, 2, 332));
  return [(184 + 24 * mud) * m, (180 + 26 * mud) * m, (170 + 28 * mud) * m];
}

/** White tiles laid along the top, grubby grout between them. */
function tilesCap(x: number, y: number): Rgb {
  const g = layered(x / 64, y / 64, 4, 340);
  if (x % 16 === 0 || y % 16 === 0) {
    const m = (0.8 + 0.2 * grain(x, y, 341)) * (0.8 + 0.3 * g);
    return [146 * m, 142 * m, 128 * m];
  }
  let m = (0.93 + 0.08 * grain(x >> 4, y >> 4, 342)) * (0.97 + 0.04 * grain(x, y, 343));
  if (x % 16 === 1 || y % 16 === 1) m *= 1.06;
  return [212 * m, 214 * m, 204 * m];
}

/** Each zone's low wall top (zones.ts), 64 pixels a cell. */
export const CAPS = [yellowCap, houseCap, officeCap, drywallCap, tilesCap].map((pixel) => makeTexture(64, pixel));
/**
 * Each zone's trim along a low wall's open edges: dark painted wood, a rounded wooden rail, aluminium, a steel corner
 * bead, round-edged tiles.
 */
export const CAP_TRIMS: readonly Rgb[] = [
  [112, 90, 46],
  [140, 96, 60],
  [196, 198, 204],
  [150, 154, 160],
  [226, 226, 216],
];

/**
 * The carpet, at 64 pixels a cell, and how many cells its picture covers before it repeats. Its stains are the same
 * size they always were; the picture is just big enough that they don't line up every couple of cells.
 */
export const CARPET_SIZE = 512;
export const CARPET_CELLS = CARPET_SIZE / 64;

export const CARPET = makeTexture(CARPET_SIZE, (x, y) => {
  const u = x / CARPET_SIZE;
  const v = y / CARPET_SIZE;
  const k = CARPET_CELLS / 2;
  let m = 0.74 + 0.5 * grain(x, y, 3);
  m *= 0.7 + 0.5 * layered(u, v, 3 * k, 20);
  m *= 1 - 0.3 * smoothstep(0.56, 0.72, layered(u, v, 2 * k, 33));
  return [150 * m, 128 * m, 66 * m];
});

/**
 * A floor the carpet's size, worked out `period` pixels a side and repeated: patterned floors repeat anyway, and
 * working the whole of each out from noise would make opening the door stall.
 */
function makeFloor(period: number, pixel: (x: number, y: number) => Rgb): Uint8ClampedArray {
  const tile = makeTexture(period, pixel);
  const out = new Uint8ClampedArray(CARPET_SIZE * CARPET_SIZE * 3);
  for (let y = 0; y < CARPET_SIZE; y++) {
    const row = tile.subarray((y % period) * period * 3, ((y % period) + 1) * period * 3);
    for (let x = 0; x < CARPET_SIZE; x += period) out.set(row, (y * CARPET_SIZE + x) * 3);
  }
  return out;
}

/** An old house's carpet: dark red, worn paler in places. */
const HOUSE_FLOOR = makeFloor(256, (x, y) => {
  const u = x / 256;
  const v = y / 256;
  let m = 0.78 + 0.4 * grain(x, y, 250);
  m *= 0.72 + 0.46 * layered(u, v, 6, 251);
  const worn = smoothstep(0.55, 0.7, layered(u, v, 2, 252));
  return [112 * m * (1 + worn * 0.25), 52 * m * (1 + worn * 0.4), 44 * m * (1 + worn * 0.4)];
});

/** Grey-blue carpet tiles, half a cell a side, each one's pile turned a quarter from its neighbours'. */
const OFFICE_FLOOR = makeFloor(64, (x, y) => {
  const across = ((x >> 5) + (y >> 5)) % 2 === 0;
  const line = (across ? y : x) % 3 === 0;
  let m = (0.82 + 0.3 * grain(x, y, 255)) * (line ? 0.88 : 1);
  m *= 0.94 + 0.08 * grain(x >> 5, y >> 5, 256);
  if (x % 32 === 0 || y % 32 === 0) m *= 0.82;
  return [84 * m, 92 * m, 104 * m];
});

/** Bare concrete, blotchy. Its cracks are laid over it (floorMarks.ts), each its own. */
const CONCRETE_FLOOR = makeFloor(256, (x, y) => {
  const u = x / 256;
  const v = y / 256;
  let m = 0.9 + 0.16 * grain(x, y, 260);
  m *= 0.78 + 0.34 * layered(u, v, 4, 261);
  m *= 1 - 0.25 * smoothstep(0.6, 0.75, layered(u, v, 2, 262));
  return [124 * m, 120 * m, 112 * m];
});

/** Checked lino, a quarter of a cell a square, scuffed and yellowed. */
const LINO_FLOOR = makeFloor(128, (x, y) => {
  const u = x / 128;
  const v = y / 128;
  const dark = ((x >> 4) + (y >> 4)) % 2 === 1;
  let m = (0.92 + 0.1 * grain(x, y, 265)) * (0.84 + 0.24 * layered(u, v, 4, 266));
  if (x % 16 === 0 || y % 16 === 0) m *= 0.9;
  return dark ? [92 * m, 94 * m, 90 * m] : [190 * m, 182 * m, 156 * m];
});

/** Each zone's floor, all the carpet's size, indexed by zone (zones.ts). */
export const FLOORS = [CARPET, HOUSE_FLOOR, OFFICE_FLOOR, CONCRETE_FLOOR, LINO_FLOOR];
/** Whether each zone's floor is mirrored like the carpet (CARPET_FLIP): not a pattern, which would jump where it flips. */
export const FLOOR_FLIPS = [true, true, false, true, false];

/**
 * Whether each column, and each row, of carpet pictures is mirrored, so even eight cells apart the stains don't repeat.
 * A mirror meets its neighbour seamlessly whichever way either is turned. Indexed by column (or row) & 255.
 */
export const CARPET_FLIP = Uint8Array.from({ length: 256 }, (_, i) => (grain(i, 0, 77) < 0.5 ? 1 : 0));

/** Ceiling tiles in a 32-pixel grid, a few of them stained. */
function ceilingPixel(x: number, y: number): Rgb {
  const lx = x % 32;
  const ly = y % 32;
  let m = 0.92 + 0.1 * grain(x, y, 5);
  if (grain(x, y, 6) > 0.93) m *= 0.8;
  if (lx === 0 || ly === 0) m *= 0.55;
  else if (lx === 1 || ly === 1) m *= 0.9;
  m *= 0.88 + 0.18 * layered(x / 64, y / 64, 2, 40);
  return [198 * m, 190 * m, 158 * m];
}

export const CEILING = makeTexture(64, ceilingPixel);

/** Where the light panel glows: 1 the panel, 2 the slightly dimmer seams across it, 0 the ceiling around it. */
export const PANEL_MASK = new Uint8Array(64 * 64);

export const PANEL = makeTexture(64, (x, y) => {
  if (x >= 8 && x < 56 && y >= 20 && y < 44) {
    if (x < 10 || x >= 54 || y < 22 || y >= 42) return [128, 126, 112];
    PANEL_MASK[y * 64 + x] = x % 8 === 1 || y === 32 ? 2 : 1;
    return [255, 250, 225];
  }
  return ceilingPixel(x, y);
});

/** The sides of the pits: bare plaster, grainy and grubby, about the carpet's colour so the pits sit in the floor. */
export const PIT_SIDE = makeTexture(64, (x, y) => {
  const u = x / 64;
  const v = y / 64;
  let m = 0.86 + 0.2 * grain(x, y, 90);
  m *= 0.84 + 0.26 * layered(u, v, 4, 91);
  m *= 1 - 0.22 * smoothstep(0.55, 0.7, layered(u, v, 2, 95));
  return [160 * m, 138 * m, 74 * m];
});
