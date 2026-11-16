import { Figure, type FigureModel } from "./engine/figure";
import type { StatueMesh } from "./engine/statue";

/*
 * XN, standing in her backrooms. For now she only stands where she's put and keeps her eye on the visitor: her head
 * follows them, her tail and hair move, and once in a while her head twitches. Where and when she turns up, and what
 * she says, come later.
 *
 * She moves like a cheap game's character: her pose is only worked out a few times a second.
 */

/** How close the visitor can come to her middle. */
export const XN_RADIUS = 0.24;
/** Poses per second. */
const POSE_RATE = 10;
/** How far her head turns to follow, in radians, and how fast it catches up, per second. */
const HEAD_REACH = 1.25;
const HEAD_SPEED = 5;
/** Seconds between twitches, at least and at most, and how long one lasts. */
const TWITCH_MIN = 4;
const TWITCH_MAX = 11;
const TWITCH_TIME = 0.2;

const TAIL = ["tail_1", "tail_2", "tail_3", "tail_4", "tail_5"];
const HAIR_BACK = ["hair_back_1", "hair_back_2", "hair_back_3", "hair_back_4"];
const HAIR_LEFT = ["hair_side_l_1", "hair_side_l_2", "hair_side_l_3"];
const HAIR_RIGHT = ["hair_side_r_1", "hair_side_r_2", "hair_side_r_3"];

export class Xn {
  x: number;
  y: number;
  /** The way her body faces, in radians. */
  facing: number;
  readonly figure: Figure;
  private readonly neck: number;
  private readonly head: number;
  private readonly chest: number;
  private readonly tail: number[];
  private readonly hairBack: number[];
  private readonly hairLeft: number[];
  private readonly hairRight: number[];
  private clock = 0;
  /** Counts down to the next pose. */
  private wait = 0;
  private headYaw = 0;
  /** How fast her head was turning at the last pose: her hair trails behind it. */
  private headSwing = 0;
  private nextTwitch = TWITCH_MIN + Math.random() * (TWITCH_MAX - TWITCH_MIN);
  private twitchLeft = 0;
  private twitchSide = 1;
  private mesh: StatueMesh | null = null;

  constructor(model: FigureModel, x: number, y: number, facing: number) {
    this.x = x;
    this.y = y;
    this.facing = facing;
    const figure = new Figure(model);
    this.figure = figure;
    this.neck = figure.bone("neck");
    this.head = figure.bone("head");
    this.chest = figure.bone("chest");
    this.tail = TAIL.map((name) => figure.bone(name));
    this.hairBack = HAIR_BACK.map((name) => figure.bone(name));
    this.hairLeft = HAIR_LEFT.map((name) => figure.bone(name));
    this.hairRight = HAIR_RIGHT.map((name) => figure.bone(name));
  }

  /**
   * Moves her on by dt seconds, watching the visitor at (px, py), and returns her mesh to draw. With `still` she
   * does nothing of her own accord (reduced motion): her head still follows, since that answers the visitor.
   */
  update(dt: number, px: number, py: number, still: boolean): StatueMesh {
    this.clock += dt;
    this.wait -= dt;
    if (this.mesh && this.wait > 0) return this.mesh;
    const step = this.mesh ? 1 / POSE_RATE : 0;
    this.wait = 1 / POSE_RATE;
    this.pose(step, px, py, still);
    this.mesh = this.figure.place(this.x, this.y, this.facing);
    return this.mesh;
  }

  private pose(step: number, px: number, py: number, still: boolean) {
    const figure = this.figure;
    const t = still ? 0 : this.clock;

    // Where the visitor is, seen from her: along her front and across her.
    const dx = px - this.x;
    const dy = py - this.y;
    const fx = Math.cos(this.facing);
    const fy = Math.sin(this.facing);
    const ahead = dx * fx + dy * fy;
    const across = dx * fy - dy * fx;
    let want = Math.atan2(across, ahead);
    if (want > HEAD_REACH) want = HEAD_REACH;
    if (want < -HEAD_REACH) want = -HEAD_REACH;
    const before = this.headYaw;
    // The first pose looks straight at them; after that her head catches up.
    this.headYaw += (want - this.headYaw) * (step ? Math.min(1, step * HEAD_SPEED) : 1);
    this.headSwing = step ? (this.headYaw - before) / step : 0;

    let tilt = still ? 0 : 0.05 * Math.sin(t * 0.9);
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
    figure.turn(this.neck, this.headYaw * 0.3);
    figure.turn(this.head, this.headYaw * 0.7, 0, tilt);
    figure.turn(this.chest, 0, still ? 0 : 0.012 * Math.sin(t * 1.7));

    // Her hair trails her head when it turns, and otherwise sways a little.
    let trail = -this.headSwing * 0.09;
    if (trail > 0.3) trail = 0.3;
    if (trail < -0.3) trail = -0.3;
    const sway = still ? 0 : 1;
    this.hairBack.forEach((bone, i) => {
      const k = (i + 1) / 4;
      figure.turn(bone, trail * k, sway * 0.035 * k * Math.sin(t * 1.3 - 0.6 * i));
    });
    for (const [bones, side] of [[this.hairLeft, 1], [this.hairRight, -1]] as const) {
      bones.forEach((bone, i) => {
        const k = (i + 1) / 3;
        figure.turn(bone, trail * k, 0, sway * side * 0.05 * k * Math.sin(t * 1.1 - 0.5 * i + 0.8));
      });
    }

    // Her tail: a slow wave running down it.
    this.tail.forEach((bone, i) => {
      const a = t * 2.6 - 0.75 * i;
      figure.turn(bone, sway * (0.11 + 0.065 * i) * Math.sin(a), sway * 0.05 * Math.sin(a + 1.2));
    });
  }
}
