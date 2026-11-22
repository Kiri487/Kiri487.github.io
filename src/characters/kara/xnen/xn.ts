import { clamp } from "../../../shared/math";
import { Figure, type FigureModel, type Placement } from "./engine/figure";
import type { StatueMesh } from "./engine/statue";

/*
 * XN in her backrooms. She stands on the floor, hangs from the ceiling or sticks out of a wall, and does one thing
 * where she is: stands, stares at a light or the carpet, faces the wall, crouches, sits hugging her knees, turns
 * on the spot, or walks (a different way every time) wherever the game's route takes her. She also gets up on
 * things (a chair, a desk, a filing cabinet, a monitor) to stand, crouch or sit on the edge with her legs hanging,
 * swinging them or not; and stands, sits or crouches at a door, or in front of graffiti or a sign, looking at it. On top of any of them her tail can be up or down, and her arms still or swinging. She minds her own
 * business until the visitor comes near; then her head follows them, and only her head: her body carries on with
 * what it was doing. Her tail and hair always move a little, and once in
 * a while her head twitches.
 *
 * The game decides where she is and what she does (game.ts: she turns up near the visitor and moves on when
 * they've looked away a while). What she says comes later.
 *
 * She moves like a cheap game's character: her pose is only worked out a few times a second.
 */

/** How close the visitor can come to her middle. */
export const XN_RADIUS = 0.24;
/** She only watches a visitor this many cells from her, or nearer; Kiri tunes it in the dev panel. */
export const NOTICE_RANGE = 4;
/** Poses per second. */
const POSE_RATE = 10;
/** How far her head turns to follow, in radians: to either side, back (to look up) and forward (to look down). */
const HEAD_REACH = 1.25;
const HEAD_BACK = 0.75;
const HEAD_DOWN = 0.6;
/** How fast her head catches up, per second; slower when she turns from the wall or the carpet to the visitor. */
const HEAD_SPEED = 5;
const SLOW_HEAD_SPEED = 1.1;
/** How far she tilts her head when the visitor is further round than it can turn. */
const STRAIN_TILT = 0.35;
/** Seconds between twitches, at least and at most, and how long one lasts. */
const TWITCH_MIN = 4;
const TWITCH_MAX = 11;
const TWITCH_TIME = 0.2;
/** Her feet keep this far off a ceiling or wall, so they don't poke through it. */
const GAP = 0.01;
/** Turning on the spot, round and round without stopping: seconds for one turn. */
const SPIN_TIME = 3;

const TAIL = ["tail_1", "tail_2", "tail_3", "tail_4", "tail_5"];
const HAIR_BACK = ["hair_back_1", "hair_back_2", "hair_back_3", "hair_back_4"];
const HAIR_LEFT = ["hair_side_l_1", "hair_side_l_2", "hair_side_l_3"];
const HAIR_RIGHT = ["hair_side_r_1", "hair_side_r_2", "hair_side_r_3"];

export type XnSurface = "floor" | "ceiling" | "wall";

/** What she has in her hands: nothing, or a burger, held in her lap and now and then lifted to her mouth for a bite. */
export type XnHold = "none" | "burger";

/** `perch` sits on an edge, legs hanging: only on something she's got up on. */
export type XnAction = "stand" | "lamp" | "carpet" | "faceWall" | "crouch" | "sit" | "spin" | "walk" | "perch";

/** Everything she can do, in the dev panel's order. */
export const XN_ACTIONS: readonly XnAction[] = ["stand", "lamp", "carpet", "faceWall", "crouch", "sit", "spin", "walk"];

/** What she can't do sticking out of a wall: there's no wall in front of her to face, and nothing to walk on. */
export const NOT_ON_WALLS: ReadonlySet<XnAction> = new Set<XnAction>(["faceWall", "walk"]);

/** What goes on top of any action. */
export interface XnManner {
  tailUp: boolean;
  swingArms: boolean;
}

/** A point in the world: x, y on the map, z from the floor (0) to the ceiling (1). */
export type Point = readonly [number, number, number];

export interface XnSpot extends Placement {
  surface: XnSurface;
}

/** Standing on the floor at (x, y), facing `facing` (radians). */
export function floorSpot(x: number, y: number, facing: number): XnSpot {
  return { surface: "floor", x, y, z: 0, up: [0, 0, 1], front: [Math.cos(facing), Math.sin(facing), 0] };
}

/** Hanging from the ceiling over (x, y), `ceiling` high, her front toward `facing`. */
export function ceilingSpot(x: number, y: number, facing: number, ceiling = 1): XnSpot {
  return {
    surface: "ceiling",
    x,
    y,
    z: ceiling - GAP,
    up: [0, 0, -1],
    front: [Math.cos(facing), Math.sin(facing), 0],
  };
}

