import { clamp } from "../../../shared/math";
import { graffitiNear } from "./engine/graffiti";
import { boardFace, junkAround, solidDistance, type Junk } from "./engine/junk";
import { LIGHT_DEAD, PIT_COUNT, PIT_PITCH, PIT_RIM, type WorldMap } from "./engine/map";
import { pitFieldsNear } from "./engine/pits";
import { PLAYER_RADIUS, type Player } from "./engine/player";
import type { Camera } from "./engine/render";
import { STATUE_RADIUS, type StatueMesh } from "./engine/statue";
import type { Tuning } from "./engine/tuning";
import {
  NOT_ON_WALLS,
  floorSpot,
  spotOn,
  topSpot,
  wallSpot,
  XN_RADIUS,
  type Point,
  type Xn,
  type XnAction,
  type XnHold,
  type XnRoute,
  type XnSpot,
  type XnSurface,
} from "./xn";

/*
 * Where XN can be in the place, and what she does there: room for her, the faces of wall she can cling to, spots out
 * of the visitor's view to turn up in, her three ways of walking, and the things near her she can get up on, sit at
 * or look at. When she turns up and goes is game.ts's business; this only finds her somewhere, and sets her going.
 */

/**
 * What XN can do with something near her. Get up on a chair, a desk, a filing cabinet or a monitor lying back
 * (stand, crouch, or sit on the edge with her legs hanging, still or swinging), the same upside down under a chair
 * in the ceiling; stand at a door, or sit or crouch facing it or with her back to it; stand, sit or
 * crouch looking at graffiti (her head on one side if it's her drawing of herself) or a sign; sit on a camp's
 * mattress hugging her knees, facing out into the room or turned to the wall with the count on it; sit on the edge
 * of a pantry's worktop; stand, sit or crouch under the one light left in a dark hall, or reading a whiteboard she's
 * written on.
 */
export type PropTarget =
  | "chair"
  | "desk"
  | "cabinet"
  | "monitor"
  | "hung"
  | "door"
  | "graffiti"
  | "portrait"
  | "sign"
  | "pit"
  | "party"
  | "bed"
  | "counter"
  | "spotlight"
  | "board";
/** `hold` is sitting on the edge with a burger in her hands, now and then taking a bite. */
export type PropPose =
  | "stand"
  | "crouch"
  | "perch"
  | "swing"
  | "sit"
  | "sitBack"
  | "crouchBack"
  | "hold"
  | "holdSwing"
  | "sitWall";

/** Which poses go with which things. */
export const PROP_POSES: Record<PropTarget, readonly PropPose[]> = {
  chair: ["stand", "crouch", "perch", "swing"],
  desk: ["stand", "crouch", "perch", "swing"],
  cabinet: ["stand", "crouch", "perch", "swing"],
  monitor: ["stand", "crouch", "perch", "swing"],
  hung: ["stand", "crouch", "perch", "swing"],
  pit: ["perch", "swing"],
  party: ["hold", "holdSwing"],
  door: ["stand", "sit", "crouch", "sitBack", "crouchBack"],
  graffiti: ["stand", "sit", "crouch"],
  portrait: ["stand", "sit", "crouch"],
  sign: ["stand", "sit", "crouch"],
  bed: ["sit", "sitWall"],
  // Only on its edge: standing on it, she'd have her head in the wall cupboards.
  counter: ["perch", "swing"],
  spotlight: ["stand", "sit", "crouch"],
  board: ["stand", "sit", "crouch"],
};

/** The dev panel puts XN this far in front of the visitor. */
const XN_AHEAD = 1.7;
/** Looking for a wall for XN: how far from the visitor, and how far from her, for facing one. */
const WALL_SEARCH = 6;
const FACE_WALL_SEARCH = 4;
/** Facing a wall, her feet are this far from it. */
const FACE_WALL_GAP = 0.16;
/** Lights she might stare at are at most this far off. */
const LAMP_SEARCH = 3.5;
/*
 * XN walking. Each time she sets off she goes one of three ways, as likely as each other: wandering, turning off when
 * the way ahead is blocked or she feels like it; back and forth along a stretch; or round and round a light or a
 * pillar near her (wandering, if there's none she can walk round).
 */
