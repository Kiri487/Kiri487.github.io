import { hash3, mod } from "./hash";
import type { Tuning } from "./tuning";

/*
 * The place is an endless grid of one-metre cells, worked out from the seed wherever it's looked at, never stored.
 * Walls sit on a lattice every 5 cells. Each stretch of lattice between two points is a wall, a wall with a doorway,
 * half a wall or nothing, and how often each comes up depends on the kind of area: open halls with pillars, mazes of
 * corridors, or packed office cubicles. Now and then a block of lattice rooms is knocked through into one big room.
 */

interface Area {
  /** How likely a stretch of lattice is to have any wall. */
  dense: number;
  door: number;
  half: number;
  /** How likely a lattice point on its own is a pillar. */
  post: number;
}

const HALL: Area = { dense: 0.14, door: 0.3, half: 0.3, post: 0.5 };
const MAZE: Area = { dense: 0.6, door: 0.32, half: 0.24, post: 0.12 };
const OFFICE: Area = { dense: 0.88, door: 0.52, half: 0.1, post: 0.05 };

export const LIGHT_ON = 1;
/** Two groups of lights that flicker, each in step with itself. */
export const LIGHT_FLICKER_A = 2;
export const LIGHT_FLICKER_B = 3;
export const LIGHT_DEAD = 4;

/** Where the player starts: inside the first lattice room, which is always open. */
export const SPAWN = { x: 2.5, y: 2.5, angle: 0.6 };

export interface Statue {
  /** Middle of its cell. */
  x: number;
  y: number;
  cx: number;
  cy: number;
  /** The way its front faces, in radians. */
  facing: number;
  /** The ceiling light nearest to it, which always works. */
  lampX: number;
  lampY: number;
}

/** How many spots a region tries before it gives up on having a statue. */
const STATUE_TRIES = 24;
/** Statues keep this far from their region's edge, so the lamp over one is in the same region. */
const STATUE_MARGIN = 5;

export class WorldMap {
  readonly seed: number;
  private readonly tuning: Tuning;
  /** One statue per square region this many cells wide. */
  readonly region: number;
  private readonly statues = new Map<string, Statue | null>();

  /** The tuning is read live, so the dev panel's dead-light slider works without a new map. */
  constructor(seed: number, tuning: Tuning) {
    this.seed = seed;
    this.tuning = tuning;
    this.region = Math.max(20, Math.round(tuning.region));
  }

  /** A number in [0, 1) for this spot and purpose, the same every time for this seed. */
  noise(x: number, y: number, s: number): number {
    return hash3(x, y, s + this.seed * 101);
  }

  private area(lx: number, ly: number): Area {
    const rx = Math.floor((lx + 3) / 6);
    const ry = Math.floor((ly + 3) / 6);
    if (rx === 0 && ry === 0) return MAZE;
    const t = this.noise(rx, ry, 10);
    return t < 0.3 ? HALL : t < 0.72 ? MAZE : OFFICE;
  }

  private bigRoom(lx: number, ly: number, dir: number): boolean {
    if (this.noise(Math.floor(lx / 3), Math.floor(ly / 3), 9) >= 0.2) return false;
    return dir === 0 ? mod(ly, 3) !== 0 : mod(lx, 3) !== 0;
  }

  /** Whether the stretch of lattice from point (lx, ly), running east (dir 0) or south (dir 1), covers cell m (1–4). */
  private segment(lx: number, ly: number, dir: number, m: number): boolean {
    // Two stretches by the spawn point are always open, so nobody starts boxed in.
    if (dir === 0 ? lx === 0 && (ly === 0 || ly === 1) : ly === 0 && (lx === 0 || lx === 1)) return false;
    if (this.bigRoom(lx, ly, dir)) return false;
    const area = this.area(lx, ly);
    if (this.noise(lx, ly, 2 + dir) >= area.dense) return false;
    const k = this.noise(lx, ly, 4 + dir);
    if (k < area.door) {
      const doorway = 1 + Math.floor(this.noise(lx, ly, 6 + dir) * 4);
      if (m === doorway) return false;
      if (k < area.door * 0.4 && m === (doorway % 4) + 1) return false;
      return true;
    }
    if (k < area.door + area.half) return m <= 2;
    return true;
  }