/** On the ceiling at (x, y), `ceiling` high, facing `facing`; or else on the floor there. */
export function spotOn(surface: XnSurface, x: number, y: number, facing: number, ceiling = 1): XnSpot {
  return surface === "ceiling" ? ceilingSpot(x, y, facing, ceiling) : floorSpot(x, y, facing);
}

/**
 * On top of something at height z, facing `facing`; or, `hanging`, from the underside of something upside down in
 * the ceiling, her head toward the floor.
 */
export function topSpot(x: number, y: number, z: number, facing: number, hanging = false): XnSpot {
  return {
    surface: hanging ? "ceiling" : "floor",
    x,
    y,
    z,
    up: [0, 0, hanging ? -1 : 1],
    front: [Math.cos(facing), Math.sin(facing), 0],
  };
}

/**
 * Sticking straight out of a wall, half way up it. (x, y) is on the wall's face, `out` the way the face looks
 * (radians), and `along` (1 or −1) which way along the wall her front points.
 */
export function wallSpot(x: number, y: number, out: number, along: number): XnSpot {
  const ox = Math.cos(out);
  const oy = Math.sin(out);
  return {
    surface: "wall",
    x: x + ox * GAP,
    y: y + oy * GAP,
    z: 0.5,
    up: [ox, oy, 0],
    front: [-oy * along, ox * along, 0],
  };
}

/** What each action does with her head while nobody's watching: look at its target, or ahead, tipped this far down. */
const REST_NOD: Record<XnAction, number> = {
  stand: 0,
  lamp: 0,
  carpet: 0,
  faceWall: 0.12,
  crouch: 0,
  sit: 0.3,
  spin: 0,
  walk: 0.1,
  perch: 0.15,
};

/**
 * Her crouch, sitting on her heels: shins leaning forward (radians from upright) and thighs folded up past level
 * (radians from hanging straight down), from these when she's least low, adding the rest when she's lowest. Her legs'
 * bone lengths, hip to knee to ankle.
 */
const CROUCH_SHIN = 0.6;
const CROUCH_SHIN_MORE = 0.45;
const CROUCH_THIGH = 1.8;
const CROUCH_THIGH_MORE = 0.6;
const THIGH_LENGTH = 0.062;
const SHIN_LENGTH = 0.081;
/** Her hip joints and ankle joints, standing, above her soles. */
const HIP_HEIGHT = 0.164;
const ANKLE_HEIGHT = 0.021;

/** The rest of her crouch, in radians, which Kiri tunes in the dev panel. */
export interface XnCrouch {
  /** How low she sits, 0–1. */
  depth: number;
  /** Knees apart. */
  knees: number;
  /** Chest forward. */
  lean: number;
  /** Arms straight out over her knees: this far forward of hanging down. */
  arms: number;
  /** Hands in toward each other. */
  armsIn: number;
}

export const DEFAULT_CROUCH: XnCrouch = { depth: 0.66, knees: 0.1, lean: 0.5, arms: 1.12, armsIn: 0.4 };

/** Sitting on the floor hugging her knees, in radians unless said, which Kiri tunes in the dev panel. */
export interface XnSit {
  /** Her hip joints above the floor, in map units: low enough that her seat is on it. */
  seat: number;
  /** Thighs raised, from hanging straight down; her right one a little less. Her shins reach for the floor. */
  knees: number;
  /** Knees apart. */
  spread: number;
  /** Chest forward. */
  lean: number;
  /** Upper arms forward of hanging down. */
  arms: number;
  /** Forearms folded in across each other. */
  fold: number;
  /**
   * How flat her feet are kept, 0–1. Flat bends her ankles a long way, which stretches her boots; less lets her toes
   * come up with her shins.
   */
  feet: number;
}

export const DEFAULT_SIT: XnSit = { seat: 0.03, knees: 2.5, spread: 0, lean: 0.5, arms: 1.25, fold: 1.3, feet: 0.2 };
/** Her right thigh is raised this much less than her left, so she isn't a mirror image. */
const SIT_UNEVEN = 0.2;

/**
 * Sitting on an edge: her hip joints this high over what she sits on, her thighs out level over the edge (a little
 * apart, the right one a touch higher), her shins hanging; swinging, each leg this far either way, this many times a
 * second, the two out of step.
 */
const PERCH_SEAT = 0.035;
const PERCH_SPREAD = 0.08;
const PERCH_SWING = 0.4;
const PERCH_SWING_RATE = 1.3;
/**
 * Holding a burger in both hands: her upper arms forward and in, her forearms bent up toward each other; lifting it,
 * further up, to just in front of her face. All in radians, as for the rest of her arms.
 */
