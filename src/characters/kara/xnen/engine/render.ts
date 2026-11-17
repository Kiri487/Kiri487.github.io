import { WN, type Lighting } from "./lighting";
import type { WorldMap } from "./map";
import { drawStatue, type Prop, type StatueFrame } from "./statue";
import { CARPET, CEILING, PANEL, PANEL_MASK, WALL_TEXTURES } from "./textures";
import type { Tuning } from "./tuning";

/*
 * A raycaster: one ray per screen column finds the nearest wall, then the ceiling and floor are filled in row by
 * row. It draws into a small picture (180 pixels on the short side by default) that the page stretches to the
 * screen, and finishes with the videotape look: colour bleed, noise, scanlines and the ragged bottom edge.
 */

const FOG: readonly [number, number, number] = [14, 12, 6];
const EMIT = [255, 250, 225];
/** Eye height, with floor at 0 and ceiling at 1. */
export const EYE = 0.5;
/** Nothing is drawn past this many cells. */
const FAR = 28;

export interface Camera {
  x: number;
  y: number;
  angle: number;
  /** Looking up or down, as a share of the picture's height. */
  pitch: number;
  /** Walking bob, in pixels. */
  bob: number;
}

/** Tape trouble laid over the picture, for the transitions. */
export interface Effects {
  /** 0–1: how much of the picture is snow. */
  snow: number;
  /** 0–1: rows torn sideways. */
  tear: number;
  /** Rows the picture is rolled up by. */
  roll: number;
  /** 0–1: the thick bands of noise that crawl down the picture while rewinding. */
  bands: number;
  /** Where those bands are, 0–1 down the picture; moving it moves them. */
  bandPhase: number;
  /** How far the colours bleed apart, 1 for the usual. */
  bleed: number;
  /** 0–1: the picture blown out towards white. */
  flash: number;
  /** 0–1: how many stretches of wall still have no lower half, as when the signal hasn't come in yet. */
  wallGaps: number;
}

export const CLEAN: Effects = { snow: 0, tear: 0, roll: 0, bands: 0, bandPhase: 0, bleed: 1, flash: 0, wallGaps: 0 };

/** Screen columns go missing together in strips this wide. */
const GAP_STRIP = 5;
const GAP_COLOUR = [11, 10, 6];

/** A fresh picture, fully opaque: every pixel's colour is drawn each frame, but its alpha only here. */
function opaqueImage(ctx: CanvasRenderingContext2D, W: number, H: number): ImageData {
  const image = ctx.createImageData(W, H);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
  return image;
}

