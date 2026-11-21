import { clamp } from "../../../../shared/math";
import { glyphFor } from "./graffiti";
import { hash3 } from "./hash";
import type { StatueSkin } from "./statue";

/*
 * XN has had some of the meeting rooms' whiteboards (junk.ts) for meetings of her own: an agenda, the minutes, who
 * came; a flowchart that comes back round to where it started; a chart; or one line, like a notice. In whiteboard
 * marker, blue mostly, red to ring and underline, in the same hand as her graffiti (graffiti.ts): every letter turned
 * and sized a little its own way and off the line, and every stroke of it off where it was meant to go, so no two A's
 * come out the same; the strokes running past where they meet, wavering, thicker and thinner; nothing ruled. Her
 * words read through SAN like the rest of hers (the game hands the reading in); the boxes, arrows and bars don't
 * change. Each board written on has its own atlas, drawn again when the reading changes.
 */

/** A written board's atlas: its face, and its aluminium frame under it. Its face is the board's shape, near enough. */
export const WRITTEN_W = 256;
export const WRITTEN_H = 88;
export const WRITTEN_FACE = { x: 0, y: 0, w: 256, h: 80 };
export const WRITTEN_FRAME = { x: 0, y: 80, w: 8, h: 8 };

/** How many different boards she's written. */
export const WRITINGS = 12;

type Colour = readonly [number, number, number];
type Point = readonly [number, number];

const BLUE: Colour = [36, 64, 168];
const RED: Colour = [188, 36, 36];
const BLACK: Colour = [38, 38, 42];
const BOARD_WHITE: Colour = [236, 238, 236];
const FRAME_GREY: Colour = [168, 170, 172];
/** How strongly the marker covers the white. */
const INK = 0.9;
/**
 * Her hand: the gap between letters and the stroke's width, against the letters' height, and lines' spacing. How far
 * each point of a letter's strokes lands off where it was meant to, in its grid (6 tall); how far its strokes run on
 * past their ends, against its height; how much a stroke's width varies.
 */
const GAP = 1.4;
const MISS = 0.45;
const RUN_ON = 0.12;
const WIDTH_VARIES = 0.35;
const HEAVY = 0.2;
const LINE_STEP = 1.5;
/** Room left at the board's edges. */
const MARGIN = 10;
const FACE_W = WRITTEN_FACE.w;
const FACE_H = WRITTEN_FACE.h;

/** Writing on one board: everything in marker goes through here. */
class Pen {
  readonly rgb = new Float32Array(FACE_W * FACE_H * 3);
  private readonly seed: number;
  private strokes = 0;

  constructor(seed: number) {
    this.seed = seed;
    for (let y = 0; y < FACE_H; y++) {
      for (let x = 0; x < FACE_W; x++) {
        const m = 0.97 + 0.04 * hash3(x, y, 1000);
        const o = (y * FACE_W + x) * 3;
        this.rgb[o] = BOARD_WHITE[0] * m;
        this.rgb[o + 1] = BOARD_WHITE[1] * m;
        this.rgb[o + 2] = BOARD_WHITE[2] * m;
      }
    }
  }

  /** A little of the hand's shake, the same every time for this board. */
  private shake(k: number, amount: number) {
    return (hash3(this.seed, this.strokes, k) - 0.5) * 2 * amount;
  }

  /**
   * Lines along the paths drawn by hand: straight stretches waver a little and the ends run on past where they were
   * meant to stop.
   */
  lines(paths: readonly (readonly Point[])[], colour: Colour, width: number) {
    this.ink(
      paths.map((path) => this.byHand(path)),
      colour,
      width,
    );
  }

  private byHand(path: readonly Point[]): Point[] {
    this.strokes++;
    const out: Point[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const [ux, uy] = [(bx - ax) / len, (by - ay) / len];
      const n = Math.max(1, Math.ceil(len / 7));
      const first = i === 0;
      const last = i === path.length - 2;
      for (let k = first ? 0 : 1; k <= n; k++) {
        const t = k / n;
        // Off the straight line, most in the middle; past the ends, a little.
        const off = k === 0 || k === n ? 0 : this.shake(10 + i * 16 + k, 0.7);
        const over = (first && k === 0 ? -1 : last && k === n ? 1 : 0) * Math.abs(this.shake(9 + i, 2));
        out.push([ax + (bx - ax) * t - uy * off + ux * over, ay + (by - ay) * t + ux * off + uy * over]);
      }
    }
    return out;
  }

