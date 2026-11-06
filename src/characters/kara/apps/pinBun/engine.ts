/*
 * Pin Bun's table and everything that happens on it: the shapes, the ball's physics and the scoring. No React and
 * no drawing, so it runs the same whether anyone is watching. Units are the table's own pixels, y pointing down,
 * the way the table is drawn.
 */

export const WIDTH = 400;
export const HEIGHT = 720;
export const BALL_RADIUS = 9;
export const BALLS_PER_GAME = 3;

/** Down the table, which leans away from the player. */
const GRAVITY = 1100;
/** Small enough that the ball can't move more than its own radius in one, so it never skips through a wall. */
const SUBSTEP = 1 / 480;
const MAX_SPEED = 2600;
const AIR_DRAG = 0.05;

export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

interface Wall extends Segment {
  /** "sling" kicks the ball back. "gate" only stops the ball from the table's side, so the lane can shoot through. */
  kind: "wall" | "sling" | "gate";
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

function seg(ax: number, ay: number, bx: number, by: number, kind: Wall["kind"] = "wall"): Wall {
  return { ax, ay, bx, by, kind };
}

// ---------------------------------------------------------------------------------------------------------------
// The table. Symmetric around x = 186, the middle of the playfield; the plunger lane takes the right edge.

export const PLAYFIELD_MIDDLE = 186;
/** The plunger lane, between the playfield's right wall and the cabinet's. */
export const LANE = { left: 360, right: 388, floor: 680, top: 250 };
/** The round top of the table. */
export const ARC = { x: 200, y: 200, r: 188 };
const ARC_PIECES = 28;

function arcWalls(): Wall[] {
  const walls: Wall[] = [];
  for (let i = 0; i < ARC_PIECES; i++) {
    const from = Math.PI + (Math.PI * i) / ARC_PIECES;
    const to = Math.PI + (Math.PI * (i + 1)) / ARC_PIECES;
    walls.push(
      seg(
        ARC.x + ARC.r * Math.cos(from),
        ARC.y + ARC.r * Math.sin(from),
        ARC.x + ARC.r * Math.cos(to),
        ARC.y + ARC.r * Math.sin(to),
      ),
    );
  }
  return walls;
}

/** The two triangles above the flippers. Their inner edge is the one that kicks. */
export const SLINGS: { a: [number, number]; b: [number, number]; c: [number, number] }[] = [
  { a: [42, 450], b: [42, 520], c: [96, 556] },
  { a: [330, 450], b: [330, 520], c: [276, 556] },
];

export const WALLS: Wall[] = [
  ...arcWalls(),
  // The cabinet's sides.
  seg(12, 540, 12, 200),
  seg(388, 200, 388, 720),
  // The plunger lane: its wall, the plunger's resting top, and the gate that keeps the ball out once it's left.
  seg(LANE.left, LANE.top, LANE.left, 720),
  seg(LANE.left, LANE.floor, LANE.right, LANE.floor),
  seg(LANE.left, LANE.top, LANE.right, LANE.top - 18, "gate"),
  // Down to the flippers.
  seg(12, 540, 118, 628),
  seg(360, 540, 254, 628),
  // The sides of the drain, so a ball rattling around down there can't slip under the guides.
  seg(118, 628, 118, 720),
  seg(254, 628, 254, 720),
  // The slingshots.
  ...SLINGS.flatMap(({ a, b, c }) => [seg(...a, ...b), seg(...b, ...c), seg(...c, ...a, "sling")]),
  // Posts between the three lanes at the top.
  ...[117, 163, 209, 255].map((x) => seg(x, 92, x, 135)),
  // The straw's mouth: two sides, and a cap so a ball coming down from above can't drop in backwards.
  seg(287, 406, 289, 374),
  seg(313, 406, 311, 374),
  seg(289, 374, 311, 374),
];

/** The three burgers, in a triangle that's a little off on purpose. */
export const BUMPERS: Circle[] = [
  { x: 122, y: 252, r: 24 },
  { x: 236, y: 236, r: 24 },
  { x: 178, y: 322, r: 24 },
];

/** The lanes at the top, lit by rolling through them: 4, 2 and 0. */
export const LANES: Circle[] = [140, 186, 232].map((x) => ({ x, y: 115, r: 7 }));
export const LANE_LABELS = ["4", "2", "0"];

/** K, A, R, A, standing in a row along the left wall. */
export const TARGETS: Segment[] = [0, 1, 2, 3].map((i) => ({ ax: 26, ay: 296 + i * 30, bx: 26, by: 320 + i * 30 }));
export const TARGET_LETTERS = ["K", "A", "R", "A"];

/**
 * T, H, U, in a row facing the flippers, right under the days of the week, where Thursday is taped over.
 * Knocking them all down: no Thursday.
 */
export const THU_TARGETS: Segment[] = [0, 1, 2].map((i) => ({ ax: 153 + i * 24, ay: 458, bx: 171 + i * 24, by: 458 }));
export const THU_LETTERS = ["T", "H", "U"];

/**
 * The straw: a ramp up the right side, round a hairpin and down into the right inlane. A ball on it is off the
 * playfield and simply follows the path, slowed going up and sped up coming down; one that runs out of speed
 * rolls back out of the mouth.
 */
/** Where the straw goes, roughly. Smoothed into STRAW below. */
const STRAW_SHAPE: [number, number][] = [
  [300, 402],
  [300, 360],
  [302, 322],
  [308, 298],
  [320, 283],
  [334, 279],
  [345, 286],
  [350, 302],
  [350, 340],
  [348, 400],
  [345, 470],
];

/** Through every point of STRAW_SHAPE, curving smoothly between them (Catmull-Rom), a few steps per piece. */
function smooth(points: [number, number][], steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let n = 0; n < steps; n++) {
      const t = n / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export const STRAW = smooth(STRAW_SHAPE, 6);
/** Where crossing into the mouth starts the ride: a line across it, crossed going up. */
const STRAW_MOUTH = { left: 289, right: 311, y: 400 };
/** It's a smooth plastic tube, so only a little slows the ball down besides going uphill. */
const STRAW_FRICTION = 0.25;

const strawLengths = STRAW.slice(1).map(([x, y], i) => Math.hypot(x - STRAW[i][0], y - STRAW[i][1]));
export const STRAW_LENGTH = strawLengths.reduce((sum, n) => sum + n, 0);

/** Where along the straw `s` is, and which way the straw runs there. */
export function strawAt(s: number): { x: number; y: number; tx: number; ty: number } {
  let rest = Math.max(0, Math.min(STRAW_LENGTH, s));
  for (let i = 0; i < strawLengths.length; i++) {
    const length = strawLengths[i];
    if (rest <= length || i === strawLengths.length - 1) {
      const [ax, ay] = STRAW[i];
      const [bx, by] = STRAW[i + 1];
      const t = Math.min(1, rest / length);
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, tx: (bx - ax) / length, ty: (by - ay) / length };
    }
    rest -= length;
  }
  return { x: STRAW[0][0], y: STRAW[0][1], tx: 0, ty: -1 };
}

/** Mr. Spicy, in his web in the corner. Small, and he'd rather not be hit. */
export const SPICY: Circle = { x: 330, y: 150, r: 8 };
const TARGET_THICKNESS = 3;

export interface FlipperShape {
  x: number;
  y: number;
  rest: number;
  up: number;
}
export const FLIPPER_LENGTH = 48;
export const FLIPPER_RADIUS = 7;
const FLIPPER_UP_SPEED = 30;
const FLIPPER_DOWN_SPEED = 16;
export const FLIPPERS: [FlipperShape, FlipperShape] = [
  { x: 124, y: 638, rest: 0.5, up: -0.5 },
  { x: 248, y: 638, rest: Math.PI - 0.5, up: Math.PI + 0.5 },
];

const SERVE = { x: (LANE.left + LANE.right) / 2, y: LANE.floor - BALL_RADIUS - 0.5 };
/** Holding the plunger this long pulls it all the way back. */
const CHARGE_SECONDS = 0.9;
const LAUNCH_MIN = 700;
const LAUNCH_RANGE = 1500;
const SERVE_DELAY = 1.2;
/** RUSH HOUR's extra meatball out of the plunger lane goes out on its own, this fast. */
const AUTO_LAUNCH = 1800;
/** Straw rides it takes to start RUSH HOUR. */
export const STRAW_RIDES_FOR_RUSH = 3;
const MAX_MULTIPLIER = 5;

const POINTS = {
  bumper: 500,
  sling: 100,
  lane: 1000,
  lanes: 5000,
  target: 750,
  kara: 10000,
  spicy: 2500,
  thu: 750,
  thursday: 7500,
  mission: 25000,
  fourTwenty: 42000,
  straw: 5000,
  jackpot: 50000,
};

/** What the meatball becomes, one mission at a time. */
export const RANKS = ["Meatball", "Patty", "Chickenburger", "Double Double"];

type MissionKind = "burgers" | "kara" | "spicy" | "thursday" | "lanes";

interface Mission {
  kind: MissionKind;
  /** What the display says while it's the one to do. */
  title: string;
  /** How many of it. */
  goal: number;
}

/**
 * Done in order, kept from ball to ball. The first three each make the meatball something better; the last makes
 * it 4:20, after which they start over.
 */
export const MISSIONS: Mission[] = [
  { kind: "burgers", title: "Hit the burgers", goal: 10 },
  { kind: "kara", title: "Spell KARA", goal: 1 },
  { kind: "spicy", title: "Find Mr. Spicy", goal: 1 },
  { kind: "thursday", title: "Thursday does not exist", goal: 1 },
  { kind: "lanes", title: "Light 4:20", goal: 1 },
];
/** How long it's 4:20 for, once it is. */
const FOUR_TWENTY_SECONDS = 20;
/** Hitting Mr. Spicy again this soon is the same hit. */
const SPICY_COOLDOWN = 0.5;
const SPICY_KICK = 380;
const MESSAGE_SECONDS = 2.5;

// ---------------------------------------------------------------------------------------------------------------
// The game.

export type GameEvent =
  | "bumper"
  | "sling"
  | "target"
  | "kara"
  | "lane"
  | "lanes"
  | "spicy"
  | "thursday"
  | "mission"
  /** Promoted: rank is already the new one. */
  | "rank"
  | "fourTwenty"
  | "straw"
  | "rushHour"
  | "jackpot"
  | "rushOver"
  | "launch"
  | "drain"
  | "over";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** How far it has rolled, as an angle, so it can be drawn turning. */
  spin: number;
  /** Riding the straw: how far along it, and how fast. Null on the playfield. */
  straw: { s: number; speed: number } | null;
}

