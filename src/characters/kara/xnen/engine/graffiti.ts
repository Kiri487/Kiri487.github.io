import { hash3 } from "./hash";
import type { WorldMap } from "./map";
import type { Tuning } from "./tuning";

/*
 * Marks on the walls, here and there at random, and only on the walls:
 *
 * - XN's graffiti: big crooked capitals sprayed in black. What she wrote is English; how much of it the visitor can
 *   read follows their SAN, word by word, the same as her subtitles (the renderer is handed the reading). ROT13 keeps
 *   every word's length, so the letters stay where they were sprayed and only their shapes change.
 * - Arrows, in the same black, pointing nowhere in particular.
 * - Tally marks, tiny, at about eye height: someone counting, in fives, up to thirteen fives.
 * - XN's drawings of herself and Kara (Kiri's drawings, traced in black): on their heads as they are, turned
 *   upright or toppled over, leaning opposite ways, and labelled "me" and "kara" (read through SAN like her
 *   words: at first they say ZR and XNEN).
 * - The Weed Cat Cult's slogans off its poster, written small in green by hand at eye height, across or down.
 * - The cult's cat god (Kiri's drawing, traced in the same green), drawn upright with care at eye height, half the
 *   time with one of the slogans written small under it.
 *
 * Walls run along the lattice every 5 cells, so a tag belongs to one stretch of lattice (the four cells between two
 * points) and one side of it, and keeps inside the part of that side the visitor can see.
 */

/** What XN wrote. Lower case here; sprayed in capitals. */
export const GRAFFITI_TEXTS: readonly string[] = [
  "this wall is the other side of this wall",
  "i counted the lights. one counted back",
  "exit is a flavor",
  "you are here →",
  "dont trust the ceiling it has opinions",
  "do not wake the hallway",
  "the walls are load bearing. so am i",
  "kara was here",
];

/** The cult's slogans, off its poster. */
export const CULT_TEXTS: readonly string[] = ["大麻猫神教", "信者募集", "猫神はあなたを待っている", "緑の導きに身をゆだねよ"];

/** Mask pixels to a cell across, and to the wall's height. */
const PX = 96;
/** The colours: XN's black spray, and the cult's green. */
const BLACK: readonly [number, number, number] = [20, 18, 15];
const GREEN: readonly [number, number, number] = [26, 64, 24];
/** How often a side of a stretch has something on it, at 100 %. */
const CHANCE = 0.065;
/** Of those, what: XN's words, an arrow, tally marks, a cult slogan, XN's drawing, the cat god. */
const KINDS: readonly [Kind, number][] = [
  ["text", 0.41],
  ["arrow", 0.18],
  ["tally", 0.13],
  ["cult", 0.14],
  ["portrait", 0.08],
  ["shrine", 0.06],
];
/** The stroke's thickness as a share of a grid step. */
const STROKE = 0.38;

export type Kind = "text" | "arrow" | "tally" | "cult" | "portrait" | "shrine";

type Stroke = readonly (readonly [number, number])[];
/** A glyph: strokes on a grid this wide and 6 tall, y down. */
interface GlyphDef {
  w: number;
  strokes: readonly Stroke[];
}

/** XN and Kara, traced from Kiri's drawings (assets/xn-drawing.webp, kara-drawing.webp): keys for the drawings. */
const XN_FIGURE = "Ⓧ";
const KARA_FIGURE = "Ⓚ";
/** The cat god, traced from Kiri's drawing (assets/god-drawing.webp). */
const GOD_FIGURE = "Ⓖ";
/** A drawing's width in grid steps, against its 6 tall: the drawings are a little over half as wide as they're tall. */
const FIGURE_W = 3.3;
/** The cat god's width in grid steps, against its 6 tall. */
const GOD_W = 3.1;
/** How much darker than the drawing the traced lines go: a little, so thin lines hold up on the wall. */
const INK_GAIN = 1.2;

/** A traced drawing: per pixel how much ink, 0–255. */
export interface Drawing {
  w: number;
  h: number;
  ink: Uint8Array;
}

const drawings = new Map<string, Drawing>();

/** The ink of a drawing loaded as RGBA: the files keep it light on black (Kiri's lines' alpha), so its red is how much ink. */
export function inkOf(rgba: Uint8ClampedArray, w: number, h: number): Drawing {
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = rgba[i * 4];
  return { w, h, ink };
}

/** The drawings have loaded: any drawing sprayed before them was sprayed without them, so it's sprayed again. */
export function setDrawings(xn: Drawing, kara: Drawing, god: Drawing) {
  drawings.set(XN_FIGURE, xn);
  drawings.set(KARA_FIGURE, kara);
  drawings.set(GOD_FIGURE, god);
  sprayed.clear();
}

const latin = (strokes: readonly Stroke[]): GlyphDef => ({ w: 4, strokes });
const square = (strokes: readonly Stroke[]): GlyphDef => ({ w: 6, strokes });

/** The tally's single mark, and its five. */
const TALLY_ONE = "|";
const TALLY_FIVE = "卌";