  /** Lines through the points as they are, blended onto the board once, so where they join or cross isn't darker. */
  private ink(paths: readonly (readonly Point[])[], colour: Colour, width: number) {
    const cover = new Float32Array(FACE_W * FACE_H);
    const r = width / 2;
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const [ax, ay] = path[i];
        const [bx, by] = path[i + 1];
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
        const x1 = Math.min(FACE_W - 1, Math.ceil(Math.max(ax, bx) + r + 1));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
        const y1 = Math.min(FACE_H - 1, Math.ceil(Math.max(ay, by) + r + 1));
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy || 1;
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const px = x + 0.5;
            const py = y + 0.5;
            const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
            const d = Math.hypot(px - ax - dx * t, py - ay - dy * t);
            const c = clamp(r + 0.5 - d, 0, 1);
            const k = y * FACE_W + x;
            if (c > cover[k]) cover[k] = c;
          }
        }
      }
    }
    for (let k = 0; k < cover.length; k++) {
      const a = cover[k] * INK;
      if (!a) continue;
      for (let c = 0; c < 3; c++) this.rgb[k * 3 + c] = this.rgb[k * 3 + c] * (1 - a) + colour[c] * a;
    }
  }

  /** How wide `text` comes out at `size` px tall. */
  measure(text: string, size: number) {
    const unit = size / 6;
    let w = 0;
    for (const ch of text) w += ch === " " ? 2.5 * unit : ((glyphFor(ch)?.w ?? 3) + GAP) * unit;
    return Math.max(0, w - GAP * unit);
  }

  /**
   * Writes `text` in her capitals with its top left at (x, y), `size` px tall; returns how wide it came out. Her hand,
   * as on the walls: the line running a little downhill or up, every letter turned and sized its own way and off the
   * line, the gaps uneven; and every letter's strokes drawn by hand (scrawl).
   */
  write(text: string, x: number, y: number, size: number, colour: Colour) {
    const unit = size / 6;
    this.strokes++;
    const slope = this.shake(1, 0.04);
    let at = x;
    for (const ch of text) {
      if (ch === " ") {
        at += 2.5 * unit;
        continue;
      }
      const glyph = glyphFor(ch);
      if (!glyph) {
        at += 4.8 * unit;
        continue;
      }
      this.strokes++;
      const turn = this.shake(2, 0.13);
      const scale = 1 + this.shake(3, 0.12);
      const cx = at + (glyph.w / 2) * unit + this.shake(4, 0.07 * size);
      const cy = y + 3 * unit + (at - x) * slope + this.shake(5, 0.1 * size);
      const [c, n] = [Math.cos(turn), Math.sin(turn)];
      glyph.strokes.forEach((stroke, si) => {
        const path = stroke.map(([gx, gy], pi) => {
          // Each point where her hand put it, not where it was meant to go.
          const mx = gx + this.shake(50 + si * 16 + pi * 2, MISS);
          const my = gy + this.shake(51 + si * 16 + pi * 2, MISS);
          const lx = (mx - glyph.w / 2) * unit * scale;
          const ly = (my - 3) * unit * scale;
          return [cx + lx * c - ly * n, cy + lx * n + ly * c] as const;
        });
        this.scrawl(path, size, colour, si);
      });
      at += (glyph.w + GAP) * unit * (1 + this.shake(6, 0.12));
    }
    return at - x - GAP * unit;
  }

  /**
   * One stroke of a letter `size` tall, by hand: run on a little past both ends, wavering along its length, heavier
   * or lighter than the last.
   */
  private scrawl(path: readonly Point[], size: number, colour: Colour, k: number) {
    const run = (from: Point, to: Point, amount: number): Point => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
      return [to[0] + ((to[0] - from[0]) / len) * amount, to[1] + ((to[1] - from[1]) / len) * amount];
    };
    const points = [...path];
    if (points.length > 1) {
      points[0] = run(path[1], path[0], Math.abs(this.shake(60 + k, RUN_ON * size)));
      const last = points.length - 1;
      points[last] = run(path[last - 1], path[last], Math.abs(this.shake(61 + k, RUN_ON * size)));
    }
    // Wavering along it: each straight stretch bent a little off true, at a point or two along it.
    const wavy: Point[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const steps = Math.max(1, Math.round(len / (size * 0.35)));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const off = s === steps ? 0 : this.shake(70 + k * 8 + i * 3 + s, size * 0.05);
        wavy.push([ax + (bx - ax) * t - ((by - ay) / len) * off, ay + (by - ay) * t + ((bx - ax) / len) * off]);
      }
    }
    const width = Math.max(1.1, size * HEAVY * (1 + this.shake(80 + k, WIDTH_VARIES)));
    this.ink([wavy], colour, width);
  }

  /**
   * Writes `text` broken into lines no wider than `width`, its first line's top at y, the lines close together and
   * each starting a little in or out, as on her walls; returns how many lines.
   */
  wrap(text: string, x: number, y: number, size: number, width: number, colour: Colour) {
    const lines: string[] = [];
    for (const word of text.split(" ")) {
      const last = lines[lines.length - 1];
      const longer = `${last} ${word}`;
      if (last !== undefined && this.measure(longer, size) <= width) lines[lines.length - 1] = longer;
      else lines.push(word);
    }
    const step = size * LINE_STEP;
    lines.forEach((line, i) => this.write(line, x + Math.max(0, this.shake(11 + i, size * 0.6)), y + i * step, size, colour));
    return lines.length;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, colour: Colour, width: number) {
    // Drawn in one go round, and on a little past where it started, as a hand does.
    const start = this.shake(4, Math.PI);
    const path: Point[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = start + (i / 28) * Math.PI * 2;
      const wobble = 1 + this.shake(5 + i, 0.04);
      path.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
    }
    this.ink([path], colour, width);
  }

  /** A line along the points with a head on its end. */
  arrow(path: readonly Point[], colour: Colour, width: number) {
    const [ex, ey] = path[path.length - 1];
    const [px, py] = path[path.length - 2];
    const a = Math.atan2(ey - py, ex - px);
    const head = (turn: number): Point => [ex - Math.cos(a + turn) * 5, ey - Math.sin(a + turn) * 5];
    this.lines([path, [head(0.5), [ex, ey], head(-0.5)]], colour, width);
  }

  box(x0: number, y0: number, x1: number, y1: number, colour: Colour, width: number) {
    this.lines(
      [
        [
          [x0, y0],
          [x1, y0 + this.shake(6, 1.2)],
          [x1 + this.shake(8, 1), y1],
          [x0, y1 + this.shake(7, 1.2)],
          [x0, y0],
        ],
      ],
      colour,
      width,
    );
  }
}