const HOLD_UPPER = -0.55;
const HOLD_IN = 0.28;
const HOLD_FORE = -1.05;
const HOLD_FORE_IN = 0.45;
const RAISE_UPPER = -1.25;
const RAISE_FORE = 0.05;
/**
 * Lifting it to her mouth: every this many seconds, this likely to; this long going up (and coming down), this long
 * held there eating, with a little nibbling bob at this rate a second.
 */
const EAT_EVERY = 3;
const EAT_CHANCE = 0.35;
const RAISE_MOVE = 0.45;
const RAISE_EAT = 1.8;
const NIBBLE_RATE = 2.5;
const NIBBLE = 0.08;
/**
 * The burger tipped back toward her, its bitten side turned up to her: this far held in her lap, this far at her
 * mouth.
 */
const HELD_TIP = 0.35;
const HELD_TIP_EATING = 0.75;
/** Her palms: on from her wrists, this far again as from her elbows to her wrists. */
const PALM_ON = 0.5;

/**
 * Walking, not quite right: one leg lagging, her body rolling over each foot and her head
 * lolling after it, and now and then she stops dead mid-step. In radians unless said; Kiri tunes it in the dev panel.
 */
export interface XnWalk {
  /** Strides (two steps) per second. */
  pace: number;
  /** How far her thighs swing fore and aft. */
  stride: number;
  /** How high she lifts each knee. */
  lift: number;
  /** How much less one leg does: her left when negative, her right when positive, up to 1 either way. */
  limp: number;
  /** Her body rolling over the foot she's on. */
  sway: number;
  /** Her head lolling after it. */
  loll: number;
  /** The chance, each step, that she freezes a moment with a foot in the air, 0–1. */
  stutter: number;
  /** Chest forward. */
  lean: number;
}

export const DEFAULT_WALK: XnWalk = {
  pace: 0.55,
  stride: 0.42,
  lift: 0.95,
  limp: 0.5,
  sway: 0.12,
  loll: 0.22,
  stutter: 0.25,
  lean: 0.18,
};

/** Every walk setting's whole range: each time she walks she picks anywhere in it, since she's XN. */
export const WALK_RANGE: Record<keyof XnWalk, readonly [number, number]> = {
  pace: [0.2, 1.5],
  stride: [0, 0.8],
  lift: [0, 1.8],
  limp: [-1, 1],
  sway: [0, 0.4],
  loll: [0, 0.6],
  stutter: [0, 1],
  lean: [0, 0.6],
};

/** A new way to walk, every setting picked anywhere in its range. */
export function randomWalk(): XnWalk {
  const pick = (key: keyof XnWalk) => {
    const [min, max] = WALK_RANGE[key];
    return min + Math.random() * (max - min);
  };
  // A stride near nothing is allowed: she marches on the spot and gets nowhere. She's XN.
  return {
    pace: pick("pace"),
    stride: pick("stride"),
    lift: pick("lift"),
    limp: pick("limp"),
    sway: pick("sway"),
    loll: pick("loll"),
    stutter: pick("stutter"),
    lean: pick("lean"),
  };
}
/**
 * Where she walks: from `spot`, up to `distance` further on, over `dt` seconds. The game knows the walls, so it decides
 * the way, turns her toward it and says where she ends up.
 */
export type XnRoute = (spot: XnSpot, distance: number, dt: number) => XnSpot;

/** How long a stutter holds her, at least and at most, in seconds. */
const STUTTER_MIN = 0.3;
const STUTTER_MAX = 0.8;

/** Her arms are busy (on her knees, or holding the edge): they never swing. */
const ARMS_BUSY = new Set<XnAction>(["crouch", "sit", "perch"]);

/** Looking away from the visitor at something: she takes her time turning to them. */
const SLOW_TO_NOTICE = new Set<XnAction>(["faceWall", "carpet"]);

