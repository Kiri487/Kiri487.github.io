import { prefersReducedMotion } from "../../../shared/motion";
import { seeded } from "./seeded";

/* ============================================================
   The crossing between Kere and XR, all three at once. Kere → XR:
   the name rolls through ROT13, the face changes a cell at a
   time, and the page is scanned black from the top, unevenly,
   in fine cells. XR → Kere plays it backwards: the scan
   withdraws from the bottom up as face and name change back.
   Kept small and separate, so Kere can play it without loading
   the rest of XR's code.
   ============================================================ */

/* ---- name and face ---- */

/** The name's roll takes this long. */
export const NAME_MS = 1000;
const LETTER_STAGGER_MS = 120;
const LETTER_STEP_MS = 40;

const shift = (ch: string, by: number) => {
  const base = ch >= "a" && ch <= "z" ? 97 : ch >= "A" && ch <= "Z" ? 65 : -1;
  return base < 0 ? ch : String.fromCharCode(((ch.charCodeAt(0) - base + by + 26 * 2) % 26) + base);
};

/**
 * `name` part-way through ROT13, `t` ms in. Each letter rolls 13 places through the alphabet; forward (1) they start
 * left to right, backward (-1) right to left, so leaving is entering played in reverse.
 */
export function rollName(name: string, t: number, dir: 1 | -1): string {
  const letters = [...name];
  return letters
    .map((ch, i) => {
      const order = dir === 1 ? i : letters.length - 1 - i;
      const steps = Math.max(0, Math.min(13, Math.floor((t - order * LETTER_STAGGER_MS) / LETTER_STEP_MS)));
      return shift(ch, dir * steps);
    })
    .join("");
}

/** `from` turning into `to` one cell at a time, in `order` (cell indexes), spread evenly over the scan. */
export function morphFace(from: string, to: string, t: number, order: number[]): string {
  const cells = [...from];
  const target = [...to];
  const step = SCAN_MS / (order.length + 1);
  order.forEach((cell, k) => {
    if (t >= (k + 1) * step) cells[cell] = target[cell];
  });
  return cells.join("");
}

/** Runs `frame` with the elapsed time on every animation frame for `duration` ms, then resolves. */
export function animate(duration: number, frame: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      frame(Math.min(t, duration));
      if (t < duration) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/* ---- the scan ---- */

// Fine cells: about 10 × 4.5 px on a 1080p screen.
const ROWS = 240;
const COLS = 192;
const OVERLAY_ID = "xr-scan";

/** One step of the scan: how many rows each column has covered from the top, and how long it holds. */
interface ScanFrame {
  fill: number[];
  hold: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The scan, worked out once with a fixed seed, so it moves the same way every time and leaving can replay it exactly
 * backwards. The front moves a few rows at a time at an uneven pace, the columns drift a little ahead or behind each
 * other, and twice it slips back a few rows. No stalls: a pause just looked like the site lagging.
 */
function buildScan(): ScanFrame[] {
  const rand = seeded("xr-scan");
  const offsets = Array.from({ length: COLS }, () => Math.floor(rand() * 13) - 6);
  const frames: ScanFrame[] = [];
  let front = 0;
  let slips = 2;
  while (front < ROWS + 16) {
    let step = 4 + Math.floor(rand() * 12);
    const hold = 18 + rand() * 40;
    if (slips > 0 && front > ROWS * 0.3 && rand() < 0.07) {
      step = -6;
      slips--;
    }
    front += step;
    for (let c = 0; c < COLS; c++) {
      if (rand() < 0.3) offsets[c] = clamp(offsets[c] + (rand() < 0.5 ? -4 : 4), -16, 10);
    }
    frames.push({ fill: offsets.map((o) => clamp(front + o, 0, ROWS)), hold });
  }
  frames.push({ fill: Array<number>(COLS).fill(ROWS), hold: 0 });
  return frames;
}

const SCAN = buildScan();
const FULL = Array<number>(COLS).fill(ROWS);

/** How long the scan takes, either way: the face changes over the same stretch. */
export const SCAN_MS = SCAN.reduce((sum, f) => sum + f.hold, 0);

/**
 * White cells blended with "difference" turn whatever is under them into its exact negative — which is what XR's
 * colours are of Kere's — so mid-scan the covered part already looks like XR.
 */
function overlay(): HTMLCanvasElement {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing instanceof HTMLCanvasElement) return existing;
  const canvas = document.createElement("canvas");
  canvas.id = OVERLAY_ID;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    pointerEvents: "none",
    mixBlendMode: "difference",
  });
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  return canvas;
}

function draw(canvas: HTMLCanvasElement, fill: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  fill.forEach((rows, c) => {
    if (rows <= 0) return;
    // Whole pixels, so neighbouring cells never leave a hairline gap.
    const x = Math.floor((c * width) / COLS);
    const w = Math.floor(((c + 1) * width) / COLS) - x;
    ctx.fillRect(x, 0, w, Math.ceil((rows * height) / ROWS));
  });
}

function play(frames: ScanFrame[], canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= frames.length) {
        resolve();
        return;
      }
      draw(canvas, frames[i].fill);
      const hold = frames[i].hold;
      i++;
      window.setTimeout(next, hold);
    };
    next();
  });
}

/** Kere → XR: scan the page black from the top. The cover stays until XR is on screen (see `removeCover`). */
export function scanIn(): Promise<void> {
  const canvas = overlay();
  if (prefersReducedMotion()) {
    draw(canvas, FULL);
    return Promise.resolve();
  }
  return play(SCAN, canvas);
}

/** XR → Kere, the first instant: cover the page at once, so Kere's white page appears black, as XR's was. */
export function coverAll() {
  draw(overlay(), FULL);
}

/** XR → Kere: the scan played backwards, withdrawing from the bottom up, then the cover is gone. */
export async function scanOut(): Promise<void> {
  const canvas = overlay();
  if (!prefersReducedMotion()) {
    const backwards = [...SCAN].reverse().map((f, i, all) => ({ fill: f.fill, hold: all[i + 1]?.hold ?? 0 }));
    await play([...backwards, { fill: Array<number>(COLS).fill(0), hold: 0 }], canvas);
  }
  removeCover();
}

export function removeCover() {
  document.getElementById(OVERLAY_ID)?.remove();
}
