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

export const WALL_TEXTURES = [0, 1, 2].map((variant) => makeTexture(64, wallPixel(variant)));

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