export class Xn {
  readonly figure: Figure;
  private spot: XnSpot;
  private action: XnAction = "stand";
  /** What she looks at while the visitor is far off; null looks ahead. */
  private gaze: Point | null = null;
  /** Kiri's dev panel: she never notices anyone, so the action can be watched. */
  ignore = false;
  noticeRange = NOTICE_RANGE;
  /** The visitor is near enough: her head follows them. */
  private watching = false;
  /** Tail up or down, arms still or swinging, whatever the action. */
  manner: XnManner = { tailUp: false, swingArms: false };
  crouch: XnCrouch = { ...DEFAULT_CROUCH };
  sit: XnSit = { ...DEFAULT_SIT };
  walk: XnWalk = { ...DEFAULT_WALK };
  /** Where she goes while she walks; null walks on the spot. */
  route: XnRoute | null = null;
  /** She stops walking and stands, while the visitor talks to her; with a burger, she stops lifting it to her mouth. */
  halted = false;
  /** Sitting on an edge, she swings her legs. */
  swingLegs = false;
  /** What she has in her hands. */
  holding: XnHold = "none";
  /** Her head tipped to one side while she looks at something (her own drawing): radians, 0 for none. */
  curious = 0;
  private readonly neck: number;
  private readonly head: number;
  private readonly spine: number;
  private readonly chest: number;
  private readonly upperArms: [number, number];
  private readonly foreArms: [number, number];
  private readonly thighs: [number, number];
  private readonly shins: [number, number];
  private readonly feet: [number, number];
  private readonly tail: number[];
  private readonly hairBack: number[];
  private readonly hairLeft: number[];
  private readonly hairRight: number[];
  /** Her head's joint, at rest, in her own space. */
  private readonly headJoint: Point;
  private clock = 0;
  /** Seconds into the current action. */
  private actionClock = 0;
  /** Counts down to the next pose. */
  private wait = 0;
  private headYaw = 0;
  private headPitch = 0;
  private headStrain = 0;
  /** How fast her head was turning at the last pose: her hair trails behind it. */
  private headSwing = 0;
  private nextTwitch = TWITCH_MIN + Math.random() * (TWITCH_MAX - TWITCH_MIN);
  private twitchLeft = 0;
  private twitchSide = 1;
  /** How far through her walk she is, in radians: a whole stride is 2π. */
  private gait = 0;
  /** Seconds she stays frozen mid-step. */
  private frozen = 0;
  private mesh: StatueMesh | null = null;
  /** Where she was last put, for finding her hands. */
  private placed: Placement | null = null;
  /** How far up to her mouth the burger is, 0–1, as of her last pose. */
  private lift = 0;
  /** When, on her action's clock, she started a bite; -1 while she isn't taking one. And when she next thinks of one. */
  private biteAt = -1;
  private nextBite = EAT_EVERY;
  /** Her hands' bones, and her palms on them, at rest. */
  private readonly handBones: [number, number];
  private readonly palms: [Point, Point];

  constructor(model: FigureModel, spot: XnSpot) {
    this.spot = spot;
    const figure = new Figure(model);
    this.figure = figure;
    const pair = (name: string): [number, number] => [figure.bone(`${name}_l`), figure.bone(`${name}_r`)];
    this.neck = figure.bone("neck");
    this.head = figure.bone("head");
    this.spine = figure.bone("spine");
    this.chest = figure.bone("chest");
    this.upperArms = pair("upper_arm");
    this.foreArms = pair("fore_arm");
    this.thighs = pair("thigh");
    this.shins = pair("shin");
    this.feet = pair("foot");
    this.tail = TAIL.map((name) => figure.bone(name));
    this.hairBack = HAIR_BACK.map((name) => figure.bone(name));
    this.hairLeft = HAIR_LEFT.map((name) => figure.bone(name));
    this.hairRight = HAIR_RIGHT.map((name) => figure.bone(name));
    const head = model.bones[this.head];
    this.headJoint = [head.x, head.y, head.z];
    this.handBones = pair("hand");
    const palm = (i: number): Point => {
      const elbow = model.bones[this.foreArms[i]];
      const wrist = model.bones[this.handBones[i]];
      return [
        wrist.x + (wrist.x - elbow.x) * PALM_ON,
        wrist.y + (wrist.y - elbow.y) * PALM_ON,
        wrist.z + (wrist.z - elbow.z) * PALM_ON,
      ];
    };
    this.palms = [palm(0), palm(1)];
  }

  /** The middle of her height, on the map: where she can be bumped into, and is looked for. */
  get x(): number {
    return this.middleOf(this.spot)[0];
  }

  get y(): number {
    return this.middleOf(this.spot)[1];
  }

  /** Where the middle of her height would be on the map, put at `spot`. */
  middleOf(spot: XnSpot): [number, number] {
    const half = this.figure.height / 2;
    return [spot.x + spot.up[0] * half, spot.y + spot.up[1] * half];
  }

  get surface(): XnSurface {
    return this.spot.surface;
  }

  get where(): XnSpot {
    return this.spot;
  }

  /** Puts her somewhere else. */
  moveTo(spot: XnSpot) {
    this.spot = spot;
    this.mesh = null;
  }

  /** Works her pose out again at once, after her manner or crouch changed. */
  repose() {
    this.mesh = null;
  }

