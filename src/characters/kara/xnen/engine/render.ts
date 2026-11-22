import { clamp } from "../../../../shared/math";
import { tileGone } from "./decay";
import { OVER_COLOUR, graffitiOn, paintAt, tagArt, type GraffitiLevel, type PaintSample, type Tag } from "./graffiti";
import { WN, type Lighting } from "./lighting";
import type { WorldMap } from "./map";
import {
  POSTER_GLOW,
  POSTER_WIDTH,
  postersOn,
  postersOver,
  type PosterArt,
  type PosterLevel,
  type PosterSpot,
} from "./posters";
import { drawPits, pitFieldsNear } from "./pits";
import { drawStatue, type Prop, type StatueFrame } from "./statue";
import { floorMarksAt, type FloorMark } from "./floorMarks";
import { wallMarksOn, type WallMark } from "./wallMarks";
import { CARPET_FLIP, CARPET_SIZE, CEILING, FLOORS, FLOOR_FLIPS, PANEL, PANEL_MASK, WALL_TEXTURES } from "./textures";

/** The carpet picture's size, for wrapping pixels into it: CARPET_SIZE − 1, and log2 of CARPET_SIZE. */
const CARPET_MASK = CARPET_SIZE - 1;
const CARPET_SHIFT = Math.log2(CARPET_SIZE);
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
/** The most cells a column's ray goes through looking for a wall, and so the most open cells it can cross. */
const RAY_STEPS = 64;
const RAY_CELLS = RAY_STEPS + 1;

export interface Camera {
  x: number;
  y: number;
  angle: number;
  /** Looking up or down, as a share of the picture's height. */
  pitch: number;
  /** Walking bob, in pixels. */
  bob: number;
  /** Eye height, if not EYE: lower while falling into a pit, below 0 once down in it. */
  z?: number;
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

/** Up through a missing ceiling tile: the dark, and a pipe. Only the frame's dark line is left round it. */
const HOLE_DARK = [22, 20, 14];
const HOLE_PIPE = [70, 66, 54];

/** Under warmer light (a burger room), each colour's share: redder, and much less blue. */
const WARM = [1.12, 0.98, 0.76];

/**
 * Which row of a wall's picture (WALL_TEXTURES, 128 rows) is `tv` down from where a ceiling 1 high would meet it,
 * under a ceiling `ceiling` high. Higher than that, the wall alone goes on up, over and over; under any ceiling the
 * topmost row is the dark edge where it meets the wall.
 */
function wallRow(tv: number, ceiling: number): number {
  const ty = Math.floor(tv * 64);
  if (ceiling === 1) return 64 + (ty > 63 ? 63 : ty < 0 ? 0 : ty);
  if (tv < 1 - ceiling + 1 / 64) return 64;
  if (ty > 0) return 64 + (ty > 63 ? 63 : ty);
  return ((ty % 64) + 64) % 64;
}

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
  /** 1 for each pixel of the place that's under warmer light, filled in as it's drawn. */
  private warmth = new Uint8Array(320 * 180);
  private scratch = new Uint8ClampedArray(320 * 180 * 4);
  private gaps = gapOrder(320);
  /** The frame on screen when the tape was paused. */
  private still: Uint8ClampedArray | null = null;
  private noiseSeed = 1;
  /** The things to draw this frame, in the order they're drawn. */
  private propOrder: Prop[] = [];
  /** The cult's posters, once their picture has loaded and been aged. */
  private posters: readonly PosterArt[] = [];
  /** The ceiling's posters over each cell of the light window, looked up once a frame; undefined until then. */
  private ceilingPosters: (PosterSpot[] | null | undefined)[] = new Array(WN * WN);
  /** Each column's ray: how far to the wall it hits (Infinity for none), the wall's cell, and which way it came in. */
  private rayHit = new Float64Array(320);
  private rayHitX = new Int32Array(320);
  private rayHitY = new Int32Array(320);
  private rayHitSide = new Uint8Array(320);
  /** How many open cells each column's ray crosses first, and 1 where their ceilings aren't all 1 high. */
  private rayCells = new Uint8Array(320);
  private rayUneven = new Uint8Array(320);
  /**
   * The open cells each column's ray crosses, nearest first, RAY_CELLS to a column: how far ahead each starts, its
   * ceiling's height, the cell, and which way the ray came into it (0 across x, 1 across y).
   */
  private rayFrom = new Float64Array(320 * RAY_CELLS);
  private rayCeiling = new Float32Array(320 * RAY_CELLS);
  private rayX = new Int32Array(320 * RAY_CELLS);
  private rayY = new Int32Array(320 * RAY_CELLS);
  private raySide = new Uint8Array(320 * RAY_CELLS);
  /** The marks on the floor of each cell of the light window, looked up once a frame; undefined until then. */
  private floorMarkCells: (FloorMark[] | null | undefined)[] = new Array(WN * WN);
  /** Which of the four ceiling tiles over each cell of the light window are gone, as bits; -1 until looked up. */
  private ceilingHoles = new Int8Array(WN * WN);