export interface Flipper {
  angle: number;
  /** Radians per second, for how hard it hits. */
  omega: number;
  pressed: boolean;
}

export interface Game {
  time: number;
  status: "playing" | "over";
  /** Every meatball in play. More than one during RUSH HOUR. */
  balls: Ball[];
  /** When the next ball appears in the lane. Infinity while one is out. */
  serveAt: number;
  flippers: [Flipper, Flipper];
  charging: boolean;
  /** How far the plunger is pulled back, 0 to 1. */
  charge: number;
  score: number;
  /** Which ball this is, from 1. */
  ballNumber: number;
  multiplier: number;
  lanesLit: boolean[];
  /** Whether the ball is in each lane right now, so rolling through counts once. */
  inLane: boolean[];
  targetsDown: boolean[];
  /** When the targets stand back up, after all four went down. */
  targetsUpAt: number;
  thuDown: boolean[];
  thuUpAt: number;
  /** Which of RANKS the meatball is. */
  rank: number;
  /** Which of MISSIONS is the one to do, and how far along it is. */
  mission: number;
  missionProgress: number;
  /** When Mr. Spicy was last hit, for him curling up. */
  spicyHitAt: number;
  /** It's 4:20 until then. */
  fourTwentyUntil: number;
  /** Straw rides towards RUSH HOUR. */
  strawRides: number;
  /** When a ball last came out of the straw's far end, for lighting it up. */
  strawAt: number;
  /** More than one meatball out, until it's down to one again. */
  rushHour: boolean;
  /** When each was last hit, for drawing it lit. */
  bumperHits: number[];
  slingHits: number[];
  /** When a ball last went down the drain, for lighting NO REFUNDS. */
  drainedAt: number;
  /** When someone last pressed COIN RETURN, which only ever lights NO REFUNDS. */
  refusedAt: number;
  /** When a whole set was last done (KARA, or the 4:20 lanes), for the table to light up. */
  bonusAt: number;
  message: { text: string; until: number } | null;
  /** What happened since the last time someone looked: for sounds and Kara. Emptied by whoever reads it. */
  events: GameEvent[];
}