const GLYPHS: Record<string, GlyphDef> = {
  A: latin([[[0, 6], [2, 0], [4, 6]], [[0.9, 3.6], [3.1, 3.6]]]),
  B: latin([[[0, 6], [0, 0], [3, 0], [4, 1], [3, 3], [0, 3]], [[3, 3], [4, 4.5], [3, 6], [0, 6]]]),
  C: latin([[[4, 1], [3, 0], [1, 0], [0, 1.5], [0, 4.5], [1, 6], [3, 6], [4, 5]]]),
  D: latin([[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]]),
  E: latin([[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]]),
  F: latin([[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]]),
  G: latin([[[4, 1], [3, 0], [1, 0], [0, 1.5], [0, 4.5], [1, 6], [3, 6], [4, 5], [4, 3.5], [2, 3.5]]]),
  H: latin([[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]]),
  I: latin([[[2, 0], [2, 6]], [[1, 0], [3, 0]], [[1, 6], [3, 6]]]),
  J: latin([[[4, 0], [4, 4.5], [3, 6], [1, 6], [0, 4.5]]]),
  K: latin([[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.3, 2.6], [4, 6]]]),
  L: latin([[[0, 0], [0, 6], [4, 6]]]),
  M: latin([[[0, 6], [0, 0], [2, 3.2], [4, 0], [4, 6]]]),
  N: latin([[[0, 6], [0, 0], [4, 6], [4, 0]]]),
  O: latin([[[1, 0], [3, 0], [4, 1.5], [4, 4.5], [3, 6], [1, 6], [0, 4.5], [0, 1.5], [1, 0]]]),
  P: latin([[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]]]),
  Q: latin([[[1, 0], [3, 0], [4, 1.5], [4, 4.5], [3, 6], [1, 6], [0, 4.5], [0, 1.5], [1, 0]], [[2.5, 4.4], [4.3, 6.4]]]),
  R: latin([[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2], [3, 3], [0, 3]], [[2, 3], [4, 6]]]),
  S: latin([[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]]),
  T: latin([[[0, 0], [4, 0]], [[2, 0], [2, 6]]]),
  U: latin([[[0, 0], [0, 4.5], [1, 6], [3, 6], [4, 4.5], [4, 0]]]),
  V: latin([[[0, 0], [2, 6], [4, 0]]]),
  W: latin([[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]]),
  X: latin([[[0, 0], [4, 6]], [[4, 0], [0, 6]]]),
  Y: latin([[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]]),
  Z: latin([[[0, 0], [4, 0], [0, 6], [4, 6]]]),
  ".": latin([[[2, 5.5], [2.1, 6]]]),
  "'": latin([[[2.2, 0], [1.8, 1.6]]]),
  "→": { w: 4.4, strokes: [[[0, 3], [4.4, 3]], [[2.6, 1.3], [4.4, 3], [2.6, 4.7]]] },

  [TALLY_ONE]: { w: 1, strokes: [[[0.5, 0], [0.5, 6]]] },
  [TALLY_FIVE]: {
    w: 4.6,
    strokes: [[[0.5, 0], [0.5, 6]], [[1.6, 0], [1.6, 6]], [[2.7, 0], [2.7, 6]], [[3.8, 0], [3.8, 6]], [[-0.4, 4.8], [4.8, 1.2]]],
  },

  大: square([[[0.5, 2], [5.5, 2]], [[3, 0], [3, 2], [2.4, 4], [0.5, 6]], [[3, 2.2], [4, 4.2], [5.6, 6]]]),
  麻: square([
    [[3, 0], [3, 0.8]],
    [[0.8, 1], [5.8, 1]],
    [[1, 1], [1, 4], [0.2, 6]],
    [[1.8, 2.8], [3.6, 2.8]],
    [[2.7, 1.8], [2.7, 6]],
    [[2.7, 3], [1.8, 5]],
    [[3.9, 2.8], [5.8, 2.8]],
    [[4.8, 1.8], [4.8, 6]],
    [[4.8, 3], [3.9, 5]],
    [[4.8, 3], [5.8, 5]],
  ]),
  猫: square([
    [[0.2, 0.6], [1.2, 1.6]],
    [[1.8, 0.2], [1.6, 3], [0.4, 6]],
    [[0.3, 3.2], [1.4, 2.4]],
    [[2.4, 1], [6, 1]],
    [[3.4, 0], [3.4, 1.8]],
    [[5, 0], [5, 1.8]],
    [[2.6, 2.5], [2.6, 6]],
    [[2.6, 2.5], [5.8, 2.5], [5.8, 6]],
    [[2.6, 4.2], [5.8, 4.2]],
    [[4.2, 2.5], [4.2, 6]],
    [[2.6, 6], [5.8, 6]],
  ]),
  神: square([
    [[1, 0], [1.4, 0.6]],
    [[0, 1.5], [2, 1.5], [0.2, 3.8]],
    [[1.2, 2.6], [1.2, 6]],
    [[1.3, 3.4], [2, 4]],
    [[2.6, 1], [2.6, 4.4]],
    [[2.6, 1], [5.6, 1], [5.6, 4.4]],
    [[2.6, 2.7], [5.6, 2.7]],
    [[2.6, 4.4], [5.6, 4.4]],
    [[4.1, 0], [4.1, 6]],
  ]),
  教: square([
    [[0.3, 1.2], [2.8, 1.2]],
    [[1.5, 0], [1.5, 2.4]],
    [[0, 2.4], [3, 2.4]],
    [[2.6, 0.4], [0.2, 3.6]],
    [[0.6, 3.2], [2.6, 3.2], [1.6, 4]],
    [[1.6, 4], [1.6, 6], [1, 5.6]],
    [[0.2, 4.6], [3, 4.6]],
    [[4.2, 0], [3.4, 2]],
    [[3.8, 1.2], [6, 1.2]],
    [[5.4, 1.2], [4.6, 3.6], [3.2, 6]],
    [[3.8, 2.8], [6, 6]],
  ]),
  信: square([
    [[1.4, 0], [0.2, 2.8]],
    [[0.9, 1.6], [0.9, 6]],
    [[3.6, 0], [4.2, 0.6]],
    [[2, 1], [6, 1]],
    [[2.6, 2], [5.4, 2]],
    [[2.6, 3], [5.4, 3]],
    [[2.6, 4], [2.6, 6]],
    [[2.6, 4], [5.4, 4], [5.4, 6]],
    [[2.6, 6], [5.4, 6]],
  ]),
  者: square([
    [[1, 1.2], [5, 1.2]],
    [[3, 0], [3, 2.4]],
    [[0, 2.4], [6, 2.4]],
    [[5, 0.6], [1, 4.2]],
    [[1.6, 3.6], [1.6, 6]],
    [[1.6, 3.6], [5, 3.6], [5, 6]],
    [[1.6, 4.8], [5, 4.8]],
    [[1.6, 6], [5, 6]],
  ]),
  募: square([
    [[0.4, 0.7], [5.6, 0.7]],
    [[2, 0], [2, 1.3]],
    [[4, 0], [4, 1.3]],
    [[1.4, 1.6], [1.4, 3.2]],
    [[1.4, 1.6], [4.6, 1.6], [4.6, 3.2]],
    [[1.4, 2.4], [4.6, 2.4]],
    [[1.4, 3.2], [4.6, 3.2]],
    [[0.2, 3.9], [5.8, 3.9]],
    [[3, 3.3], [2.2, 4.5], [0.6, 5.2]],
    [[3.3, 4.1], [5.6, 5.1]],
    [[1.8, 4.9], [4.2, 4.9], [4, 6], [3.4, 5.8]],
    [[3, 4.4], [1.6, 6]],
  ]),
  集: square([
    [[1.6, 0], [0.4, 2]],
    [[1.2, 1.2], [1.2, 3.4]],
    [[3, 0], [3.4, 0.8]],
    [[1.2, 0.8], [5.6, 0.8]],
    [[1.2, 1.6], [5, 1.6]],
    [[1.2, 2.4], [5, 2.4]],
    [[1.2, 3.2], [5.6, 3.2]],
    [[3.2, 0.8], [3.2, 3.2]],
    [[0.4, 4.2], [5.6, 4.2]],
    [[3, 3.4], [3, 6]],
    [[3, 4.4], [0.6, 6]],
    [[3, 4.4], [5.4, 6]],
  ]),
  緑: square([
    [[1.2, 0], [0.4, 1.2], [1.6, 1.6]],
    [[1.6, 0.8], [0.2, 3], [2, 2.6]],
    [[1.1, 2.8], [1.1, 6]],
    [[0.4, 4.2], [0.1, 5.4]],
    [[1.8, 4.2], [2.1, 5.2]],
    [[2.8, 0.4], [5.4, 0.4], [5.4, 2.2]],
    [[3, 1.3], [5.4, 1.3]],
    [[2.6, 2.2], [5.8, 2.2]],
    [[4.2, 2.2], [4.2, 6], [3.6, 5.6]],
    [[2.8, 3.2], [3.6, 4]],
    [[2.6, 5.4], [4, 4.4]],
    [[5.6, 3], [4.4, 4.2], [5.8, 5.8]],
  ]),
  の: square([[[3, 1.2], [2.4, 4.6], [1.2, 5.2], [0.6, 3.8], [1.4, 1.6], [3, 0.8], [5, 1.4], [5.6, 3.2], [4.8, 5], [3.4, 5.8]]]),
  導: square([
    [[1.6, 0], [2, 0.5]],
    [[4.4, 0], [4, 0.5]],
    [[1, 0.8], [5, 0.8]],
    [[1.8, 1.4], [1.8, 3.2]],
    [[1.8, 1.4], [4.4, 1.4], [4.4, 3.2]],
    [[1.8, 2], [4.4, 2]],
    [[1.8, 2.6], [4.4, 2.6]],
    [[1.8, 3.2], [4.4, 3.2]],
    [[0.2, 0.8], [0.6, 1.2]],
    [[0, 2], [0.8, 2], [0.6, 3.4], [0.1, 3.8]],
    [[0.6, 3.4], [1.6, 3.8], [5.8, 3.8]],
    [[0.8, 4.6], [5.4, 4.6]],
    [[4.2, 4], [4.2, 6], [3.6, 5.6]],
    [[2.2, 5], [2.8, 5.6]],
  ]),
  き: square([[[1, 1], [4.6, 0.6]], [[1, 2.4], [5, 2]], [[2.4, 0], [4, 3.6]], [[4, 3.6], [1.6, 3.8], [1.8, 5.4], [4.4, 5.8]]]),
  に: square([[[0.8, 0.6], [0.4, 3], [0.8, 5.6]], [[2.6, 1.2], [5, 1]], [[2.6, 4.2], [3.2, 5.2], [5.4, 5.2]]]),
  身: square([
    [[3.2, 0], [2.4, 0.8]],
    [[1.4, 0.8], [1.4, 4.6]],
    [[1.4, 0.8], [4.4, 0.8], [4.4, 6], [3.6, 5.6]],
    [[1.4, 2], [4.4, 2]],
    [[1.4, 3.2], [4.4, 3.2]],
    [[0.2, 4.8], [5.8, 2.4]],
    [[3.2, 4], [0.4, 6]],
  ]),
  を: square([[[1, 1], [4, 0.8]], [[2.6, 0], [1, 3.2], [3.6, 2.4], [3.8, 3.4]], [[5, 2.4], [2.4, 4], [2.6, 5.6], [5, 5.8]]]),
  ゆ: square([
    [[0.8, 1.4], [0.6, 4.6], [1, 5]],
    [[1, 3.2], [2.4, 1.6], [4.4, 1.6], [5.2, 3], [4.4, 4.6], [2.6, 4.6]],
    [[3.2, 0.4], [3.4, 4], [2.6, 6]],
  ]),
  だ: square([
    [[0.4, 1.4], [2.8, 1.2]],
    [[1.6, 0], [0.6, 5.4]],
    [[3, 2.6], [5, 2.4]],
    [[3, 4.2], [3.4, 5.4], [5.4, 5.4]],
    [[4.6, 0], [4.9, 0.8]],
    [[5.4, 0], [5.7, 0.8]],
  ]),
  ね: square([
    [[0.4, 1.6], [1.6, 1.6], [0.2, 5.4]],
    [[1.6, 0], [1.6, 6]],
    [[1.6, 3.6], [3.4, 1.8], [5, 2.2], [5.2, 4.6], [4, 5.6], [3, 4.8], [4, 4.2], [5.8, 5.6]],
  ]),
  よ: square([[[2.6, 0], [2.6, 5.2], [1.4, 5.6], [0.8, 4.8], [2, 4.2], [4.8, 5.4]], [[2.6, 2.2], [4.6, 2]]]),
  は: square([[[0.8, 0.4], [0.4, 3], [0.8, 5.6]], [[2.4, 1.6], [5.4, 1.4]], [[4, 0], [4, 5], [3, 5.6], [2.4, 4.8], [3.6, 4.2], [5.6, 5.4]]]),
  あ: square([
    [[1, 1.2], [4.8, 0.8]],
    [[2.6, 0], [2.4, 3], [2.8, 5.6]],
    [[3.8, 2.2], [2, 4.8], [0.8, 4.6], [1.2, 3.2], [3.4, 2.6], [5, 3.2], [5.2, 4.6], [4, 5.6]],
  ]),
  な: square([
    [[0.4, 1.4], [2.6, 1.2]],
    [[1.6, 0], [0.6, 3.6]],
    [[4, 0.8], [5, 1.6]],
    [[4, 2.4], [3.8, 5.2], [2.6, 5.8], [2, 5], [3, 4.4], [5.4, 5.6]],
  ]),
  た: square([[[0.4, 1.4], [2.8, 1.2]], [[1.6, 0], [0.6, 5.4]], [[3, 2.6], [5, 2.4]], [[3, 4.2], [3.4, 5.4], [5.4, 5.4]]]),
  待: square([
    [[1.4, 0], [0.2, 1.4]],
    [[1.4, 1.6], [0.2, 3.2]],
    [[0.9, 2.6], [0.9, 6]],
    [[2.6, 1], [5.4, 1]],
    [[4, 0], [4, 2.2]],
    [[2.2, 2.2], [5.8, 2.2]],
    [[2.4, 3.4], [5.8, 3.4]],
    [[5, 2.8], [5, 6], [4.4, 5.6]],
    [[3, 4.4], [3.6, 5.2]],
  ]),
  っ: square([[[1.6, 3.4], [3.6, 2.8], [4.6, 3.6], [4, 5], [2.4, 5.8]]]),
  て: square([[[0.6, 1.4], [5.4, 1], [3, 2.6], [2.4, 4.2], [3.4, 5.8], [4.6, 5.8]]]),
  い: square([[[1, 1], [0.8, 4], [1.6, 5.4], [2.2, 4.6]], [[4.2, 1.6], [5.2, 3.8]]]),
  る: square([[[1.4, 0.8], [4.4, 0.6], [1, 4], [3.6, 3.2], [5, 4.4], [4, 5.8], [2.4, 5.4], [2.6, 4.8], [3.4, 5.2]]]),
};