  setPosters(posters: readonly PosterArt[]) {
    this.posters = posters;
  }

  /** How XN's graffiti reads right now: her words through the visitor's SAN. Plain until the game says otherwise. */
  private readGraffiti: (text: string) => string = (text) => text;

  setGraffitiReader(read: (text: string) => string) {
    this.readGraffiti = read;
  }

  /** How what the lost wrote in blood reads right now: plain, until SAN takes it as it takes the other cats' words. */
  private readLost: (text: string) => string = (text) => text;

  setLostReader(read: (text: string) => string) {
    this.readLost = read;
  }

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
    this.rayHit = new Float64Array(W);
    this.rayHitX = new Int32Array(W);
    this.rayHitY = new Int32Array(W);
    this.rayHitSide = new Uint8Array(W);
    this.rayCells = new Uint8Array(W);
    this.rayUneven = new Uint8Array(W);
    this.rayFrom = new Float64Array(W * RAY_CELLS);
    this.rayCeiling = new Float32Array(W * RAY_CELLS);
    this.rayX = new Int32Array(W * RAY_CELLS);
    this.rayY = new Int32Array(W * RAY_CELLS);
    this.raySide = new Uint8Array(W * RAY_CELLS);
    this.depth = new Float32Array(W * H);
    this.warmth = new Uint8Array(W * H);
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
    const z = cam.z ?? EYE;
    const fogK = (tuning.fog / 100) * 0.3;
    const [FR, FG, FB] = FOG;
    const [ER, EG, EB] = EMIT;
    const ox = light.x0 + 0.5;
    const oy = light.y0 + 0.5;
    const comb = light.combined;
    const warm = light.warm;
    const zones = light.zone;
    const warmth = this.warmth;
    warmth.fill(0);
    const panels = light.panel;
    const glow = light.glow;
    const px = cam.x;
    const py = cam.y;
    const posters = this.posters;
    const posterAspect = posters.length ? posters[0][0].h / posters[0][0].w : 1;
    // Neighbouring columns mostly see the same face of wall: its posters are looked up once.
    let faceKey = "";
    let onFace: PosterSpot[] | null = null;
    // The posters this column crosses, and the size of each to draw.
    const crossed: PosterSpot[] = [];
    const crossedLevel: PosterLevel[] = [];
    const ceilingPosters = this.ceilingPosters;
    ceilingPosters.fill(undefined);
    const ceilingHoles = this.ceilingHoles;
    ceilingHoles.fill(-1);
    const floorMarkCells = this.floorMarkCells;
    floorMarkCells.fill(undefined);
    // The graffiti on the face of wall being drawn, looked up once per face, and what it shows this frame.
    let tagKey = "";
    let tag: Tag | null = null;
    let tagMask: GraffitiLevel[] | null = null;
    const sample: PaintSample = { paint: 0, over: 0 };
    // The marks on the face of wall being drawn, looked up once per face, and those this column crosses.
    let marksKey = "";
    let marks: WallMark[] | null = null;
    const marked: WallMark[] = [];
    const [OR, OG, OB] = OVER_COLOUR;

