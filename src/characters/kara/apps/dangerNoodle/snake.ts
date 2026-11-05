/** The rules, kept apart from the screen. Every move returns a new game and leaves the old one alone. */

export const SIZE = 20;

export type Direction = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "over";

export interface Noodle {
  /** Cell indices, head first. */
  body: number[];
  direction: Direction;
  /** Turns pressed faster than it moves, kept so none of them are lost. Two at most. */
  queued: Direction[];
  burger: number;
  score: number;
  status: Status;
}

const OPPOSITE: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };

/** How long a step takes: it speeds up every few burgers, to a limit. */
const START_MS = 220;
const FASTEST_MS = 70;
const FASTER_BY_MS = 10;
const BURGERS_PER_SPEED_UP = 5;

export function stepMs(score: number): number {
  return Math.max(FASTEST_MS, START_MS - Math.floor(score / BURGERS_PER_SPEED_UP) * FASTER_BY_MS);
}

function at(row: number, col: number): number {
  return row * SIZE + col;
}

/** Anywhere the noodle isn't. On a full board, nowhere: -1. */
function placeBurger(body: number[]): number {
  const taken = new Set(body);
  const free: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!taken.has(i)) free.push(i);
  return free.length === 0 ? -1 : free[Math.floor(Math.random() * free.length)];
}

/** Three long, in the middle, facing right. */
export function newNoodle(): Noodle {
  const row = Math.floor(SIZE / 2);
  const col = Math.floor(SIZE / 2);
  const body = [at(row, col), at(row, col - 1), at(row, col - 2)];
  return { body, direction: "right", queued: [], burger: placeBurger(body), score: 0, status: "ready" };
}

/** A turn, queued for the next step. Back into itself doesn't count. The first one starts the game. */
export function turn(noodle: Noodle, direction: Direction): Noodle {
  if (noodle.status === "over") return noodle;
  const last = noodle.queued[noodle.queued.length - 1] ?? noodle.direction;
  const status = noodle.status === "ready" ? "playing" : noodle.status;
  if (direction === last || direction === OPPOSITE[last] || noodle.queued.length >= 2) {
    return status === noodle.status ? noodle : { ...noodle, status };
  }
  return { ...noodle, status, queued: [...noodle.queued, direction] };
}

export interface StepResult {
  noodle: Noodle;
  ate: boolean;
}

/** One step forward: into a burger and it grows, into a wall or itself and it's over. */
export function step(noodle: Noodle): StepResult {
  if (noodle.status !== "playing") return { noodle, ate: false };
  const [direction = noodle.direction, ...queued] = noodle.queued;
  const head = noodle.body[0];
  const row = Math.floor(head / SIZE);
  const col = head % SIZE;
  const next = {
    up: [row - 1, col],
    down: [row + 1, col],
    left: [row, col - 1],
    right: [row, col + 1],
  }[direction];

  const [nextRow, nextCol] = next;
  const outside = nextRow < 0 || nextRow >= SIZE || nextCol < 0 || nextCol >= SIZE;
  const nextHead = at(nextRow, nextCol);
  const ate = !outside && nextHead === noodle.burger;
  // The tail moves out of the way this step, unless it's growing.
  const stays = ate ? noodle.body : noodle.body.slice(0, -1);

  if (outside || stays.includes(nextHead)) {
    return { noodle: { ...noodle, direction, queued, status: "over" }, ate: false };
  }

  const body = [nextHead, ...stays];
  if (!ate) return { noodle: { ...noodle, body, direction, queued }, ate };

  const burger = placeBurger(body);
  // Nowhere left to put one: the board is all noodle, which is as over as it gets.
  const status = burger === -1 ? "over" : "playing";
  return { noodle: { ...noodle, body, direction, queued, burger, score: noodle.score + 1, status }, ate };
}
