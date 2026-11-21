import { hash3, mod } from "./hash";
import type { Tuning } from "./tuning";
import {
  BURGER_ROOM_WEIGHTS,
  CELLS_WEIGHTS,
  CORRIDOR_WEIGHTS,
  heaviest,
  PIT_ROOM_WEIGHTS,
  ZONE_DRYWALL,
  ZONE_HOUSE,
  ZONE_OFFICE,
  ZONE_TILES,
  ZONE_YELLOW,
  CAMP_WEIGHTS,
  DEAD_END_WEIGHTS,
  CUBICLE_HALL_WEIGHTS,
  LAMP_HALL_WEIGHTS,
  MEETING_WEIGHTS,
  PILLAR_HALL_WEIGHTS,
  PANTRY_WEIGHTS,
  STORAGE_WEIGHTS,
  WORKROOM_WEIGHTS,
  type ZoneWeights,
} from "./zones";

/*
 * The place is an endless grid of one-metre cells, worked out from the seed wherever it's looked at, never stored.
 * Walls sit on a lattice every 5 cells. Each stretch of lattice between two points is a wall, a wall with a doorway,
 * half a wall or nothing, and how often each comes up depends on the kind of area: open halls with pillars, mazes of
 * corridors, or packed office cubicles. Now and then a block of lattice rooms is knocked through into one big room.
 *
 * Some areas aren't left to the dice stretch by stretch but laid out to a plan. A corridor area is long corridors four
 * cells wide, side by side, with a row of little rooms between each two, each room's door opening onto one of them. A
 * cells area has its walls every 3 cells instead of 5: a warren of rooms two cells by two, or a few run together.
 *
 * Rarer still, a block of 3 × 3 lattice rooms is a special room, built to its own plan: walled all round, with a
 * doorway somewhere along some of its sides and at least one. Each kind says what of the usual backrooms it lets in.
 * So far there's one kind, the pit room: from wall to wall a grid of square pits with no bottom, only thin rims
 * between them.
 *
 * Smaller and rarer, a burger room: two cells by two in a corner of a lattice room, walled in all round with one
 * doorway, a party laid out in it for nobody (junk.ts), under warmer light (lighting.ts).
 *
 * Far more common, a fitted room: a whole lattice room walled in, with a door or two, fitted out for a use, its
 * furniture where it belongs (junk.ts) and none of the junk lying about. Each kind keeps mostly to its zone.
 *
 * The place is done up in zones (zones.ts), which have a say in what turns up where: how areas are laid out, which
 * special rooms there are (pit rooms only in the yellow), and, elsewhere, the junk, the writing and the posters.
 *
 * Some statues have the cult's sign laid out in candles on the floor in front of them (junk.ts), where it fits.
 *
 * A big room is a hall of one kind or another (HallKind): pillars every three cells all the way across, like a car
 * park with no cars; a floor of office cubicles, everyone gone (junk.ts); every light out but the one in the middle,
 * something under it; or left empty. A hall that's any of the first three has no fitted room or burger room in it.
 *
 * At the end of some dead ends, something (DeadEnd): a lattice room with only the one way in, or a corridor walled
 * across. A door flat on the far wall that doesn't open, a chair facing it, a vending machine or two still lit; in a
 * room, sometimes only the light nearest the far wall still on, and sometimes only that and nothing else.
 *
 * Rarely, in a plain room, a stair up through the ceiling that nobody can climb (StairsPlan).
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

/**
 * How an area of 6 × 6 lattice rooms is laid out: stretch by stretch by the dice (as an Area says), as corridors
 * running east–west or north–south, or as cells.
 */
const LATTICE = 0;
const CORRIDOR_EW = 1;
const CORRIDOR_NS = 2;
const CELLS = 3;
/**
 * How likely an area is to be corridors, and to be cells, if nothing round it stops it: in the yellow, and weighed in
 * the other zones (zones.ts).
 */
const CORRIDOR_SHARE = 0.16;
/** A corridor area's walls, rooms and corridors repeat every this many cells across the corridors. */
const CORRIDOR_PERIOD = 8;
const CELLS_SHARE = 0.12;
/** In a corridor area: how likely a room is to have a second door, onto the other corridor. */
const CORRIDOR_SECOND_DOOR = 0.3;
/** How likely a corridor is to be walled across here and there, and two rooms side by side to have a door between. */
const CORRIDOR_BLOCKED = 0.04;
const CORRIDOR_SIDE_DOOR = 0.25;
/** In a cells area: how likely a stretch of its lattice is to have any wall, and a wall to have a doorway. */
const CELLS_DENSE = 0.85;
const CELLS_DOOR = 0.6;

export const LIGHT_ON = 1;
/** Two groups of lights that flicker, each in step with itself. */
export const LIGHT_FLICKER_A = 2;
export const LIGHT_FLICKER_B = 3;
export const LIGHT_DEAD = 4;

/** How likely each zone is to be each kind, in turn from one die; what's left over is yellow. */
const ZONE_CHANCES: readonly [number, number][] = [
  [ZONE_HOUSE, 0.11],
  [ZONE_OFFICE, 0.11],
  [ZONE_DRYWALL, 0.1],
  [ZONE_TILES, 0.1],
];
/**
 * Zones are the cells nearest each of a scattering of points, one somewhere in each square this many cells wide, so
 * they come in all shapes. The square at the spawn has its point right on it, and is always yellow.
 */
const ZONE_SIZE = 44;
/**
 * Mostly a whole lattice room is one zone, so the change comes at a wall or a doorway, like going into another wing.
 * In this share of lattice rooms the line between zones runs straight through, wallpaper and carpet cut off mid-room.
 */
const ZONE_UNRULY = 0.15;

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
  /** The cult's sign laid out in candles on the floor in front of it, if someone has. */
  sign: CandleSign | null;
}

/**
 * The cult's sign laid out in candles on the floor (junk.ts): its middle, and the way it runs, from its top (the ears)
 * to its foot. In front of a statue, its middle on the line the statue faces and its ears toward it.
 */