export function newGame(): Game {
  return {
    time: 0,
    status: "playing",
    balls: [newBall()],
    serveAt: Infinity,
    flippers: FLIPPERS.map((f) => ({ angle: f.rest, omega: 0, pressed: false })) as [Flipper, Flipper],
    charging: false,
    charge: 0,
    score: 0,
    ballNumber: 1,
    multiplier: 1,
    lanesLit: [false, false, false],
    inLane: [false, false, false],
    targetsDown: [false, false, false, false],
    targetsUpAt: Infinity,
    thuDown: [false, false, false],
    thuUpAt: Infinity,
    rank: 0,
    mission: 0,
    missionProgress: 0,
    spicyHitAt: -Infinity,
    fourTwentyUntil: -Infinity,
    strawRides: 0,
    strawAt: -Infinity,
    rushHour: false,
    bumperHits: BUMPERS.map(() => -Infinity),
    slingHits: SLINGS.map(() => -Infinity),
    drainedAt: -Infinity,
    refusedAt: -Infinity,
    bonusAt: -Infinity,
    message: null,
    events: [],
  };
}

/** A meatball waiting on the plunger. */
function newBall(): Ball {
  return { ...SERVE, vx: 0, vy: 0, spin: 0, straw: null };
}

/** Where a flipper's tip is right now. */
export function flipperTip(index: 0 | 1, angle: number): { x: number; y: number } {
  const { x, y } = FLIPPERS[index];
  return { x: x + FLIPPER_LENGTH * Math.cos(angle), y: y + FLIPPER_LENGTH * Math.sin(angle) };
}

