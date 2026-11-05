/** The rules, kept apart from the screen. Every move returns a new game and leaves the old one alone. */

export interface Cell {
  burger: boolean;
  open: boolean;
  flagged: boolean;
  /** Burgers in the eight cells around it. */
  count: number;
}

export type Status = "ready" | "playing" | "won" | "lost";

export interface Game {
  rows: number;
  cols: number;
  burgers: number;
  cells: Cell[];
  status: Status;
  /** The burger that ended the game, shown apart from the rest. */
  hitIndex: number | null;
  startedAt: number | null;
  endedAt: number | null;
}

export function newGame(rows: number, cols: number, burgers: number): Game {
  const cells = Array.from({ length: rows * cols }, () => ({ burger: false, open: false, flagged: false, count: 0 }));
  return { rows, cols, burgers, cells, status: "ready", hitIndex: null, startedAt: null, endedAt: null };
}

export function neighbors(game: Pick<Game, "rows" | "cols">, index: number): number[] {
  const { rows, cols } = game;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) result.push(r * cols + c);
    }
  }
  return result;
}

export function flagCount(game: Game): number {
  return game.cells.reduce((total, cell) => total + (cell.flagged ? 1 : 0), 0);
}

/** Seconds on the clock, the way the counter shows them. */
export function elapsedSeconds(game: Pick<Game, "startedAt" | "endedAt">, now: number): number {
  if (game.startedAt === null) return 0;
  return Math.min(999, Math.floor(((game.endedAt ?? now) - game.startedAt) / 1000));
}

/** Placed on the first click, never under it or next to it, so the first click always opens some room. */
function placeBurgers(game: Game, firstIndex: number) {
  const keepClear = new Set([firstIndex, ...neighbors(game, firstIndex)]);
  // On a board too packed for that, only the clicked cell is kept clear.
  if (game.cells.length - keepClear.size < game.burgers) keepClear.clear();
  keepClear.add(firstIndex);

  const candidates = game.cells.map((_, index) => index).filter((index) => !keepClear.has(index));
  for (let i = 0; i < game.burgers; i++) {
    const pick = i + Math.floor(Math.random() * (candidates.length - i));
    [candidates[i], candidates[pick]] = [candidates[pick], candidates[i]];
    game.cells[candidates[i]].burger = true;
  }
  game.cells.forEach((cell, index) => {
    cell.count = neighbors(game, index).filter((other) => game.cells[other].burger).length;
  });
}

function copy(game: Game): Game {
  return { ...game, cells: game.cells.map((cell) => ({ ...cell })) };
}

/** Opens one cell on a copy already made, spreading out from empty ones. */
function openCell(game: Game, index: number, now: number) {
  const start = game.cells[index];
  if (start.open || start.flagged || game.status === "won" || game.status === "lost") return;

  if (game.status === "ready") {
    placeBurgers(game, index);
    game.status = "playing";
    game.startedAt = now;
  }

  if (start.burger) {
    start.open = true;
    game.status = "lost";
    game.hitIndex = index;
    game.endedAt = now;
    for (const cell of game.cells) if (cell.burger && !cell.flagged) cell.open = true;
    return;
  }

  const queue = [index];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    const cell = game.cells[current];
    if (cell.open || cell.flagged) continue;
    cell.open = true;
    if (cell.count === 0) queue.push(...neighbors(game, current));
  }

  const safeLeft = game.cells.some((cell) => !cell.burger && !cell.open);
  if (!safeLeft) {
    game.status = "won";
    game.endedAt = now;
    for (const cell of game.cells) if (cell.burger) cell.flagged = true;
  }
}

export function reveal(game: Game, index: number, now: number): Game {
  const next = copy(game);
  openCell(next, index, now);
  return next;
}

/** On an open number with as many flags around it as it says: opens everything else around it. */
export function chord(game: Game, index: number, now: number): Game {
  const cell = game.cells[index];
  if (!cell.open || cell.count === 0 || game.status !== "playing") return game;
  const around = neighbors(game, index);
  const flagged = around.filter((other) => game.cells[other].flagged).length;
  if (flagged !== cell.count) return game;

  const next = copy(game);
  for (const other of around) openCell(next, other, now);
  return next;
}

export function toggleFlag(game: Game, index: number): Game {
  const cell = game.cells[index];
  if (cell.open || game.status === "won" || game.status === "lost") return game;
  const next = copy(game);
  next.cells[index].flagged = !cell.flagged;
  return next;
}