/** How fast she turns as she walks, in radians a second. */
const XN_TURN = 1.6;
/** Wandering: how far ahead she wants room, and seconds, at least and at most, before she feels like a new way. */
const XN_LOOK_AHEAD = 0.45;
const XN_WANDER_TURN = [3, 8] as const;
/**
 * Seconds her way can be blocked (by a wall, a statue or the visitor) before she tries another way when wandering,
 * and before she gives up the other routes and wanders.
 */
const XN_HELD = 0.4;
const XN_STUCK = 1;
/** Back and forth: the stretch, at least and at most, in cells. */
const XN_PACE_SPAN = [1.5, 4] as const;
/** Round and round: how far off she looks for something to walk round, and how far from its middle she walks. */
const XN_ROUND_SEARCH = 3;
const XN_ROUND_LAMP = [0.5, 1.2] as const;
const XN_ROUND_PILLAR = [0.95, 1.4] as const;
/** She turns up this many cells from the visitor, at least and at most. */
const XN_NEAR = 4;
const XN_FAR = 20;
/** How often she turns up on each surface. */
const XN_SURFACES: readonly [XnSurface, number][] = [
  ["floor", 5],
  ["ceiling", 3],
  ["wall", 2],
];
/** Spots tried for her, each time. */
const XN_TRIES = 80;
/** Looking at graffiti or a sign, she's this far from it, at least and at most. */
const XN_LOOK_AWAY = [0.45, 0.8] as const;
/** At a door: facing it, how far off she stands or sits; with her back to it, how far her heels are. */
const XN_DOOR_FACING = 0.3;
const XN_DOOR_BACK = 0.12;
/** Her head tipped this far, looking at her own drawing. */
const XN_CURIOUS = 0.3;
/** Sitting on an edge, her hips this far back from it. */
const XN_EDGE_BACK = 0.035;
/**
 * On a mattress: how far along it from its middle she sits, at most, either way; and how far her hips are back from
 * its middle, away from the way she faces, so her feet are on it too.
 */
const XN_BED_ALONG = 0.2;
const XN_BED_BACK = 0.06;
/** How many seats on the rims of each pit room near the visitor XN thinks of, when she's looking for something. */
const XN_PIT_SEATS = 3;
/** Under a dark hall's one light: how far from right under it she is, at least and at most. */
const XN_UNDER_LIGHT = [0.35, 0.7] as const;

/** Somewhere between the two, at random. */
export function between([low, high]: readonly [number, number]) {
  return low + Math.random() * (high - low);
}

function pickSurface(): XnSurface {
  const total = XN_SURFACES.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [surface, weight] of XN_SURFACES) {
    roll -= weight;
    if (roll < 0) return surface;
  }
  return "floor";
}

/** The four sides of a cell. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/**
 * What XN needs of the place as it is now. The map and the visitor change (a new map from the dev panel), so they're
 * read each time.
 */
export interface XnWorld {
  readonly map: WorldMap;
  readonly player: Player;
  /** The statues and junk in drawing range of the visitor. */
  readonly statues: readonly StatueMesh[];
  readonly junk: readonly Junk[];
  readonly tuning: Tuning;
  /** How far the picture reaches to each side of straight ahead, at one cell ahead. */
  spread(): number;
  /** How far off anything is drawn at all: past it, lost in the fog, nothing can be seen. */
  readonly drawRange: number;
}

/** Something near her that XN can do something with: what it is, how far it is, and where. */
export interface Thing {
  target: PropTarget;
  x: number;
  y: number;
  junk: Junk | null;
  /** To get up on: the middle of its top, the way its front faces, how far its front edge is. */
  perch?: { x: number; y: number; z: number; yaw: number; edge: number };
  /** A door's foot and the way it faces, and whether its back is free. */
  door?: { x: number; y: number; yaw: number; both: boolean };
  /** To look at: its middle and the way it faces out. */
  look?: { x: number; y: number; z: number; nx: number; ny: number };
  /** To be under: a light, the middle of the floor under it. */
  light?: { x: number; y: number };
}

/** Where she goes and what she does, to do a pose with a thing. */
export interface Plan {
  spot: XnSpot;
  action: XnAction;
  gaze: Point | null;
  swing: boolean;
  curious: number;
  /** Her tail up: on a chair's seat there's a backrest behind her for it to go through. */
  tailUp?: boolean;
  /** What she has in her hands. */
  holding?: XnHold;
}