/** The meatball sitting on the plunger, waiting to be launched, if there is one. */
function plungerBall(game: Game): Ball | undefined {
  return game.balls.find(
    (ball) => !ball.straw && ball.x > LANE.left && ball.y > LANE.floor - BALL_RADIUS - 4 && Math.abs(ball.vy) < 60,
  );
}

export function ballOnPlunger(game: Game): boolean {
  return plungerBall(game) !== undefined;
}

export function setFlipper(game: Game, index: 0 | 1, pressed: boolean) {
  game.flippers[index].pressed = pressed && game.status === "playing";
}

export function setCharging(game: Game, charging: boolean) {
  if (game.status !== "playing") return;
  if (charging) {
    game.charging = true;
    return;
  }
  if (!game.charging) return;
  game.charging = false;
  const ball = plungerBall(game);
  if (ball) {
    ball.vy = -(LAUNCH_MIN + LAUNCH_RANGE * game.charge);
    game.events.push("launch");
  }
  game.charge = 0;
}

/** Lets go of everything held, such as when the window loses the keyboard. */
export function releaseAll(game: Game) {
  game.flippers.forEach((f) => (f.pressed = false));
  game.charging = false;
  game.charge = 0;
}

/** The coin door, beside the table. A coin goes in; nothing ever comes back out. */
export function insertCoin(game: Game) {
  say(game, "Coin accepted. Kara ate it.");
}

export function pressCoinReturn(game: Game) {
  game.refusedAt = game.time;
  say(game, "NO REFUNDS");
}

function say(game: Game, text: string) {
  game.message = { text, until: game.time + MESSAGE_SECONDS };
}

function score(game: Game, points: number) {
  game.score += points * game.multiplier;
}

/** Runs the table forward by dt seconds, in small enough steps. */
export function step(game: Game, dt: number) {
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUBSTEP, left);
    substep(game, h);
    left -= h;
  }
}

