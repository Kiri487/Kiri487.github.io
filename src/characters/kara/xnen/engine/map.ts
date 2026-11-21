import { hash3, mod } from "./hash";
import type { Tuning } from "./tuning";

/*
 * The place is an endless grid of one-metre cells, worked out from the seed wherever it's looked at, never stored.
 * Walls sit on a lattice every 5 cells. Each stretch of lattice between two points is a wall, a wall with a doorway,
 * half a wall or nothing, and how often each comes up depends on the kind of area: open halls with pillars, mazes of
 * corridors, or packed office cubicles. Now and then a block of lattice rooms is knocked through into one big room.
 *
 * Rarer still, a block of 3 × 3 lattice rooms is a special room, built to its own plan: walled all round, with a
 * doorway somewhere along some of its sides and at least one. Each kind says what of the usual backrooms it lets in.
 * So far there's one kind, the pit room: from wall to wall a grid of square pits with no bottom, only thin rims
 * between them.
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

/** A special room is one block of 3 × 3 lattice rooms: this many cells a side, walls included. */
export const ROOM_BLOCK = 15;

/** The kinds of special room. */
export type RoomKind = "pit";
/**
 * What a special room lets in: the junk lying about the backrooms, a statue, and XN, on its floor and its walls or
 * just turning up there. Things it has of its own (XN on a pit's rim) it sees to itself.
 */
export interface RoomRules {
  junk: boolean;
  statue: boolean;
  xn: boolean;
}
const ROOM_RULES: Record<RoomKind, RoomRules> = {
  pit: { junk: false, statue: false, xn: false },
};
/**
 * How likely a block is to be each kind of special room, in turn from one die: a new kind takes the next share, so the
 * ones before stay where they were.
 */
const ROOM_CHANCES: readonly [RoomKind, number][] = [["pit", 0.06]];
/**
 * How likely each side of a special room is to have a doorway (one, anywhere along it). A room left with none gets
 * one.
 */
const ROOM_DOOR = 0.5;

/** Its pits fill the room from wall to wall: one cell in from the room's corner, past the wall, and this many a side. */
const PIT_FIELD_IN = 1;
export const PIT_FIELD = 14;
/** How many pits along each side of the field, and so how far apart their rims are. */
export const PIT_COUNT = 7;
export const PIT_PITCH = PIT_FIELD / PIT_COUNT;
/**
 * Half a rim's width: the rims between pits are this far either side of their lines. Along the walls the rim is all on
 * the inside, so it's as wide as the others.
 */
export const PIT_RIM = 0.15;

/** The square of pits in a pit room, in cells: its north-west corner and its width. */
export interface PitField {
  x0: number;
  y0: number;
  size: number;
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

  /** What kind of special room block (bx, by) of 3 × 3 lattice rooms is, or null if it's none. Never the spawn's. */
  roomKind(bx: number, by: number): RoomKind | null {
    if (bx === 0 && by === 0) return null;
    let die = this.noise(bx, by, 50);
    for (const [kind, chance] of ROOM_CHANCES) {
      if (die < chance) return kind;
      die -= chance;
    }
    return null;
  }

  /** Whether block (bx, by) is a special room of any kind. */
  private specialRoom(bx: number, by: number): boolean {
    return this.roomKind(bx, by) !== null;
  }

  /** Whether block (bx, by) is a pit room. */
  pitRoom(bx: number, by: number): boolean {
    return this.roomKind(bx, by) === "pit";
  }

  /** The kind of special room cell (cx, cy) is in, walls included, or null if it's in none. */
  roomAt(cx: number, cy: number): RoomKind | null {
    return this.roomKind(Math.floor(cx / ROOM_BLOCK), Math.floor(cy / ROOM_BLOCK));
  }

  /** Whether `what` belongs at cell (cx, cy): anywhere outside the special rooms, and in one if its kind lets it in. */
  allows(cx: number, cy: number, what: keyof RoomRules): boolean {
    const kind = this.roomAt(cx, cy);
    return !kind || ROOM_RULES[kind][what];
  }

  /** Whether block (bx, by) of 3 × 3 lattice rooms is knocked through into one room: a big room or a special room. */
  private openBlock(bx: number, by: number): boolean {
    return this.noise(bx, by, 9) < 0.2 || this.specialRoom(bx, by);
  }

  private bigRoom(lx: number, ly: number, dir: number): boolean {
    if (!this.openBlock(Math.floor(lx / 3), Math.floor(ly / 3))) return false;
    return dir === 0 ? mod(ly, 3) !== 0 : mod(lx, 3) !== 0;
  }

  /**
   * Whether the stretch of lattice from point (lx, ly), running east (dir 0) or south (dir 1), is a special room's
   * wall: then it's always there, but for the side's doorway if it has one and it's here.
   */
  private roomWall(lx: number, ly: number, dir: number): boolean {
    const across = dir === 0 ? ly : lx;
    if (mod(across, 3) !== 0) return false;
    const along = Math.floor((dir === 0 ? lx : ly) / 3);
    const block = across / 3;
    return dir === 0
      ? this.specialRoom(along, block) || this.specialRoom(along, block - 1)
      : this.specialRoom(block, along) || this.specialRoom(block - 1, along);
  }

