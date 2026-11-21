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
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
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

/** Yellow wallpaper with a faint diamond pattern, darker toward the floor, over a brown skirting board. */
function wallPixel(variant: number) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    let base: Rgb = [202, 176, 86];
    let m = 1;
    let stain = 0;
    if (x % 8 === 0) m *= 0.94;
    const ddx = Math.abs((x % 16) - 8);
    const ddy = Math.abs((y % 16) - 8);
    if (ddx + ddy === 4) m *= 0.9;
    if (ddx + ddy < 2) m *= 0.93;
    m *= 0.94 + 0.12 * grain(x, y, 1);
    const g = layered(u, v, 4, 10 + variant * 7);
    m *= 0.82 + 0.3 * g;
    m *= 1 - 0.3 * Math.max(0, (v - 0.55) / 0.45) * (0.4 + g);
    // Variant 1 has damp patches, variant 2 streaks running down from the top.
    if (variant === 1) {
      stain = smoothstep(0.5, 0.64, layered(u, v, 2, 50));
      m *= 1 - 0.32 * stain;
    }
    if (variant === 2 && grain(x, 0, 60) > 0.78 && y < grain(x, 1, 61) * 44) {
      m *= 0.8;
      stain = 0.5;
    }
    if (y >= 57) {
      base = [104, 84, 46];
      m = 0.88 + 0.12 * grain(x, y, 2);
      if (y === 57) m *= 0.6;
      stain = 0;
    }
    if (y < 1) m *= 0.75;
    return [base[0] * m, base[1] * m * (1 - stain * 0.1), base[2] * m * (1 - stain * 0.3)];
  };
}

/** Faded striped wallpaper above a dado rail, dark wood panelling below. */
function housePixel(variant: number) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    const g = layered(u, v, 4, 200 + variant * 7);
    if (y < 34) {
      // Wide dusty-rose bands, a thin line either side of each.
      const sx = x % 16;
      let base: Rgb = sx < 6 ? [164, 128, 112] : [184, 162, 132];
      if (sx === 7 || sx === 15) base = [150, 120, 100];
      let m = (0.93 + 0.1 * grain(x, y, 201)) * (0.84 + 0.28 * g);
      if (y < 1) m *= 0.75;
      // Variant 1 has damp coming down from the top, variant 2 a strip of paper peeled off, plaster under it.
      if (variant === 1) m *= 1 - 0.3 * smoothstep(0.52, 0.66, layered(u, v * 0.6, 2, 205)) * (1 - v * 1.6);
      if (variant === 2 && x >= 20 && x < 31 + Math.floor(grain(0, y, 206) * 3) && y > 6 + grain(x, 0, 207) * 4) {
        base = [176, 170, 150];
        m *= 0.9;
      }
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

/** Off-white paint over plasterboard, scuffed about knee and hand height, over a black rubber skirting. */
function officePixel(variant: number) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    if (y >= 58) {
      const m = (y === 58 ? 0.7 : 1) * (0.9 + 0.12 * grain(x, y, 220));
      return [46 * m, 46 * m, 48 * m];
    }
    const g = layered(u, v, 4, 221 + variant * 7);
    let m = (0.95 + 0.06 * grain(x, y, 222)) * (0.88 + 0.2 * g);
    if (y < 1) m *= 0.75;
    m *= 1 - 0.22 * Math.max(0, (v - 0.6) / 0.4) * (0.4 + g);
    // Variant 1 has grey scuffs where chairs and bags have rubbed, variant 2 a brown water stain from the ceiling.
    if (variant === 1) {
      const band = Math.max(0, 1 - Math.abs(v - 0.64) / 0.1);
      m *= 1 - 0.18 * band * smoothstep(0.45, 0.65, valueNoise(u, v * 6, 8, 225));
    }
    if (variant === 2) {
      const stain = smoothstep(0.48, 0.6, layered(u, v * 0.5, 2, 226)) * (1 - smoothstep(0, 0.7, v));
      return [192 * m * (1 - stain * 0.12), 192 * m * (1 - stain * 0.2), 184 * m * (1 - stain * 0.4)];
    }
    return [192 * m, 192 * m, 184 * m];
  };
}