    // How fogged something `t` cells ahead is, 1 for not seen at all; and the size of poster to show on the ceiling
    // there, so far ones don't sparkle (seen at a slant, they shrink more).
    const fogAt = (t: number) => {
      const f = 1 - Math.exp(-t * fogK);
      const far = (t - 20) / 8;
      return far > f ? far : f;
    };
    const posterLevelAt = (t: number) => {
      if (!posters.length) return -1;
      const ratio = (posters[0][0].w * t * 1.5) / (POSTER_WIDTH * focal);
      return clamp(Math.floor(Math.log2(Math.max(1, ratio))), 0, posters[0].length - 1);
    };

    // One pixel of ceiling, at (fx, fy) on the map: lit `l`, fogged `f`, its posters shown at size `posterLevel`.
    const ceilingPixel = (o: number, fx: number, fy: number, l: number, f: number, posterLevel: number) => {
      const inWindow = fx >= ox && fy >= oy && fx < ox + WN - 1 && fy < oy + WN - 1;
      const inv = 1 - f;
      const ar = FR * f, ag = FG * f, ab = FB * f;
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
        let papered = false;
        if (posterLevel >= 0 && inWindow && pi >= 0 && pi < WN * WN) {
          let over = ceilingPosters[pi];
          if (over === undefined) {
            over = postersOver(map, cx, cy, tuning, posterAspect);
            ceilingPosters[pi] = over;
          }
          if (over) {
            // Across runs south and down runs east: seen from below, the picture isn't mirrored.
            const across = fy - cy;
            const down = fx - cx;
            for (let i = over.length - 1; i >= 0; i--) {
              const spot = over[i];
              const ox = across - spot.across;
              const oy = down - spot.down;
              const pu = (ox * spot.cos + oy * spot.sin) / (spot.halfW * 2) + 0.5;
              const pv = (oy * spot.cos - ox * spot.sin) / (spot.halfH * 2) + 0.5;
              if (pu < 0 || pu >= 1 || pv < 0 || pv >= 1) continue;
              const level = posters[spot.copy][posterLevel];
              const k = Math.floor(pv * level.h) * level.w + Math.floor(pu * level.w);
              const m = level.mask[k];
              if (!m) continue;
              const e = ((m - 1) / 254) * POSTER_GLOW * (1 - f * 0.5);
              d[o] = level.rgb[k * 3] * li + ar + 26 * e;
              d[o + 1] = level.rgb[k * 3 + 1] * li + ag + 150 * e;
              d[o + 2] = level.rgb[k * 3 + 2] * li + ab + 70 * e;
              papered = true;
              break;
            }
          }
        }
        // A tile gone: the dark above it, inside what's left of its frame.
        let holes = 0;
        if (!papered && inWindow && pi >= 0 && pi < WN * WN) {
          holes = ceilingHoles[pi];
          if (holes < 0) {
            holes =
              (tileGone(map, cx * 2, cy * 2) ? 1 : 0) |
              (tileGone(map, cx * 2 + 1, cy * 2) ? 2 : 0) |
              (tileGone(map, cx * 2, cy * 2 + 1) ? 4 : 0) |
              (tileGone(map, cx * 2 + 1, cy * 2 + 1) ? 8 : 0);
            ceilingHoles[pi] = holes;
          }
        }
        const hx = Math.floor((fx - cx) * 64);
        const hy = Math.floor((fy - cy) * 64);
        const lx = hx & 31;
        const ly = hy & 31;
        if (holes && holes & (1 << ((hx >> 5) + (hy >> 5) * 2)) && lx > 0 && ly > 0) {
          const shade = (0.2 + 0.45 * l) * inv;
          // A pipe running across some of the holes.
          const pipe = ly >= 13 && ly <= 17 && (cx + cy + (hx >> 5)) % 2 === 0;
          const c = pipe ? HOLE_PIPE : HOLE_DARK;
          d[o] = c[0] * shade + ar;
          d[o + 1] = c[1] * shade + ag;
          d[o + 2] = c[2] * shade + ab;
        } else if (!papered) {
          d[o] = CEILING[ti] * li + ar;
          d[o + 1] = CEILING[ti + 1] * li + ag;
          d[o + 2] = CEILING[ti + 2] * li + ab;
        }
      }
    };

    const { rayHit, rayHitX, rayHitY, rayHitSide, rayCells, rayUneven, rayFrom, rayCeiling, rayX, rayY, raySide } = this;

    // Ceiling (floorPass false) and floor, row by row. The floor runs after the walls and skips what they cover.
    const rows = (floorPass: boolean) => {
      for (let y = 0; y < H; y++) {
        let p = y + 0.5 - horizon;
        const isFloor = p > 0;
        if (isFloor !== floorPass) continue;
        if (p < 0) p = -p;
        if (p < 0.5) p = 0.5;
        const rd = ((isFloor ? z : 1 - z) * focal) / p;
        let o = y * W * 4;
        const f = fogAt(rd);
        if (f >= 1) {
          for (let x = 0; x < W; x++, o += 4) {
            if (floorPass ? y <= wallBottom[x] : rayUneven[x]) continue;
            d[o] = FR;
            d[o + 1] = FG;
            d[o + 2] = FB;
            d[o + 3] = 255;
          }
          continue;
        }
        const inv = 1 - f;
        const ar = FR * f, ag = FG * f, ab = FB * f;
        const posterLevel = floorPass ? -1 : posterLevelAt(rd);
        const sx = (rd * 2 * plx) / W;
        const sy = (rd * 2 * ply) / W;
        let fx = px + rd * (dx - plx) + sx * 0.5;
        let fy = py + rd * (dy - ply) + sy * 0.5;
        for (let x = 0; x < W; x++, o += 4, fx += sx, fy += sy) {
          if (floorPass ? y <= wallBottom[x] : rayUneven[x]) continue;
          const gx = fx - ox;
          const gy = fy - oy;
          const ix = Math.floor(gx);
          const iy = Math.floor(gy);
          const u = gx - ix;
          const v = gy - iy;
          const k = ix + iy * WN;
          const inWindow = ix >= 0 && iy >= 0 && ix < WN - 1 && iy < WN - 1;
          const cell = Math.floor(fx) - light.x0 + (Math.floor(fy) - light.y0) * WN;
          if (inWindow) warmth[o >> 2] = warm[cell];
          const l = inWindow
            ? (comb[k] * (1 - u) + comb[k + 1] * u) * (1 - v) + (comb[k + WN] * (1 - u) + comb[k + WN + 1] * u) * v
            : 0;
          d[o + 3] = 255;
          if (isFloor) {
            const li = l * inv;
            const zone = inWindow ? zones[cell] : 0;
            const floor = FLOORS[zone];
            // Each column and row of carpet pictures mirrored or not, so the stains don't line up.
            const tx = Math.floor(fx * 64);
            const ty = Math.floor(fy * 64);
            let cu = tx & CARPET_MASK;
            let cv = ty & CARPET_MASK;
            if (FLOOR_FLIPS[zone]) {
              if (CARPET_FLIP[(tx >> CARPET_SHIFT) & 255]) cu = CARPET_MASK - cu;
              if (CARPET_FLIP[(ty >> CARPET_SHIFT) & 255]) cv = CARPET_MASK - cv;
            }
            const ti = (cv * CARPET_SIZE + cu) * 3;
            let fr = floor[ti];
            let fg = floor[ti + 1];
            let fb = floor[ti + 2];
            // What's happened to the floor here, over it.
            if (inWindow) {
              let marks = floorMarkCells[cell];
              if (marks === undefined) {
                marks = floorMarksAt(map, Math.floor(fx), Math.floor(fy));
                floorMarkCells[cell] = marks;
              }
              if (marks) {
                for (const mark of marks) {
                  const mi = tx - mark.x;
                  const mj = ty - mark.y;
                  if (mi < 0 || mj < 0 || mi >= mark.w || mj >= mark.h) continue;
                  const mk = mj * mark.w + mi;
                  const a = mark.alpha[mk] / 255;
                  if (!a) continue;
                  if (mark.shade) {
                    fr += ((fr * mark.rgb[mk * 3]) / 255 - fr) * a;
                    fg += ((fg * mark.rgb[mk * 3 + 1]) / 255 - fg) * a;
                    fb += ((fb * mark.rgb[mk * 3 + 2]) / 255 - fb) * a;
                  } else {
                    fr += (mark.rgb[mk * 3] - fr) * a;
                    fg += (mark.rgb[mk * 3 + 1] - fg) * a;
                    fb += (mark.rgb[mk * 3 + 2] - fb) * a;
                  }
                }
              }
            }
            d[o] = fr * li + ar;
            d[o + 1] = fg * li + ag;
            d[o + 2] = fb * li + ab;
          } else {
            ceilingPixel(o, fx, fy, l, f, posterLevel);
          }
        }
      }
    };

    // Each column's ray, out to the wall it hits, through the open cells on the way.
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
      let hit = Infinity;
      const base = x * RAY_CELLS;
      rayFrom[base] = 0;
      rayCeiling[base] = light.ceilingAt(mapX, mapY, map);
      rayX[base] = mapX;
      rayY[base] = mapY;
      let cells = 1;
      let uneven = rayCeiling[base] !== 1;
      for (let n = 0; n < RAY_STEPS; n++) {
        let perp: number;
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
          hit = perp;
          break;
        }
        const height = light.ceilingAt(mapX, mapY, map);
        rayFrom[base + cells] = perp;
        rayCeiling[base + cells] = height;
        rayX[base + cells] = mapX;
        rayY[base + cells] = mapY;
        raySide[base + cells] = side;
        cells++;
        if (height !== 1) uneven = true;
      }
      rayHit[x] = hit;
      rayHitX[x] = mapX;
      rayHitY[x] = mapY;
      rayHitSide[x] = side;
      rayCells[x] = cells;
      rayUneven[x] = uneven ? 1 : 0;
    }

    rows(false);

    // How far off each pixel is, for what's drawn over the place: the pits, for XN's legs hanging into one to go behind
    // its far side, and a ceiling of more than one height, for what's beyond a drop in it.
    const depth = this.depth;
    depth.fill(1e9);

    /**
     * Draws column x's ceiling cell by cell along its ray, up to a wall `end` cells ahead, each at its own height; and,
     * where one drops lower, the face of wall above the drop. Gives the first row it left.
     */
    const ceilingColumn = (x: number, rdx: number, rdy: number, end: number): number => {
      const cells = rayCells[x];
      const base = x * RAY_CELLS;
      let clip = 0;
      for (let i = 0; i < cells; i++) {
        const height = rayCeiling[base + i];
        const from = rayFrom[base + i];
        const to = i + 1 < cells ? rayFrom[base + i + 1] : end;
        // Where it drops from the cell before: the face from the ceiling there down to this one, as wall.
        const start = i === 0 ? 0 : Math.ceil(horizon - (focal / from) * (height - z) - 0.5);
        if (start > clip) {
          const above = rayCeiling[base + i - 1];
          const s = raySide[base + i];
          const hx = px + from * rdx;
          const hy = py + from * rdy;
          const along = s === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
          const tx = Math.min(63, Math.floor(along * 64));
          const tex = WALL_TEXTURES[light.zoneAt(rayX[base + i - 1], rayY[base + i - 1], map)];
          const l = light.at(px + (from - 0.05) * rdx, py + (from - 0.05) * rdy) * (s === 1 ? 0.9 : 1);
          const f = Math.min(1, fogAt(from));
          const inv = 1 - f;
          const wx = rayX[base + i - 1] - light.x0;
          const wy = rayY[base + i - 1] - light.y0;
          const warmHere = wx >= 0 && wy >= 0 && wx < WN && wy < WN ? warm[wx + wy * WN] : 0;
          const last = Math.min(start, H);
          for (let y = Math.max(clip, 0); y < last; y++) {
            const tv = 1 - z - ((horizon - (y + 0.5)) * from) / focal;
            const ti = (wallRow(tv, above) * 64 + tx) * 3;
            const li = l * (1.1 - 0.25 * (tv > 0 ? tv : 0)) * inv;
            const o = (y * W + x) * 4;
            d[o] = tex[ti] * li + FR * f;
            d[o + 1] = tex[ti + 1] * li + FG * f;
            d[o + 2] = tex[ti + 2] * li + FB * f;
            depth[y * W + x] = from;
            warmth[y * W + x] = warmHere;
          }
          clip = start;
        }
        // Its ceiling, from there to where the ray leaves it.
        const rise = (height - z) * focal;
        const last = Math.min(H, to === Infinity ? Math.ceil(horizon - 0.5) : Math.ceil(horizon - (focal / to) * (height - z) - 0.5));
        for (let y = Math.max(clip, 0); y < last; y++) {
          let p = horizon - (y + 0.5);
          if (p < 0.5) p = 0.5;
          const t = rise / p;
          const o = (y * W + x) * 4;
          depth[y * W + x] = t;
          const f = fogAt(t);
          if (f >= 1) {
            d[o] = FR;
            d[o + 1] = FG;
            d[o + 2] = FB;
            continue;
          }
          const fx = px + t * rdx;
          const fy = py + t * rdy;
          const cx = Math.floor(fx) - light.x0;
          const cy = Math.floor(fy) - light.y0;
          warmth[y * W + x] = cx >= 0 && cy >= 0 && cx < WN && cy < WN ? warm[cx + cy * WN] : 0;
          ceilingPixel(o, fx, fy, light.at(fx, fy), f, posterLevelAt(t));
        }
        if (last > clip) clip = last;
      }
      return clip;
    };

    // Walls, column by column.
    for (let x = 0; x < W; x++) {
      const cam2 = (2 * (x + 0.5)) / W - 1;
      const rdx = dx + plx * cam2;
      const rdy = dy + ply * cam2;
      const stepX = rdx < 0 ? -1 : 1;
      const stepY = rdy < 0 ? -1 : 1;
      const hit = rayHit[x] !== Infinity;
      let perp = rayHit[x];
      const mapX = rayHitX[x];
      const mapY = rayHitY[x];
      const side = rayHitSide[x];
      // Under a ceiling of more than one height, this column's is drawn cell by cell, with the drops between.
      const clipTop = rayUneven[x] ? ceilingColumn(x, rdx, rdy, rayHit[x]) : 0;
      if (!hit) {
        wallDepth[x] = 1e9;
        wallBottom[x] = -1;
        continue;
      }
      if (perp < 0.02) perp = 0.02;
      const lineH = focal / perp;
      // The wall goes up to the ceiling in front of it; its texture is laid out as if that were 1 high.
      const ceiling = rayCeiling[x * RAY_CELLS + rayCells[x] - 1];
      const top = horizon - lineH * (1 - z);
      const span = lineH;
      let y0 = Math.ceil(horizon - lineH * (ceiling - z) - 0.5);
      if (y0 < clipTop) y0 = clipTop;
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
      const wx = Math.floor(hx) - light.x0;
      const wy = Math.floor(hy) - light.y0;
      // Set for every pixel of the wall, warm or not: the ceiling drawn before it may have marked them for a room
      // behind it.
      const warmHere = wx >= 0 && wy >= 0 && wx < WN && wy < WN ? warm[wx + wy * WN] : 0;
      for (let y = y0; y <= y1; y++) warmth[y * W + x] = warmHere;
      if (side === 1) l *= 0.9;
      let f = 1 - Math.exp(-perp * fogK);
      const far = (perp - 20) / 8;
      if (far > f) f = far;
      if (f > 1) f = 1;
      const inv = 1 - f;
      const ar = FR * f, ag = FG * f, ab = FB * f;
      // Done up as the zone of the cell this face looks into.
      const zone = side === 0 ? light.zoneAt(mapX - stepX, mapY, map) : light.zoneAt(mapX, mapY - stepY, map);
      const tex = WALL_TEXTURES[zone];
      const gap = this.gaps[x] < effects.wallGaps;

      // The posters on this face of wall that this column crosses. Across the face runs left to right as seen.
      const face = side === 0 ? (stepX > 0 ? 0 : 1) : stepY > 0 ? 2 : 3;
      const key = `${mapX},${mapY},${face}`;
      crossed.length = 0;
      crossedLevel.length = 0;
      let across = 0;
      if (posters.length) {
        if (key !== faceKey) {
          faceKey = key;
          onFace = postersOn(map, mapX, mapY, face, tuning, posterAspect);
        }
        if (onFace) {
          across = side === 0 ? (stepX > 0 ? wallX : 1 - wallX) : stepY > 0 ? 1 - wallX : wallX;
          for (const spot of onFace) {
            if (Math.abs(across - spot.across) >= spot.reach) continue;
            // Under a low ceiling, none that would go up into it.
            if (ceiling < 1 && spot.down - Math.hypot(spot.halfW, spot.halfH) < 1 - ceiling) continue;
            // The size whose pixels are about as big as the screen's, so a far poster doesn't sparkle.
            const art = posters[spot.copy];
            const ratio = art[0].h / Math.max(1, lineH * spot.halfH * 2);
            const n = clamp(Math.floor(Math.log2(Math.max(1, ratio))), 0, art.length - 1);
            crossed.push(spot);
            crossedLevel.push(art[n]);
          }
        }
      }
      // XN's graffiti on this face, if any, at the size whose pixels are about as big as the screen's.
      if (key !== tagKey) {
        tagKey = key;
        tag = graffitiOn(map, mapX, mapY, face, tuning);
        tagMask = tag
          ? tagArt(tag, tag.text ? this.readGraffiti(tag.text) : "", tag.lost ? this.readLost(tag.lost) : "")
          : null;
      }
      if (key !== marksKey) {
        marksKey = key;
        marks = wallMarksOn(map, mapX, mapY, face);
      }
      marked.length = 0;
      if (marks) for (const mark of marks) if (tx >= mark.x && tx < mark.x + mark.w) marked.push(mark);
      const along = (side === 0 ? mapY : mapX) + wallX;
      const painted = tag && tagMask && along >= tag.from && along < tag.to ? tag : null;
      const tagLevel = painted ? Math.max(0, Math.floor(Math.log2(Math.max(1, painted.px / Math.max(1, lineH))))) : 0;
      for (let y = y0; y <= y1; y++) {
        if (gap && y > horizon) {
          const o = (y * W + x) * 4;
          d[o] = GAP_COLOUR[0];
          d[o + 1] = GAP_COLOUR[1];
          d[o + 2] = GAP_COLOUR[2];
          continue;
        }
        const tv = (y + 0.5 - top) / span;
        const ty = wallRow(tv, ceiling);
        const ti = (ty * 64 + tx) * 3;
        const li = l * (1.1 - 0.25 * (tv > 0 ? tv : 0)) * inv;
        const o = (y * W + x) * 4;
        let papered = false;
        // The topmost poster here: the last one stuck up.
        for (let i = crossed.length - 1; i >= 0; i--) {
          const spot = crossed[i];
          const ox = across - spot.across;
          const oy = tv - spot.down;
          const pu = (ox * spot.cos + oy * spot.sin) / (spot.halfW * 2) + 0.5;
          const pv = (oy * spot.cos - ox * spot.sin) / (spot.halfH * 2) + 0.5;
          if (pu < 0 || pu >= 1 || pv < 0 || pv >= 1) continue;
          const level = crossedLevel[i];
          const k = Math.floor(pv * level.h) * level.w + Math.floor(pu * level.w);
          const m = level.mask[k];
          if (!m) continue;
          const e = ((m - 1) / 254) * POSTER_GLOW * (1 - f * 0.5);
          d[o] = level.rgb[k * 3] * li + ar + 26 * e;
          d[o + 1] = level.rgb[k * 3 + 1] * li + ag + 150 * e;
          d[o + 2] = level.rgb[k * 3 + 2] * li + ab + 70 * e;
          papered = true;
          break;
        }
        if (papered) continue;
        // The paper, with what's happened to the wall over it.
        let wr = tex[ti];
        let wg = tex[ti + 1];
        let wb = tex[ti + 2];
        if (marked.length) {
          const row = Math.floor(tv * 64);
          for (const mark of marked) {
            const j = row - mark.y;
            if (j < 0 || j >= mark.h) continue;
            const k = j * mark.w + tx - mark.x;
            const a = mark.alpha[k] / 255;
            if (!a) continue;
            if (mark.shade) {
              wr += ((wr * mark.rgb[k * 3]) / 255 - wr) * a;
              wg += ((wg * mark.rgb[k * 3 + 1]) / 255 - wg) * a;
              wb += ((wb * mark.rgb[k * 3 + 2]) / 255 - wb) * a;
            } else {
              wr += (mark.rgb[k * 3] - wr) * a;
              wg += (mark.rgb[k * 3 + 1] - wg) * a;
              wb += (mark.rgb[k * 3 + 2] - wb) * a;
            }
          }
        }
        if (painted && tagMask && paintAt(painted, tagMask, tagLevel, along, tv, sample)) {
          // Its own paint on the wall, then whatever XN put over the top.
          const a = sample.paint;
          const b = sample.over;
          const paint = painted.colour;
          const r = wr + (paint[0] - wr) * a;
          const g = wg + (paint[1] - wg) * a;
          const bl = wb + (paint[2] - wb) * a;
          d[o] = (r + (OR - r) * b) * li + ar;
          d[o + 1] = (g + (OG - g) * b) * li + ag;
          d[o + 2] = (bl + (OB - bl) * b) * li + ab;
          continue;
        }
        d[o] = wr * li + ar;
        d[o + 1] = wg * li + ag;
        d[o + 2] = wb * li + ab;
      }
    }

    // From down in a pit there's no floor at 0 to see: the pit's own floor and sides cover it all.
    if (z > 0) rows(true);
    drawPits(
      {
        pixels: d,
        depth,
        width: W,
        height: H,
        wallDepth,
        camX: px,
        camY: py,
        eye: z,
        dirX: dx,
        dirY: dy,
        planeX: plx,
        planeY: ply,
        focal,
        horizon,
        fogK,
        fog: FOG,
        far: FAR,
      },
      pitFieldsNear(map, px, py, FAR),
      light,
    );

    if (props.length) {
      const frame: StatueFrame = {
        pixels: d,
        width: W,
        height: H,
        wallDepth,
        depth,
        camX: px,
        camY: py,
        eye: z,
        dirX: dx,
        dirY: dy,
        focal,
        horizon,
        fogK,
        fog: FOG,
      };
      // Nearest first: what stands behind them is then mostly turned away pixel by pixel before it's coloured.
      const order = this.propOrder;
      order.length = 0;
      for (const prop of props) order.push(prop);
      order.sort((a, b) => (a.mesh.x - px) ** 2 + (a.mesh.y - py) ** 2 - (b.mesh.x - px) ** 2 - (b.mesh.y - py) ** 2);
      for (const prop of order) {
        drawStatue(frame, prop.mesh, prop.model, prop.skin, prop.glow ?? light.at(prop.mesh.x, prop.mesh.y), prop.clip);
      }
    }

    // Warmer light where it's warm.
    const [WR, WG, WB] = WARM;
    for (let i = 0, o = 0; i < W * H; i++, o += 4) {
      if (!warmth[i]) continue;
      d[o] *= WR;
      d[o + 1] *= WG;
      d[o + 2] *= WB;
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
      const from = clamp(y + jump, 0, H - 1);
      d.set(still.subarray(from * row, from * row + row), y * row);
    }
    if (band >= 0) {
      const thick = Math.max(2, Math.round(H / 45));
      for (let y = band; y < Math.min(H, band + thick); y++) this.slideRow(d, y, W, 6 * 4, 120);
    }
    this.ctx.putImageData(this.image, 0, 0);
  }
}