function substep(game: Game, dt: number) {
  game.time += dt;

  if (game.charging) game.charge = Math.min(1, game.charge + dt / CHARGE_SECONDS);

  game.flippers.forEach((flipper, i) => {
    const shape = FLIPPERS[i];
    const target = flipper.pressed ? shape.up : shape.rest;
    const speed = flipper.pressed ? FLIPPER_UP_SPEED : FLIPPER_DOWN_SPEED;
    const turn = Math.max(-speed * dt, Math.min(speed * dt, target - flipper.angle));
    flipper.angle += turn;
    flipper.omega = turn / dt;
  });

  if (game.thuUpAt <= game.time) {
    game.thuDown = game.thuDown.map(() => false);
    game.thuUpAt = Infinity;
  }

  if (game.targetsUpAt <= game.time) {
    game.targetsDown = game.targetsDown.map(() => false);
    game.targetsUpAt = Infinity;
  }

  if (game.serveAt <= game.time) {
    game.serveAt = Infinity;
    game.balls.push(newBall());
  }

  for (const ball of game.balls) {
    if (ball.straw) rideStraw(game, ball, dt);
    else moveBall(game, ball, dt);
  }
  collideBalls(game);

  // Gone off the bottom. The last one out is a lost ball; before that, it's the end of RUSH HOUR.
  const before = game.balls.length;
  game.balls = game.balls.filter((ball) => ball.straw || ball.y <= HEIGHT + BALL_RADIUS * 2);
  if (game.balls.length === before) return;
  if (game.balls.length === 0) drain(game);
  else if (game.rushHour && game.balls.length === 1) {
    game.rushHour = false;
    say(game, "Rush hour is over");
    game.events.push("rushOver");
  }
}

function moveBall(game: Game, ball: Ball, dt: number) {
  const fromY = ball.y;
  ball.vy += GRAVITY * dt;
  const drag = 1 - AIR_DRAG * dt;
  ball.vx *= drag;
  ball.vy *= drag;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed;
    ball.vy *= MAX_SPEED / speed;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.spin += (speed * dt) / BALL_RADIUS;

  collideWalls(game, ball);
  collideBumpers(game, ball);
  collideTargets(game, ball);
  collideThu(game, ball);
  collideSpicy(game, ball);
  collideFlippers(game, ball);
  checkLanes(game, ball);

  // Into the straw: crossing its mouth going up.
  if (
    fromY > STRAW_MOUTH.y &&
    ball.y <= STRAW_MOUTH.y &&
    ball.x > STRAW_MOUTH.left &&
    ball.x < STRAW_MOUTH.right &&
    ball.vy < 0
  ) {
    const { tx, ty } = strawAt(0);
    ball.straw = { s: 0, speed: Math.max(0, ball.vx * tx + ball.vy * ty) };
  }
}

/** Along the straw: slowed going up, sped up coming down, and back onto the playfield at either end. */
function rideStraw(game: Game, ball: Ball, dt: number) {
  const straw = ball.straw;
  if (!straw) return;
  const here = strawAt(straw.s);
  straw.speed += GRAVITY * here.ty * dt;
  straw.speed *= 1 - STRAW_FRICTION * dt;
  straw.s += straw.speed * dt;
  ball.spin += (Math.abs(straw.speed) * dt) / BALL_RADIUS;

  const at = strawAt(straw.s);
  ball.x = at.x;
  ball.y = at.y;
  if (straw.s <= 0) {
    // Not enough to make it: back out of the mouth, the way it came.
    ball.straw = null;
    ball.y = STRAW_MOUTH.y + 2;
    ball.vx = straw.speed * at.tx;
    ball.vy = straw.speed * at.ty;
    return;
  }
  if (straw.s < STRAW_LENGTH) return;
  ball.straw = null;
  ball.vx = straw.speed * at.tx;
  ball.vy = straw.speed * at.ty;
  finishStraw(game);
}