/** One size of a tag's mask: per pixel how much paint, 0–255. */
export interface GraffitiLevel {
  w: number;
  h: number;
  paint: Uint8Array;
}

/** A tag as sprayed on its stretch: what it is, and where, in world units along the wall and down from the ceiling. */
export interface Tag {
  kind: Kind;
  /** XN's words, read through SAN; "" for anything else. */
  text: string;
  /** The dice for the hand. */
  seed: number;
  /** Along the wall's line, world x (a stretch running east) or y (south), where the mask starts and ends. */
  from: number;
  to: number;
  /** Down from the ceiling, where the mask starts and ends. */
  top: number;
  bottom: number;
  /** The tag's own layout, in mask pixels. */
  layout: Glyph[];
  maskW: number;
  maskH: number;
  /** Mask pixels to the wall's height. */
  px: number;
  /** Whether the mask runs the opposite way to the world's axis, so it reads left to right from its side. */
  reversed: boolean;
  /** How heavy the paint went on, and its colour. */
  strength: number;
  colour: readonly [number, number, number];
}

interface Glyph {
  /** For XN's words, its index into the text (its shape follows SAN); otherwise −1 and `ch` is the glyph. */
  at: number;
  ch: string;
  /** Where its grid's corner lands and how its grid is turned and scaled, in mask pixels. */
  x: number;
  y: number;
  cos: number;
  sin: number;
  step: number;
  /** The stroke's thickness, against the usual. */
  weight: number;
  /** How far gone the hand was, 0–1. */
  chaos: number;
  /** Its box's width in grid steps (6 tall): where a drawing is traced. */
  w: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Splits words into lines of about this many characters. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** A glyph to place: its character, its index into XN's text (or −1), and how its stroke goes. */
interface Item {
  ch: string;
  at: number;
  weight: number;
  /** How far gone the hand was, 0–1: the tally's last fives get wilder and wilder. */
  chaos: number;
}

/** What's on a tag, row by row (or column by column, written downwards), before it's laid out. */
interface Plan {
  rows: Item[][];
  /** Lays itself out instead of in rows: a drawing. */
  custom?: (size: number) => Placed[];
  /** What the tag says, read through SAN, when the plan decides it rather than the pick of XN's lines. */
  text?: string;
  /** Glyph height as a share of the wall: what it would like, and the least it can shrink to. */
  size: number;
  least: number;
  /** Rows written downwards, the next to the left, as Japanese is. */
  down: boolean;
  /** Space between glyphs and between rows, in grid steps. */
  gap: number;
  rowGap: number;
  /** How much each glyph wanders: off its place, and turned. */
  wander: number;
  turn: number;
  /** Turns the whole lot (an arrow). */
  angle: number;
  /** Slope of the rows. */
  slope: number;
  colour: readonly [number, number, number];
  /** Mask pixels to the wall's height: finer for small writing, so it's still sharp up close. */
  px: number;
  /** Written by hand at about eye height, rather than anywhere up the wall. */
  eye: boolean;
}

const item = (ch: string, at = -1, weight = 1, chaos = 0): Item => ({ ch, at, weight, chaos });

/** XN's words in rows of about `width` characters, each letter its index into the text. */
function textRows(text: string, width: number): Item[][] {
  const rows: Item[][] = [];
  let at = 0;
  for (const line of wrap(text, width)) {
    while (text[at] === " ") at++;
    rows.push(Array.from(line, (ch, i) => item(ch === " " ? " " : "", at + i)));
    at += line.length;
  }
  return rows;
}

/** What goes on a tag of this kind, by its dice. `pickText` is which of the lines, for words and slogans. */
function planOf(kind: Kind, text: string, pickText: number, r: (k: number) => number): Plan {
  const base = {
    down: false,
    gap: 1.5,
    rowGap: 3.3,
    wander: 1,
    turn: 0.22,
    angle: 0,
    slope: (r(1) - 0.5) * 0.14,
    px: PX,
    eye: false,
  };
  switch (kind) {
    case "text":
      return { ...base, rows: textRows(text, 9 + Math.floor(r(2) * 8)), size: 0.13 + r(0) * 0.07, least: 0.08, colour: BLACK };
    case "arrow":
      return {
        ...base,
        rows: [[item("→")]],
        size: 0.4 + r(2) * 0.3,
        least: 0.2,
        angle: r(6) * Math.PI * 2,
        wander: 0,
        turn: 0,
        slope: 0,
        colour: BLACK,
      };
    case "tally": {
      // Up to thirteen fives, often all thirteen, and a few marks over.
      const fives = r(2) < 0.3 ? 13 : 1 + Math.floor(r(3) * 13);
      const over = fives === 13 ? 0 : Math.floor(r(4) * 5);
      const perRow = 4 + Math.floor(r(5) * 4);
      // Neat to begin with, until whoever it was starts losing it: some by the fourth five, some not till the
      // twelfth, and a few never do. From there it gets wilder five by five, until it's only a scrawl.
      const calm = r(7) < 0.12;
      const snaps = 3 + r(8) * 8;
      const unravels = 2 + r(9) * 4;
      const chaosAt = (n: number) => (calm ? 0.12 * (n / 12) : clamp01((n - snaps) / unravels) ** 1.2);
      const mark = (ch: string, n: number) => item(ch, -1, 0.6, chaosAt(n));
      const rows: Item[][] = [];
      for (let i = 0; i < fives; i += perRow) {
        rows.push(Array.from({ length: Math.min(perRow, fives - i) }, (_, j) => mark(TALLY_FIVE, i + j)));
      }
      // The marks over a last five: on the same row if it has room, else a row of their own.
      const singles = Array.from({ length: over }, () => mark(TALLY_ONE, fives));
      const last = rows[rows.length - 1];
      if (singles.length && last.length < perRow) last.push(...singles);
      else if (singles.length) rows.push(singles);
      // Tiny, scratched in by hand at about eye height: smaller than the cult's writing.
      return {
        ...base,
        rows,
        size: 0.035 + r(0) * 0.015,
        least: 0.025,
        gap: 1.6,
        rowGap: 2.6,
        turn: 0.08,
        wander: 0.5,
        slope: (r(1) - 0.5) * 0.06,
        colour: BLACK,
        px: 384,
        eye: true,
      };
    }
    case "portrait":
      return portraitPlan(base, r);
    case "shrine":
      return shrinePlan(base, pickText, r);
    case "cult": {
      const slogan = CULT_TEXTS[pickText];
      // Small and neat, as a person writes on a wall at eye height: one line, or two if it's long.
      const down = r(6) < 0.5;
      const chars = Array.from(slogan);
      const per = chars.length > 8 && r(2) < 0.7 ? Math.ceil(chars.length / 2) : chars.length;
      const rows: Item[][] = [];
      for (let i = 0; i < chars.length; i += per) rows.push(chars.slice(i, i + per).map((ch) => item(ch, -1, 0.55)));
      return {
        ...base,
        rows,
        down,
        size: 0.055 + r(0) * 0.03,
        least: 0.04,
        gap: 0.8,
        rowGap: 1.4,
        turn: 0.07,
        wander: 0.35,
        slope: (r(1) - 0.5) * 0.06,
        colour: GREEN,
        px: 288,
        eye: true,
      };
    }
  }
}

/**
 * XN's drawing of herself and Kara, side by side: mostly on their heads, as Kiri drew them; now and then turned
 * upright, or toppled over. They never lean the same way: one tips one side, the other the other. Often labelled,
 * "me" with an arrow at her and "kara" by Kara's head.
 */
function portraitPlan(base: Omit<Plan, "rows" | "size" | "least" | "colour">, r: (k: number) => number): Plan {
  const labelled = r(8) < 0.6;
  const pose = r(9);
  // The drawings are upside down: turned 0 is on their heads, π upright.
  const tilt =
    pose < 0.6
      ? (r(10) - 0.5) * 0.12
      : pose < 0.85
        ? Math.PI + (r(10) - 0.5) * 0.12
        : (r(10) < 0.5 ? -1 : 1) * (0.5 + r(11) * 0.5);
  // How far each leans off that, opposite ways; which way XN goes is a toss.
  const lean = (r(7) < 0.5 ? -1 : 1) * (0.15 + r(6) * 0.25);
  const text = labelled ? "me kara" : "";
  const hand = Math.floor(r(12) * 1e6);
  const custom = (size: number): Placed[] => {
    const step = size / 6;
    const out: Placed[] = [];
    const g = (k: number) => hash3(hand, k, 7727);
    // Half the width a drawing takes, in grid steps, turned this far.
    const halfWidth = (angle: number) => (FIGURE_W / 2) * Math.abs(Math.cos(angle)) + 3 * Math.abs(Math.sin(angle));
    const xnTilt = tilt - lean + (g(5) - 0.5) * 0.08;
    const karaTilt = tilt + lean + (g(7) - 0.5) * 0.08;
    // The labels are small next to the drawings.
    const letter = 0.2;
    const lw = step * letter;
    let x = (halfWidth(xnTilt) - FIGURE_W / 2) * step;
    if (labelled) {
      // "me →", at the height of her head, wherever the pose has put it (low in the drawing).
      const headY = 3 + Math.cos(xnTilt) * 1.7;
      const y = (headY - 3 * letter) * step;
      const glyph = (it: Item, at: number, k: number, w = 4) =>
        out.push({ item: it, x: at, y: y + (g(k) - 0.5) * lw, angle: (g(k + 1) - 0.5) * 0.3, scale: letter, w });
      let lx = 0;
      glyph(item("", 0, 0.8), lx, 0);
      lx += lw * 5.4;
      glyph(item("", 1, 0.8), lx, 2);
      lx += lw * 5.6;
      glyph(item("→", -1, 0.8), lx, 4, 4.4);
      x += lx + lw * 6 - 0.6 * step;
    }
    out.push({ item: item(XN_FIGURE), x, y: 0, angle: xnTilt, scale: 1, w: FIGURE_W });
    // Kara beside her, far enough that the two don't run into each other however they lean.
    x += (halfWidth(xnTilt) + halfWidth(karaTilt) - 0.7 + g(6) * 0.5) * step;
    const ky = (g(8) - 0.5) * step * 0.6;
    const kScale = 0.92 + g(9) * 0.12;
    out.push({ item: item(KARA_FIGURE), x, y: ky, angle: karaTilt, scale: kScale, w: FIGURE_W });
    if (labelled) {
      // "kara" by her head: under the drawing while she's on her head, over it once she's upright.
      const y = Math.cos(karaTilt) > 0 ? ky + 6 * step + step * 0.4 : ky - letter * 6 * step - step * 0.4;
      const kx = x + (FIGURE_W / 2) * step - lw * 5.4 * 2;
      for (let i = 0; i < 4; i++) {
        out.push({
          item: item("", 3 + i, 0.8),
          x: kx + i * lw * 5.4,
          y: y + (g(10 + i) - 0.5) * lw,
          angle: (g(14 + i) - 0.5) * 0.3,
          scale: letter,
          w: 4,
        });
      }
    }
    return out;
  };
  return { ...base, rows: [], custom, text, size: 0.55 + r(0) * 0.15, least: 0.3, colour: BLACK, px: 512 };
}

/**
 * The cat god, drawn by a believer: upright, with care, in the cult's green pen at eye height. Half the time one of
 * the slogans is written small under its feet, picked at random.
 */
function shrinePlan(base: Omit<Plan, "rows" | "size" | "least" | "colour">, pickText: number, r: (k: number) => number): Plan {
  const captioned = r(7) < 0.5;
  const tilt = (r(10) - 0.5) * 0.08;
  const chars = Array.from(CULT_TEXTS[pickText]);
  const custom = (size: number): Placed[] => {
    const step = size / 6;
    const out: Placed[] = [];
    const g = (k: number) => hash3(Math.floor(r(12) * 1e6), k, 7729);
    out.push({ item: item(GOD_FIGURE), x: 0, y: 0, angle: tilt, scale: 1, w: GOD_W });
    if (captioned) {
      // The slogan in the cult's small hand, the size it's written elsewhere: one line, or two if it's long.
      const letter = 0.07 / size;
      const lw = step * letter;
      const per = chars.length > 8 ? Math.ceil(chars.length / 2) : chars.length;
      for (let i = 0; i < chars.length; i += per) {
        const row = chars.slice(i, i + per);
        const width = row.length * lw * 6.8;
        const y = 6 * step + step * 0.3 + (i / per) * lw * 7.4;
        row.forEach((ch, j) => {
          out.push({
            item: item(ch, -1, 0.55),
            x: (GOD_W / 2) * step - width / 2 + j * lw * 6.8 + (g(j * 3) - 0.5) * lw * 0.4,
            y: y + (g(j * 3 + 1) - 0.5) * lw * 0.4,
            angle: (g(j * 3 + 2) - 0.5) * 0.08,
            scale: letter,
            w: 6,
          });
        });
      }
    }
    return out;
  };
  return { ...base, rows: [], custom, size: 0.45 + r(0) * 0.12, least: 0.28, colour: GREEN, px: 512, eye: true };
}

/** Glyphs placed in wall units, relative to the tag's own corner, before the bounds are known. */
interface Placed {
  item: Item;
  x: number;
  y: number;
  angle: number;
  scale: number;
  w: number;
}

/** Lays the plan out at this glyph height. */
function place(plan: Plan, size: number, seed: number): Placed[] {
  if (plan.custom) return plan.custom(size);
  const step = size / 6;
  const out: Placed[] = [];
  const columns = plan.down ? plan.rows.length : 0;
  plan.rows.forEach((row, ri) => {
    const indent = (hash3(seed, 900 + ri, 7719) - 0.3) * size * 0.8 * plan.wander;
    let along = Math.max(0, indent);
    row.forEach((it, ci) => {
      const g = (k: number) => hash3(seed, (it.at >= 0 ? it.at : ri * 64 + ci) * 16 + k, 7723);
      const def = GLYPHS[it.ch.toUpperCase()] ?? GLYPHS.A;
      const w = it.ch === " " ? 2.5 : def.w;
      const c = it.chaos;
      if (it.ch !== " ") {
        // The wilder the hand, the further off its place, the more turned, and the bigger and less even.
        const jx = (g(0) - 0.5) * size * (0.12 * plan.wander + c * 0.7);
        const jy = (g(1) - 0.5) * size * (0.16 * plan.wander + c * 0.9) + c * c * size * 0.5 * g(4);
        const x = plan.down ? (columns - 1 - ri) * step * (6 + plan.rowGap) + jx : along + jx;
        const y = plan.down ? along + jy : ri * step * (6 + plan.rowGap) + along * plan.slope + jy;
        const angle = plan.angle + (g(2) - 0.5) * (plan.turn + c * 1.3);
        const scale = 1 + (g(3) - 0.5) * (0.16 * plan.wander + c * 0.7) + c * 0.3;
        out.push({ item: it, x, y, angle, scale, w });
      }
      along += step * ((plan.down ? 6 : w) + plan.gap) * (1 + (g(5) - 0.4) * c * 0.9);
    });
  });
  return out;
}

/** The bounds of what's placed, with the stroke and overspray round it and room below for drips. */
function bounds(placed: Placed[], size: number, drip: number): [number, number, number, number] {
  const step = size / 6;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of placed) {
    const s = step * p.scale;
    const c = Math.cos(p.angle), n = Math.sin(p.angle);
    const m = 0.6 + p.item.chaos * 2.5;
    for (const [gx, gy] of [[-m, -m], [p.w + m, -m], [-m, 6 + m], [p.w + m, 6 + m]]) {
      const lx = (gx - p.w / 2) * s;
      const ly = (gy - 3) * s;
      const wx = p.x + (p.w / 2) * s + lx * c - ly * n;
      const wy = p.y + 3 * s + lx * n + ly * c;
      x0 = Math.min(x0, wx);
      x1 = Math.max(x1, wx);
      y0 = Math.min(y0, wy);
      y1 = Math.max(y1, wy);
    }
  }
  const reach = step * 1.6;
  return [x0 - reach, x1 + reach, y0 - reach, y1 + reach + size * drip];
}