  /** 1 where cell (x, y) is wall. */
  wall(x: number, y: number): number {
    const lx = Math.floor(x / 5);
    const ly = Math.floor(y / 5);
    const mx = x - lx * 5;
    const my = y - ly * 5;
    if (mx === 0 && my === 0) {
      if (
        this.segment(lx, ly, 0, 1) ||
        this.segment(lx - 1, ly, 0, 4) ||
        this.segment(lx, ly, 1, 1) ||
        this.segment(lx, ly - 1, 1, 4)
      ) {
        return 1;
      }
      const inBigRoom =
        this.noise(Math.floor(lx / 3), Math.floor(ly / 3), 9) < 0.2 && mod(lx, 3) !== 0 && mod(ly, 3) !== 0;
      return this.noise(lx, ly, 8) < (inBigRoom ? 0.6 : this.area(lx, ly).post) ? 1 : 0;
    }
    if (my === 0) return this.segment(lx, ly, 0, mx) ? 1 : 0;
    if (mx === 0) return this.segment(lx, ly, 1, my) ? 1 : 0;
    return 0;
  }

  /** The ceiling light over cell (x, y), for cells where a light hangs (every 3 cells). */
  light(x: number, y: number): number {
    const statue = this.statueIn(Math.floor(x / this.region), Math.floor(y / this.region));
    if (statue && statue.lampX === x && statue.lampY === y) return LIGHT_ON;
    // Some whole stretches are mostly dark.
    const rx = Math.floor((x + 11) / 22);
    const ry = Math.floor((y + 11) / 22);
    let dead = this.tuning.dead / 100;
    if (!(rx === 0 && ry === 0) && this.noise(rx, ry, 21) < 0.16) dead = Math.max(dead, 0.85);
    if (this.noise(x, y, 20) < dead) return LIGHT_DEAD;
    const r = this.noise(x, y, 22);
    return r < 0.08 ? LIGHT_FLICKER_A : r < 0.14 ? LIGHT_FLICKER_B : LIGHT_ON;
  }

  /** Room for a statue at cell (x, y): it and the eight cells around it are open. */
  private roomy(x: number, y: number): boolean {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        if (this.wall(x + i, y + j)) return false;
      }
    }
    return true;
  }

  /** The region's statue, or null if it found nowhere to stand. */
  statueIn(rx: number, ry: number): Statue | null {
    const key = `${rx},${ry}`;
    const known = this.statues.get(key);
    if (known !== undefined) return known;

    let found: Statue | null = null;
    const span = this.region - STATUE_MARGIN * 2;
    for (let k = 0; k < STATUE_TRIES; k++) {
      const cx = rx * this.region + STATUE_MARGIN + Math.floor(this.noise(rx, ry, 100 + k) * span);
      const cy = ry * this.region + STATUE_MARGIN + Math.floor(this.noise(rx, ry, 140 + k) * span);
      if (!this.roomy(cx, cy)) continue;
      // Lights hang over cells 1, 4, 7… on both axes; the nearest one is at most a cell away.
      const lampX = cx + [1, 0, -1][mod(cx, 3)];
      const lampY = cy + [1, 0, -1][mod(cy, 3)];
      found = { x: cx + 0.5, y: cy + 0.5, cx, cy, facing: this.noise(rx, ry, 180 + k) * Math.PI * 2, lampX, lampY };
      break;
    }
    this.statues.set(key, found);
    return found;
  }

  /** Every statue whose region touches the square of this radius around (x, y). */
  statuesAround(x: number, y: number, radius: number): Statue[] {
    const out: Statue[] = [];
    const r0x = Math.floor((x - radius) / this.region);
    const r1x = Math.floor((x + radius) / this.region);
    const r0y = Math.floor((y - radius) / this.region);
    const r1y = Math.floor((y + radius) / this.region);
    for (let ry = r0y; ry <= r1y; ry++) {
      for (let rx = r0x; rx <= r1x; rx++) {
        const statue = this.statueIn(rx, ry);
        if (statue) out.push(statue);
      }
    }
    return out;
  }
}