function finishStraw(game: Game) {
  game.strawAt = game.time;
  if (game.rushHour) {
    score(game, POINTS.jackpot);
    game.bonusAt = game.time;
    say(game, "JACKPOT!");
    game.events.push("jackpot");
    return;
  }
  score(game, POINTS.straw);
  game.strawRides++;
  if (game.strawRides < STRAW_RIDES_FOR_RUSH) {
    say(game, `Straw ${game.strawRides}/${STRAW_RIDES_FOR_RUSH}`);
    game.events.push("straw");
    return;
  }
  // RUSH HOUR: two more meatballs, one fired out of the plunger lane, one sent round the straw.
  game.strawRides = 0;
  game.rushHour = true;
  game.bonusAt = game.time;
  const fired = newBall();
  fired.vy = -AUTO_LAUNCH;
  const riding = newBall();
  riding.straw = { s: STRAW_LENGTH * 0.45, speed: 120 };
  const start = strawAt(riding.straw.s);
  riding.x = start.x;
  riding.y = start.y;
  game.balls.push(fired, riding);
  say(game, "RUSH HOUR!");
  game.events.push("rushHour");
}

const BALL_BOUNCE = 0.9;

/** Meatballs knocking into each other, on the playfield. The same weight, so they share the push. */
function collideBalls(game: Game) {
  const loose = game.balls.filter((ball) => !ball.straw);
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i];
      const b = loose[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= BALL_RADIUS * 2 || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = BALL_RADIUS * 2 - d;
      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) continue;
      const push = ((1 + BALL_BOUNCE) * closing) / 2;
      a.vx -= push * nx;
      a.vy -= push * ny;
      b.vx += push * nx;
      b.vy += push * ny;
    }
  }
}

/** What hitting something did: which way it pushed the ball, and how fast the ball was going into it. */
interface Hit {
  nx: number;
  ny: number;
  /** Negative: towards the thing that was hit. */
  vn: number;
}

/**
 * Keeps the ball out of a thick segment, bouncing it off. `surface` is how fast that point of the segment is moving,
 * for flippers.
 */
function collideSegment(
  ball: Ball,
  s: Segment,
  thickness: number,
  restitution: number,
  surface?: (x: number, y: number) => { x: number; y: number },
): Hit | null {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const t = Math.max(0, Math.min(1, ((ball.x - s.ax) * dx + (ball.y - s.ay) * dy) / (dx * dx + dy * dy)));
  const cx = s.ax + t * dx;
  const cy = s.ay + t * dy;
  const ex = ball.x - cx;
  const ey = ball.y - cy;
  const reach = BALL_RADIUS + thickness;
  const d2 = ex * ex + ey * ey;
  if (d2 >= reach * reach) return null;
  const d = Math.sqrt(d2);
  // Dead on the line: push it out sideways, which is as good a guess as any.
  const nx = d > 1e-6 ? ex / d : -dy / Math.hypot(dx, dy);
  const ny = d > 1e-6 ? ey / d : dx / Math.hypot(dx, dy);
  ball.x = cx + nx * reach;
  ball.y = cy + ny * reach;
  const moving = surface ? surface(cx, cy) : { x: 0, y: 0 };
  const vn = (ball.vx - moving.x) * nx + (ball.vy - moving.y) * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }
  return { nx, ny, vn };
}

/** Kicks never go quite the same way twice, or a ball can bounce between the two slingshots forever. */
const KICK_WOBBLE = 0.12;

/** Speeds the ball up away from whatever it hit, to at least about this. */
function kick(ball: Ball, hit: Hit, speed: number) {
  const wobble = (Math.random() * 2 - 1) * KICK_WOBBLE;
  const nx = hit.nx * Math.cos(wobble) - hit.ny * Math.sin(wobble);
  const ny = hit.nx * Math.sin(wobble) + hit.ny * Math.cos(wobble);
  const target = speed * (0.85 + Math.random() * 0.3);
  const out = ball.vx * nx + ball.vy * ny;
  if (out >= target) return;
  ball.vx += (target - out) * nx;
  ball.vy += (target - out) * ny;
}

const WALL_BOUNCE = 0.45;
const SLING_KICK = 560;
/** Rolling gently against a slingshot isn't hitting it. */
const SLING_MIN_HIT = 120;