  /**
   * Which sides of special room (bx, by) have a doorway: north, south, west, east. Each side's own die is shared with
   * the block on its other side, so a wall between two special rooms agrees with itself; a room that rolls none gets
   * one.
   */
  private roomSides(bx: number, by: number): [boolean, boolean, boolean, boolean] {
    const sides: [boolean, boolean, boolean, boolean] = [
      this.noise(bx, by, 52) < ROOM_DOOR,
      this.noise(bx, by + 1, 52) < ROOM_DOOR,
      this.noise(bx, by, 53) < ROOM_DOOR,
      this.noise(bx + 1, by, 53) < ROOM_DOOR,
    ];
    if (!sides.some(Boolean)) sides[Math.floor(this.noise(bx, by, 54) * 4)] = true;
    return sides;
  }

  /**
   * The doorway in a special room's wall along a block's side, as the stretch it's in (0–2) and the cell along that
   * stretch (1–4), or null if there's none. dir 0: the wall along the top of block (a, b); dir 1: down its left.
   */
  private roomDoorway(dir: number, a: number, b: number): [number, number] | null {
    const side = (bx: number, by: number, k: number) => this.specialRoom(bx, by) && this.roomSides(bx, by)[k];
    const open = dir === 0 ? side(a, b, 0) || side(a, b - 1, 1) : side(a, b, 2) || side(a - 1, b, 3);
    if (!open) return null;
    return [Math.floor(this.noise(a, b, 56 + dir) * 3), 1 + Math.floor(this.noise(a, b, 58 + dir) * 4)];
  }

  /**
   * Whether side `side` of the stretch of lattice from point (lx, ly), running east (dir 0) or south (dir 1), is the
   * outside of a pit room's wall: the room on the other side, and not on this one. Side 0 faces north or west.
   */
  pitOutside(lx: number, ly: number, dir: number, side: number): boolean {
    const across = dir === 0 ? ly : lx;
    if (mod(across, 3) !== 0) return false;
    const along = Math.floor((dir === 0 ? lx : ly) / 3);
    const block = across / 3;
    const room = (k: number) => (dir === 0 ? this.pitRoom(along, k) : this.pitRoom(k, along));
    // Side 0 is in the block before the line, side 1 in the one after.
    const here = side === 0 ? block - 1 : block;
    const there = side === 0 ? block : block - 1;
    return room(there) && !room(here);
  }

  /** The square of pits that (x, y) is over or beside, if it's in a pit room. */
  pitFieldAt(x: number, y: number): PitField | null {
    const bx = Math.floor(x / ROOM_BLOCK);
    const by = Math.floor(y / ROOM_BLOCK);
    if (!this.pitRoom(bx, by)) return null;
    return { x0: bx * ROOM_BLOCK + PIT_FIELD_IN, y0: by * ROOM_BLOCK + PIT_FIELD_IN, size: PIT_FIELD };
  }

  /**
   * Whether (x, y) is over a pit, not on a rim or the carpet round them. With a `margin`, only if it's more than that
   * far out over the pit: someone standing at (x, y) still has a foot on the rim until then.
   */
  pitAt(x: number, y: number, margin = 0): boolean {
    const field = this.pitFieldAt(x, y);
    return !!field && overPit(field, x, y, margin);
  }

  /** Whether the stretch of lattice from point (lx, ly), running east (dir 0) or south (dir 1), covers cell m (1–4). */
  private segment(lx: number, ly: number, dir: number, m: number): boolean {
    // Two stretches by the spawn point are always open, so nobody starts boxed in.
    if (dir === 0 ? lx === 0 && (ly === 0 || ly === 1) : ly === 0 && (lx === 0 || lx === 1)) return false;
    if (this.bigRoom(lx, ly, dir)) return false;
    if (this.roomWall(lx, ly, dir)) {
      const doorway =
        dir === 0
          ? this.roomDoorway(0, Math.floor(lx / 3), ly / 3)
          : this.roomDoorway(1, lx / 3, Math.floor(ly / 3));
      return !doorway || doorway[0] !== mod(dir === 0 ? lx : ly, 3) || doorway[1] !== m;
    }
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
      const inside = mod(lx, 3) !== 0 && mod(ly, 3) !== 0;
      const bx = Math.floor(lx / 3);
      const by = Math.floor(ly / 3);
      // A special room has nothing standing in it but what its plan puts there.
      if (inside && this.specialRoom(bx, by)) return 0;
      const inBigRoom = inside && this.openBlock(bx, by);
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

  /** Room for a statue at cell (x, y): it and the eight cells around it are open, and statues belong there. */
  private roomy(x: number, y: number): boolean {
    if (!this.allows(x, y, "statue")) return false;
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

/** Whether (x, y), inside or beside a pit field, is over one of its pits, and more than `margin` out from its rims. */
export function overPit(field: PitField, x: number, y: number, margin = 0): boolean {
  const u = x - field.x0;
  const v = y - field.y0;
  const edge = PIT_RIM * 2 + margin;
  if (u <= edge || v <= edge || u >= field.size - edge || v >= field.size - edge) return false;
  const du = u - Math.round(u / PIT_PITCH) * PIT_PITCH;
  const dv = v - Math.round(v / PIT_PITCH) * PIT_PITCH;
  const rim = PIT_RIM + margin;
  return Math.abs(du) > rim && Math.abs(dv) > rim;
}