/** The tallest a tag may be, as a share of the wall. */
const TALLEST = 0.94;

/**
 * Lays out a tag in the room it has on its stretch (`room` cells along, from `start`), or returns null if it won't fit
 * at a readable size. The hand: each glyph a little turned and off the line, the rows sloping, the whole careless.
 */
function layOut(plan: Plan, kind: Kind, text: string, seed: number, start: number, room: number, reversed: boolean): Tag | null {
  const r = (k: number) => hash3(seed, k, 7717);
  let size = plan.size;
  let placed = place(plan, size, seed);
  let [x0, x1, y0, y1] = bounds(placed, size, plan.custom ? 0.12 : 0.6);
  // Too big for the room: smaller, but not too small to read. The hand wanders, so it's measured again after.
  for (let tries = 0; tries < 4; tries++) {
    const fit = Math.min((room - 0.1) / (x1 - x0), TALLEST / (y1 - y0));
    if (fit >= 1) break;
    size *= fit * 0.97;
    if (size < plan.least) return null;
    placed = place(plan, size, seed);
    [x0, x1, y0, y1] = bounds(placed, size, plan.custom ? 0.12 : 0.6);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  if (w > room || h > TALLEST) return null;
  const step = size / 6;

  const along = start + 0.05 + r(3) * Math.max(0, room - w - 0.1);
  const top = plan.eye
    ? Math.min(0.96 - h, Math.max(0.04, 0.32 + r(4) * 0.3 - h / 2))
    : 0.04 + r(4) * Math.max(0, 0.92 - h);
  const px = plan.px;
  const layout: Glyph[] = placed.map((p) => ({
    at: p.item.at,
    ch: p.item.ch,
    x: (p.x - x0) * px,
    y: (p.y - y0) * px,
    cos: Math.cos(p.angle),
    sin: Math.sin(p.angle),
    step: step * p.scale * px,
    weight: p.item.weight,
    chaos: p.item.chaos,
    w: p.w,
  }));
  return {
    kind,
    text,
    seed,
    from: along,
    to: along + w,
    top,
    bottom: top + h,
    layout,
    maskW: Math.ceil(w * px),
    maskH: Math.ceil(h * px),
    px,
    reversed,
    strength: 0.78 + r(5) * 0.2,
    colour: plan.colour,
  };
}

/** Sprays one stroke into the mask: a hard core, speckled overspray round it, and now and then a drip. */
function spray(tag: Tag, paint: Uint8Array, glyph: Glyph, def: GlyphDef, stroke: Stroke, k: number) {
  const W = tag.maskW;
  const H = tag.maskH;
  const radius = glyph.step * STROKE * glyph.weight * (1 + glyph.chaos * 0.7);
  const spread = radius + Math.max(1, radius * 0.6);
  const jitter = (i: number, a: number) => (hash3(tag.seed, k * 64 + i * 2 + a, 7741) - 0.5) * (0.5 + glyph.chaos * 2.2);
  const mid = def.w / 2;
  const pts = stroke.map(([gx, gy], i) => {
    const lx = (gx + jitter(i, 0) - mid) * glyph.step;
    const ly = (gy + jitter(i, 1) - 3) * glyph.step;
    return [
      glyph.x + mid * glyph.step + lx * glyph.cos - ly * glyph.sin,
      glyph.y + 3 * glyph.step + lx * glyph.sin + ly * glyph.cos,
    ] as const;
  });
  const dab = (ax: number, ay: number, bx: number, by: number, core: number, fringe: number) => {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - fringe));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + fringe));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - fringe));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by) + fringe));
    const ex = bx - ax;
    const ey = by - ay;
    const len2 = ex * ex + ey * ey || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = clamp01((px * ex + py * ey) / len2);
        const d = Math.hypot(px - ex * t, py - ey * t);
        let a = 0;
        if (d < core) a = 1;
        else if (d < fringe) {
          const fall = 1 - (d - core) / (fringe - core);
          if (hash3(x, y, tag.seed + k) < fall * 0.7) a = 0.35 + fall * 0.4;
        }
        const i = y * W + x;
        const v = Math.round(a * 255);
        if (v > paint[i]) paint[i] = v;
      }
    }
  };
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[Math.min(i + 1, pts.length - 1)];
    dab(ax, ay, bx, by, radius, spread);
    // Where the can paused, the paint ran: a thin drip straight down, ending in a bead. Not from a pen.
    const roll = tag.kind === "cult" || tag.kind === "tally" || tag.kind === "shrine" ? 1 : hash3(tag.seed, k * 64 + i, 7753);
    if (roll < 0.14) {
      const length = (0.3 + hash3(tag.seed, k * 64 + i, 7759) * 0.9) * glyph.step * 3;
      const thin = Math.max(0.5, radius * 0.45);
      dab(ax, ay, ax, ay + length, thin, thin + 0.6);
      dab(ax, ay + length, ax, ay + length, thin * 1.5, thin * 1.5 + 0.5);
    }
  }
}