/** A header with a red line under it; returns how wide it is. */
function header(pen: Pen, text: string, size = 11) {
  const w = pen.write(text, MARGIN + 2, 7, size, BLUE);
  pen.lines([[[MARGIN + 1, 9 + size], [MARGIN + 4 + w, 8 + size]]], RED, 1.3);
  return w;
}

/** Boxes in a row along y = `top`, each round its word, arrows between; returns each box's left, right and bottom. */
function flow(pen: Pen, words: readonly string[], top: number, size: number) {
  const pad = 4;
  const gap = 14;
  const widths = words.map((w) => pen.measure(w, size) + pad * 2);
  const total = widths.reduce((s, w) => s + w, 0) + gap * (words.length - 1);
  let x = (FACE_W - total) / 2;
  const boxes: [number, number, number][] = [];
  words.forEach((word, i) => {
    const bottom = top + size + pad * 2;
    pen.box(x, top, x + widths[i], bottom, BLUE, 1.2);
    pen.write(word, x + pad, top + pad, size, BLUE);
    boxes.push([x, x + widths[i], bottom]);
    if (i < words.length - 1) {
      const mid = top + size / 2 + pad;
      pen.arrow([[x + widths[i] + 2, mid], [x + widths[i] + gap - 2, mid]], BLUE, 1.2);
    }
    x += widths[i] + gap;
  });
  return boxes;
}

/** Each board: the words of hers on it (read through SAN), and how it's laid out with them as read. */
interface Writing {
  texts: readonly string[];
  draw: (pen: Pen, shown: readonly string[], roll: (k: number) => number) => void;
}