/** A random order for the wall strips to come back in, one number per screen column. */
function gapOrder(W: number): Float32Array {
  const order = new Float32Array(W);
  for (let x = 0; x < W; x += GAP_STRIP) order.fill(Math.random(), x, x + GAP_STRIP);
  return order;
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private width = 320;
  private height = 180;
  private aspect = 16 / 9;
  private image: ImageData;
  private wallDepth = new Float32Array(320);
  private wallBottom = new Int16Array(320);
  private depth = new Float32Array(320 * 180);
  private scratch = new Uint8ClampedArray(320 * 180 * 4);
  private gaps = gapOrder(320);
  /** The frame on screen when the tape was paused. */
  private still: Uint8ClampedArray | null = null;
  private noiseSeed = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas");
    this.ctx = ctx;
    this.image = opaqueImage(ctx, this.width, this.height);
  }

  /** Fits the picture to the screen's shape, `res` pixels on its short side. */
  resize(screenWidth: number, screenHeight: number, res: number) {
    const aspect = screenWidth > 0 && screenHeight > 0 ? screenWidth / screenHeight : 16 / 9;
    let W: number;
    let H: number;
    if (aspect >= 1) {
      H = res;
      W = Math.min(Math.round((H * aspect) / 2) * 2, H * 3);
    } else {
      W = res;
      H = Math.min(Math.round(W / aspect / 2) * 2, Math.round(W * 2.4));
    }
    if (W === this.width && H === this.height && aspect === this.aspect) return;
    this.aspect = aspect;
    this.width = W;
    this.height = H;
    this.canvas.width = W;
    this.canvas.height = H;
    this.image = opaqueImage(this.ctx, W, H);
    this.gaps = gapOrder(W);
    this.wallDepth = new Float32Array(W);
    this.wallBottom = new Int16Array(W);
    this.depth = new Float32Array(W * H);
    this.scratch = new Uint8ClampedArray(W * H * 4);
    this.still = null;
  }

  get pictureHeight() {
    return this.height;
  }

  /** How far the picture reaches to each side of straight ahead, at one cell ahead. */
  spread(fov: number): number {
    return Math.tan((fov * Math.PI) / 360) * Math.min(1, this.aspect / 1.2);
  }

  render(
    cam: Camera,
    light: Lighting,
    map: WorldMap,
    tuning: Tuning,
    props: readonly Prop[],
    effects: Effects,
    reduced: boolean,
  ) {
    const W = this.width;
    const H = this.height;
    const d = this.image.data;
    const wallDepth = this.wallDepth;
    const wallBottom = this.wallBottom;
    const plane = this.spread(tuning.fov);
    const dx = Math.cos(cam.angle);
    const dy = Math.sin(cam.angle);
    const plx = -dy * plane;
    const ply = dx * plane;
    const focal = W / 2 / plane;
    const horizon = H / 2 + cam.pitch * H + cam.bob;
    const fogK = (tuning.fog / 100) * 0.3;
    const [FR, FG, FB] = FOG;
    const [ER, EG, EB] = EMIT;
    const ox = light.x0 + 0.5;
    const oy = light.y0 + 0.5;
    const comb = light.combined;
    const panels = light.panel;
    const glow = light.glow;
    const px = cam.x;
    const py = cam.y;

    // Ceiling (floorPass false) and floor, row by row. The floor runs after the walls and skips what they cover.
    const rows = (floorPass: boolean) => {
      for (let y = 0; y < H; y++) {
        let p = y + 0.5 - horizon;
        const isFloor = p > 0;
        if (isFloor !== floorPass) continue;
        if (p < 0) p = -p;
        if (p < 0.5) p = 0.5;
        const rd = (EYE * focal) / p;
        let o = y * W * 4;
        let f = 1 - Math.exp(-rd * fogK);
        const far = (rd - 20) / 8;
        if (far > f) f = far;
        if (f >= 1) {
          for (let x = 0; x < W; x++, o += 4) {
            if (floorPass && y <= wallBottom[x]) continue;
            d[o] = FR;
            d[o + 1] = FG;
            d[o + 2] = FB;
            d[o + 3] = 255;
          }
          continue;
        }
        const inv = 1 - f;
        const ar = FR * f, ag = FG * f, ab = FB * f;
        const sx = (rd * 2 * plx) / W;
        const sy = (rd * 2 * ply) / W;
        let fx = px + rd * (dx - plx) + sx * 0.5;
        let fy = py + rd * (dy - ply) + sy * 0.5;
        for (let x = 0; x < W; x++, o += 4, fx += sx, fy += sy) {
          if (floorPass && y <= wallBottom[x]) continue;
          const gx = fx - ox;
          const gy = fy - oy;
          const ix = Math.floor(gx);
          const iy = Math.floor(gy);
          const u = gx - ix;
          const v = gy - iy;
          const k = ix + iy * WN;
          const inWindow = ix >= 0 && iy >= 0 && ix < WN - 1 && iy < WN - 1;
          const l = inWindow
            ? (comb[k] * (1 - u) + comb[k + 1] * u) * (1 - v) + (comb[k + WN] * (1 - u) + comb[k + WN + 1] * u) * v
            : 0;
          d[o + 3] = 255;
          if (isFloor) {
            const li = l * inv;
            const ti = ((Math.floor(fy * 64) & 127) * 128 + (Math.floor(fx * 64) & 127)) * 3;
            d[o] = CARPET[ti] * li + ar;
            d[o + 1] = CARPET[ti + 1] * li + ag;
            d[o + 2] = CARPET[ti + 2] * li + ab;
          } else {
            const cx = Math.floor(fx);
            const cy = Math.floor(fy);
            const pi = cx - light.x0 + (cy - light.y0) * WN;
            const state = inWindow ? panels[pi] : 0;
            const tp = Math.floor((fy - cy) * 64) * 64 + Math.floor((fx - cx) * 64);
            const ti = tp * 3;
            if (state) {
              const mask = PANEL_MASK[tp];
              if (mask && state !== 4) {
                const e = glow[state] * (mask === 2 ? 0.9 : 1);
                const ff = f * 0.5;
                d[o] = ER * e * (1 - ff) + FR * ff;
                d[o + 1] = EG * e * (1 - ff) + FG * ff;
                d[o + 2] = EB * e * (1 - ff) + FB * ff;
              } else {
                const li = l * inv * (mask ? 0.32 : 1);
                d[o] = PANEL[ti] * li + ar;
                d[o + 1] = PANEL[ti + 1] * li + ag;
                d[o + 2] = PANEL[ti + 2] * li + ab;
              }
            } else {
              const li = l * inv;
              d[o] = CEILING[ti] * li + ar;
              d[o + 1] = CEILING[ti + 1] * li + ag;
              d[o + 2] = CEILING[ti + 2] * li + ab;
            }
          }
        }
      }
    };
    rows(false);

    // Walls, column by column.
    for (let x = 0; x < W; x++) {
      const cam2 = (2 * (x + 0.5)) / W - 1;
      const rdx = dx + plx * cam2;
      const rdy = dy + ply * cam2;
      let mapX = Math.floor(px);
      let mapY = Math.floor(py);
      const ddx = Math.abs(1 / rdx);
      const ddy = Math.abs(1 / rdy);
      const stepX = rdx < 0 ? -1 : 1;
      const stepY = rdy < 0 ? -1 : 1;
      let sdx = rdx < 0 ? (px - mapX) * ddx : (mapX + 1 - px) * ddx;
      let sdy = rdy < 0 ? (py - mapY) * ddy : (mapY + 1 - py) * ddy;
      let side = 0;
      let hit = false;
      let perp = 0;
      for (let n = 0; n < 64; n++) {
        if (sdx < sdy) {
          perp = sdx;
          sdx += ddx;
          mapX += stepX;
          side = 0;
        } else {
          perp = sdy;
          sdy += ddy;
          mapY += stepY;
          side = 1;
        }
        if (perp > FAR) break;
        if (light.wallAt(mapX, mapY, map)) {
          hit = true;
          break;
        }
      }
      if (!hit) {
        wallDepth[x] = 1e9;
        wallBottom[x] = -1;
        continue;
      }
      if (perp < 0.02) perp = 0.02;
      const lineH = focal / perp;
      const top = horizon - lineH * (1 - EYE);
      const span = lineH;
      let y0 = Math.ceil(top - 0.5);
      if (y0 < 0) y0 = 0;
      let y1 = Math.floor(top + span - 0.5);
      if (y1 > H - 1) y1 = H - 1;
      wallDepth[x] = perp;
      wallBottom[x] = y1;
      let hx = px + perp * rdx;
      let hy = py + perp * rdy;
      const wallX = side === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
      const tx = Math.min(63, Math.floor(wallX * 64));
      // Light is read from just in front of the wall face.
      if (side === 0) hx -= stepX * 0.3;
      else hy -= stepY * 0.3;
      let l = light.at(hx, hy);
      if (side === 1) l *= 0.9;
      let f = 1 - Math.exp(-perp * fogK);
      const far = (perp - 20) / 8;
      if (far > f) f = far;
      if (f > 1) f = 1;
      const inv = 1 - f;
      const ar = FR * f, ag = FG * f, ab = FB * f;
      const pick = map.noise(mapX, mapY, 30);
      const tex = WALL_TEXTURES[pick < 0.6 ? 0 : pick < 0.85 ? 1 : 2];
      const gap = this.gaps[x] < effects.wallGaps;
      for (let y = y0; y <= y1; y++) {
        if (gap && y > horizon) {
          const o = (y * W + x) * 4;
          d[o] = GAP_COLOUR[0];
          d[o + 1] = GAP_COLOUR[1];
          d[o + 2] = GAP_COLOUR[2];
          continue;
        }
        const tv = (y + 0.5 - top) / span;
        let ty = Math.floor(tv * 64);
        if (ty > 63) ty = 63;
        if (ty < 0) ty = 0;
        const ti = (ty * 64 + tx) * 3;
        const li = l * (1.1 - 0.25 * tv) * inv;
        const o = (y * W + x) * 4;
        d[o] = tex[ti] * li + ar;
        d[o + 1] = tex[ti + 1] * li + ag;
        d[o + 2] = tex[ti + 2] * li + ab;
      }
    }

    rows(true);

    if (props.length) {
      this.depth.fill(1e9);
      const frame: StatueFrame = {
        pixels: d,
        width: W,
        height: H,
        wallDepth,
        depth: this.depth,
        camX: px,
        camY: py,
        eye: EYE,
        dirX: dx,
        dirY: dy,
        focal,
        horizon,
        fogK,
        fog: FOG,
      };
      for (const prop of props) drawStatue(frame, prop.mesh, prop.model, prop.skin, light.at(prop.mesh.x, prop.mesh.y));
    }

    this.tape(d, W, H, tuning, effects, reduced);
    this.ctx.putImageData(this.image, 0, 0);
  }

  private nextNoise() {
    this.noiseSeed = (this.noiseSeed * 1664525 + 1013904223) | 0;
    return this.noiseSeed | 1;
  }

  /** The videotape look, plus whatever trouble the transitions add. */
  private tape(d: Uint8ClampedArray, W: number, H: number, tuning: Tuning, fx: Effects, reduced: boolean) {
    const row = W * 4;
    // Rewinding: the picture rolls up.
    const roll = ((Math.round(fx.roll) % H) + H) % H;
    if (roll) {
      this.scratch.set(d);
      for (let y = 0; y < H; y++) d.set(this.scratch.subarray(((y + roll) % H) * row, ((y + roll) % H) * row + row), y * row);
    }
    // Colour bleed: red pulled left, blue pushed right.
    const shift = Math.max(1, Math.round((W / 200) * fx.bleed)) * 4;
    for (let y = 0; y < H; y++) {
      const r0 = y * row;
      const r1 = r0 + row;
      for (let o = r0; o < r1 - shift; o += 4) d[o] = d[o + shift];
      for (let o = r1 - 4; o >= r0 + shift; o -= 4) d[o + 2] = d[o + 2 - shift];
    }
    // Reduced motion keeps the same grain every frame, so the noise doesn't crawl.
    let ns = reduced ? 12345 : this.nextNoise();
    const sat = tuning.yellow / 100;
    const snow = fx.snow;
    for (let y = 0, o = 0; y < H; y++) {
      const scan = y & 1 ? 0.86 : 1;
      for (let x = 0; x < W; x++, o += 4) {
        let r = d[o];
        let g = d[o + 1];
        let b = d[o + 2];
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        r = lum + (r - lum) * sat;
        g = lum + (g - lum) * sat;
        b = lum + (b - lum) * sat;
        ns ^= ns << 13;
        ns ^= ns >>> 17;
        ns ^= ns << 5;
        const n = ((ns & 255) - 128) * 0.11;
        r = (r * 0.9 + 12 + n) * scan;
        g = (g * 0.9 + 11 + n) * scan;
        b = (b * 0.9 + 9 + n) * scan;
        if (snow > 0) {
          const s = (ns >>> 8) & 255;
          r = r * (1 - snow) + s * snow;
          g = g * (1 - snow) + s * snow;
          b = b * (1 - snow) + s * snow;
        }
        if (fx.flash > 0) {
          r += (255 - r) * fx.flash;
          g += (255 - g) * fx.flash;
          b += (255 - b) * fx.flash;
        }
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
      }
    }
    // Torn rows: whole lines slid sideways, as when the tracking slips.
    if (fx.tear > 0) {
      for (let y = 0; y < H; y++) {
        ns ^= ns << 13;
        ns ^= ns >>> 17;
        ns ^= ns << 5;
        if ((ns & 1023) / 1024 > fx.tear * 0.35) continue;
        const sh = (((ns >>> 10) & 31) + 2) * 4 * Math.ceil(fx.tear * 3);
        this.slideRow(d, y, W, sh, 40);
      }
    }
    // Rewinding: three thick bands of noise crawling down, each torn sideways and mostly snow.
    if (fx.bands > 0) {
      const thick = Math.max(3, Math.round(H * 0.07));
      for (let b = 0; b < 3; b++) {
        const top = Math.floor((((fx.bandPhase + b / 3) % 1) + 1) % 1 * H);
        for (let y = top; y < Math.min(H, top + thick); y++) {
          ns ^= ns << 13;
          ns ^= ns >>> 17;
          ns ^= ns << 5;
          this.slideRow(d, y, W, (((ns & 15) + 6) * 4) | 0, 120);
          const a = fx.bands * 0.75;
          for (let o = y * row; o < y * row + row; o += 4) {
            ns ^= ns << 13;
            ns ^= ns >>> 17;
            ns ^= ns << 5;
            const s = ns & 255;
            d[o] = d[o] * (1 - a) + s * a;
            d[o + 1] = d[o + 1] * (1 - a) + s * a;
            d[o + 2] = d[o + 2] * (1 - a) + s * a;
          }
        }
      }
    }
    // Head-switching noise along the bottom edge.
    const ragged = Math.max(2, Math.round(H / 60));
    for (let y = H - ragged; y < H; y++) {
      ns ^= ns << 13;
      ns ^= ns >>> 17;
      ns ^= ns << 5;
      this.slideRow(d, y, W, ((ns & 15) + 2) * 4, 90);
    }
    this.noiseSeed = ns;
  }

  /** Slides one row left by `shift` bytes, with bright specks of noise in it. */
  private slideRow(d: Uint8ClampedArray, y: number, W: number, shift: number, speck: number) {
    const r0 = y * W * 4;
    const r1 = r0 + W * 4;
    let ns = this.noiseSeed | 1;
    for (let o = r0; o < r1 - shift; o += 4) {
      ns ^= ns << 13;
      ns ^= ns >>> 17;
      ns ^= ns << 5;
      const n = (ns & 255) > 200 ? speck : 0;
      d[o] = d[o + shift] + n;
      d[o + 1] = d[o + shift + 1] + n;
      d[o + 2] = d[o + shift + 2] + n;
    }
    this.noiseSeed = ns;
  }

  /** Keeps the frame on screen, for the pause. */
  hold(): Uint8ClampedArray {
    this.still = new Uint8ClampedArray(this.image.data);
    return this.still;
  }

  /**
   * The paused tape: the held frame, nudged up or down by `jump` rows, with a band of noise across it starting at
   * row `band` (none if negative).
   */
  renderPaused(jump: number, band: number) {
    const still = this.still ?? this.hold();
    const W = this.width;
    const H = this.height;
    const row = W * 4;
    const d = this.image.data;
    for (let y = 0; y < H; y++) {
      const from = Math.min(H - 1, Math.max(0, y + jump));
      d.set(still.subarray(from * row, from * row + row), y * row);
    }
    if (band >= 0) {
      const thick = Math.max(2, Math.round(H / 45));
      for (let y = band; y < Math.min(H, band + thick); y++) this.slideRow(d, y, W, 6 * 4, 120);
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