/** Half the size: each pixel the average of four. */
function halve(level: GraffitiLevel): GraffitiLevel {
  const w = Math.max(1, level.w >> 1);
  const h = Math.max(1, level.h >> 1);
  const paint = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          sum += level.paint[Math.min(level.h - 1, y * 2 + j) * level.w + Math.min(level.w - 1, x * 2 + i)];
        }
      }
      paint[y * w + x] = sum >> 2;
    }
  }
  return { w, h, paint };
}

/** Traces a drawing into the mask, turned and scaled as its glyph is, in its box (the glyph's width × 6). */
function trace(tag: Tag, paint: Uint8Array, glyph: Glyph, drawing: Drawing) {
  const W = tag.maskW;
  const H = tag.maskH;
  const half = (glyph.w / 2) * glyph.step;
  const cx = glyph.x + half;
  const cy = glyph.y + 3 * glyph.step;
  const reach = Math.hypot(half, 3 * glyph.step);
  const x0 = Math.max(0, Math.floor(cx - reach));
  const x1 = Math.min(W - 1, Math.ceil(cx + reach));
  const y0 = Math.max(0, Math.floor(cy - reach));
  const y1 = Math.min(H - 1, Math.ceil(cy + reach));
  const { w: dw, h: dh, ink } = drawing;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      // Back into the drawing's own frame, 0–1 across and down.
      const u = (px * glyph.cos + py * glyph.sin) / (glyph.w * glyph.step) + 0.5;
      const v = (py * glyph.cos - px * glyph.sin) / (6 * glyph.step) + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      // Bilinear, so the drawing's thin lines don't break up.
      const fx = u * dw - 0.5;
      const fy = v * dh - 0.5;
      const ix = Math.max(0, Math.min(dw - 2, Math.floor(fx)));
      const iy = Math.max(0, Math.min(dh - 2, Math.floor(fy)));
      const tx = clamp01(fx - ix);
      const ty = clamp01(fy - iy);
      const k = iy * dw + ix;
      const a = Math.min(255, ((ink[k] * (1 - tx) + ink[k + 1] * tx) * (1 - ty) + (ink[k + dw] * (1 - tx) + ink[k + dw + 1] * tx) * ty) * INK_GAIN);
      const i = y * W + x;
      if (a > paint[i]) paint[i] = a;
    }
  }
}