function collideWalls(game: Game, ball: Ball) {
  for (const wall of WALLS) {
    if (wall.kind === "gate") {
      // Only from the table's side: up and to the left of it, where this comes out negative.
      const side = (ball.x - wall.ax) * (wall.ay - wall.by) + (ball.y - wall.ay) * (wall.bx - wall.ax);
      if (side >= 0) continue;
    }
    const hit = collideSegment(ball, wall, 0, WALL_BOUNCE);
    if (!hit) continue;
    if (wall.kind === "sling") {
      if (hit.vn < -SLING_MIN_HIT) {
        kick(ball, hit, SLING_KICK);
        const index = wall.ax < PLAYFIELD_MIDDLE ? 0 : 1;
        game.slingHits[index] = game.time;
        score(game, POINTS.sling);
        game.events.push("sling");
      }
    }
  }
}

const BUMPER_BOUNCE = 0.6;
const BUMPER_KICK = 720;

function collideBumpers(game: Game, ball: Ball) {
  BUMPERS.forEach((bumper, i) => {
    const ex = ball.x - bumper.x;
    const ey = ball.y - bumper.y;
    const reach = BALL_RADIUS + bumper.r;
    const d = Math.hypot(ex, ey);
    if (d >= reach || d < 1e-6) return;
    const hit: Hit = { nx: ex / d, ny: ey / d, vn: 0 };
    ball.x = bumper.x + hit.nx * reach;
    ball.y = bumper.y + hit.ny * reach;
    hit.vn = ball.vx * hit.nx + ball.vy * hit.ny;
    if (hit.vn < 0) {
      ball.vx -= (1 + BUMPER_BOUNCE) * hit.vn * hit.nx;
      ball.vy -= (1 + BUMPER_BOUNCE) * hit.vn * hit.ny;
    }
    kick(ball, hit, BUMPER_KICK);
    game.bumperHits[i] = game.time;
    score(game, POINTS.bumper);
    game.events.push("bumper");
    advance(game, "burgers");
  });
}

const TARGETS_UP_DELAY = 1.5;

function collideTargets(game: Game, ball: Ball) {
  TARGETS.forEach((target, i) => {
    if (game.targetsDown[i]) return;
    if (!collideSegment(ball, target, TARGET_THICKNESS, WALL_BOUNCE)) return;
    game.targetsDown[i] = true;
    score(game, POINTS.target);
    if (game.targetsDown.every(Boolean)) {
      score(game, POINTS.kara);
      game.multiplier = Math.min(MAX_MULTIPLIER, game.multiplier + 1);
      game.targetsUpAt = game.time + TARGETS_UP_DELAY;
      game.bonusAt = game.time;
      say(game, `KARA! Multiplier x${game.multiplier}`);
      game.events.push("kara");
      advance(game, "kara");
    } else {
      say(game, TARGET_LETTERS.map((letter, n) => (game.targetsDown[n] ? letter : "_")).join(" "));
      game.events.push("target");
    }
  });
}

function collideThu(game: Game, ball: Ball) {
  THU_TARGETS.forEach((target, i) => {
    if (game.thuDown[i]) return;
    if (!collideSegment(ball, target, TARGET_THICKNESS, WALL_BOUNCE)) return;
    game.thuDown[i] = true;
    score(game, POINTS.thu);
    if (game.thuDown.every(Boolean)) {
      score(game, POINTS.thursday);
      game.thuUpAt = game.time + TARGETS_UP_DELAY;
      say(game, "Thursday does not exist");
      game.events.push("thursday");
      advance(game, "thursday");
    } else {
      say(game, THU_LETTERS.map((letter, n) => (game.thuDown[n] ? letter : "_")).join(" "));
      game.events.push("target");
    }
  });
}