export function createXnPlaces(world: XnWorld) {
  /**
   * Whether (x, y) is inside a piece of junk, with `room` to spare: on the floor the junk down there, on the ceiling
   * the junk up there, on a wall (or not knowing) any.
   */
  const intoJunk = (x: number, y: number, room: number, surface: XnSurface = "wall") =>
    world.junk.some(
      (junk) =>
        junk.solid &&
        (surface === "wall" || !!junk.solid.overhead === (surface === "ceiling")) &&
        solidDistance(junk.solid, x, y) < junk.solid.r + room,
    );

  // ---- where XN can go ----

  /** No wall on the straight line between two points. */
  const clearBetween = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.1);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (world.map.wall(Math.floor(x0 + (x1 - x0) * k), Math.floor(y0 + (y1 - y0) * k))) return false;
    }
    return true;
  };

  /** Room for XN's middle at (x, y): no wall within her reach. */
  const roomFor = (x: number, y: number) => {
    const r = XN_RADIUS;
    // She keeps out of the special rooms that keep her out.
    if (!world.map.allows(Math.floor(x), Math.floor(y), "xn")) return false;
    return (
      !world.map.wall(Math.floor(x - r), Math.floor(y - r)) &&
      !world.map.wall(Math.floor(x + r), Math.floor(y - r)) &&
      !world.map.wall(Math.floor(x - r), Math.floor(y + r)) &&
      !world.map.wall(Math.floor(x + r), Math.floor(y + r))
    );
  };

  /** Every face of wall within `reach` cells of (x, y) that has open floor in front of it. */
  const wallFaces = (x: number, y: number, reach: number) => {
    const faces: { x: number; y: number; nx: number; ny: number }[] = [];
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    for (let j = -reach; j <= reach; j++) {
      for (let i = -reach; i <= reach; i++) {
        if (!world.map.wall(cx + i, cy + j)) continue;
        for (const [nx, ny] of SIDES) {
          if (world.map.wall(cx + i + nx, cy + j + ny)) continue;
          if (!world.map.allows(cx + i + nx, cy + j + ny, "xn")) continue;
          faces.push({ x: cx + i + 0.5 + nx * 0.5, y: cy + j + 0.5 + ny * 0.5, nx, ny });
        }
      }
    }
    return faces;
  };

  /**
   * XN on the given surface in front of someone at (x, y) looking along `angle`, facing back at them: on the floor
   * or the ceiling up to XN_AHEAD ahead, nearer if a wall's in the way; on a wall, the face of wall about two cells off
   * that looks their way.
   */
  const spotAhead = (x: number, y: number, angle: number, surface: XnSurface): XnSpot => {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    if (surface === "wall") {
      let best: XnSpot | null = null;
      let bestScore = Infinity;
      for (const face of wallFaces(x, y, WALL_SEARCH)) {
        const dx = x - face.x;
        const dy = y - face.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.8 || (dx * face.nx + dy * face.ny) / dist < 0.25) continue;
        if (!clearBetween(x, y, face.x + face.nx * 0.3, face.y + face.ny * 0.3)) continue;
        // About two cells off, and in front of them rather than behind.
        const behind = -(dx * fx + dy * fy) / dist < 0 ? 3 : 0;
        const score = Math.abs(dist - 2) + behind;
        if (score >= bestScore) continue;
        bestScore = score;
        // Her front along the wall, toward their side of her.
        const along = dx * -face.ny + dy * face.nx < 0 ? -1 : 1;
        best = wallSpot(face.x, face.y, Math.atan2(face.ny, face.nx), along);
      }
      // Nowhere to cling to: the floor.
      if (best) return best;
    }
    let d = XN_AHEAD;
    while (d > 0.6 && !(roomFor(x + fx * d, y + fy * d) && clearBetween(x, y, x + fx * d, y + fy * d))) d -= 0.1;
    return spotOn(surface, x + fx * d, y + fy * d, angle + Math.PI);
  };

  /** A ceiling light near her to stare at: one she can turn her head to, and that works, if there's one. */
  const lampFor = (who: Xn): Point | null => {
    const { front } = who.where;
    const facing = Math.atan2(front[1], front[0]);
    let best: Point | null = null;
    let bestScore = Infinity;
    const r = Math.ceil(LAMP_SEARCH);
    const cx = Math.floor(who.x);
    const cy = Math.floor(who.y);
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const lx = cx + i;
        const ly = cy + j;
        if (!world.map.lampAt(lx, ly) || world.map.wall(lx, ly)) continue;
        const dx = lx + 0.5 - who.x;
        const dy = ly + 0.5 - who.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LAMP_SEARCH) continue;
        const off = Math.atan2(dy, dx) - facing;
        const turn = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
        const dead = world.map.light(lx, ly) === LIGHT_DEAD ? 1.5 : 0;
        const score = dist + (dist > 0.3 && turn > 1.1 ? 3 : 0) + dead;
        if (score >= bestScore) continue;
        bestScore = score;
        best = [lx + 0.5, ly + 0.5, 1];
      }
    }
    return best;
  };

  // ---- XN walking ----

  /**
   * Room for her middle at (x, y) as she walks on `surface`: no wall or statue there (a statue stands nearly to the
   * ceiling), nor junk on that surface; on the floor, no visitor either. Up on the ceiling she goes over them.
   */
  const freeFor = (x: number, y: number, surface: XnSurface) => {
    if (!roomFor(x, y) || intoJunk(x, y, XN_RADIUS, surface)) return false;
    const { player } = world;
    if (surface !== "ceiling" && Math.hypot(x - player.x, y - player.y) < XN_RADIUS + PLAYER_RADIUS) return false;
    return world.statues.every((mesh) => Math.hypot(x - mesh.x, y - mesh.y) >= STATUE_RADIUS + XN_RADIUS);
  };

  /** Room for her all the way from (x, y) `far` cells along `angle`, on `surface`. */
  const wayClear = (x: number, y: number, angle: number, far: number, surface: XnSurface) => {
    const n = Math.max(1, Math.ceil(far / 0.1));
    for (let i = 1; i <= n; i++) {
      const k = (far * i) / n;
      if (!freeFor(x + Math.cos(angle) * k, y + Math.sin(angle) * k, surface)) return false;
    }
    return true;
  };

  /**
   * Which way she wants to go from (x, y), given which way she faces, the seconds since the last pose, and how many
   * seconds her way has been blocked. Null gives up: she wanders off instead.
   */
  type Aim = (x: number, y: number, facing: number, dt: number, held: number) => number | null;

  /** A way from (x, y) with room to walk, near `facing` if there's one; back the way she came if there's none. */
  const openWay = (x: number, y: number, facing: number, surface: XnSurface) => {
    for (let i = 0; i < 12; i++) {
      const a = facing + (Math.random() * 2 - 1) * (i < 6 ? 1.2 : Math.PI);
      if (wayClear(x, y, a, 1, surface)) return a;
    }
    return facing + Math.PI;
  };

  /** Wandering on `surface`: on ahead until the way is blocked, or she feels like going another way. */
  const wanderAim = (surface: XnSurface): Aim => {
    let want: number | null = null;
    let restless = between(XN_WANDER_TURN);
    return (x, y, facing, dt, held) => {
      restless -= dt;
      if (want === null) want = facing;
      if (restless <= 0 || held > XN_HELD || !wayClear(x, y, want, XN_LOOK_AHEAD, surface)) {
        restless = between(XN_WANDER_TURN);
        want = openWay(x, y, want, surface);
      }
      return want;
    };
  };

  /**
   * A route that turns her a little at a time toward the way `aim` gives and walks her on along her front: slower the
   * further she still has to turn, and never into a wall or a statue, or nearer into the visitor.
   */
  const walker = (aim: Aim): XnRoute => {
    let steer = aim;
    let held = 0;
    return (spot, distance, dt) => {
      const facing = Math.atan2(spot.front[1], spot.front[0]);
      let want = steer(spot.x, spot.y, facing, dt, held);
      if (want === null) {
        steer = wanderAim(spot.surface);
        held = 0;
        want = steer(spot.x, spot.y, facing, dt, held) ?? facing;
      }
      const off = Math.atan2(Math.sin(want - facing), Math.cos(want - facing));
      const turned = facing + clamp(off, -XN_TURN * dt, XN_TURN * dt);
      const go = distance * Math.max(0, Math.cos(off));
      if (go <= 0) return spotOn(spot.surface, spot.x, spot.y, turned);
      const x = spot.x + Math.cos(turned) * go;
      const y = spot.y + Math.sin(turned) * go;
      const { player } = world;
      const near = Math.hypot(x - player.x, y - player.y);
      // Up on the ceiling she goes over the visitor, but not the statues, nearly as tall as the room.
      const intoVisitor =
        spot.surface !== "ceiling" &&
        near < XN_RADIUS + PLAYER_RADIUS &&
        near < Math.hypot(spot.x - player.x, spot.y - player.y);
      const intoStatue =
        world.statues.some((mesh) => Math.hypot(x - mesh.x, y - mesh.y) < STATUE_RADIUS + XN_RADIUS) ||
        intoJunk(x, y, XN_RADIUS, spot.surface);
      if (!roomFor(x, y) || intoVisitor || intoStatue) {
        held += dt;
        return spotOn(spot.surface, spot.x, spot.y, turned);
      }
      held = 0;
      return spotOn(spot.surface, x, y, turned);
    };
  };

  /** Back and forth between where she is and somewhere a straight walk off. Null if there's no room for it. */
  const backAndForth = (from: XnSpot): Aim | null => {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const far = between(XN_PACE_SPAN);
      if (!wayClear(from.x, from.y, a, far, from.surface)) continue;
      const ends = [
        [from.x, from.y],
        [from.x + Math.cos(a) * far, from.y + Math.sin(a) * far],
      ];
      let to = 1;
      return (x, y, _facing, _dt, held) => {
        // Turning round can swing her off the line and into a corner: she gives up and wanders.
        if (held > XN_STUCK) return null;
        if (Math.hypot(ends[to][0] - x, ends[to][1] - y) < 0.1) to = 1 - to;
        return Math.atan2(ends[to][1] - y, ends[to][0] - x);
      };
    }
    return null;
  };

  /**
   * Round and round a light, or a pillar, near her: one with room all round it, and a clear walk to it. Null if
   * there's none.
   */
  const roundAbout = (from: XnSpot): Aim | null => {
    const rings: [number, number, number][] = [];
    const r = XN_ROUND_SEARCH;
    const cx = Math.floor(from.x);
    const cy = Math.floor(from.y);
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const lx = cx + i;
        const ly = cy + j;
        const pillar = world.map.wall(lx, ly);
        if (!pillar && !world.map.lampAt(lx, ly)) continue;
        const ox = lx + 0.5;
        const oy = ly + 0.5;
        const away = Math.hypot(from.x - ox, from.y - oy);
        if (away > r) continue;
        const radius = between(pillar ? XN_ROUND_PILLAR : XN_ROUND_LAMP);
        let room = true;
        for (let k = 0; k < 16 && room; k++) {
          const a = (k / 16) * Math.PI * 2;
          room = roomFor(ox + Math.cos(a) * radius, oy + Math.sin(a) * radius);
        }
        // The nearest point of the ring, and a clear walk there.
        const toward = Math.atan2(oy - from.y, ox - from.x);
        const way = away > radius ? toward : toward + Math.PI;
        if (room && wayClear(from.x, from.y, way, Math.abs(away - radius), from.surface)) {
          rings.push([ox, oy, radius]);
        }
      }
    }
    if (!rings.length) return null;
    const [ox, oy, radius] = rings[Math.floor(Math.random() * rings.length)];
    const turn = Math.random() < 0.5 ? -1 : 1;
    return (x, y, _facing, _dt, held) => {
      // Spiralling in, she can meet a wall the straight walk missed: she gives up and wanders.
      if (held > XN_STUCK) return null;
      // Along the ring, leaning in or out toward it when she's off it.
      const off = clamp((Math.hypot(x - ox, y - oy) - radius) * 2, -0.8, 0.8);
      return Math.atan2(y - oy, x - ox) + turn * (Math.PI / 2 + off);
    };
  };

  /** One of her three ways of walking, at random. */
  const routeFor = (who: Xn): XnRoute => {
    const roll = Math.floor(Math.random() * 3);
    const aim = (roll === 1 && backAndForth(who.where)) || (roll === 2 && roundAbout(who.where)) || wanderAim(who.where.surface);
    return walker(aim);
  };

  /** Starts an action: moves her to a wall to face it, and finds what she stares at. */
  const startXnAction = (who: Xn, action: XnAction) => {
    const surface = who.surface;
    // Sticking out of a wall, she can't face it or walk.
    let chosen = surface === "wall" && NOT_ON_WALLS.has(action) ? "stand" : action;
    if (action === "faceWall" && surface !== "wall") {
      // The face of wall nearest her, preferably one where the visitor can see her.
      let best: XnSpot | null = null;
      let bestScore = Infinity;
      for (const face of wallFaces(who.x, who.y, FACE_WALL_SEARCH)) {
        const sx = face.x + face.nx * FACE_WALL_GAP;
        const sy = face.y + face.ny * FACE_WALL_GAP;
        const mx = sx + face.nx * 0.1;
        const my = sy + face.ny * 0.1;
        if (!roomFor(mx, my) || intoJunk(mx, my, XN_RADIUS)) continue;
        const seen = clearBetween(world.player.x, world.player.y, mx, my);
        const score = Math.hypot(sx - who.x, sy - who.y) + (seen ? 0 : 4);
        if (score >= bestScore) continue;
        bestScore = score;
        const facing = Math.atan2(-face.ny, -face.nx);
        best = spotOn(surface, sx, sy, facing);
      }
      // No wall near enough: she just stands.
      if (best) who.moveTo(best);
      else chosen = "stand";
    }
    let gaze: Point | null = null;
    if (chosen === "lamp") gaze = lampFor(who);
    if (chosen === "carpet") {
      const { x, y, front } = who.where;
      // Just ahead of her feet, or the floor under her.
      gaze = surface === "floor" ? [x + front[0] * 0.3, y + front[1] * 0.3, 0] : [who.x, who.y, 0];
    }
    who.act(chosen, gaze);
    if (chosen === "walk") who.route = routeFor(who);
  };

  /** XN is in the visitor's view: in the picture's width, give or take hers, with no wall between. */
  const sees = (cam: Camera, x: number, y: number) => {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const fx = Math.cos(cam.angle);
    const fy = Math.sin(cam.angle);
    const ahead = dx * fx + dy * fy;
    if (ahead <= 0 || Math.hypot(dx, dy) > world.drawRange) return false;
    if (Math.abs(dy * fx - dx * fy) - XN_RADIUS > ahead * world.spread()) return false;
    return clearBetween(cam.x, cam.y, x, y);
  };

  /**
   * Somewhere for XN to turn up near the visitor, out of their view: one with nothing between them, so a turn of the
   * head finds her, if any of the spots tried is; any out of view otherwise. Null if none is.
   */
  const pickXnSpot = (who: Xn, cam: Camera): XnSpot | null => {
    let fallback: XnSpot | null = null;
    for (let i = 0; i < XN_TRIES; i++) {
      const surface = pickSurface();
      const angle = Math.random() * Math.PI * 2;
      const dist = between([XN_NEAR, XN_FAR]);
      const x = cam.x + Math.cos(angle) * dist;
      const y = cam.y + Math.sin(angle) * dist;
      let spot: XnSpot;
      if (surface === "wall") {
        const faces = wallFaces(x, y, 1);
        if (!faces.length) continue;
        const face = faces[Math.floor(Math.random() * faces.length)];
        spot = wallSpot(face.x, face.y, Math.atan2(face.ny, face.nx), Math.random() < 0.5 ? -1 : 1);
      } else {
        if (!roomFor(x, y)) continue;
        spot = spotOn(surface, x, y, Math.random() * Math.PI * 2);
      }
      const [mx, my] = who.middleOf(spot);
      if (intoJunk(mx, my, XN_RADIUS, surface)) continue;
      const away = Math.hypot(mx - cam.x, my - cam.y);
      if (away < XN_NEAR || away > XN_FAR || sees(cam, mx, my)) continue;
      if (clearBetween(cam.x, cam.y, mx, my)) return spot;
      if (!fallback) fallback = spot;
    }
    return fallback;
  };

  // ---- XN and things ----

  /** Everything near (x, y) she could do something with. */
  const thingsNear = (x: number, y: number, radius: number): Thing[] => {
    const out: Thing[] = [];
    for (const junk of junkAround(world.map, x, y, radius)) {
      if (junk.perch) {
        const target = junk.partySeat
          ? "party"
          : junk.perch.ceiling
            ? "hung"
            : junk.kind === "bedding"
              ? "bed"
              : junk.kind === "kitchen"
                ? "counter"
                : (junk.kind as PropTarget);
        // Only what she has ways to be on: a perch on any other kind of thing is left alone.
        if (target in PROP_POSES) out.push({ target, x: junk.perch.x, y: junk.perch.y, junk, perch: junk.perch });
      }
      if (junk.doorway) out.push({ target: "door", x: junk.x, y: junk.y, junk, door: junk.doorway });
      if (junk.writing) {
        const look = boardFace(junk);
        out.push({ target: "board", x: look.x, y: look.y, junk, look });
      }
      if (junk.plate) {
        const { x: px, y: py, z, yaw } = junk.plate;
        const look = { x: px, y: py, z, nx: Math.cos(yaw), ny: Math.sin(yaw) };
        out.push({ target: "sign", x: px, y: py, junk, look });
      }
    }
    for (const tag of graffitiNear(world.map, x, y, radius, world.tuning)) {
      const target = tag.kind === "portrait" ? "portrait" : "graffiti";
      out.push({ target, x: tag.centre.x, y: tag.centre.y, junk: null, look: tag.centre });
    }
    // The one light left in each dark hall near.
    for (const [lx, ly] of world.map.lampHallsNear(x, y, radius)) {
      out.push({ target: "spotlight", x: lx, y: ly, junk: null, light: { x: lx, y: ly } });
    }
    // A few rims in each pit room near, to sit on with her legs over a pit: on a rim between two, facing either.
    for (const field of pitFieldsNear(world.map, x, y, radius)) {
      for (let k = 0; k < XN_PIT_SEATS; k++) {
        const across = 1 + Math.floor(Math.random() * (PIT_COUNT - 1));
        const along = Math.floor(Math.random() * PIT_COUNT);
        const ahead = Math.random() < 0.5 ? 1 : -1;
        const onX = Math.random() < 0.5;
        const line = across * PIT_PITCH;
        const mid = (along + 0.5) * PIT_PITCH;
        const sx = field.x0 + (onX ? line : mid);
        const sy = field.y0 + (onX ? mid : line);
        const yaw = onX ? (ahead > 0 ? 0 : Math.PI) : ahead > 0 ? Math.PI / 2 : -Math.PI / 2;
        out.push({ target: "pit", x: sx, y: sy, junk: null, perch: { x: sx, y: sy, z: 0, yaw, edge: PIT_RIM } });
      }
    }
    return out;
  };

  /** Whether there's room for her middle at (x, y) on the floor, minding everything but the thing she's at. */
  const roomBy = (x: number, y: number, except: Junk | null) =>
    roomFor(x, y) &&
    !world.junk.some(
      (junk) =>
        junk !== except &&
        junk.solid &&
        !junk.solid.overhead &&
        solidDistance(junk.solid, x, y) < junk.solid.r + XN_RADIUS,
    );

  /** Where she goes and what she does, to do `pose` with `thing`; null if there's no room for it. */
  const planFor = (thing: Thing, pose: PropPose): Plan | null => {
    const still = { swing: false, curious: 0 };
    if (thing.target === "bed" && thing.perch) {
      // Sitting on it hugging her knees, somewhere along it: facing out into the room, or turned to the wall it lies
      // along, looking at the count.
      const { x, y, z, yaw } = thing.perch;
      const along = (Math.random() * 2 - 1) * XN_BED_ALONG;
      const toWall = pose === "sitWall";
      const facing = toWall ? yaw + Math.PI : yaw;
      const sx = x + Math.sin(yaw) * along - Math.cos(facing) * XN_BED_BACK;
      const sy = y - Math.cos(yaw) * along - Math.sin(facing) * XN_BED_BACK;
      const spot = topSpot(sx, sy, z, facing + (Math.random() - 0.5) * 0.3);
      // The wall is behind the mattress's middle, as far as its edge is in front.
      const { edge } = thing.perch;
      const gaze: Point | null = toWall ? [x - Math.cos(yaw) * edge, y - Math.sin(yaw) * edge, 0.45] : null;
      return { spot, action: "sit", gaze, ...still };
    }
    if (thing.perch) {
      const { x, y, z, yaw, edge } = thing.perch;
      const hanging = thing.target === "hung";
      const holding: XnHold = pose === "hold" || pose === "holdSwing" ? "burger" : "none";
      if (pose === "perch" || pose === "swing" || holding !== "none") {
        // On the front edge, hips just back from it, facing out over it.
        const back = edge - XN_EDGE_BACK;
        const spot = topSpot(x + Math.cos(yaw) * back, y + Math.sin(yaw) * back, z, yaw, hanging);
        const chair = thing.target === "chair" || thing.target === "party" || hanging;
        const swing = pose === "swing" || pose === "holdSwing";
        return { spot, action: "perch", gaze: null, swing, curious: 0, tailUp: chair, holding };
      }
      if (pose !== "stand" && pose !== "crouch") return null;
      // Upside down under a chair in the ceiling, her feet on the underside of its seat.
      const spot = topSpot(x, y, z, yaw + (Math.random() - 0.5) * 1.2, hanging);
      return { spot, action: pose, gaze: null, ...still };
    }
    if (thing.light) {
      // Somewhere just off right under it, minding what's there; standing, she looks up into it, and down at the
      // floor under it otherwise.
      const { x, y } = thing.light;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = between(XN_UNDER_LIGHT);
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d;
        if (!roomBy(sx, sy, null)) continue;
        const action: XnAction = pose === "sit" ? "sit" : pose === "crouch" ? "crouch" : "stand";
        const facing = Math.atan2(y - sy, x - sx) + (Math.random() - 0.5) * 0.6;
        const gaze: Point = action === "stand" ? [x, y, 1] : [x, y, 0.1];
        return { spot: floorSpot(sx, sy, facing), action, gaze, ...still };
      }
      return null;
    }
    if (thing.door) {
      const { x, y, yaw, both } = thing.door;
      const side = both && Math.random() < 0.5 ? -1 : 1;
      const nx = Math.cos(yaw) * side;
      const ny = Math.sin(yaw) * side;
      const back = pose === "sitBack" || pose === "crouchBack";
      const d = back ? XN_DOOR_BACK : XN_DOOR_FACING;
      const sx = x + nx * d;
      const sy = y + ny * d;
      // Her middle out from the door, whichever way she faces.
      const mx = x + nx * (d + 0.06);
      const my = y + ny * (d + 0.06);
      if (!roomBy(mx, my, thing.junk)) return null;
      const action: XnAction = pose === "stand" ? "stand" : pose === "sit" || pose === "sitBack" ? "sit" : "crouch";
      const facing = back ? Math.atan2(ny, nx) : Math.atan2(-ny, -nx);
      const gaze: Point | null = back ? null : [x, y, 0.4];
      return { spot: floorSpot(sx, sy, facing), action, gaze, ...still };
    }
    if (thing.look) {
      const { x, y, z, nx, ny } = thing.look;
      const d = between(XN_LOOK_AWAY);
      const sx = x + nx * d;
      const sy = y + ny * d;
      if (!roomBy(sx, sy, thing.junk)) return null;
      const action: XnAction = pose === "sit" ? "sit" : pose === "crouch" ? "crouch" : "stand";
      // Facing it, a little off square.
      const facing = Math.atan2(-ny, -nx) + (Math.random() - 0.5) * 0.4;
      return {
        spot: floorSpot(sx, sy, facing),
        action,
        gaze: [x, y, z],
        swing: false,
        curious: thing.target === "portrait" ? XN_CURIOUS * (Math.random() < 0.5 ? -1 : 1) : 0,
      };
    }
    return null;
  };

  /** Puts her there, doing that. */
  const carryOut = (who: Xn, plan: Plan) => {
    who.moveTo(plan.spot);
    who.act(plan.action, plan.gaze);
    who.swingLegs = plan.swing;
    who.curious = plan.curious;
    if (plan.tailUp) who.manner = { ...who.manner, tailUp: true };
    who.holding = plan.holding ?? "none";
  };

  /**
   * Something near the visitor for XN to do something with, out of their view: one with nothing between, if any of
   * those near is; any out of view otherwise. Null if none is.
   */
  const pickXnProp = (who: Xn, cam: Camera, only?: PropTarget, within = XN_FAR): Plan | null => {
    const things = thingsNear(cam.x, cam.y, within).filter((thing) => !only || thing.target === only);
    for (let i = things.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [things[i], things[j]] = [things[j], things[i]];
    }
    let fallback: Plan | null = null;
    for (const thing of things) {
      const poses = PROP_POSES[thing.target];
      const plan = planFor(thing, poses[Math.floor(Math.random() * poses.length)]);
      if (!plan) continue;
      const [mx, my] = who.middleOf(plan.spot);
      const away = Math.hypot(mx - cam.x, my - cam.y);
      if (away < XN_NEAR || away > XN_FAR || sees(cam, mx, my)) continue;
      if (clearBetween(cam.x, cam.y, mx, my)) return plan;
      if (!fallback) fallback = plan;
    }
    return fallback;
  };

  return {
    intoJunk,
    spotAhead,
    startXnAction,
    sees,
    pickXnSpot,
    thingsNear,
    planFor,
    carryOut,
    pickXnProp,
  };
}