/** The tag's mask as it reads now (`shown` is XN's text after SAN has had its say), at every size. */
function sprayTag(tag: Tag, shown: string): GraffitiLevel[] {
  const paint = new Uint8Array(tag.maskW * tag.maskH);
  tag.layout.forEach((glyph, gi) => {
    const char = glyph.at >= 0 ? shown[glyph.at].toUpperCase() : glyph.ch;
    const drawing = drawings.get(char);
    if (drawing) {
      trace(tag, paint, glyph, drawing);
      return;
    }
    const def = GLYPHS[char];
    if (!def) return;
    def.strokes.forEach((stroke, si) => spray(tag, paint, glyph, def, stroke, gi * 16 + si));
    // Far enough gone, the count turns to slashes scored back and forth over it.
    const extra = Math.floor(Math.max(0, glyph.chaos - 0.4) * 9);
    for (let e = 0; e < extra; e++) {
      const d = (k: number) => hash3(tag.seed, gi * 97 + e * 7 + k, 7771);
      const slash: Stroke = [
        [-0.8 + d(0) * (def.w + 1.6), -0.6 + d(1) * 7.2],
        [-0.8 + d(2) * (def.w + 1.6), -0.6 + d(3) * 7.2],
        ...(d(4) < 0.4 ? [[-0.8 + d(5) * (def.w + 1.6), -0.6 + d(6) * 7.2] as const] : []),
      ];
      spray(tag, paint, glyph, def, slash, gi * 16 + 8 + e);
    }
  });
  const levels: GraffitiLevel[] = [{ w: tag.maskW, h: tag.maskH, paint }];
  while (levels[levels.length - 1].h > 6) levels.push(halve(levels[levels.length - 1]));
  return levels;
}