const WRITTEN: readonly Writing[] = [
  {
    // An agenda with only the one item, the last of it ringed.
    texts: ["agenda", "1. thursday", "2. more thursday", "3. any other thursday"],
    draw: (pen, [title, a, b, c]) => {
      header(pen, title);
      pen.write(a, 16, 28, 8, BLUE);
      pen.write(b, 16, 42, 8, BLUE);
      const w = pen.write(c, 16, 56, 8, BLUE);
      pen.ellipse(16 + w / 2, 60, w / 2 + 13, 10, RED, 1.2);
    },
  },
  {
    texts: ["minutes", "the meeting ate the minutes"],
    draw: (pen, [title, line]) => {
      header(pen, title);
      pen.wrap(line, MARGIN + 6, 30, 11, 170, BLUE);
    },
  },
  {
    // Done, and ticked.
    texts: ["today", "teach the chairs to wait", "done. they waited"],
    draw: (pen, [title, task, done]) => {
      header(pen, title);
      pen.write(task, 16, 32, 8, BLUE);
      const w = pen.write(done, 16, 50, 8, RED);
      const x = 16 + w + 8;
      pen.lines([[[x, 53], [x + 3, 57], [x + 10, 47]]], RED, 1.4);
    },
  },
  {
    // Who came: her, mostly; the chair ringed.
    texts: ["attendance", "me", "me", "the chair", "me"],
    draw: (pen, [title, ...names]) => {
      header(pen, title, 10);
      names.forEach((name, i) => {
        const y = 25 + i * 13;
        const w = pen.write(name, 22, y, 7, BLUE);
        if (i === 2) pen.ellipse(22 + w / 2, y + 3.5, w / 2 + 11, 8, RED, 1.2);
      });
    },
  },
  {
    // A flowchart that comes back round to where it started.
    texts: ["you", "hallway", "hallway", "hallway"],
    draw: (pen, words) => {
      const boxes = flow(pen, words, 14, 7);
      const [first] = boxes;
      const last = boxes[boxes.length - 1];
      const from = (last[0] + last[1]) / 2;
      const to = (first[0] + first[1]) / 2;
      pen.arrow([[from, last[2] + 2], [from + 2, 58], [to - 2, 59], [to, first[2] + 2]], BLUE, 1.2);
    },
  },
  {
    // A problem solved, the answer underlined twice.
    texts: ["problem", "eat it", "no problem"],
    draw: (pen, words) => {
      const boxes = flow(pen, words, 28, 8);
      const [x0, x1, bottom] = boxes[boxes.length - 1];
      pen.lines([[[x0, bottom + 4], [x1, bottom + 3]], [[x0 + 2, bottom + 8], [x1 - 2, bottom + 7]]], RED, 1.3);
    },
  },
  {
    // How much thursday each day: hardly any, but on thursday, off the top of the board.
    texts: ["how much thursday", "m t w t f s s"],
    draw: (pen, [title, days], roll) => {
      // Off to the right, clear of thursday's bar.
      pen.write(title, FACE_W - MARGIN - pen.measure(title, 7), 6, 7, BLUE);
      const base = 64;
      const left = 26;
      pen.lines([[[left, 18], [left, base], [FACE_W - 20, base]]], BLACK, 1.2);
      days.split(" ").forEach((day, i) => {
        const x = left + 14 + i * 28;
        const thursday = i === 3;
        const top = thursday ? -2 : base - 4 - roll(i) * 10;
        const colour = thursday ? RED : BLUE;
        pen.box(x, top, x + 14, base, colour, 1.2);
        // Hatched in.
        const hatch: Point[][] = [];
        for (let y = base - 4; y > top + 2; y -= 4) hatch.push([[x + 1, y], [x + 13, y - 3]]);
        pen.lines(hatch, colour, 0.9);
        pen.write(day, x + 4, base + 4, 6, BLUE);
      });
    },
  },
  {
    // What the room's made of: carpet, the hum, and her, most of all.
    texts: ["what this room is made of", "carpet", "hum", "me"],
    draw: (pen, [title, carpet, hum, me]) => {
      pen.write(title, MARGIN, 5, 7, BLUE);
      const [cx, cy, r] = [64, 47, 25];
      pen.ellipse(cx, cy, r, r, BLACK, 1.2);
      const cuts = [-Math.PI / 2, 0.15, 0.65];
      pen.lines(cuts.map((a) => [[cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]]), BLACK, 1.2);
      // Each label off to the right, a line to the middle of its slice.
      // Each label off to the side of its slice, a line to the middle of the slice; hers is the big one, on the left.
      const slices: [string, number, number, number][] = [
        [carpet, (cuts[0] + cuts[1]) / 2, 118, 26],
        [hum, (cuts[1] + cuts[2]) / 2, 118, 50],
        [me, (cuts[2] + Math.PI * 1.5) / 2, 12, 62],
      ];
      for (const [label, a, x, y] of slices) {
        const w = pen.write(label, x, y, 8, BLUE);
        const end = x < cx ? x + w + 3 : x - 4;
        pen.lines([[[cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6], [end, y + 4]]], BLUE, 1);
      }
    },
  },
  {
    texts: ["meeting moved to the ceiling"],
    draw: (pen, [line]) => {
      const n = pen.wrap(line, MARGIN + 12, 8, 14, 150, BLUE);
      pen.arrow([[226, 8 + n * 18], [228, 6]], RED, 1.8);
    },
  },
  {
    texts: ["do not erase. it remembers"],
    draw: (pen, [line]) => {
      const n = pen.wrap(line, MARGIN + 30, 8, 14, 150, BLUE);
      const y = 8 + n * 18 + 3;
      const wave: Point[] = [];
      for (let x = MARGIN + 28; x <= 200; x += 3) wave.push([x, y + Math.sin(x * 0.5) * 1.5]);
      pen.lines([wave], RED, 1.3);
    },
  },
  {
    texts: ["goal: be a burger by thursday"],
    draw: (pen, [line]) => {
      const n = pen.wrap(line, MARGIN + 20, 8, 14, 160, BLUE);
      const y = 8 + n * 18 + 3;
      pen.lines([[[MARGIN + 18, y], [190, y - 1]]], RED, 1.5);
    },
  },
  {
    texts: ["kere asked for minutes. i gave her hours"],
    draw: (pen, [line]) => {
      pen.wrap(line, MARGIN + 24, 8, 12, 170, BLUE);
    },
  },
];

