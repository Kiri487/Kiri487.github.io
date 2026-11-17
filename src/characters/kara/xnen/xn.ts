import { clamp } from "../../../shared/math";
import { Figure, type FigureModel, type Placement } from "./engine/figure";
import type { StatueMesh } from "./engine/statue";

/*
 * XN in her backrooms. She stands on the floor, hangs from the ceiling or sticks out of a wall, and does one thing
 * where she is: stands, stares at a light or the carpet, faces the wall, crouches, sits hugging her knees, or turns
 * on the spot. On top of any of them her tail can be up or down, and her arms still or swinging. She minds her own
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

export type XnAction = "stand" | "lamp" | "carpet" | "faceWall" | "crouch" | "sit" | "spin";

/** Everything she can do, in the dev panel's order. */
export const XN_ACTIONS: readonly XnAction[] = ["stand", "lamp", "carpet", "faceWall", "crouch", "sit", "spin"];

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

/** Hanging from the ceiling over (x, y), her front toward `facing`. */
export function ceilingSpot(x: number, y: number, facing: number): XnSpot {
  return { surface: "ceiling", x, y, z: 1 - GAP, up: [0, 0, -1], front: [Math.cos(facing), Math.sin(facing), 0] };
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

/** Her arms are busy (on her knees): they never swing. */
const ARMS_BUSY = new Set<XnAction>(["crouch", "sit"]);

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
  private readonly neck: number;
  private readonly head: number;
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
  private mesh: StatueMesh | null = null;

  constructor(model: FigureModel, spot: XnSpot) {
    this.spot = spot;
    const figure = new Figure(model);
    this.figure = figure;
    const pair = (name: string): [number, number] => [figure.bone(`${name}_l`), figure.bone(`${name}_r`)];
    this.neck = figure.bone("neck");
    this.head = figure.bone("head");
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
    this.actionClock = 0;
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
    this.mesh = this.figure.place(this.pose(step, viewer, still));
    return this.mesh;
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

  private pose(step: number, viewer: Point, still: boolean): Placement {
    const figure = this.figure;
    const t = still ? 0 : this.clock;
    const ta = still ? 0 : this.actionClock;
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
    }

    // Arms: at rest, or hanging loose and swinging round it, the forearms a beat behind.
    const w = ta * 2.2;
    const swing = this.manner.swingArms && !ARMS_BUSY.has(this.action) ? 1 : 0;
    const [upperL, upperR] = this.upperArms;
    const [foreL, foreR] = this.foreArms;
    figure.turn(upperL, 0, upperArm + swing * 0.3 * Math.sin(w), armIn - swing * 0.06);
    figure.turn(upperR, 0, upperArm - rightOver + swing * 0.3 * Math.sin(w - 0.25), -armIn + swing * 0.06);
    figure.turn(foreL, 0, swing * 0.2 * Math.sin(w - 0.6), foreIn);
    figure.turn(foreR, 0, swing * 0.2 * Math.sin(w - 0.85), -foreIn);

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

    let tilt = (still ? 0 : 0.05 * Math.sin(t * 0.9)) + this.headStrain;
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
    figure.turn(this.head, this.headYaw * 0.7, this.headPitch * 0.5 - lean, tilt);

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
          sway * (0.11 + 0.065 * i) * Math.sin(a),
          sway * 0.05 * Math.sin(a + 1.2) + (i === 0 ? tailLift : 0),
        );
      });
    }
    return at;
  }
}