/** Masks already sprayed, by tag and what it shows. Kept small: SAN only changes a word now and then. */
const sprayed = new Map<string, GraffitiLevel[]>();
const SPRAYED_MAX = 160;

/** The tag's mask showing `shown` (XN's words as read now; "" for anything else). */
export function tagArt(tag: Tag, shown: string): GraffitiLevel[] {
  const key = `${tag.seed}|${tag.from}|${shown}`;
  let art = sprayed.get(key);
  if (!art) {
    art = sprayTag(tag, shown);
    if (sprayed.size >= SPRAYED_MAX) sprayed.delete(sprayed.keys().next().value as string);
    sprayed.set(key, art);
  }
  return art;
}


/** Whether the cell is wall and the one on this side of the stretch (0 north or west, 1 south or east) is open. */
const sideOpen = (map: WorldMap, x: number, y: number, dir: number, side: number) =>
  map.wall(x, y) === 1 &&
  map.wall(x + (dir === 1 ? (side ? 1 : -1) : 0), y + (dir === 0 ? (side ? 1 : -1) : 0)) === 0;

/** The longest run of cells on this side of the stretch that can be seen, as [first m, count]. */
function openRun(map: WorldMap, lx: number, ly: number, dir: number, side: number): [number, number] {
  let best: [number, number] = [0, 0];
  let first = 0;
  let count = 0;
  for (let m = 1; m <= 4; m++) {
    const x = dir === 0 ? lx * 5 + m : lx * 5;
    const y = dir === 0 ? ly * 5 : ly * 5 + m;
    if (sideOpen(map, x, y, dir, side)) {
      if (!count) first = m;
      count++;
      if (count > best[1]) best = [first, count];
    } else count = 0;
  }
  return best;
}

/** Which kind, by a die. */
function kindOf(dice: number): Kind {
  for (const [kind, share] of KINDS) {
    if (dice < share) return kind;
    dice -= share;
  }
  return "text";
}