/** Atlases already drawn, by board and what it reads as. Kept small: the reading only changes a word now and then. */
const drawn = new Map<string, StatueSkin>();
const DRAWN_MOST = 24;

/**
 * The atlas of a board with writing `index` on it (its hand from `seed`), its words as `read` makes them now, and its
 * frame. Its face is lit like any other part of it, by the room.
 */
export function whiteboardSkin(index: number, seed: number, read: (text: string) => string): StatueSkin {
  const writing = WRITTEN[index % WRITTEN.length];
  const shown = writing.texts.map(read);
  const key = `${index}|${seed}|${shown.join("|")}`;
  let skin = drawn.get(key);
  if (skin) return skin;
  const pen = new Pen(seed);
  writing.draw(pen, shown, (k) => hash3(seed, index, 40 + k));
  const data = new Uint8ClampedArray(WRITTEN_W * WRITTEN_H * 4);
  for (let y = 0; y < FACE_H; y++) {
    for (let x = 0; x < FACE_W; x++) {
      const i = y * FACE_W + x;
      const o = ((WRITTEN_FACE.y + y) * WRITTEN_W + WRITTEN_FACE.x + x) * 4;
      data[o] = pen.rgb[i * 3];
      data[o + 1] = pen.rgb[i * 3 + 1];
      data[o + 2] = pen.rgb[i * 3 + 2];
      data[o + 3] = 255;
    }
  }
  for (let y = 0; y < WRITTEN_FRAME.h; y++) {
    for (let x = 0; x < WRITTEN_FRAME.w; x++) {
      const o = ((WRITTEN_FRAME.y + y) * WRITTEN_W + WRITTEN_FRAME.x + x) * 4;
      data.set([...FRAME_GREY, 255], o);
    }
  }
  skin = { data };
  if (drawn.size >= DRAWN_MOST) drawn.delete(drawn.keys().next().value as string);
  drawn.set(key, skin);
  return skin;
}