export interface CandleSign {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

/** How tall the sign is laid out, in cells. */
export const CANDLE_SIGN_SIZE = 3.4;
/** Half the room it takes, across it and along it, its candles a little off where they were meant to go included. */
const CANDLE_SIGN_HALF = [1.25, 1.7] as const;
/** How far in front of its statue its middle is. */
const CANDLE_SIGN_AWAY = 2.9;
/**
 * How many statues are picked to have one, and how many ways round they're tried: about one in ten in all, as a few
 * have no room for it any way round.
 */
const CANDLE_SIGN_SHARE = 0.12;
const CANDLE_SIGN_TURNS = 8;

/** A special room is one block of 3 × 3 lattice rooms: this many cells a side, walls included. */
export const ROOM_BLOCK = 15;

/** How likely a block of lattice rooms is to be knocked through into a big room. */
const BIG_ROOM = 0.2;
/**
 * What a big room has in it: pillars, cubicles, one light. Each share is weighed by the zone at its middle (zones.ts);
 * an empty one's share isn't, so where a kind is weighed down, more of them are empty.
 */
export type HallKind = "pillars" | "cubicles" | "lamp";
const HALL_CHANCES: readonly [HallKind, number, ZoneWeights][] = [
  ["pillars", 0.3, PILLAR_HALL_WEIGHTS],
  ["cubicles", 0.25, CUBICLE_HALL_WEIGHTS],
  ["lamp", 0.15, LAMP_HALL_WEIGHTS],
];
const HALL_EMPTY = 0.3;
/** In a pillar hall: a pillar on every cell this many apart each way, and how many of them aren't there. */
export const HALL_PILLAR_EVERY = 3;
const HALL_PILLAR_MISSING = 0.06;
/** In a one-light hall: the one that works, this many cells in from the block's corner each way (its middle). */
export const HALL_LAMP = 7;

/** What's at a dead end. */
export type DeadEndThing = "door" | "chair" | "vending";
/**
 * The end of a dead end, with something at it: the middle of the face of wall at the far end, the way out of it into
 * the open, and how far either way of the middle there's wall to put things along. A cell (cx, cy) by it and `side`
 * give its things their own dice.
 */
export interface DeadEnd {
  x: number;
  y: number;
  nx: number;
  ny: number;
  half: number;
  cx: number;
  cy: number;
  side: number;
  thing: DeadEndThing | null;
  /** A room's: only its light nearest the far wall still works. */
  lampOnly: boolean;
}
/**
 * How likely a lattice room with only the one way in is to have something at its far end; what, in turn from one die
 * (nothing but its last light, the rest); how likely, with a thing there, its other lights are out too.
 */
const DEAD_END = 0.5;
const DEAD_END_KINDS: readonly [DeadEndThing | null, number][] = [
  ["door", 0.3],
  ["chair", 0.25],
  ["vending", 0.25],
  [null, 0.2],
];
const DEAD_END_LAMP_ONLY = 0.5;

/** What's at a dead end in `zone`, from a die: each thing as likely as its share weighed by the zone (zones.ts). */
function deadEndThing(die: number, zone: number, nothing = true): DeadEndThing | null {
  const shares = DEAD_END_KINDS.filter(([kind]) => kind || nothing).map(
    ([kind, share]) => [kind, kind ? share * DEAD_END_WEIGHTS[kind][zone] : share] as const,
  );
  let left = die * shares.reduce((sum, [, share]) => sum + share, 0);
  for (const [kind, share] of shares) {
    if (left < share) return kind;
    left -= share;
  }
  return shares[shares.length - 1][0];
}
/** How likely each side of a corridor walled across is to have something against the wall. */
const CORRIDOR_END = 0.5;

/**
 * A stair going up, now and then, in a plain lattice room: along a wall from near a corner, its thirteenth step at
 * the ceiling and the rest on up through it, the way up blocked at its foot, by a sign or a heap of chairs. The middle
 * of its foot on the floor, the way up it, and the way out of the wall it runs along. A cell in the room gives its
 * things their own dice.
 */
export interface StairsPlan {
  x: number;
  y: number;
  ax: number;
  ay: number;
  nx: number;
  ny: number;
  block: "sign" | "chairs";
  cx: number;
  cy: number;
}
/** How likely a plain lattice room is to have a stair; how far from the corner it starts; how wide it is. */
const STAIRS = 0.006;
const STAIRS_FROM_CORNER = 0.35;
export const STAIRS_W = 0.45;

/** The kinds of special room. */
/**
 * "burger" is a little room in a corner of a lattice room, not a block: see burgerPlan. The fitted kinds are whole
 * lattice rooms: see fittedPlan.
 */
export type RoomKind = "pit" | "burger" | FittedKind;
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
  burger: { junk: false, statue: false, xn: true },
  workroom: { junk: false, statue: false, xn: true },
  camp: { junk: false, statue: false, xn: true },
  pantry: { junk: false, statue: false, xn: true },
  meeting: { junk: false, statue: false, xn: true },
  storage: { junk: false, statue: false, xn: true },
};
/**
 * How likely a block is to be each kind of special room, in turn from one die: a new kind takes the next share, so the
 * ones before stay where they were. Each is weighed by the zone at the block's middle (zones.ts).
 */
const ROOM_CHANCES: readonly [RoomKind, number, ZoneWeights][] = [["pit", 0.06, PIT_ROOM_WEIGHTS]];
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

/** How likely a lattice room is to have a burger room in it, weighed by its zone (zones.ts). */
const BURGER_ROOM = 0.0035;

/**
 * A burger room: the cell at its north-west corner inside its walls (it's two cells by two), and its doorway, the
 * side (north, south, west, east) and which of that side's two cells.
 */
export interface BurgerPlan {
  x0: number;
  y0: number;
  side: number;
  cell: number;
}

/**
 * The kinds of fitted room: a lattice room fitted out for a use. A camp is where one of the lost lived for a while:
 * a mattress on the floor, empty tins, the count on the wall. A pantry is a little kitchen. A meeting room, sometimes
 * two lattice rooms knocked through into one long one. A storeroom, shelving all round.
 */
export type FittedKind = "workroom" | "camp" | "pantry" | "meeting" | "storage";
/**
 * How likely a lattice room is to be each kind of fitted room, in turn from one die, weighed by its zone (zones.ts):
 * a new kind takes the next share, so the ones before stay where they were.
 */
const FITTED_CHANCES: readonly [FittedKind, number, ZoneWeights][] = [
  ["workroom", 0.06, WORKROOM_WEIGHTS],
  ["camp", 0.07, CAMP_WEIGHTS],
  ["pantry", 0.06, PANTRY_WEIGHTS],
  ["meeting", 0.05, MEETING_WEIGHTS],
  ["storage", 0.06, STORAGE_WEIGHTS],
];
/** A storeroom's lights: how many are out, and how many of the rest flicker. */
const STORAGE_DEAD = 0.5;
const STORAGE_FLICKER = 0.5;
/** How likely a meeting room is to take in the lattice room east of it or south of it too, if it can. */
const MEETING_LONG = 0.4;
/** A long one's inside, the long way: two lattice rooms' insides and the lattice between them. */
const FITTED_LONG = 9;
/** How likely a fitted room is to have a second door, in another wall. */
const FITTED_SECOND_DOOR = 0.3;
/** A fitted room is a lattice room's inside: this many cells a side. */
export const FITTED_SIZE = 4;

/**
 * A fitted room: its kind, the cell at its north-west corner inside its walls, its size inside them, and its doors,
 * each the side it's in (north, south, west, east) and the cell along that side (from 1 at its west or north end;
 * only ever the middle two of a lattice room's four, clear of the corners). The first door is the way in.
 */
export interface FittedPlan {
  kind: FittedKind;
  x0: number;
  y0: number;
  w: number;
  h: number;
  doors: readonly (readonly [number, number])[];
}

/**
 * Where a camp's mattress lies: in a corner, along one of the two walls there, clear of the doors. Its corner (0
 * north-west, 1 north-east, 2 south-west, 3 south-east), whether it runs east-west, and the sides of the wall it lies
 * along (where the count is) and of the wall at its head.
 */
export interface CampBed {
  corner: number;
  alongX: boolean;
  wall: number;
  head: number;
}

/** The side across a fitted room from each side: north, south, west, east. */
const ACROSS_SIDE = [1, 0, 3, 2] as const;