/** What a preview forces: the kind, which line, and for a slogan whether it runs down. */
interface Forced {
  kind: Kind;
  line: number;
  /** Dice it fixes: a slogan's direction (6); a drawing's lean (7), labels (8) and pose (9); a shrine's caption (7). */
  dice?: Record<number, number>;
}

/** Tags by stretch, side and map: they're laid out once. */
const known = new WeakMap<WorldMap, Map<string, Tag | null>>();

/**
 * The tag on one side of the stretch of lattice from point (lx, ly), running east (dir 0) or south (1), or null.
 * Side 0 faces north or west, side 1 south or east.
 */
function tagOn(map: WorldMap, lx: number, ly: number, dir: number, side: number, tuning: Tuning): Tag | null {
  let tags = known.get(map);
  if (!tags) {
    tags = new Map();
    known.set(map, tags);
  }
  const key = `${lx},${ly},${dir},${side},${tuning.graffiti}`;
  const had = tags.get(key);
  if (had !== undefined) return had;
  let tag: Tag | null = null;
  const forced = PREVIEW ? previewFor(map).get(`${lx},${ly},${dir},${side}`) : undefined;
  const pick = (k: number) => map.noise(lx * 2 + dir, ly * 2 + side, 500 + k);
  if (forced || pick(0) < (CHANCE * tuning.graffiti) / 100) {
    const [first, count] = openRun(map, lx, ly, dir, side);
    if (count) {
      const kind = forced?.kind ?? kindOf(pick(1));
      const lines = kind === "cult" || kind === "shrine" ? CULT_TEXTS : GRAFFITI_TEXTS;
      const line = forced?.line ?? Math.floor(pick(2) * lines.length);
      const text = kind === "text" ? GRAFFITI_TEXTS[line] : "";
      const seed = Math.floor(pick(3) * 0x7fffffff);
      const dice = (k: number) => hash3(seed, k, 7717);
      // A preview fixes what it wants to show; the rest of its dice stay.
      const fixed = forced?.dice;
      const r = fixed ? (k: number) => fixed[k] ?? dice(k) : dice;
      const plan = planOf(kind, text, line, r);
      // Seen from the north (side 0 of an east-running stretch) or the east (side 1 of a south-running one), the
      // world's axis runs right to left.
      const reversed = dir === 0 ? side === 0 : side === 1;
      tag = layOut(plan, kind, plan.text ?? text, seed, (dir === 0 ? lx : ly) * 5 + first, count, reversed);
    }
  }
  tags.set(key, tag);
  return tag;
}

/**
 * What's on one face of wall cell (cx, cy), or null. `face` is the side it's seen from, as for posters: 0 from the
 * west, 1 the east, 2 the north, 3 the south. Only the long faces of a stretch carry any.
 */
export function graffitiOn(map: WorldMap, cx: number, cy: number, face: number, tuning: Tuning): Tag | null {
  if (face >= 2) {
    const lx = Math.floor(cx / 5);
    if (cx - lx * 5 === 0 || cy % 5 !== 0) return null;
    return tagOn(map, lx, cy / 5, 0, face === 2 ? 0 : 1, tuning);
  }
  const ly = Math.floor(cy / 5);
  if (cy - ly * 5 === 0 || cx % 5 !== 0) return null;
  return tagOn(map, cx / 5, ly, 1, face === 0 ? 0 : 1, tuning);
}

/**
 * TEMPORARY, for Kiri to look over: every one of XN's lines and the cult's slogans (two across, two down), arrows
 * and tally marks, on the stretches nearest where the visitor starts (the room she starts in has none,
 * only posts). Gone once she's happy.
 */
const PREVIEW = true;
const PREVIEW_ORDER: readonly Forced[] = [
  // On their heads, labelled, leaning one way and then the other; upright, labelled; toppled, no words.
  { kind: "portrait", line: 0, dice: { 7: 0, 8: 0, 9: 0.3 } },
  { kind: "portrait", line: 0, dice: { 7: 0.99, 8: 0.99, 9: 0.3 } },
  { kind: "portrait", line: 0, dice: { 7: 0, 8: 0, 9: 0.7 } },
  { kind: "portrait", line: 0, dice: { 7: 0.99, 8: 0.99, 9: 0.9 } },
  // The cat god with a slogan under it, and without.
  { kind: "shrine", line: 2, dice: { 7: 0 } },
  { kind: "shrine", line: 0, dice: { 7: 0.99 } },
  { kind: "cult", line: 0, dice: { 6: 0 } },
  { kind: "cult", line: 1, dice: { 6: 0.99 } },
  { kind: "cult", line: 2, dice: { 6: 0 } },
  { kind: "cult", line: 3, dice: { 6: 0.99 } },
  { kind: "tally", line: 0 },
  { kind: "tally", line: 0 },
  ...GRAFFITI_TEXTS.map((_, line): Forced => ({ kind: "text", line })),
  { kind: "arrow", line: 0 },
  { kind: "arrow", line: 0 },
];
const previews = new WeakMap<WorldMap, Map<string, Forced>>();

function previewFor(map: WorldMap): Map<string, Forced> {
  const had = previews.get(map);
  if (had) return had;
  const sides: [string, number][] = [];
  for (let ly = -3; ly <= 4; ly++) {
    for (let lx = -3; lx <= 4; lx++) {
      for (let dir = 0; dir < 2; dir++) {
        for (let side = 0; side < 2; side++) {
          const [first, count] = openRun(map, lx, ly, dir, side);
          if (count < 3) continue;
          const mid = first + count / 2;
          const x = dir === 0 ? lx * 5 + mid : lx * 5 + (side ? 1 : 0);
          const y = dir === 0 ? ly * 5 + (side ? 1 : 0) : ly * 5 + mid;
          sides.push([`${lx},${ly},${dir},${side}`, Math.hypot(x - 2.5, y - 2.5)]);
        }
      }
    }
  }
  sides.sort((a, b) => a[1] - b[1]);
  const out = new Map<string, Forced>();
  sides.slice(0, PREVIEW_ORDER.length).forEach(([key], i) => out.set(key, PREVIEW_ORDER[i]));
  previews.set(map, out);
  return out;
}

/** The paint on the wall at this point of the tag, 0–1: `along` in world units, `down` from the ceiling. */
export function paintAt(tag: Tag, art: GraffitiLevel[], level: number, along: number, down: number): number {
  let u = (along - tag.from) / (tag.to - tag.from);
  if (tag.reversed) u = 1 - u;
  const v = (down - tag.top) / (tag.bottom - tag.top);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
  const l = art[Math.min(level, art.length - 1)];
  return (l.paint[Math.floor(v * l.h) * l.w + Math.floor(u * l.w)] / 255) * tag.strength;
}