  /** Starts an action from the top, looking at `gaze` (or ahead) while the visitor is far off. */
  act(action: XnAction, gaze: Point | null) {
    this.action = action;
    this.gaze = gaze;
    this.curious = 0;
    this.holding = "none";
    this.biteAt = -1;
    this.nextBite = EAT_EVERY;
    this.actionClock = 0;
    this.gait = 0;
    this.frozen = 0;
    this.route = null;
    this.mesh = null;
  }

  /**
   * Moves her on by dt seconds and returns her mesh to draw. `viewer` is the visitor's eye. With `still` (reduced
   * motion) she does nothing of her own accord; her head still answers the visitor.
   */
  update(dt: number, viewer: Point, still: boolean): StatueMesh {
    this.clock += dt;
    this.actionClock += dt;
    // She watches them while they're near; further off, she goes back to what she was doing.
    this.watching = !this.ignore && Math.hypot(viewer[0] - this.x, viewer[1] - this.y) <= this.noticeRange;
    this.wait -= dt;
    if (this.mesh && this.wait > 0) return this.mesh;
    const step = this.mesh ? 1 / POSE_RATE : 0;
    this.wait = 1 / POSE_RATE;
    this.placed = this.pose(step, viewer, still);
    this.mesh = this.figure.place(this.placed);
    return this.mesh;
  }

  /**
   * Where what she holds is, between her hands, in the place, and which way she faces; null if she holds nothing.
   * As of her last pose.
   */
  held(): { x: number; y: number; z: number; yaw: number; tip: number } | null {
    const at = this.placed;
    if (this.holding === "none" || !at) return null;
    let X = 0;
    let Y = 0;
    let Z = 0;
    this.palms.forEach((palm, i) => {
      const [x, y, z] = this.figure.carried(this.handBones[i], palm[0], palm[1], palm[2]);
      X += x / 2;
      Y += y / 2;
      Z += z / 2;
    });
    const [ux, uy, uz] = at.up;
    const [fx, fy, fz] = at.front;
    const rx = fy * uz - fz * uy;
    const ry = fz * ux - fx * uz;
    const rz = fx * uy - fy * ux;
    return {
      x: at.x + X * rx + Y * ux + Z * fx,
      y: at.y + X * ry + Y * uy + Z * fy,
      z: at.z + X * rz + Y * uz + Z * fz,
      yaw: Math.atan2(fy, fx),
      tip: HELD_TIP + (HELD_TIP_EATING - HELD_TIP) * this.lift,
    };
  }

  /** Which way her front points now: turning on the spot swings it round her up. */
  private front(still: boolean): Point {
    const { up, front } = this.spot;
    if (this.action !== "spin" || still) return front;
    const a = (this.actionClock / SPIN_TIME) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // up × front, a quarter turn on.
    const sx = up[1] * front[2] - up[2] * front[1];
    const sy = up[2] * front[0] - up[0] * front[2];
    const sz = up[0] * front[1] - up[1] * front[0];
    return [front[0] * c + sx * s, front[1] * c + sy * s, front[2] * c + sz * s];
  }

  /** Walking, by `step` seconds: on through her stride, and along her route by as far as her feet went. */
  private walkOn(step: number) {
    const { pace, stride, limp, stutter } = this.walk;
    if (this.frozen > 0) {
      this.frozen -= step;
      return;
    }
    const before = Math.floor(this.gait / Math.PI);
    this.gait += step * pace * Math.PI * 2;
    // Each step, as the lifted foot passes the other, she may stop dead and hold it there.
    if (Math.floor(this.gait / Math.PI) !== before && Math.random() < stutter) {
      this.frozen = STUTTER_MIN + Math.random() * (STUTTER_MAX - STUTTER_MIN);
    }
    // A stride carries her as far as each foot swings, front to back, so they don't slide on the floor.
    const leg = THIGH_LENGTH + SHIN_LENGTH;
    const far = 2 * leg * (Math.sin(stride) + Math.sin(stride * (1 - 0.6 * Math.abs(limp))));
    if (this.route) this.spot = this.route(this.spot, step * pace * far, step);
  }