function collideSpicy(game: Game, ball: Ball) {
  const ex = ball.x - SPICY.x;
  const ey = ball.y - SPICY.y;
  const reach = BALL_RADIUS + SPICY.r;
  const d = Math.hypot(ex, ey);
  if (d >= reach || d < 1e-6) return;
  const hit: Hit = { nx: ex / d, ny: ey / d, vn: 0 };
  ball.x = SPICY.x + hit.nx * reach;
  ball.y = SPICY.y + hit.ny * reach;
  hit.vn = ball.vx * hit.nx + ball.vy * hit.ny;
  if (hit.vn < 0) {
    ball.vx -= (1 + WALL_BOUNCE) * hit.vn * hit.nx;
    ball.vy -= (1 + WALL_BOUNCE) * hit.vn * hit.ny;
  }
  kick(ball, hit, SPICY_KICK);
  if (game.time - game.spicyHitAt < SPICY_COOLDOWN) return;
  game.spicyHitAt = game.time;
  score(game, POINTS.spicy);
  say(game, "Mr. Spicy has been hit. Rude.");
  game.events.push("spicy");
  advance(game, "spicy");
}

/** Counts towards the mission, if it's the one to do. Done, it's the next one, and maybe a better meatball. */
function advance(game: Game, kind: MissionKind) {
  const mission = MISSIONS[game.mission];
  if (mission.kind !== kind) return;
  game.missionProgress++;
  if (game.missionProgress < mission.goal) {
    say(game, `${mission.title} ${game.missionProgress}/${mission.goal}`);
    return;
  }
  score(game, POINTS.mission);
  game.missionProgress = 0;
  game.mission = (game.mission + 1) % MISSIONS.length;
  game.bonusAt = game.time;

  if (game.mission === 0) {
    // That was the last one: it's 4:20.
    score(game, POINTS.fourTwenty);
    game.fourTwentyUntil = game.time + FOUR_TWENTY_SECONDS;
    say(game, "IT'S 4:20");
    game.events.push("fourTwenty");
  } else if (game.rank < RANKS.length - 1) {
    game.rank++;
    say(game, `Promoted: ${RANKS[game.rank]}`);
    game.events.push("rank");
  } else {
    say(game, `Done! Next: ${MISSIONS[game.mission].title}`);
    game.events.push("mission");
  }
}

/** What the display says when nothing's just happened: the mission, and how far along it is. */
export function missionText(game: Game): string {
  const mission = MISSIONS[game.mission];
  return mission.goal > 1 ? `${mission.title} ${game.missionProgress}/${mission.goal}` : mission.title;
}

export function isFourTwenty(game: Game): boolean {
  return game.time < game.fourTwentyUntil;
}

const FLIPPER_BOUNCE = 0.3;

function collideFlippers(game: Game, ball: Ball) {
  game.flippers.forEach((flipper, i) => {
    const index = i as 0 | 1;
    const pivot = FLIPPERS[index];
    const tip = flipperTip(index, flipper.angle);
    collideSegment(ball, { ax: pivot.x, ay: pivot.y, bx: tip.x, by: tip.y }, FLIPPER_RADIUS, FLIPPER_BOUNCE, (x, y) => ({
      x: -flipper.omega * (y - pivot.y),
      y: flipper.omega * (x - pivot.x),
    }));
  });
}

function checkLanes(game: Game, ball: Ball) {
  LANES.forEach((lane, i) => {
    const inside = Math.hypot(ball.x - lane.x, ball.y - lane.y) < lane.r + BALL_RADIUS * 0.6;
    if (inside && !game.inLane[i] && !game.lanesLit[i]) {
      game.lanesLit[i] = true;
      score(game, POINTS.lane);
      if (game.lanesLit.every(Boolean)) {
        score(game, POINTS.lanes);
        game.lanesLit = game.lanesLit.map(() => false);
        game.bonusAt = game.time;
        say(game, "4:20 lanes lit!");
        game.events.push("lanes");
        advance(game, "lanes");
      } else {
        game.events.push("lane");
      }
    }
    game.inLane[i] = inside;
  });
}

function drain(game: Game) {
  game.rushHour = false;
  game.drainedAt = game.time;
  releaseAll(game);
  if (game.ballNumber >= BALLS_PER_GAME) {
    game.status = "over";
    game.message = { text: "Kara is no longer hungry. (this is a lie)", until: Infinity };
    game.events.push("over");
    return;
  }
  game.ballNumber++;
  game.multiplier = 1;
  game.serveAt = game.time + SERVE_DELAY;
  say(game, `Ball ${game.ballNumber}`);
  game.events.push("drain");
}