/** The wall across from a fitted room's way in, or, if there's a door in that too, the first without one. */
function facingWall(plan: FittedPlan): number {
  const [doorSide] = plan.doors[0];
  const across = ACROSS_SIDE[doorSide];
  const doorSides = new Set(plan.doors.map(([side]) => side));
  const sides = [across, ...[0, 1, 2, 3].filter((s) => s !== across)];
  return sides.find((s) => !doorSides.has(s)) ?? across;
}

/** Which way a meeting room's table runs: along x in a long room that's long that way, and either way in a square one. */
export function meetingAlongX(plan: FittedPlan, noise: (k: number) => number): boolean {
  return plan.w > plan.h || (plan.w === plan.h && noise(0) < 0.5);
}

/**
 * The wall something's put up on in a fitted room, or −1: a meeting room's whiteboard (an end wall with no door, or
 * else any with none), a pantry's counter and wall cupboards (the wall across from the way in). The furniture goes
 * by it.
 */
export function mountedWall(plan: FittedPlan, noise: (k: number) => number): number {
  if (plan.kind === "pantry") return facingWall(plan);
  if (plan.kind !== "meeting") return -1;
  const ends = meetingAlongX(plan, noise) ? [2, 3] : [0, 1];
  const sides = [...ends, ...[0, 1, 2, 3].filter((s) => !ends.includes(s))];
  const doorSides = new Set(plan.doors.map(([s]) => s));
  return sides.find((s) => !doorSides.has(s)) ?? -1;
}

/**
 * Whether wall `side` of a fitted room is kept bare of writing and posters, which would be half behind what's against
 * it: the wall something's put up on, and every wall of a storeroom, shelved all round.
 */
export function bareWall(plan: FittedPlan, side: number, noise: (k: number) => number): boolean {
  return plan.kind === "storage" || side === mountedWall(plan, noise);
}