  private pose(step: number, viewer: Point, still: boolean): Placement {
    const figure = this.figure;
    const t = still ? 0 : this.clock;
    const ta = still ? 0 : this.actionClock;
    /** Walking: her arms swing with her legs instead of on their own; her head lolls and nods with her steps. */
    const walking = this.action === "walk" && !still && !this.halted;
    if (walking && step) this.walkOn(step);
    const at: Placement = { ...this.spot, front: this.front(still) };
    figure.rest();

    // ---- the body: what the action does ----
    /** How far the action bends her chest forward; her head makes up for it. */
    let lean = 0;
    let headDrop = 0;
    /** Her tail's root, tipped back off the floor; her arms' rest: tipped forward (negative), and in. */
    let tailLift = 0;
    let upperArm = 0;
    let armIn = 0;
    /** Her forearms folded in toward each other (left arm), and her right arm raised so it lies over the left. */
    let foreIn = 0;
    let rightOver = 0;
    let loll = 0;
    let nod = 0;
    if (this.action === "crouch") {
      // Down on her heels. The ankle under the hip, worked out from the leg's two bones; the whole of her drops
      // by what the legs lost, and the bones fold so her feet stay where they were.
      const { depth } = this.crouch;
      const s = CROUCH_SHIN + CROUCH_SHIN_MORE * depth;
      const a = CROUCH_THIGH + CROUCH_THIGH_MORE * depth;
      const rise = THIGH_LENGTH * -Math.cos(a) - SHIN_LENGTH * Math.cos(s);
      const ahead = THIGH_LENGTH * Math.sin(a) - SHIN_LENGTH * Math.sin(s);
      headDrop = THIGH_LENGTH + SHIN_LENGTH + rise;
      figure.shift(0, -headDrop, -ahead);
      const { knees, lean: forward, arms, armsIn } = this.crouch;
      this.thighs.forEach((bone, i) => figure.turn(bone, 0, -a, i === 0 ? -knees : knees));
      for (const bone of this.shins) figure.turn(bone, 0, a + s);
      for (const bone of this.feet) figure.turn(bone, 0, -s);
      lean = forward;
      // Straight out over her knees, measured from hanging down whatever her chest's lean.
      upperArm = -forward - arms;
      armIn = armsIn;
      // Back along the floor, or it would go through it.
      tailLift = 1.0;
    } else if (this.action === "sit") {
      // Seat on the floor. Each thigh is raised, and its shin reaches down from the knee to put the foot flat on
      // the floor in front of her.
      const { seat, knees, spread, lean: forward, arms, fold, feet } = this.sit;
      figure.shift(0, seat - HIP_HEIGHT, 0);
      headDrop = HIP_HEIGHT - seat;
      this.thighs.forEach((thigh, i) => {
        const a = knees - (i === 1 ? SIT_UNEVEN : 0);
        const kneeHeight = seat - THIGH_LENGTH * Math.cos(a);
        const s = Math.acos(clamp((kneeHeight - ANKLE_HEIGHT) / SHIN_LENGTH, -1, 1));
        figure.turn(thigh, 0, -a, i === 0 ? -spread : spread);
        figure.turn(this.shins[i], 0, a - s);
        figure.turn(this.feet[i], 0, s * feet);
      });
      lean = forward;
      upperArm = -forward - arms;
      foreIn = fold;
      rightOver = 0.15;
      // Lying flat behind her.
      tailLift = 1.4;
    } else if (this.action === "perch") {
      // On the edge: her seat on it, thighs out level over the edge, shins hanging from the knee and swinging, if she
      // swings them, one leg against the other.
      figure.shift(0, PERCH_SEAT - HIP_HEIGHT, 0);
      headDrop = HIP_HEIGHT - PERCH_SEAT;
      const swing = this.swingLegs ? PERCH_SWING : 0;
      this.thighs.forEach((thigh, i) => {
        const kick = swing * Math.sin(ta * PERCH_SWING_RATE * Math.PI * 2 + (i === 1 ? Math.PI : 0));
        figure.turn(thigh, 0, -Math.PI / 2 + (i === 1 ? 0.06 : 0), i === 0 ? -PERCH_SPREAD : PERCH_SPREAD);
        figure.turn(this.shins[i], 0, Math.PI / 2 - kick);
        figure.turn(this.feet[i], 0, 0.35 + kick * 0.3);
      });
      lean = 0.12;
      // Hands down beside her, on the edge.
      upperArm = -0.15;
      armIn = -0.18;
      // Lying flat behind her on what she sits on, as on the floor, not down through it.
      tailLift = 1.4;
    } else if (walking) {
      const { stride, lift, limp, sway, loll: lolls, lean: forward } = this.walk;
      const g = this.gait;
      // Each leg in turn: forward through the air with its knee up, then back along the floor. Whichever reaches
      // lower is the one she's on; she drops by what it lost.
      let reach = 0;
      this.thighs.forEach((thigh, i) => {
        const p = g + (i === 1 ? Math.PI : 0);
        const weak = (limp > 0 ? i === 1 : i === 0) ? 1 - 0.6 * Math.abs(limp) : 1;
        const air = Math.max(0, Math.cos(p));
        const a = -stride * weak * Math.sin(p) - lift * weak * 0.45 * air * air;
        const k = lift * weak * Math.pow(air, 1.5);
        figure.turn(thigh, 0, a);
        figure.turn(this.shins[i], 0, k);
        // On the floor her foot stays flat; in the air it hangs, toes down.
        figure.turn(this.feet[i], 0, -(a + k) * (1 - 0.7 * air));
        reach = Math.max(reach, THIGH_LENGTH * Math.cos(a) + SHIN_LENGTH * Math.cos(a + k));
      });
      headDrop = THIGH_LENGTH + SHIN_LENGTH - reach;
      figure.shift(0, -headDrop, 0);
      // Her body rolls over the foot she's on and twists against her hips; her head lolls a beat behind.
      figure.turn(this.spine, -0.25 * stride * Math.sin(g), 0, sway * Math.sin(g));
      lean = forward;
      loll = lolls * Math.sin(g - 0.6);
      nod = 0.06 * Math.cos(2 * g);
      tailLift = 0.15;
    }

    // Arms: at rest, or hanging loose and swinging round it, the forearms a beat behind.
    const [upperL, upperR] = this.upperArms;
    const [foreL, foreR] = this.foreArms;
    if (walking) {
      // Swinging against her legs, or hanging limp and only jolted by each step.
      const g = this.gait;
      const swing = this.manner.swingArms ? this.walk.stride * 0.9 : 0;
      const jolt = 0.07 * Math.sin(2 * g - 0.5);
      figure.turn(upperL, 0, swing * Math.sin(g) + jolt, 0.04);
      figure.turn(upperR, 0, -swing * Math.sin(g) + jolt, -0.04);
      figure.turn(foreL, 0, -swing * 0.5 * Math.sin(g - 0.7) - 0.1 * swing - jolt);
      figure.turn(foreR, 0, swing * 0.5 * Math.sin(g - 0.7) - 0.1 * swing - jolt);
    } else if (this.holding !== "none") {
      // A burger in both hands in her lap; now and then lifted up to her mouth for a bite, and back.
      let lift = 0;
      if (still) {
        this.biteAt = -1;
      } else if (this.halted) {
        // Talking to the visitor: down it comes, and stays down; no bites.
        this.biteAt = -1;
        this.nextBite = ta + EAT_EVERY;
        lift = Math.max(0, this.lift - step / RAISE_MOVE);
      } else {
        if (this.biteAt < 0 && ta >= this.nextBite) {
          this.nextBite = ta + EAT_EVERY;
          if (Math.random() < EAT_CHANCE) this.biteAt = ta;
        }
        if (this.biteAt >= 0) {
          const into = ta - this.biteAt;
          const ease = (k: number) => k * k * (3 - 2 * k);
          if (into < RAISE_MOVE) lift = ease(into / RAISE_MOVE);
          else if (into < RAISE_MOVE + RAISE_EAT) {
            const eating = into - RAISE_MOVE;
            lift = 1 - NIBBLE * (0.5 - 0.5 * Math.cos(eating * NIBBLE_RATE * Math.PI * 2));
          } else if (into < RAISE_MOVE * 2 + RAISE_EAT) {
            lift = ease(1 - (into - RAISE_MOVE - RAISE_EAT) / RAISE_MOVE);
          } else {
            this.biteAt = -1;
            this.nextBite = ta + EAT_EVERY;
          }
        }
      }
      this.lift = lift;
      const upper = HOLD_UPPER + RAISE_UPPER * lift;
      const fore = HOLD_FORE + RAISE_FORE * lift;
      figure.turn(upperL, 0, upper, HOLD_IN);
      figure.turn(upperR, 0, upper, -HOLD_IN);
      figure.turn(foreL, 0, fore, HOLD_FORE_IN);
      figure.turn(foreR, 0, fore, -HOLD_FORE_IN);
    } else {
      const w = ta * 2.2;
      const swing = this.manner.swingArms && !ARMS_BUSY.has(this.action) ? 1 : 0;
      figure.turn(upperL, 0, upperArm + swing * 0.3 * Math.sin(w), armIn - swing * 0.06);
      figure.turn(upperR, 0, upperArm - rightOver + swing * 0.3 * Math.sin(w - 0.25), -armIn + swing * 0.06);
      figure.turn(foreL, 0, swing * 0.2 * Math.sin(w - 0.6), foreIn);
      figure.turn(foreR, 0, swing * 0.2 * Math.sin(w - 0.85), -foreIn);
    }

    // ---- the head: what she looks at ----
    const target = this.watching ? viewer : this.gaze;
    let wantYaw = 0;
    let wantPitch = this.watching ? 0 : REST_NOD[this.action];
    let wantStrain = 0;
    if (target) {
      // The target in her own space, from her head.
      const [fx, fy, fz] = at.front;
      const [ux, uy, uz] = at.up;
      const rx = fy * uz - fz * uy;
      const ry = fz * ux - fx * uz;
      const rz = fx * uy - fy * ux;
      const dx = target[0] - at.x;
      const dy = target[1] - at.y;
      const dz = target[2] - at.z;
      const lx = dx * rx + dy * ry + dz * rz - this.headJoint[0];
      const ly = dx * ux + dy * uy + dz * uz - this.headJoint[1] + headDrop;
      const lz = dx * fx + dy * fy + dz * fz - this.headJoint[2];
      const level = Math.hypot(lx, lz);
      const yaw = Math.atan2(lx, lz);
      // Straight over her head, which way to turn means little: turn less.
      wantYaw = clamp(yaw, -HEAD_REACH, HEAD_REACH) * Math.min(1, level / (0.5 * Math.hypot(level, ly) || 1));
      wantPitch = clamp(-Math.atan2(ly, level), -HEAD_BACK, HEAD_DOWN);
      // Further round than her head goes: she tilts it instead.
      const over = Math.abs(yaw) - HEAD_REACH;
      if (over > 0) wantStrain = Math.min(STRAIN_TILT, over * 0.5) * (yaw > 0 ? -1 : 1);
    }
    const speed = SLOW_TO_NOTICE.has(this.action) ? SLOW_HEAD_SPEED : HEAD_SPEED;
    // The first pose looks straight there; after that her head catches up.
    const k = step ? Math.min(1, step * speed) : 1;
    const before = this.headYaw;
    this.headYaw += (wantYaw - this.headYaw) * k;
    this.headPitch += (wantPitch - this.headPitch) * k;
    this.headStrain += (wantStrain - this.headStrain) * k;
    this.headSwing = step ? (this.headYaw - before) / step : 0;

    // Looking at something of her own, not at the visitor, she tips her head to one side.
    let tilt = (still ? 0 : 0.05 * Math.sin(t * 0.9)) + this.headStrain + loll + (this.watching ? 0 : this.curious);
    if (!still) {
      this.nextTwitch -= step;
      if (this.nextTwitch <= 0) {
        this.nextTwitch = TWITCH_MIN + Math.random() * (TWITCH_MAX - TWITCH_MIN);
        this.twitchLeft = TWITCH_TIME;
        this.twitchSide = Math.random() < 0.5 ? -1 : 1;
      }
      if (this.twitchLeft > 0) {
        this.twitchLeft -= step;
        tilt += 0.4 * this.twitchSide;
      }
    }
    // Looking up or down, her chest helps a little.
    const breath = still ? 0 : 0.012 * Math.sin(t * 1.7);
    figure.turn(this.chest, 0, lean + breath + this.headPitch * 0.2);
    figure.turn(this.neck, this.headYaw * 0.3, this.headPitch * 0.3);
    figure.turn(this.head, this.headYaw * 0.7, this.headPitch * 0.5 - lean + nod, tilt);

    // ---- hair and tail ----
    // Her hair trails her head when it turns, and otherwise sways a little.
    const trail = clamp(-this.headSwing * 0.09, -0.3, 0.3);
    const sway = still ? 0 : 1;
    // Her head tipped back further than her back (looking up, or straight ahead while she leans forward) would swing
    // her long hair forward through her; it turns back to hang down her back instead.
    const backward = Math.max(0, lean - this.headPitch * 0.8);
    this.hairBack.forEach((bone, i) => {
      const k = (i + 1) / 4;
      figure.turn(bone, trail * k, (i === 0 ? backward : 0) + sway * 0.035 * k * Math.sin(t * 1.3 - 0.6 * i));
    });
    for (const [bones, side] of [[this.hairLeft, 1], [this.hairRight, -1]] as const) {
      bones.forEach((bone, i) => {
        const k = (i + 1) / 3;
        figure.turn(bone, trail * k, 0, sway * side * 0.05 * k * Math.sin(t * 1.1 - 0.5 * i + 0.8));
      });
    }

    // Her tail: up and swinging slowly, or down with a slow wave running along it.
    if (this.manner.tailUp) {
      const sweep = 0.35 * Math.sin(ta * 0.9);
      this.tail.forEach((bone, i) => {
        if (i === 0) figure.turn(bone, sweep, 1.1);
        else figure.turn(bone, sweep * 0.3 * Math.sin(ta * 0.9 - 0.7 * i), 0.15);
      });
    } else {
      this.tail.forEach((bone, i) => {
        const a = t * 2.6 - 0.75 * i;
        figure.turn(
          bone,
          sway * (0.11 + 0.065 * i) * Math.sin(a) + (walking && i === 0 ? 0.25 * Math.sin(this.gait) : 0),
          sway * 0.05 * Math.sin(a + 1.2) + (i === 0 ? tailLift : 0),
        );
      });
    }
    return at;
  }
}
