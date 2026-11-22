import { LIGHT_DEAD, LIGHT_ON, LIGHT_FLICKER_A, type WorldMap } from "./map";

/*
 * The walls and light around the player, worked out for a square window of cells and kept until they walk far
 * enough from its middle. Each working ceiling light adds light to the cells within reach, much less where a wall
 * is in the way; flickering lights add theirs to one of two layers that the flicker scales every frame.
 */

/** Window width in cells. */
export const WN = 128;
const HALF = WN / 2;
/** Rebuilt once the player is this far from the window's middle. */
const REBUILD_AT = 16;
const LIGHT_REACH = 6;
const AMBIENT = 0.035;
/** How much a light's glow falls off with how high it hangs, the ceiling's height to this power. */
const HANG_FALLOFF = 0.35;

export class Lighting {
  /** Window position of cell (0, 0) in the world. */
  x0 = 0;
  y0 = 0;
  readonly wall = new Uint8Array(WN * WN);
  /** The light hanging over each cell, 0 where none does. */
  readonly panel = new Uint8Array(WN * WN);
  /** This frame's light per cell. */
  readonly combined = new Float32Array(WN * WN);
  /** This frame's glow of each kind of light panel, indexed by its state. */
  readonly glow = new Float32Array(5);
  /** 1 for each cell under warmer light, inside a burger room (not its walls or doorway), like a fast-food place's. */
  readonly warm = new Uint8Array(WN * WN);
  /** The zone each cell is in (map.zoneAt): what its floor, and the faces of wall looking into it, are done up as. */
  readonly zone = new Uint8Array(WN * WN);
  /** How high the ceiling is over each cell (map.ceilingAt), and its floor (map.floorAt). */
  readonly ceiling = new Float32Array(WN * WN);
  readonly floor = new Float32Array(WN * WN);
  /** How high each low wall is (map.lowWall), 0 for one that goes up to the ceiling and for open floor. */
  readonly low = new Float32Array(WN * WN);
  /** 1 for each cell of wall the lights can't shine past: wall that goes up to the ceiling. */
  private readonly block = new Uint8Array(WN * WN);

  private readonly steady = new Float32Array(WN * WN);
  private readonly groupA = new Float32Array(WN * WN);
  private readonly groupB = new Float32Array(WN * WN);
  private readonly flicker = [
    { level: 1, left: 0 },
    { level: 1, left: 0 },
  ];
  private built = false;

  needsBuild(px: number, py: number): boolean {
    return !this.built || Math.abs(px - (this.x0 + HALF)) > REBUILD_AT || Math.abs(py - (this.y0 + HALF)) > REBUILD_AT;
  }

  /** Throws the window away, for when the map or its lights change. */
  forget() {
    this.built = false;
  }

  private clear(i0: number, j0: number, i1: number, j1: number, d2: number): boolean {
    const n = Math.ceil(Math.sqrt(d2) * 3);
    for (let s = 1; s < n; s++) {
      const t = s / n;
      if (this.block[Math.floor(i0 + 0.5 + (i1 - i0) * t) + Math.floor(j0 + 0.5 + (j1 - j0) * t) * WN]) return false;
    }
    return true;
  }