/** A camp's mattress, worked out from its plan; the same for whatever asks (the furniture, the writing). */
export function campBed(plan: FittedPlan, noise: (k: number) => number): CampBed {
  const options: CampBed[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const west = corner % 2 === 0;
    const north = corner < 2;
    for (const alongX of [true, false]) {
      const wall = alongX ? (north ? 0 : 1) : west ? 2 : 3;
      const head = alongX ? (west ? 2 : 3) : north ? 0 : 1;
      // It reaches past the first cell from the corner, so a door in the next one would be in its way.
      const atStart = alongX ? west : north;
      if (plan.doors.some(([side, cell]) => side === wall && cell === (atStart ? 2 : 3))) continue;
      options.push({ corner, alongX, wall, head });
    }
  }
  // Further from the way in, more likely: the first options that are far from it, then the dice.
  const [doorSide] = plan.doors[0];
  const far = options.filter((o) => o.wall !== doorSide && o.head !== doorSide);
  const pool = far.length ? far : options;
  return pool[Math.floor(noise(0) * pool.length)];
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
  /** How each area is laid out, by rx * 100 003 + ry. */
  private readonly layouts = new Map<number, number>();
  /** Each lattice room's fitted room, or null, by lx * 100 003 + ly. */
  private readonly fitted = new Map<number, FittedPlan | null>();
  /** What each block's big room has in it, or null if it's none of the kinds, by bx * 100 003 + by. */
  private readonly halls = new Map<number, HallKind | null>();
  /** Each lattice room's dead end, or null, by lx * 100 003 + ly. */
  private readonly ends = new Map<number, DeadEnd | null>();
  /** Each lattice room's stair, or null, by lx * 100 003 + ly. */
  private readonly stairs = new Map<number, StairsPlan | null>();

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

  /** How the area that lattice room (lx, ly) is in is laid out. */
  private layout(lx: number, ly: number): number {
    const rx = Math.floor((lx + 3) / 6);
    const ry = Math.floor((ly + 3) / 6);
    const key = rx * 100_003 + ry;
    let layout = this.layouts.get(key);
    if (layout === undefined) {
      layout = this.layoutOf(rx, ry);
      this.layouts.set(key, layout);
    }
    return layout;
  }

  /**
   * How area (rx, ry) is laid out. An area takes in 2 × 2 blocks of lattice rooms; one laid out to a plan has no
   * special rooms in them, and isn't next to one whose wall would run along its own north or west edge, which it
   * builds itself. The spawn's area is always left to the dice. How likely it is to be each depends on the zone at
   * its middle.
   */
  private layoutOf(rx: number, ry: number): number {
    if (rx === 0 && ry === 0) return LATTICE;
    const die = this.noise(rx, ry, 11);
    if (die >= CORRIDOR_SHARE * heaviest(CORRIDOR_WEIGHTS) + CELLS_SHARE * heaviest(CELLS_WEIGHTS)) return LATTICE;
    const zone = this.zoneOfPoint(rx * 30, ry * 30);
    const corridors = CORRIDOR_SHARE * CORRIDOR_WEIGHTS[zone];
    if (die >= corridors + CELLS_SHARE * CELLS_WEIGHTS[zone]) return LATTICE;
    const bx = rx * 2 - 1;
    const by = ry * 2 - 1;
    for (const [i, j] of [[0, -1], [1, -1], [-1, 0], [-1, 1], [-1, -1]]) {
      if (this.rolledRoom(bx + i, by + j)) return LATTICE;
    }
    if (die >= corridors) return CELLS;
    return this.noise(rx, ry, 12) < 0.5 ? CORRIDOR_EW : CORRIDOR_NS;
  }

  /**
   * 1 where cell (x, y) of a corridor area is wall. Across the corridors it goes, every 8 cells: a wall, a row of
   * rooms 4 cells deep, a wall, a corridor 2 cells wide. Along them the rooms are 4 cells wide, a wall between each two.
   * Each room has a door onto the corridor on one side of it, sometimes the other too, and now and then into the next
   * room; now and then a corridor is walled off.
   */
  private corridorWall(x: number, y: number, layout: number): number {
    const across = layout === CORRIDOR_EW ? y : x;
    const along = layout === CORRIDOR_EW ? x : y;
    const p = mod(across, CORRIDOR_PERIOD);
    const room = Math.floor(along / 5);
    const q = along - room * 5;
    const row = Math.floor(across / CORRIDOR_PERIOD);
    if (p >= 6) return q === 0 && this.noise(room, row, 83) < CORRIDOR_BLOCKED ? 1 : 0;
    if (q === 0) {
      // Between two rooms: a wall, sometimes with a door.
      if (p === 0 || p === 5) return 1;
      return this.noise(room, row, 85) < CORRIDOR_SIDE_DOOR && p === 1 + Math.floor(this.noise(room, row, 86) * 4)
        ? 0
        : 1;
    }
    if (p !== 0 && p !== 5) return 0;
    // A room's front or back, onto a corridor: a door in one, sometimes both.
    const first = this.noise(room, row, 80) < 0.5;
    const both = this.noise(room, row, 81) < CORRIDOR_SECOND_DOOR;
    const door = p === 0 ? first || both : !first || both;
    return door && q === 1 + Math.floor(this.noise(room, row, 82 + p) * 4) ? 0 : 1;
  }

  /**
   * Whether a light hangs over cell (cx, cy), if it's open: usually over cells 1, 4, 7… on both axes. In a corridor
   * area, one in the middle of each room and every 3 cells along each corridor; one in each burger room.
   */
  lampAt(cx: number, cy: number): boolean {
    if (this.burgerLamp(cx, cy)) return true;
    const layout = this.layout(Math.floor(cx / 5), Math.floor(cy / 5));
    if (layout === CORRIDOR_EW || layout === CORRIDOR_NS) {
      const p = mod(layout === CORRIDOR_EW ? cy : cx, CORRIDOR_PERIOD);
      const along = layout === CORRIDOR_EW ? cx : cy;
      return p === 6 ? mod(along, 3) === 1 : p === 2 && mod(along, 5) === 2;
    }
    return mod(cx, 3) === 1 && mod(cy, 3) === 1;
  }

  /** Whether the stretch of a cells area's lattice from point (qx, qy), running east or south, covers cell m (1–2). */
  private cellsSegment(qx: number, qy: number, dir: number, m: number): boolean {
    if (this.noise(qx, qy, 90 + dir) >= CELLS_DENSE) return false;
    if (this.noise(qx, qy, 92 + dir) < CELLS_DOOR) return m !== 1 + Math.floor(this.noise(qx, qy, 94 + dir) * 2);
    return true;
  }

  /** 1 where cell (x, y) of a cells area is wall: its lattice is every 3 cells, its stretches 2 cells long. */
  private cellsWall(x: number, y: number): number {
    const qx = Math.floor(x / 3);
    const qy = Math.floor(y / 3);
    const mx = x - qx * 3;
    const my = y - qy * 3;
    if (mx === 0 && my === 0) {
      const any =
        this.cellsSegment(qx, qy, 0, 1) ||
        this.cellsSegment(qx - 1, qy, 0, 2) ||
        this.cellsSegment(qx, qy, 1, 1) ||
        this.cellsSegment(qx, qy - 1, 1, 2);
      return any ? 1 : 0;
    }
    if (my === 0) return this.cellsSegment(qx, qy, 0, mx) ? 1 : 0;
    if (mx === 0) return this.cellsSegment(qx, qy, 1, my) ? 1 : 0;
    return 0;
  }

  /** The kind of zone the scattered point in square (gx, gy) starts, and where in the world that point is. */
  private zonePoint(gx: number, gy: number): [number, number, number] {
    if (gx === 0 && gy === 0) return [ZONE_YELLOW, SPAWN.x, SPAWN.y];
    let die = this.noise(gx, gy, 72);
    let kind = ZONE_YELLOW;
    for (const [k, chance] of ZONE_CHANCES) {
      if (die < chance) {
        kind = k;
        break;
      }
      die -= chance;
    }
    return [kind, (gx + this.noise(gx, gy, 73)) * ZONE_SIZE, (gy + this.noise(gx, gy, 74)) * ZONE_SIZE];
  }

  /**
   * The zone cell (cx, cy) is in, which its floor and the faces of wall looking into it are done up as. A special
   * room keeps to the yellow it was built in, and a burger room or a fitted room to its lattice room's zone, even an
   * unruly one's.
   */
  zoneAt(cx: number, cy: number): number {
    if (this.roomKind(Math.floor(cx / ROOM_BLOCK), Math.floor(cy / ROOM_BLOCK))) return ZONE_YELLOW;
    const burger = this.burgerAt(cx, cy);
    if (burger) return this.roomZone(Math.floor(burger.x0 / 5), Math.floor(burger.y0 / 5));
    const lx = Math.floor(cx / 5);
    const ly = Math.floor(cy / 5);
    // Most lattice rooms go by their middle, so the whole room is one zone; an unruly one goes cell by cell. A fitted
    // room is all of a piece, even a long one: it goes by its first lattice room.
    const fitted = this.fittedPlan(lx, ly);
    if (fitted) return this.roomZone((fitted.x0 - 1) / 5, (fitted.y0 - 1) / 5);
    if (this.noise(lx, ly, 70) < ZONE_UNRULY) return this.zoneOfPoint(cx + 0.5, cy + 0.5);
    return this.roomZone(lx, ly);
  }

  /** The zone lattice room (lx, ly) is in by its middle: all of it, unless it's unruly. */
  private roomZone(lx: number, ly: number): number {
    return this.zoneOfPoint(lx * 5 + 2.5, ly * 5 + 2.5);
  }

  /** The zone point (sx, sy) is in. What zoneAt goes by (layouts, rooms) asks this instead, so as not to go round. */
  private zoneOfPoint(sx: number, sy: number): number {
    const gx = Math.floor(sx / ZONE_SIZE);
    const gy = Math.floor(sy / ZONE_SIZE);
    let best = Infinity;
    let zone = ZONE_YELLOW;
    for (let j = gy - 1; j <= gy + 1; j++) {
      for (let i = gx - 1; i <= gx + 1; i++) {
        const [kind, x, y] = this.zonePoint(i, j);
        const d2 = (x - sx) ** 2 + (y - sy) ** 2;
        if (d2 < best) {
          best = d2;
          zone = kind;
        }
      }
    }
    return zone;
  }

  /** What kind of special room block (bx, by) of 3 × 3 lattice rooms is, or null if it's none. Never the spawn's. */
  roomKind(bx: number, by: number): RoomKind | null {
    const kind = this.rolledRoom(bx, by);
    // A block in an area laid out to a plan is part of the plan.
    return kind && this.layout(bx * 3, by * 3) === LATTICE ? kind : null;
  }

  /** What kind of special room block (bx, by) rolled, whether or not its area lets it be one. */
  private rolledRoom(bx: number, by: number): RoomKind | null {
    if (bx === 0 && by === 0) return null;
    let die = this.noise(bx, by, 50);
    for (const [kind, chance, weights] of ROOM_CHANCES) {
      const share = chance * heaviest(weights);
      if (die < share) {
        const zone = this.zoneOfPoint((bx + 0.5) * ROOM_BLOCK, (by + 0.5) * ROOM_BLOCK);
        return die < chance * weights[zone] ? kind : null;
      }
      die -= share;
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
    const kind = this.roomKind(Math.floor(cx / ROOM_BLOCK), Math.floor(cy / ROOM_BLOCK));
    if (kind) return kind;
    if (this.burgerAt(cx, cy)) return "burger";
    return this.fittedAt(cx, cy)?.kind ?? null;
  }

  /** What kind of fitted room lattice room (lx, ly) rolled, whether or not it can be one. */
  private rolledFitted(lx: number, ly: number): FittedKind | null {
    let die = this.noise(lx, ly, 64);
    for (const [kind, chance, weights] of FITTED_CHANCES) {
      const share = chance * heaviest(weights);
      if (die < share) return die < chance * weights[this.roomZone(lx, ly)] ? kind : null;
      die -= share;
    }
    return null;
  }

  /** Which way a meeting room at lattice room (lx, ly) would be long: 0 east, 1 south, −1 not. */
  private meetingLong(lx: number, ly: number): number {
    if (this.noise(lx, ly, 75) >= MEETING_LONG) return -1;
    return this.noise(lx, ly, 76) < 0.5 ? 0 : 1;
  }

  /** Whether lattice room (lx, ly) rolled a fitted room, or is the other half a long meeting room rolled to take in. */
  private wanted(lx: number, ly: number): boolean {
    if (this.rolledFitted(lx, ly)) return true;
    if (this.rolledFitted(lx - 1, ly) === "meeting" && this.meetingLong(lx - 1, ly) === 0) return true;
    return this.rolledFitted(lx, ly - 1) === "meeting" && this.meetingLong(lx, ly - 1) === 1;
  }

  /**
   * Whether lattice room (lx, ly) can be (half of) a fitted room: not by the spawn (its walls are kept open), nor in
   * or against a special room, a burger room or an area laid out to a plan, so its doors always open onto plain
   * floor.
   */
  private fits(lx: number, ly: number): boolean {
    if (Math.abs(lx) + Math.abs(ly) <= 1) return false;
    // Not in a hall that has something in it.
    const bx = Math.floor(lx / 3);
    const by = Math.floor(ly / 3);
    if (this.hallKind(bx, by)) return false;
    // Its own, those it has doors onto, and the one south-east, whose lattice point is its corner.
    for (const [i, j] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) {
      if (this.layout(lx + i, ly + j) !== LATTICE) return false;
    }
    if (this.specialRoom(Math.floor(lx / 3), Math.floor(ly / 3))) return false;
    const walls = [[lx, ly, 0], [lx, ly + 1, 0], [lx, ly, 1], [lx + 1, ly, 1]];
    if (walls.some(([i, j, dir]) => this.roomWall(i, j, dir))) return false;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) if (this.burgerPlan(lx + i, ly + j)) return false;
    }
    return true;
  }

  /**
   * The fitted room lattice room (lx, ly) is, or is half of, if any: the same plan for both halves of a long one.
   * Never against another fitted room: of two that would be side by side, the one to the west or north is the one
   * there is.
   */
  fittedPlan(lx: number, ly: number): FittedPlan | null {
    const key = lx * 100_003 + ly;
    let plan = this.fitted.get(key);
    if (plan === undefined) {
      plan = this.fittedPlanOf(lx, ly);
      this.fitted.set(key, plan);
    }
    return plan;
  }

  private fittedPlanOf(lx: number, ly: number): FittedPlan | null {
    // The far half of a long meeting room west or north of it.
    if (this.rolledFitted(lx - 1, ly) === "meeting" && this.meetingLong(lx - 1, ly) === 0) {
      const plan = this.fittedPlan(lx - 1, ly);
      if (plan && plan.w > FITTED_SIZE) return plan;
    }
    if (this.rolledFitted(lx, ly - 1) === "meeting" && this.meetingLong(lx, ly - 1) === 1) {
      const plan = this.fittedPlan(lx, ly - 1);
      if (plan && plan.h > FITTED_SIZE) return plan;
    }
    const kind = this.rolledFitted(lx, ly);
    if (!kind || !this.fits(lx, ly)) return null;
    if (this.wanted(lx - 1, ly) || this.wanted(lx, ly - 1)) return null;
    let w = FITTED_SIZE;
    let h = FITTED_SIZE;
    const long = kind === "meeting" ? this.meetingLong(lx, ly) : -1;
    if (long >= 0) {
      // The room it takes in has to fit too, and nothing else want it from its other side: north of it, or west.
      const [px, py] = long === 0 ? [lx + 1, ly] : [lx, ly + 1];
      const other = long === 0 ? this.wanted(px, py - 1) : this.wanted(px - 1, py);
      if (this.fits(px, py) && !other) {
        if (long === 0) w = FITTED_LONG;
        else h = FITTED_LONG;
      }
    }
    // Doors in the middle two cells of a lattice room's stretch of the wall, either of them on a long wall.
    const cellOn = (side: number, die: number) => {
      const cells = (side < 2 ? w : h) > FITTED_SIZE ? [2, 3, 7, 8] : [2, 3];
      return cells[Math.floor(die * cells.length)];
    };
    const first = Math.floor(this.noise(lx, ly, 65) * 4);
    const doors: [number, number][] = [[first, cellOn(first, this.noise(lx, ly, 66))]];
    if (this.noise(lx, ly, 67) < FITTED_SECOND_DOOR) {
      const side = (first + 1 + Math.floor(this.noise(lx, ly, 68) * 3)) % 4;
      doors.push([side, cellOn(side, this.noise(lx, ly, 69))]);
    }
    return { kind, x0: lx * 5 + 1, y0: ly * 5 + 1, w, h, doors };
  }

  /** The fitted room cell (cx, cy) is inside, not its walls, if any. */
  fittedAt(cx: number, cy: number): FittedPlan | null {
    const plan = this.fittedPlan(Math.floor(cx / 5), Math.floor(cy / 5));
    if (!plan || cx < plan.x0 || cy < plan.y0 || cx >= plan.x0 + plan.w || cy >= plan.y0 + plan.h) return null;
    return plan;
  }

  /**
   * Whether the stretch of lattice from point (lx, ly), running east (dir 0) or south (dir 1), covers cell m (1-4)
   * as a fitted room's wall: always, but for one of the room's doors; not at all between a long room's halves; null
   * if it's no fitted room's.
   */
  private fittedWall(lx: number, ly: number, dir: number, m: number): boolean | null {
    // The room it's the top or left of, or else the one it's the bottom or right of.
    const plan = this.fittedPlan(lx, ly) ?? (dir === 0 ? this.fittedPlan(lx, ly - 1) : this.fittedPlan(lx - 1, ly));
    if (!plan) return null;
    // The room's first lattice room, and how many it takes in each way.
    const bx = (plan.x0 - 1) / 5;
    const by = (plan.y0 - 1) / 5;
    const across = plan.w > FITTED_SIZE ? 2 : 1;
    const down = plan.h > FITTED_SIZE ? 2 : 1;
    // Along the stretch, and across it.
    const [along, line, from, span, lines] = dir === 0 ? [lx, ly, bx, across, down] : [ly, lx, by, down, across];
    if (along < from || along >= from + span) return null;
    if (line > (dir === 0 ? by : bx) && line < (dir === 0 ? by : bx) + lines) return false;
    const first = line === (dir === 0 ? by : bx);
    if (!first && line !== (dir === 0 ? by : bx) + lines) return null;
    const side = dir === 0 ? (first ? 0 : 1) : first ? 2 : 3;
    const cell = (along - from) * 5 + m;
    return !plan.doors.some(([s, c]) => s === side && c === cell);
  }

  /**
   * The burger room in lattice room (lx, ly), if it has one: in one of its corners, two cells by two inside its walls.
   * Never by the spawn (its walls are kept open), nor in a special room's block.
   */
  burgerPlan(lx: number, ly: number): BurgerPlan | null {
    if (Math.abs(lx) + Math.abs(ly) <= 1) return null;
    const bx = Math.floor(lx / 3);
    const by = Math.floor(ly / 3);
    if (this.specialRoom(bx, by) || this.hallKind(bx, by)) return null;
    const die = this.noise(lx, ly, 60);
    if (die >= BURGER_ROOM * heaviest(BURGER_ROOM_WEIGHTS)) return null;
    if (die >= BURGER_ROOM * BURGER_ROOM_WEIGHTS[this.roomZone(lx, ly)]) return null;
    // Its walls can reach the lattice on its east and south, which may be an area laid out to a plan.
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (this.layout(lx + i, ly + j) !== LATTICE) return null;
    }
    const corner = Math.floor(this.noise(lx, ly, 63) * 4);
    return {
      x0: lx * 5 + (corner % 2 ? 3 : 1),
      y0: ly * 5 + (corner < 2 ? 1 : 3),
      side: Math.floor(this.noise(lx, ly, 61) * 4),
      cell: Math.floor(this.noise(lx, ly, 62) * 2),
    };
  }

  /** The burger room whose walls or inside cell (cx, cy) is in, if any. */
  burgerAt(cx: number, cy: number): BurgerPlan | null {
    const lx = Math.floor(cx / 5);
    const ly = Math.floor(cy / 5);
    // Its walls can be on the lattice either side of it.
    for (let j = ly - 1; j <= ly; j++) {
      for (let i = lx - 1; i <= lx; i++) {
        const plan = this.burgerPlan(i, j);
        if (plan && cx >= plan.x0 - 1 && cx <= plan.x0 + 2 && cy >= plan.y0 - 1 && cy <= plan.y0 + 2) return plan;
      }
    }
    return null;
  }

  /** Whether cell (cx, cy) is inside a burger room: not its walls, nor its doorway. */
  burgerInside(cx: number, cy: number): boolean {
    const plan = this.burgerAt(cx, cy);
    return !!plan && cx >= plan.x0 && cx <= plan.x0 + 1 && cy >= plan.y0 && cy <= plan.y0 + 1;
  }

  /** The cell of a burger room's doorway, in its wall. */
  burgerDoorway(plan: BurgerPlan): [number, number] {
    const { x0, y0, side, cell } = plan;
    if (side === 0) return [x0 + cell, y0 - 1];
    if (side === 1) return [x0 + cell, y0 + 2];
    if (side === 2) return [x0 - 1, y0 + cell];
    return [x0 + 2, y0 + cell];
  }

  /**
   * Whether a light hangs over cell (cx, cy) as well as the usual ones (every third cell): one in each burger room,
   * which is too small to be sure of one, and it always works.
   */
  burgerLamp(cx: number, cy: number): boolean {
    const plan = this.burgerAt(cx, cy);
    return !!plan && cx === plan.x0 && cy === plan.y0;
  }

  /** 1 or 0 where cell (cx, cy) is a burger room's wall or inside it, null where it's neither. */
  private burgerWall(cx: number, cy: number): number | null {
    const plan = this.burgerAt(cx, cy);
    if (!plan) return null;
    const inside = cx >= plan.x0 && cx <= plan.x0 + 1 && cy >= plan.y0 && cy <= plan.y0 + 1;
    if (inside) return 0;
    const [dx, dy] = this.burgerDoorway(plan);
    return cx === dx && cy === dy ? 0 : 1;
  }

  /** Whether `what` belongs at cell (cx, cy): anywhere outside the special rooms, and in one if its kind lets it in. */
  allows(cx: number, cy: number, what: keyof RoomRules): boolean {
    const kind = this.roomAt(cx, cy);
    return !kind || ROOM_RULES[kind][what];
  }

  /** Whether block (bx, by) of 3 × 3 lattice rooms is knocked through into one room: a big room or a special room. */
  private openBlock(bx: number, by: number): boolean {
    return this.noise(bx, by, 9) < BIG_ROOM || this.specialRoom(bx, by);
  }

  /** What block (bx, by)'s big room has in it, or null if it's no big room, an empty one, or the spawn's. */
  hallKind(bx: number, by: number): HallKind | null {
    const key = bx * 100_003 + by;
    let kind = this.halls.get(key);
    if (kind === undefined) {
      kind = this.hallKindOf(bx, by);
      this.halls.set(key, kind);
    }
    return kind;
  }

  private hallKindOf(bx: number, by: number): HallKind | null {
    if (bx === 0 && by === 0) return null;
    // Only a big room of plain lattice rooms: not a special room, nor in an area laid out to a plan, which has none.
    if (this.noise(bx, by, 9) >= BIG_ROOM || this.specialRoom(bx, by)) return null;
    if (this.layout(bx * 3, by * 3) !== LATTICE) return null;
    const zone = this.zoneOfPoint((bx + 0.5) * ROOM_BLOCK, (by + 0.5) * ROOM_BLOCK);
    const shares = HALL_CHANCES.map(([kind, chance, weights]) => [kind, chance * weights[zone]] as const);
    let die = this.noise(bx, by, 47) * shares.reduce((sum, [, share]) => sum + share, HALL_EMPTY);
    for (const [kind, share] of shares) {
      if (die < share) return kind;
      die -= share;
    }
    return null;
  }

  /** The kind of hall cell (cx, cy) is inside, not on the lattice round it, or null if it's in none. */
  hallAt(cx: number, cy: number): HallKind | null {
    if (mod(cx, ROOM_BLOCK) === 0 || mod(cy, ROOM_BLOCK) === 0) return null;
    return this.hallKind(Math.floor(cx / ROOM_BLOCK), Math.floor(cy / ROOM_BLOCK));
  }

  /**
   * Whether cell (cx, cy) is in a hall that keeps out the junk lying about, statues and candles: the cubicles, which
   * have their own things, and the one-light hall, which has only the one.
   */
  bareHall(cx: number, cy: number): boolean {
    const hall = this.hallAt(cx, cy);
    return hall === "cubicles" || hall === "lamp";
  }

  /**
   * The dead end lattice room (lx, ly) is, with something at it, if it is: a plain room, with only one way in, an
   * opening in one of its walls; not by the spawn, nor with a statue in it. Its far end is the wall across from that.
   */
  deadEndRoom(lx: number, ly: number): DeadEnd | null {
    const key = lx * 100_003 + ly;
    let end = this.ends.get(key);
    if (end === undefined) {
      end = this.deadEndRoomOf(lx, ly);
      this.ends.set(key, end);
    }
    return end;
  }

  private deadEndRoomOf(lx: number, ly: number): DeadEnd | null {
    if (Math.abs(lx) + Math.abs(ly) <= 1 || this.noise(lx, ly, 77) >= DEAD_END) return null;
    if (!this.plainRoom(lx, ly)) return null;
    const x0 = lx * 5;
    const y0 = ly * 5;
    // The openings in its walls, as runs of open cells along each side.
    const cell = (side: number, k: number): [number, number] =>
      side === 0 ? [x0 + k, y0] : side === 1 ? [x0 + k, y0 + 5] : side === 2 ? [x0, y0 + k] : [x0 + 5, y0 + k];
    let runs = 0;
    let open = -1;
    for (let side = 0; side < 4; side++) {
      let was = false;
      for (let k = 1; k <= 4; k++) {
        const now = !this.wall(...cell(side, k));
        if (now && !was) {
          runs++;
          open = side;
        }
        was = now;
      }
    }
    if (runs !== 1 || this.statueInRoom(lx, ly)) return null;
    const thing = deadEndThing(this.noise(lx, ly, 78), this.roomZone(lx, ly));
    const lampOnly = !thing || this.noise(lx, ly, 79) < DEAD_END_LAMP_ONLY;
    // The far wall's inside face, its middle, and the way into the room.
    const far = ACROSS_SIDE[open];
    const [x, y, nx, ny] = [
      [x0 + 3, y0 + 1, 0, 1],
      [x0 + 3, y0 + 5, 0, -1],
      [x0 + 1, y0 + 3, 1, 0],
      [x0 + 5, y0 + 3, -1, 0],
    ][far];
    return { x, y, nx, ny, half: 2, cx: x0 + 1, cy: y0 + 1, side: far, thing, lampOnly };
  }

  /** Whether lattice room (lx, ly) is plain: of the lattice, and no special room, hall, fitted room or burger room. */
  private plainRoom(lx: number, ly: number): boolean {
    if (this.layout(lx, ly) !== LATTICE) return false;
    const bx = Math.floor(lx / 3);
    const by = Math.floor(ly / 3);
    if (this.specialRoom(bx, by) || this.hallKind(bx, by)) return false;
    return !this.fittedPlan(lx, ly) && !this.burgerPlan(lx, ly);
  }

  /** Whether its region's statue is inside lattice room (lx, ly). */
  private statueInRoom(lx: number, ly: number): boolean {
    const [x0, y0] = [lx * 5, ly * 5];
    const statue = this.statueIn(Math.floor((x0 + 2.5) / this.region), Math.floor((y0 + 2.5) / this.region));
    return !!statue && statue.cx > x0 && statue.cx < x0 + 5 && statue.cy > y0 && statue.cy < y0 + 5;
  }

  /**
   * The stair in lattice room (lx, ly), if it has one: a plain room, not by the spawn, not a dead end with something in
   * it, nor with a statue. It runs along a wall with no opening in it, from a corner where the wall across its foot has
   * none either, so it's in nobody's way in.
   */
  stairsIn(lx: number, ly: number): StairsPlan | null {
    const key = lx * 100_003 + ly;
    let plan = this.stairs.get(key);
    if (plan === undefined) {
      plan = this.stairsOf(lx, ly);
      this.stairs.set(key, plan);
    }
    return plan;
  }

  private stairsOf(lx: number, ly: number): StairsPlan | null {
    if (Math.abs(lx) + Math.abs(ly) <= 1 || this.noise(lx, ly, 48) >= STAIRS) return null;
    if (!this.plainRoom(lx, ly) || this.deadEndRoom(lx, ly)?.thing || this.statueInRoom(lx, ly)) return null;
    const x0 = lx * 5;
    const y0 = ly * 5;
    const first = Math.floor(this.noise(lx, ly, 49) * 4);
    const sides = [0, 1, 2, 3].map((k) => (first + k) % 4);
    for (const side of sides) {
      const along = side < 2;
      // The wall's cells, all wall.
      let whole = true;
      for (let k = 1; k <= 4; k++) {
        const [cx, cy] = along ? [x0 + k, side === 0 ? y0 : y0 + 5] : [side === 2 ? x0 : x0 + 5, y0 + k];
        if (!this.wall(cx, cy)) whole = false;
      }
      if (!whole) continue;
      const corners = this.noise(lx, ly, 50) < 0.5 ? [0, 1] : [1, 0];
      for (const from of corners) {
        // The cell of the wall across its foot, next to this one.
        const [qx, qy] = along
          ? [from === 0 ? x0 : x0 + 5, side === 0 ? y0 + 1 : y0 + 4]
          : [side === 2 ? x0 + 1 : x0 + 4, from === 0 ? y0 : y0 + 5];
        if (!this.wall(qx, qy)) continue;
        const [nx, ny] = [[0, 1], [0, -1], [1, 0], [-1, 0]][side];
        const [ax, ay] = along ? [from === 0 ? 1 : -1, 0] : [0, from === 0 ? 1 : -1];
        // The corner on the wall's face it starts from.
        const fx = along ? (from === 0 ? x0 + 1 : x0 + 5) : side === 2 ? x0 + 1 : x0 + 5;
        const fy = along ? (side === 0 ? y0 + 1 : y0 + 5) : from === 0 ? y0 + 1 : y0 + 5;
        const out = STAIRS_W / 2 + 0.01;
        return {
          x: fx + ax * STAIRS_FROM_CORNER + nx * out,
          y: fy + ay * STAIRS_FROM_CORNER + ny * out,
          ax,
          ay,
          nx,
          ny,
          block: this.noise(lx, ly, 51) < 0.5 ? "sign" : "chairs",
          cx: x0 + 1,
          cy: y0 + 1,
        };
      }
    }
    return null;
  }

  /**
   * Every dead end with something at it within `radius` of (x, y): rooms with one way in, and in corridor areas,
   * each side of a corridor walled across that has something against the wall.
   */
  deadEndsNear(x: number, y: number, radius: number): DeadEnd[] {
    const out: DeadEnd[] = [];
    for (let ly = Math.floor((y - radius) / 5); ly <= Math.floor((y + radius) / 5); ly++) {
      for (let lx = Math.floor((x - radius) / 5); lx <= Math.floor((x + radius) / 5); lx++) {
        const layout = this.layout(lx, ly);
        if (layout === LATTICE) {
          const end = this.deadEndRoom(lx, ly);
          if (end?.thing) out.push(end);
        } else if (layout === CORRIDOR_EW || layout === CORRIDOR_NS) {
          out.push(...this.corridorEnds(lx, ly, layout));
        }
      }
    }
    return out.filter((end) => Math.hypot(end.x - x, end.y - y) <= radius);
  }

  /**
   * The ends of corridors walled across at the lattice line through lattice room (lx, ly), with something against the
   * wall. Each wall belongs to the lattice room its first cell is in, so it's only found once.
   */
  private corridorEnds(lx: number, ly: number, layout: number): DeadEnd[] {
    const ew = layout === CORRIDOR_EW;
    const along = (ew ? lx : ly) * 5;
    const from = (ew ? ly : lx) * 5;
    const out: DeadEnd[] = [];
    for (let row = Math.floor(from / CORRIDOR_PERIOD) - 1; row <= Math.floor((from + 4) / CORRIDOR_PERIOD); row++) {
      // The corridor's two cells across: a wall across them at `along`, if this corridor's walled off here.
      const first = row * CORRIDOR_PERIOD + 6;
      if (first < from || first > from + 4) continue;
      const at = (a: number, c: number): [number, number] => (ew ? [a, c] : [c, a]);
      if (!this.wall(...at(along, first)) || !this.wall(...at(along, first + 1))) continue;
      if (this.layout(...(at(along, first).map((v) => Math.floor(v / 5)) as [number, number])) !== layout) continue;
      for (const dir of [-1, 1]) {
        const [ax, ay] = at(along + dir, first);
        const [bx, by] = at(along + dir, first + 1);
        if (this.wall(ax, ay) || this.wall(bx, by)) continue;
        const side = dir < 0 ? 0 : 1;
        if (this.noise(along * 7 + side, first, 87) >= CORRIDOR_END) continue;
        // Door, chair or vending machine, as likely as each other as in a room: never nothing.
        const thing = deadEndThing(this.noise(along * 7 + side, first, 88), this.zoneAt(ax, ay), false);
        const face = along + (dir < 0 ? 0 : 1);
        const [x, y] = at(face, first + 1);
        const [nx, ny] = at(dir, 0);
        out.push({ x, y, nx, ny, half: 1, cx: ax, cy: ay, side, thing, lampOnly: false });
      }
    }
    return out;
  }

  /** The middle of the one working light of every one-light hall within `radius` of (x, y). */
  lampHallsNear(x: number, y: number, radius: number): [number, number][] {
    const out: [number, number][] = [];
    for (let by = Math.floor((y - radius) / ROOM_BLOCK); by <= Math.floor((y + radius) / ROOM_BLOCK); by++) {
      for (let bx = Math.floor((x - radius) / ROOM_BLOCK); bx <= Math.floor((x + radius) / ROOM_BLOCK); bx++) {
        if (this.hallKind(bx, by) !== "lamp") continue;
        const lx = bx * ROOM_BLOCK + HALL_LAMP + 0.5;
        const ly = by * ROOM_BLOCK + HALL_LAMP + 0.5;
        if (Math.hypot(lx - x, ly - y) <= radius) out.push([lx, ly]);
      }
    }
    return out;
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
    const fitted = this.fittedWall(lx, ly, dir, m);
    if (fitted !== null) return fitted;
    // Two stretches by the spawn point are always open, so nobody starts boxed in.
    if (dir === 0 ? lx === 0 && (ly === 0 || ly === 1) : ly === 0 && (lx === 0 || lx === 1)) return false;
    const layout = this.layout(lx, ly);
    // An area laid out to a plan has walls of its own (cellsWall, corridorWall).
    if (layout !== LATTICE) return false;
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
    const burger = this.burgerWall(x, y);
    if (burger !== null) return burger;
    const lx = Math.floor(x / 5);
    const ly = Math.floor(y / 5);
    const layout = this.layout(lx, ly);
    if (layout === CELLS) return this.cellsWall(x, y);
    if (layout !== LATTICE) return this.corridorWall(x, y, layout);
    const hall = this.hallAt(x, y);
    if (hall === "pillars" || hall === "cubicles") {
      const ox = mod(x, ROOM_BLOCK);
      const oy = mod(y, ROOM_BLOCK);
      // The lattice's own pillars in a big room aren't where these want them, or where the cubicles go.
      if (ox % 5 === 0 && oy % 5 === 0) return 0;
      if (hall === "pillars" && ox % HALL_PILLAR_EVERY === 0 && oy % HALL_PILLAR_EVERY === 0) {
        return this.noise(x, y, 46) < HALL_PILLAR_MISSING ? 0 : 1;
      }
    }
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

  /** The ceiling light over cell (x, y), for cells where a light hangs (lampAt). */
  light(x: number, y: number): number {
    if (this.burgerLamp(x, y)) return LIGHT_ON;
    // A one-light hall's: all out, but the one in its middle, which never even flickers.
    if (this.hallAt(x, y) === "lamp") {
      return mod(x, ROOM_BLOCK) === HALL_LAMP && mod(y, ROOM_BLOCK) === HALL_LAMP ? LIGHT_ON : LIGHT_DEAD;
    }
    // A dead end's, sometimes: only the one nearest its far wall still on.
    const end = this.deadEndRoom(Math.floor(x / 5), Math.floor(y / 5));
    if (end?.lampOnly) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (let j = 1; j <= 4; j++) {
        for (let i = 1; i <= 4; i++) {
          const [lx, ly] = [end.cx - 1 + i, end.cy - 1 + j];
          if (!this.lampAt(lx, ly)) continue;
          const d = Math.hypot(lx + 0.5 - end.x, ly + 0.5 - end.y);
          if (d < bestD) {
            bestD = d;
            best = [lx, ly];
          }
        }
      }
      if (best) return best[0] === x && best[1] === y ? LIGHT_ON : LIGHT_DEAD;
    }
    // A storeroom's are mostly out, and the rest failing.
    if (this.fittedAt(x, y)?.kind === "storage") {
      const r = this.noise(x, y, 23);
      if (r < STORAGE_DEAD) return LIGHT_DEAD;
      return r < STORAGE_DEAD + (1 - STORAGE_DEAD) * STORAGE_FLICKER ? LIGHT_FLICKER_A : LIGHT_ON;
    }
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

  /** The light nearest cell (cx, cy), at most two cells away; usually it's at most one, on both axes. */
  private lampNear(cx: number, cy: number): [number, number] {
    let best: [number, number] = [cx + [1, 0, -1][mod(cx, 3)], cy + [1, 0, -1][mod(cy, 3)]];
    let bestD = Infinity;
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const d = i * i + j * j;
        if (d < bestD && this.lampAt(cx + i, cy + j) && !this.wall(cx + i, cy + j)) {
          best = [cx + i, cy + j];
          bestD = d;
        }
      }
    }
    return best;
  }

  /** Room for a statue at cell (x, y): it and the eight cells around it are open, and statues belong there. */
  private roomy(x: number, y: number): boolean {
    if (!this.allows(x, y, "statue") || this.bareHall(x, y)) return false;
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
      const [lampX, lampY] = this.lampNear(cx, cy);
      const facing = this.noise(rx, ry, 180 + k) * Math.PI * 2;
      found = { x: cx + 0.5, y: cy + 0.5, cx, cy, facing, lampX, lampY, sign: null };
      if (this.noise(rx, ry, 190) < CANDLE_SIGN_SHARE) {
        // It was turned to face the open floor the sign's laid out on, wherever round it there's room.
        for (let turn = 0; turn < CANDLE_SIGN_TURNS && !found.sign; turn++) {
          const way = facing + (turn / CANDLE_SIGN_TURNS) * Math.PI * 2;
          const dirX = Math.cos(way);
          const dirY = Math.sin(way);
          const sign = { x: found.x + dirX * CANDLE_SIGN_AWAY, y: found.y + dirY * CANDLE_SIGN_AWAY, dirX, dirY };
          if (!this.signFits(sign)) continue;
          found.facing = way;
          found.sign = sign;
        }
      }
      break;
    }
    this.statues.set(key, found);
    return found;
  }

  /**
   * Visits the floor a candle sign takes, every quarter of a cell across it and along it, until `stop` says so.
   * `grow` widens it every way by that much.
   */
  private overSign(sign: CandleSign, grow: number, stop: (x: number, y: number) => boolean): boolean {
    const [hw, hl] = [CANDLE_SIGN_HALF[0] + grow, CANDLE_SIGN_HALF[1] + grow];
    for (let a = -hw; a <= hw + 1e-6; a += 0.25) {
      for (let b = -hl; b <= hl + 1e-6; b += 0.25) {
        if (stop(sign.x - sign.dirY * a + sign.dirX * b, sign.y + sign.dirX * a + sign.dirY * b)) return true;
      }
    }
    return false;
  }

  /** Whether a candle sign has open floor for all of it, none of it in a special room. */
  private signFits(sign: CandleSign): boolean {
    return !this.overSign(sign, 0, (x, y) => {
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      return this.wall(cx, cy) !== 0 || this.roomAt(cx, cy) !== null || this.bareHall(cx, cy);
    });
  }

  /** Whether cell (cx, cy) is under, or right by, a candle sign: junk keeps off it. */
  underSign(cx: number, cy: number): boolean {
    const statue = this.statueIn(Math.floor(cx / this.region), Math.floor(cy / this.region));
    const sign = statue?.sign;
    if (!sign || Math.hypot(cx + 0.5 - sign.x, cy + 0.5 - sign.y) > CANDLE_SIGN_HALF[1] + 2) return false;
    return this.overSign(sign, 0.5, (x, y) => Math.floor(x) === cx && Math.floor(y) === cy);
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
