import { clamp } from "../../../../shared/math";
import { SPAWN } from "./map";

/** The player's size, for bumping into walls. */
export const PLAYER_RADIUS = 0.22;
/** Cells per second. */
const WALK = 1.5;
const RUN = 2.7;
const TURN = 2.2;
/**
 * How far up or down the visitor can look, as a share of the picture's height the horizon moves. The picture slides
 * rather than turns, so much further and the walls stop looking like walls.
 */
const MAX_PITCH = 0.9;

export interface Move {
  /** -1 to 1: back to forward. */
  forward: number;
  /** -1 to 1: left to right. */
  strafe: number;
  /** -1 to 1: turning left to right, from the arrow keys. */
  turn: number;
  run: boolean;
}

export class Player {
  x = SPAWN.x;
  y = SPAWN.y;
  angle = SPAWN.angle;
  pitch = 0;
  /** Walking bob, in pixels. */
  bob = 0;
  private bobPhase = 0;

  look(dx: number, dy: number, speed: number) {
    this.angle += dx * 0.0026 * speed;
    this.pitch = clamp(this.pitch - dy * 0.0016 * speed, -MAX_PITCH, MAX_PITCH);
  }

  /**
   * Walks, sliding along walls rather than stopping dead. Returns true on a footfall, so a step can be heard;
   * `bobHeight` is the picture's height, which the bob scales with (0 for no bob).
   */
  move(dt: number, input: Move, blocked: (x: number, y: number) => boolean, bobHeight: number): boolean {
    this.angle += input.turn * TURN * dt;
    let f = input.forward;
    let s = input.strafe;
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    const moving = Math.min(1, len);
    const speed = (input.run ? RUN : WALK) * dt;
    const cx = Math.cos(this.angle);
    const cy = Math.sin(this.angle);
    const mx = (cx * f - cy * s) * speed;
    const my = (cy * f + cx * s) * speed;
    if (!blocked(this.x + mx, this.y)) this.x += mx;
    if (!blocked(this.x, this.y + my)) this.y += my;

    if (moving > 0.05) {
      const before = Math.floor(this.bobPhase / Math.PI);
      this.bobPhase += dt * (input.run ? 12 : 8.5) * moving;
      this.bob = bobHeight ? Math.sin(this.bobPhase) * bobHeight * 0.012 * moving : 0;
      return Math.floor(this.bobPhase / Math.PI) !== before;
    }
    this.bob *= 0.85;
    return false;
  }
}