  build(px: number, py: number, map: WorldMap) {
    this.x0 = Math.floor(px) - HALF;
    this.y0 = Math.floor(py) - HALF;
    const { wall, block, panel, steady, groupA, groupB } = this;
    for (let j = 0; j < WN; j++) {
      for (let i = 0; i < WN; i++) {
        wall[i + j * WN] = map.wall(this.x0 + i, this.y0 + j);
        this.warm[i + j * WN] = map.burgerInside(this.x0 + i, this.y0 + j) ? 1 : 0;
        this.zone[i + j * WN] = map.zoneAt(this.x0 + i, this.y0 + j);
        this.ceiling[i + j * WN] = map.ceilingAt(this.x0 + i, this.y0 + j);
        this.floor[i + j * WN] = map.floorAt(this.x0 + i, this.y0 + j);
        const low = wall[i + j * WN] ? map.lowWall(this.x0 + i, this.y0 + j) : 0;
        this.low[i + j * WN] = low;
        this.block[i + j * WN] = wall[i + j * WN] && !low ? 1 : 0;
      }
    }
    steady.fill(0);
    groupA.fill(0);
    groupB.fill(0);
    panel.fill(0);
    for (let j = 0; j < WN; j++) {
      for (let i = 0; i < WN; i++) {
        const idx = i + j * WN;
        if (wall[idx]) continue;
        if (!map.lampAt(this.x0 + i, this.y0 + j)) continue;
        const state = map.light(this.x0 + i, this.y0 + j);
        panel[idx] = state;
        if (state === LIGHT_DEAD) continue;
        const target = state === LIGHT_ON ? steady : state === LIGHT_FLICKER_A ? groupA : groupB;
        // Hung higher, less of it reaches the floor; lower, more.
        const strength = 0.42 * this.ceiling[idx] ** -HANG_FALLOFF;
        for (let dj = -LIGHT_REACH; dj <= LIGHT_REACH; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= WN) continue;
          for (let di = -LIGHT_REACH; di <= LIGHT_REACH; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= WN) continue;
            const d2 = di * di + dj * dj;
            if (d2 > LIGHT_REACH * LIGHT_REACH) continue;
            const k = ii + jj * WN;
            // Over a low wall too: it doesn't reach the ceiling.
            if (block[k]) continue;
            let c = strength / (1 + 0.45 * d2);
            if (d2 > 0 && !this.clear(i, j, ii, jj, d2)) c *= 0.1;
            target[k] += c;
          }
        }
      }
    }
    // Wall cells borrow from the open cells beside them, so light runs smoothly right up to the wall.
    for (const layer of [steady, groupA, groupB]) {
      for (let j = 1; j < WN - 1; j++) {
        for (let i = 1; i < WN - 1; i++) {
          const k = i + j * WN;
          if (!block[k]) continue;
          let sum = 0;
          let n = 0;
          for (const o of [k - 1, k + 1, k - WN, k + WN]) {
            if (!block[o]) {
              sum += layer[o];
              n++;
            }
          }
          layer[k] = n ? (sum / n) * 0.7 : 0;
        }
      }
    }
    this.built = true;
  }

  /** Whether cell (cx, cy) is wall, from the window when it's in it, which is almost always. */
  wallAt(cx: number, cy: number, map: WorldMap): number {
    const i = cx - this.x0;
    const j = cy - this.y0;
    return i >= 0 && j >= 0 && i < WN && j < WN ? this.wall[i + j * WN] : map.wall(cx, cy);
  }

  /** The zone cell (cx, cy) is in, from the window when it's in it. */
  zoneAt(cx: number, cy: number, map: WorldMap): number {
    const i = cx - this.x0;
    const j = cy - this.y0;
    return i >= 0 && j >= 0 && i < WN && j < WN ? this.zone[i + j * WN] : map.zoneAt(cx, cy);
  }

  /** How high the ceiling is over cell (cx, cy), from the window when it's in it. */
  ceilingAt(cx: number, cy: number, map: WorldMap): number {
    const i = cx - this.x0;
    const j = cy - this.y0;
    return i >= 0 && j >= 0 && i < WN && j < WN ? this.ceiling[i + j * WN] : map.ceilingAt(cx, cy);
  }

  /** How high wall cell (cx, cy) is if it's low, 0 if not (map.lowWall), from the window when it's in it. */
  lowAt(cx: number, cy: number, map: WorldMap): number {
    const i = cx - this.x0;
    const j = cy - this.y0;
    return i >= 0 && j >= 0 && i < WN && j < WN ? this.low[i + j * WN] : map.lowWall(cx, cy);
  }

  /** How high the floor is in cell (cx, cy), from the window when it's in it. */
  floorAt(cx: number, cy: number, map: WorldMap): number {
    const i = cx - this.x0;
    const j = cy - this.y0;
    return i >= 0 && j >= 0 && i < WN && j < WN ? this.floor[i + j * WN] : map.floorAt(cx, cy);
  }

  /** Moves the flicker on and mixes this frame's light. With reduced motion the flickering lights just stay dim. */
  step(dt: number, reduced: boolean, brightness: number) {
    for (const f of this.flicker) {
      if (reduced) {
        f.level = 0.7;
        continue;
      }
      f.left -= dt;
      if (f.left <= 0) {
        if (Math.random() < 0.4) {
          f.level = 0.05 + Math.random() * 0.3;
          f.left = 0.03 + Math.random() * 0.12;
        } else {
          f.level = 1;
          f.left = 0.05 + Math.random() * Math.random() * 1.6;
        }
      }
    }
    const a = this.flicker[0].level;
    const b = this.flicker[1].level;
    const { combined, steady, groupA, groupB } = this;
    for (let i = 0; i < WN * WN; i++) combined[i] = (AMBIENT + steady[i] + a * groupA[i] + b * groupB[i]) * brightness;
    this.glow[1] = 1;
    this.glow[2] = 0.12 + 0.88 * a;
    this.glow[3] = 0.12 + 0.88 * b;
  }

  /** The light at a point, blended between the four nearest cells. */
  at(x: number, y: number): number {
    const gx = x - (this.x0 + 0.5);
    const gy = y - (this.y0 + 0.5);
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    if (ix < 0 || iy < 0 || ix >= WN - 1 || iy >= WN - 1) return AMBIENT;
    const u = gx - ix;
    const v = gy - iy;
    const k = ix + iy * WN;
    const c = this.combined;
    return (c[k] * (1 - u) + c[k + 1] * u) * (1 - v) + (c[k + WN] * (1 - u) + c[k + WN + 1] * u) * v;
  }
}