/**
 * Plasterboard never painted: a taped seam, a row of screws, a builder's pencil line. It has only two looks: variant 2
 * is the plain one again.
 */
function drywallPixel(variant: number) {
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
    // Variant 1 has blotches of mud over the screws and the seams, sanded or not.
    if (variant === 1 && layered(u, v, 3, 235) > 0.58) base = [214, 212, 206];
    // Screws, a row down each board, filled over in variant 1.
    if ((x === 20 || x === 44) && y % 14 === 6) m *= variant === 1 ? 0.85 : 0.55;
    // A builder's pencil line.
    if (y === 22 && x > 8 && x < 50 && grain(x, 0, 236) > 0.15) m *= 0.75;
    m *= 1 - 0.3 * Math.max(0, (v - 0.7) / 0.3) * (0.5 + g);
    if (y < 1) m *= 0.75;
    return [base[0] * m, base[1] * m, base[2] * m];
  };
}

/** White tiles all the way up, the grout between them grubby, the bottom row darker. */
function tilesPixel(variant: number) {
  return (x: number, y: number): Rgb => {
    const u = x / 64;
    const v = y / 64;
    const tx = x >> 4;
    const ty = y >> 4;
    const g = layered(u, v, 4, 240 + variant * 7);
    if (x % 16 === 0 || y % 16 === 0) {
      const m = (0.8 + 0.2 * grain(x, y, 241)) * (0.8 + 0.3 * g) * (1 - 0.3 * v);
      return [150 * m, 146 * m, 132 * m];
    }
    // Each tile a touch its own shade, its top and left edges catching the light like a glaze.
    let m = (0.93 + 0.08 * grain(tx, ty, 242)) * (0.97 + 0.04 * grain(x, y, 243));
    if (x % 16 === 1 || y % 16 === 1) m *= 1.06;
    if (x % 16 === 15 || y % 16 === 15) m *= 0.92;
    m *= 1 - 0.25 * Math.max(0, (v - 0.6) / 0.4) * (0.4 + g);
    let base: Rgb = ty === 3 ? [150, 156, 150] : [210, 212, 202];
    // Variant 1 has a crack running across some tiles, variant 2 a tile gone and the combed glue behind it.
    if (variant === 1 && x > 6 && x < 58 && Math.abs(y - (18 + x * 0.4 + (grain(x >> 2, 0, 245) - 0.5) * 3)) < 0.7) {
      m *= 0.55;
    }
    if (variant === 2 && tx === 2 && ty === 1) {
      base = [120, 112, 92];
      m = (0.8 + 0.25 * grain(x, y, 244)) * (y % 4 < 2 ? 0.75 : 1);
    }
    return [base[0] * m, base[1] * m, base[2] * m];
  };
}

/**
 * Each zone's wallpaper (zones.ts), in three variants: mostly the first, sometimes the second, now and then the third.
 * Indexed by zone, then variant.
 */
export const WALL_TEXTURES = [wallPixel, housePixel, officePixel, drywallPixel, tilesPixel].map((pixel) =>
  [0, 1, 2].map((variant) => makeTexture(64, pixel(variant))),
);

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

/** Bare concrete, blotchy, with a crack or two. */
const CONCRETE_FLOOR = makeFloor(256, (x, y) => {
  const u = x / 256;
  const v = y / 256;
  let m = 0.9 + 0.16 * grain(x, y, 260);
  m *= 0.78 + 0.34 * layered(u, v, 4, 261);
  m *= 1 - 0.25 * smoothstep(0.6, 0.75, layered(u, v, 2, 262));
  if (Math.abs(layered(u, v, 3, 263) - 0.5) < 0.004 && layered(u, v, 2, 264) > 0.6) m *= 0.6;
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
