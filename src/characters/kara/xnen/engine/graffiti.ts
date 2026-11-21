import { hash3 } from "./hash";
import { campBed, type BurgerPlan, type WorldMap } from "./map";
import type { Tuning } from "./tuning";
import { GRAFFITI_WEIGHTS, heaviest } from "./zones";

/*
 * Marks on the walls, here and there at random, and only on the walls:
 *
 * - XN's graffiti: big crooked capitals sprayed in black. What she wrote is English; how much of it the visitor can
 *   read follows their SAN, word by word, the same as her subtitles (the renderer is handed the reading). ROT13 keeps
 *   every word's length, so the letters stay where they were sprayed and only their shapes change.
 * - Arrows, in the same black, pointing nowhere in particular.
 * - Tally marks, tiny, in blood, anywhere from eye height down: someone who wandered in, counting with a bitten
 *   finger, in fives, up to thirteen fives. Not XN: hers is the black.
 * - What the lost wrote in blood, in the same finger: despair, and fear of her. Some of it mirrored, bending away,
 *   running out of blood, or wiped over; now and then XN has written back underneath, small.
 * - XN's drawings of herself and Kara (Kiri's drawings, traced in black): on their heads as they are, turned
 *   upright or toppled over, leaning opposite ways, and labelled "me" and "kara" (read through SAN like her
 *   words: at first they say ZR and XNEN).
 * - The Weed Cat Cult's slogans off its poster, written small in green by hand at eye height, across or down.
 * - The cult's cat god (Kiri's drawing, traced in the same green), drawn upright with care at eye height, half the
 *   time with one of the slogans written small under it. XN has been at some of them in her black: a moustache,
 *   angry eyebrows, tears, words put in its mouth, a remark and an arrow, more leaves, the slogan struck out and answered. Her words read
 *   through SAN like the rest of hers.
 * - The cult's sign on its own (the leaf on the cat god's chest, Kiri's drawing), in the same green pen: no words,
 *   and XN leaves it alone.
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
  "i hid thursday behind this wall. dont tell it",
  "i ate the map. now i am the map",
  "im the ceiling on weekends",
  "this wall was a door until it met me",
  "kiri drew me upside down. i fixed the world instead",
  "this side up",
  "i taught the carpet to sit. now it wont get up",
  "knock first. the door is changing",
  "this is the third time this wall has been here",
  "the ceiling has my number",
  "i lost a hallway around here. if you see it dont tell it",
  "the exit is upside down. so am i. we get along",
  "you were here. you just havent been yet",
  "if found please return to the hallway",
  "humming lesson today. bring your teeth",
  "xrer put a rule on this wall. i licked it off",
  "koro said i should talk to someone. i talk to this wall",
  "xbeb is jealous of this wall. its a very good wall",
  "kere alphabetized the lights. i ate the b",
  "its 4:20 in this corner",
  "this is a dream. not yours",
  "i keep the stairs in a box. they bite",
];

/** The cult's slogans, off its poster. */
export const CULT_TEXTS: readonly string[] = ["大麻猫神教", "信者募集", "猫神はあなたを待っている", "緑の導きに身をゆだねよ"];

/** What XN writes beside the cat god, with an arrow at it. */
const GOD_REMARKS: readonly string[] = [
  "it owes me money",
  "not a cat",
  "i met it. it was shorter",
  "ask it about thursday",
  "wrong god",
  "it cant read",
  "this one is fake",
];

/** What XN puts in the cat god's mouth. */
const GOD_SAYS: readonly string[] = [
  "meow",
  "i am just a cat",
  "send snacks",
  "help",
  "i dont know these people",
  "smoke weed everyday",
];

/**
 * What the lost wrote in blood: whoever wandered in, coming apart, afraid of her (they call her "it"). Plain English
 * while SAN holds; it goes to ROT13 as the other cats' words do. Beside each, what XN wrote back, now and then, in her
 * black, read through SAN as the rest of hers is; "" where she never does.
 */
const PLEAS: readonly (readonly [string, string])[] = [
  ["dont look at its eye", "which one"],
  ["it walks upside down", "you walk wrong"],
  ["it smiles without a mouth", "i have a mouth"],
  ["run", "why"],
  ["help", "with what"],
  ["i cant find the wall i came in", "it moved"],
  ["where did the others go", "around"],
  ["it was kind to me", ""],
  ["still here still here still her", "me too"],
  ["wake up wake up", "no"],
  ["it has been 65 days or one", "its thursday"],
  ["no no no no no no no no", ""],
  ["i forgot what the sky is", "yellow"],
  ["the hum is inside my teeth", "its singing"],
  ["let me out", "out of what"],
  ["im sorry im sorry im sorry", "its ok"],
  ["i heard my own voice around the corner", "that was me"],
  ["it never stops laughing", "you laughed too"],
  ["i can hear it breathing in the walls", "thats not me"],
  ["i wrote this before", "you did"],
  ["god is not here", "it is. its green"],
  ["i am not real anymore", ""],
  ["ha ha ha ha ha ha ha", ""],
  ["please", ""],
  // From here on, only on the outside of a pit room's walls: warnings, from those who got that far.
  ["dont look down", "i do"],
  ["it has no bottom", "it has a top"],
  ["the floor ends here", "it starts here"],
  ["someone is still falling", "they wave"],
  ["i never heard them land", "nobody lands"],
];
/** Where the warnings by the pit rooms start in PLEAS. Everywhere else the lost write from the ones before. */
const PIT_PLEAS = PLEAS.length - 5;
/** How often a side of a stretch on the outside of a pit room's wall has a warning on it, at 100 %. */
const PIT_WARNING = 0.3;
/** How often XN has answered one. */
const ANSWERED = 0.25;
/**
 * In a camp, only what the one who lived there wrote: the count always on the wall the bed's along, and on each of
 * the other walls, this often, the count again or their words (as often as CAMP_TALLY says the count).
 */
const CAMP_WRITING = 0.7;
const CAMP_TALLY = 0.3;
/**
 * How often the hand went wrong in a particular way: the whole thing mirrored (or only its letters), the line
 * bending off up or down, the blood giving out partway, the whole thing wiped over with a hand.
 */
const MIRRORED = 0.08;
const BENT = 0.15;
const RUN_OUT = 0.2;
const WIPED = 0.08;

/** XN's answer to each slogan (as CULT_TEXTS) once she's struck it out; the last one's e's run on as long as they like. */
const GOD_ANSWERS: readonly string[] = ["cat club", "full", "it said it waited too long", "weed"];

/** The ways XN has been at a drawing of the cat god. "answer" only where there's a slogan to strike out. */
type Defacement = "moustache" | "brows" | "tears" | "says" | "remark" | "leaves" | "answer";
const DEFACEMENTS: readonly Defacement[] = ["moustache", "brows", "tears", "says", "remark", "leaves", "answer"];
/** How many of the drawings she's been at, and how many things she did to each, at most. */
const DEFACED = 0.3;
const DEFACE_MOST = 3;

/** Mask pixels to a cell across, and to the wall's height. */
const PX = 96;
/** The colours: XN's black spray, and the cult's green. */
const BLACK: readonly [number, number, number] = [20, 18, 15];
const GREEN: readonly [number, number, number] = [26, 64, 24];
/** Blood, dried: a dark, browning red. Thinly on, the wall shows through and it goes browner still. */
const BLOOD: readonly [number, number, number] = [78, 20, 16];
/** A fingertip's half width, as a share of a grid step. */
const FINGER = 0.4;
/** How far a finger goes, in grid steps, before the blood on it is down to about a third. */
const DRY = 28;
/** How often a side of a stretch has something on it, at 100 %, in the yellow; other zones weigh it (zones.ts). */
const CHANCE = 0.065;
/**
 * Of those, what: XN's words, an arrow, tally marks, the lost's words in blood, a cult slogan, XN's drawing, the cat
 * god, the cult's sign.
 */
// XN's drawing of herself and Kara is a rare find; the cult's quick sign is commoner than its drawing of the god.
const KINDS: readonly [Kind, number][] = [
  ["text", 0.3],
  ["arrow", 0.15],
  ["tally", 0.09],
  ["plea", 0.09],
  ["cult", 0.13],
  ["portrait", 0.02],
  ["shrine", 0.09],
  ["emblem", 0.13],
];
/** The stroke's thickness as a share of a grid step. */
const STROKE = 0.38;

export type Kind = "text" | "arrow" | "tally" | "plea" | "cult" | "portrait" | "shrine" | "emblem";

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
/** What XN does to the cat god, traced from Kiri's drawings of it over the god (assets/god-*.webp), in XN's spray. */
const GOD_MOUSTACHE = "Ⓜ";
const GOD_BROWS = "Ⓑ";
const GOD_TEARS = "Ⓣ";
const SPRAYED_DRAWINGS = new Set([GOD_MOUSTACHE, GOD_BROWS, GOD_TEARS]);
/** The cult's sign, traced from Kiri's drawing (assets/cult-emblem.webp), and its width in grid steps against 6 tall. */
const EMBLEM_FIGURE = "Ⓢ";
const EMBLEM_W = 4.5;
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
/**
 * Kiri's drawings, by name: XN, Kara and the cat god, and what XN does to the cat god (a moustache, eyebrows, tears;
 * drawn on the god in its own frame, so they line up).
 */
export type DrawingName = "xn" | "kara" | "god" | "moustache" | "brows" | "tears" | "emblem";
const DRAWING_KEYS: Record<DrawingName, string> = {
  xn: XN_FIGURE,
  kara: KARA_FIGURE,
  god: GOD_FIGURE,
  moustache: GOD_MOUSTACHE,
  brows: GOD_BROWS,
  tears: GOD_TEARS,
  emblem: EMBLEM_FIGURE,
};

/** A drawing has loaded: anything sprayed before it was sprayed without it, so it's sprayed again. */
export function setDrawing(name: DrawingName, drawing: Drawing) {
  drawings.set(DRAWING_KEYS[name], drawing);
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
  "0": latin([[[1.2, 0], [2.8, 0], [3.8, 1.5], [3.8, 4.5], [2.8, 6], [1.2, 6], [0.2, 4.5], [0.2, 1.5], [1.2, 0]]]),
  "2": latin([[[0.2, 1.2], [1.2, 0], [3, 0], [4, 1.2], [3.8, 2.6], [0, 6], [4, 6]]]),
  "4": latin([[[3, 6], [3, 0], [0, 4], [4, 4]]]),
  "5": latin([[[4, 0], [0.4, 0], [0.2, 2.6], [2.8, 2.4], [4, 3.6], [3.8, 5.2], [2.4, 6], [0, 5.4]]]),
  "6": latin([[[3.6, 0.2], [1.6, 0.6], [0.2, 3], [0.4, 5.2], [2, 6], [3.6, 5.4], [4, 4], [3, 2.8], [1.2, 3], [0.2, 4]]]),
  ".": latin([[[2, 5.5], [2.1, 6]]]),
  ":": latin([[[2, 1.6], [2.1, 2.1]], [[2, 4.9], [2.1, 5.4]]]),
  "'": latin([[[2.2, 0], [1.8, 1.6]]]),
  "→": { w: 4.4, strokes: [[[0, 3], [4.4, 3]], [[2.6, 1.3], [4.4, 3], [2.6, 4.7]]] },
  "←": { w: 4.4, strokes: [[[4.4, 3], [0, 3]], [[1.8, 1.3], [0, 3], [1.8, 4.7]]] },

  // Spaced for a fingertip: the marks are fat.
  [TALLY_ONE]: { w: 1, strokes: [[[0.5, 0], [0.5, 6]]] },
  [TALLY_FIVE]: {
    w: 5.5,
    strokes: [[[0.5, 0], [0.5, 6]], [[2, 0], [2, 6]], [[3.5, 0], [3.5, 6]], [[5, 0], [5, 6]], [[-0.4, 4.7], [5.9, 1.3]]],
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
  /** XN's black over the top of it, where she's been at someone else's drawing; otherwise null. */
  over: Uint8Array | null;
}

/** How much paint there is at a point of a tag, 0–1: its own colour, and XN's black over it. */
export interface PaintSample {
  paint: number;
  over: number;
}

/** XN's black, for what she's put over the top of others' drawings. */
export const OVER_COLOUR = BLACK;

/** A tag as sprayed on its stretch: what it is, and where, in world units along the wall and down from the ceiling. */
export interface Tag {
  kind: Kind;
  /** XN's words, read through SAN; "" for anything else. */
  text: string;
  /** What the lost wrote, which SAN takes the other way; "" for anything else. */
  lost: string;
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
  /** Its middle on the wall's face, as a point in the place (z up from the floor), and the way the face looks. */
  centre: { x: number; y: number; z: number; nx: number; ny: number };
  /** Whether XN has put anything of hers over the top. */
  over: boolean;
  /** Written in blood, with a finger, rather than sprayed or penned. */
  blood: boolean;
  /** Whether it ends in a hand dragged down the wall, four fingers' worth, from its last mark. */
  drag: boolean;
  /** Whether the lost's words have been wiped over with a hand. */
  wiped: boolean;
  /** How heavy the paint went on, and its colour. */
  strength: number;
  colour: readonly [number, number, number];
}

interface Glyph {
  /** For XN's words, its index into the text (its shape follows SAN); otherwise −1 and `ch` is the glyph. */
  at: number;
  ch: string;
  /** Whether `at` is into what the lost wrote rather than XN's words. */
  lost: boolean;
  /** How little blood was left to write it with, 0–1. */
  fade: number;
  /** Written back to front. */
  flip: boolean;
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
  /** 1 for XN's black over the top; and how much the hand shakes, against the usual. */
  layer: number;
  shake: number;
  /** Strokes of its own, for what's drawn rather than written. */
  own: GlyphDef | null;
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
  /** 1 for XN's black over the top of someone else's drawing. */
  layer: number;
  /** How much the hand shakes, against the usual. */
  shake: number;
  /** Strokes of its own, for what's drawn rather than written. */
  own: GlyphDef | null;
  /** As for Glyph. */
  lost?: boolean;
  fade?: number;
  flip?: boolean;
  /** Bigger or smaller than the rest of its row. */
  size?: number;
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
  /** Room left below it for runs, against its glyph height: drips for spray, a dragged hand for blood. */
  below?: number;
  /** Ends in a hand dragged down the wall (blood only). */
  drag?: boolean;
  /** What the lost wrote, when the plan has it. */
  lost?: string;
  /** Written by a person, anywhere from eye height down to just off the floor: standing, kneeling, or slumped against it. */
  low?: boolean;
  /** How far the rows bend off, up (−) or down (+), as they go. */
  bend?: number;
  /** Wiped over with a hand (blood only). */
  wiped?: boolean;
}

const item = (ch: string, at = -1, weight = 1, chaos = 0): Item => ({ ch, at, weight, chaos, layer: 0, shake: 1, own: null });

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
function planOf(
  kind: Kind,
  text: string,
  pickText: number,
  r: (k: number) => number,
): Plan {
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
    case "text": {
      // Wrapped narrow or wide, but never so narrow a long line stacks too tall for the wall.
      const width = Math.max(9 + Math.floor(r(2) * 8), Math.ceil(text.length / 4));
      return { ...base, rows: textRows(text, width), size: 0.13 + r(0) * 0.07, least: 0.08, colour: BLACK };
    }
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
      // Shaky from the first, and soon worse: whoever it was starts losing it by the third five, or the eighth at
      // the latest, and hardly anyone never does. From there it gets wilder five by five, until it's smeared over;
      // now and then it ends in a whole hand dragged down the wall.
      const calm = r(7) < 0.05;
      const drag = !calm && r(11) < 0.3;
      const snaps = 2 + r(8) * 5;
      const unravels = 2 + r(9) * 4;
      const chaosAt = (n: number) => (calm ? 0.12 * (n / 12) : clamp01((n - snaps) / unravels) ** 1.2);
      // The finger trembles: every mark a little off, its own length, and leaning.
      const mark = (ch: string, n: number) => ({ ...item(ch, -1, 1, chaosAt(n)), shake: 1.8 });
      const rows: Item[][] = [];
      for (let i = 0; i < fives; i += perRow) {
        rows.push(Array.from({ length: Math.min(perRow, fives - i) }, (_, j) => mark(TALLY_FIVE, i + j)));
      }
      // The marks over a last five: on the same row if it has room, else a row of their own.
      const singles = Array.from({ length: over }, () => mark(TALLY_ONE, fives));
      const last = rows[rows.length - 1];
      if (singles.length && last.length < perRow) last.push(...singles);
      else if (singles.length) rows.push(singles);
      // Tiny, smaller than the cult's writing, from eye height down; fine enough up close to see the finger's streaks.
      return {
        ...base,
        rows,
        size: 0.025 + r(0) * 0.01,
        least: 0.018,
        gap: 1.8,
        rowGap: 2.6,
        turn: 0.16,
        wander: 1,
        slope: (r(1) - 0.5) * 0.1,
        colour: BLOOD,
        px: 768,
        eye: false,
        low: true,
        below: drag ? 4 + r(12) * 3 : 0.15,
        drag,
      };
    }
    case "plea":
      return pleaPlan(base, pickText, r);
    case "portrait":
      return portraitPlan(base, r);
    case "shrine":
      return shrinePlan(base, pickText, r);
    case "emblem": {
      // The cult's sign, drawn upright with care at eye height, and nothing else.
      const tilt = (r(10) - 0.5) * 0.08;
      const custom = (): Placed[] => [{ item: item(EMBLEM_FIGURE), x: 0, y: 0, angle: tilt, scale: 1, w: EMBLEM_W }];
      return { ...base, rows: [], custom, size: 0.4 + r(0) * 0.15, least: 0.25, colour: GREEN, px: 512, eye: true };
    }
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
 * What one of the lost wrote, in blood with a finger: shaky capitals, anywhere from eye height down.
 * Said over and over, it's crammed into one line, each time smaller and fainter. Now and then the hand went wrong: the
 * whole thing back to front (or only its letters), the line bending away up or down (all on one line, so it doesn't
 * run into itself), the blood giving out partway, or all of it wiped over with a hand. Now and then XN has written
 * back, under it or beside it.
 */
function pleaPlan(base: Omit<Plan, "rows" | "size" | "least" | "colour">, pick: number, r: (k: number) => number): Plan {
  const [words, reply] = PLEAS[pick];
  const each = words.split(" ");
  const repeated = new Set(each).size < each.length;
  const mirror = r(6) < MIRRORED;
  const lettersOnly = mirror && r(7) < 0.5;
  const bend = r(8) < BENT ? (r(9) < 0.5 ? -1 : 1) * (0.6 + r(10) * 0.9) : 0;
  const wiped = r(11) < WIPED;
  const runsOut = !repeated && !wiped && r(12) < RUN_OUT;
  const answered = !!reply && !wiped && r(13) < ANSWERED;
  // Where the blood gave out, if it did.
  const cut = 0.45 + r(15) * 0.3;
  const rows = textRows(words, repeated || bend ? 99 : 9 + Math.floor(r(2) * 6)).map((row) =>
    row.map((it): Item => {
      const t = it.at / Math.max(1, words.length - 1);
      const fade = wiped
        ? 0.25
        : repeated
          ? 0.75 * t ** 1.2
          : runsOut && t > cut
            ? Math.min(0.97, ((t - cut) / (1 - cut)) * 1.3)
            : 0;
      return { ...it, lost: true, shake: 1.5, flip: mirror, fade, size: repeated ? 1 - 0.5 * t : 1 };
    }),
  );
  const human: Plan = {
    ...base,
    rows,
    size: 0.028 + r(0) * 0.012,
    least: 0.02,
    gap: 1.6,
    rowGap: 2.8,
    turn: 0.2,
    wander: 1,
    slope: (r(1) - 0.5) * 0.1,
    bend,
    colour: BLOOD,
    px: 768,
    eye: false,
    low: true,
    lost: words,
    text: "",
    wiped,
    below: 0.15,
  };
  if (!answered && (!mirror || lettersOnly)) return human;

  const hand = Math.floor(r(16) * 1e6);
  const custom = (size: number): Placed[] => {
    const out = place({ ...human, custom: undefined }, size, hand);
    const step = size / 6;
    // Back to front, the whole of it: each letter's place mirrored, and its turn.
    if (mirror && !lettersOnly) {
      for (const p of out) {
        p.x = -(p.x + p.w * step * p.scale);
        p.angle = -p.angle;
      }
    }
    if (answered) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of out) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x + p.w * step * p.scale);
        y0 = Math.min(y0, p.y);
        y1 = Math.max(y1, p.y + 6 * step * p.scale);
      }
      // Hers about half her usual size: still bigger than a finger can write.
      const letter = 1.8;
      const s = step * letter;
      const adv = (4 + 1.5) * s;
      const lines = rowsOf(reply, 0, 10);
      const widest = Math.max(...lines.map((line) => line.length)) * adv;
      const g = (k: number) => hash3(hand, k, 7793);
      const where = g(0);
      // Under it, beside it, or squeezed in aslant at its corner.
      const [rx, ry, tilt] =
        where < 0.5
          ? [x0 + g(1) * Math.max(0, x1 - x0 - widest), y1 + step * 2.5, (g(2) - 0.5) * 0.15]
          : where < 0.8
            ? [x1 + step * 4, y0 + g(1) * Math.max(0, y1 - y0 - 6 * s), (g(2) - 0.5) * 0.15]
            : [x1 - widest * 0.4, y1 + step, -0.25 - g(2) * 0.2];
      lines.forEach((line, li) => {
        line.forEach((c, ci) => {
          if (c.ch === " ") return;
          const j = (n: number) => g(10 + li * 40 + ci * 3 + n);
          const along = ci * adv;
          out.push({
            item: { ...item("", c.at, 0.8), layer: 1 },
            x: rx + along * Math.cos(tilt) + (j(0) - 0.5) * adv * 0.15,
            y: ry + li * s * 9 + along * Math.sin(tilt) + (j(1) - 0.5) * s * 0.2,
            angle: tilt + (j(2) - 0.5) * 0.25,
            scale: letter,
            w: 4,
          });
        });
      });
    }
    return out;
  };
  return { ...human, custom, text: answered ? reply : "", below: answered ? 0.5 : 0.15 };
}

/** XN's words in rows of about `width` characters, each letter its index into `text` from `start`. */
function rowsOf(words: string, start: number, width: number): { ch: string; at: number }[][] {
  const rows: { ch: string; at: number }[][] = [];
  let at = 0;
  for (const line of wrap(words, width)) {
    while (words[at] === " ") at++;
    rows.push(Array.from(line, (ch, i) => ({ ch, at: start + at + i })));
    at += line.length;
  }
  return rows;
}

/**
 * A weed leaf drawn quickly, like the ones in the cat god's hands: seven rounded leaflets fanning all the way round
 * from where they meet, the longest straight up and the last two short and drooping, over a stem; `size` tall,
 * turned `angle`, about (cx, cy).
 */
function leafStrokes(cx: number, cy: number, size: number, angle: number): Stroke[] {
  const turn = (x: number, y: number) =>
    [cx + x * Math.cos(angle) - y * Math.sin(angle), cy + x * Math.sin(angle) + y * Math.cos(angle)] as const;
  const strokes: Stroke[] = [];
  const fan = [[0, 1], [-0.75, 0.85], [0.75, 0.85], [-1.5, 0.68], [1.5, 0.68], [-2.3, 0.45], [2.3, 0.45]] as const;
  for (const [a, length] of fan) {
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const l = length * size * 0.62;
    const w = l * 0.2;
    strokes.push([
      turn(0, 0),
      // Out along one side, round the tip, and back down the other.
      ...LEAFLET.map(([along, across]) => turn(dx * l * along - dy * w * across, dy * l * along + dx * w * across)),
      turn(0, 0),
    ]);
  }
  strokes.push([turn(0, 0), turn(0, size * 0.35)]);
  return strokes;
}

/** One leaflet's outline from base to tip and back, as (share of its length, share of its half width). Rounded at the tip. */
const LEAFLET: readonly (readonly [number, number])[] = [
  [0.3, 0.8],
  [0.6, 1],
  [0.8, 0.9],
  [0.92, 0.65],
  [0.99, 0.3],
  [1, 0],
  [0.99, -0.3],
  [0.92, -0.65],
  [0.8, -0.9],
  [0.6, -1],
  [0.3, -0.8],
];

/** How far down a speech bubble's edge reaches at `x` (−1 to 1 across it), as a share of its half height. */
function bubbleBottom(x: number): number {
  return Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x), 4)), 1 / 4);
}

/**
 * A speech bubble as Kiri draws one: round on top, nearly flat underneath with rounded corners (a superellipse, the
 * lower half squarer than the upper).
 */
function bubble(cx: number, cy: number, rx: number, ry: number): Stroke {
  return Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const n = sn > 0 ? 4 : 2.2;
    return [cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + ry * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n)] as const;
  });
}

/**
 * The cat god, drawn by a believer: upright, with care, in the cult's green pen at eye height. Half the time one of
 * the slogans is written small under its feet, picked at random. Now and then XN has been at it: one to three of
 * the defacements, in her black.
 */
function shrinePlan(
  base: Omit<Plan, "rows" | "size" | "least" | "colour">,
  pickText: number,
  r: (k: number) => number,
): Plan {
  const captioned = r(7) < 0.5;
  const tilt = (r(10) - 0.5) * 0.08;
  const chars = Array.from(CULT_TEXTS[pickText]);
  // What she did to it: some of the ways, shuffled by the dice, the answer only where there's a slogan.
  let done: Defacement[] = [];
  if (r(13) < DEFACED) {
    const ways = DEFACEMENTS.filter((d) => d !== "answer" || captioned);
    const shuffled = ways.map((d, i) => [d, r(20 + i)] as const).sort((a, b) => a[1] - b[1]);
    done = shuffled.slice(0, 1 + Math.floor(r(14) * DEFACE_MOST)).map(([d]) => d);
  }
  const has = (d: Defacement) => done.includes(d);
  // Her words, all in one text so SAN reads them as it reads the rest of hers.
  let text = "";
  const add = (words: string) => {
    const start = text ? text.length + 1 : 0;
    text = text ? `${text} ${words}` : words;
    return start;
  };
  const remark = has("remark") ? GOD_REMARKS[Math.floor(r(15) * GOD_REMARKS.length)] : "";
  const says = has("says") ? GOD_SAYS[Math.floor(r(16) * GOD_SAYS.length)] : "";
  let answer = has("answer") && captioned ? GOD_ANSWERS[pickText] : "";
  if (answer === "weed") answer = `w${"e".repeat(3 + Math.floor(r(17) * 10))}d`;
  const remarkAt = remark ? add(remark) : 0;
  const saysAt = says ? add(says) : 0;
  const answerAt = answer ? add(answer) : 0;

  const custom = (size: number): Placed[] => {
    const step = size / 6;
    const out: Placed[] = [];
    const g = (k: number) => hash3(Math.floor(r(12) * 1e6), k, 7729);
    out.push({ item: item(GOD_FIGURE), x: 0, y: 0, angle: tilt, scale: 1, w: GOD_W });

    // Her letters, smaller than her usual, and the slogan's, both against the god's height, so when the whole lot
    // has to shrink to fit the wall they shrink with it.
    const letter = 0.13;
    const adv = (4 + 1.5) * letter;
    const writeRows = (rows: { ch: string; at: number }[][], x0: number, y0: number, k: number, size = letter) => {
      const across = (4 + 1.5) * size;
      rows.forEach((row, ri) => {
        row.forEach((c, ci) => {
          if (c.ch === " ") return;
          const j = (n: number) => g(k + ri * 40 + ci * 3 + n);
          out.push({
            item: { ...item("", c.at, 0.8), layer: 1 },
            x: (x0 + ci * across + (j(0) - 0.5) * across * 0.15) * step,
            y: (y0 + ri * size * 9 + (j(1) - 0.5) * size * 1.2) * step,
            angle: (j(2) - 0.5) * 0.25,
            scale: size,
            w: 4,
          });
        });
      });
    };
    // Something she drew rather than wrote, from strokes in the god's grid: its own glyph, boxed to fit them.
    // `thick` and `shake` are in the god's grid too, so every mark of hers is about as heavy whatever its size.
    const draw = (strokes: Stroke[], thick = 0.07, shake = 0.05) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const stroke of strokes) {
        for (const [x, y] of stroke) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      const h = Math.max(0.3, y1 - y0);
      const scale = h / 6;
      const local = strokes.map((stroke) => stroke.map(([x, y]) => [(x - x0) / scale, (y - y0) / scale] as const));
      const w = Math.max(0.3, x1 - x0) / scale;
      out.push({
        item: {
          ...item("", -1, thick / (STROKE * scale)),
          layer: 1,
          shake: shake / (0.25 * scale),
          own: { w, strokes: local },
        },
        x: x0 * step,
        y: y0 * step,
        angle: 0,
        scale,
        w,
      });
    };

    // The slogan in the cult's small hand, the size it's written elsewhere: one line, or two if it's long.
    let captionBottom = 6;
    if (captioned) {
      const letterC = 0.14;
      const advC = letterC * 6.8;
      const per = chars.length > 8 ? Math.ceil(chars.length / 2) : chars.length;
      for (let i = 0; i < chars.length; i += per) {
        const row = chars.slice(i, i + per);
        const width = row.length * advC;
        const left = GOD_W / 2 - width / 2;
        const y = 6.3 + (i / per) * letterC * 7.4;
        row.forEach((ch, j) => {
          out.push({
            item: item(ch, -1, 0.55),
            x: (left + j * advC + (g(j * 3) - 0.5) * letterC * 0.4) * step,
            y: (y + (g(j * 3 + 1) - 0.5) * letterC * 0.4) * step,
            angle: (g(j * 3 + 2) - 0.5) * 0.08,
            scale: letterC,
            w: 6,
          });
        });
        // Struck out, with two quick passes.
        if (answer) {
          const mid = y + letterC * 3;
          draw([
            [[left - 0.2, mid + (g(200 + i) - 0.5) * 0.2], [left + width + 0.2, mid + (g(201 + i) - 0.5) * 0.2]],
            [[left + width + 0.1, mid + 0.15], [left - 0.1, mid - 0.1 + (g(202 + i) - 0.5) * 0.2]],
          ]);
        }
        captionBottom = y + letterC * 6;
      }
    }

    // Kiri's moustache, eyebrows and tears, over the god exactly where she drew them.
    for (const [way, key] of [["moustache", GOD_MOUSTACHE], ["brows", GOD_BROWS], ["tears", GOD_TEARS]] as const) {
      if (has(way)) out.push({ item: { ...item(key), layer: 1 }, x: 0, y: 0, angle: tilt, scale: 1, w: GOD_W });
    }
    if (says) {
      // A bubble up to its right, as Kiri drew it: its bottom about level with the god's eyes, its left edge at the
      // god's raised hand; round on top and flatter underneath; a short tail hooking down and left from its
      // underside, towards the god but well short of it.
      // Its words a little smaller than her others, so the bubble stays about the god's size.
      const small = letter * 0.8;
      const smallAdv = adv * 0.8;
      const rows = rowsOf(says, saysAt, 10);
      const widest = Math.max(...rows.map((row) => row.length));
      const rx = (widest * smallAdv) / 2 + small * 7;
      const ry = (rows.length * small * 9) / 2 + small * 5;
      const cx = GOD_W * 0.97 + rx;
      const cy = 0.85 - ry;
      const tailX = cx - rx * 0.56;
      const tailY = cy + ry * bubbleBottom(-0.56);
      const tail: Stroke = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const u = 1 - t;
        // From the underside, down a little and curling over to the left.
        const bx = tailX - 0.03;
        const by = tailY + 0.5;
        return [u * u * tailX + 2 * u * t * bx + t * t * (tailX - 0.6), u * u * tailY + 2 * u * t * by + t * t * (tailY + 0.65)] as const;
      });
      draw([bubble(cx, cy, rx, ry), tail]);
      writeRows(rows, cx - (widest * smallAdv) / 2, cy - (rows.length * small * 9) / 2 + small * 1.5, 300, small);
    }
    if (remark) {
      // Off to its left, with an arrow at it.
      const rows = rowsOf(remark, remarkAt, 11);
      const widest = Math.max(...rows.map((row) => row.length));
      const right = -1.6;
      const top = 2.2 + g(400) * 1.2;
      writeRows(rows, right - widest * adv, top, 500);
      out.push({
        item: { ...item("→", -1, 0.8), layer: 1 },
        x: (right + 0.2) * step,
        y: (top + (g(401) - 0.5) * 0.4) * step,
        angle: (g(402) - 0.5) * 0.5,
        scale: letter * 1.4,
        w: 4.4,
      });
    }
    if (answer) {
      // Under what she struck out.
      const rows = rowsOf(answer, answerAt, 12);
      const widest = Math.max(...rows.map((row) => row.length));
      writeRows(rows, GOD_W / 2 - (widest * adv) / 2 + (g(600) - 0.5) * 0.6, captionBottom + 0.35, 700);
    }
    if (has("leaves")) {
      // A few more leaves, hers, round the sides.
      const count = 2 + Math.floor(g(800) * 4);
      const strokes: Stroke[] = [];
      for (let i = 0; i < count; i++) {
        const j = (n: number) => g(810 + i * 5 + n);
        const left = (i + Math.floor(g(801) * 2)) % 2 === 0;
        const lx = left ? -2.6 + j(0) * 1.6 : GOD_W + 1.0 + j(0) * 1.6;
        strokes.push(...leafStrokes(lx, 1.2 + j(1) * 3.8, 1.5 + j(2) * 0.9, (j(3) - 0.5) * 1.2));
      }
      draw(strokes, 0.05, 0.025);
    }
    return out;
  };
  return { ...base, rows: [], custom, text, size: 0.45 + r(0) * 0.12, least: 0.28, colour: GREEN, px: 512, eye: true };
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
      const own = it.size ?? 1;
      // A bending row runs off further the further it goes, and its letters turn with it.
      const t = ci / Math.max(1, row.length - 1);
      const bend = plan.bend ?? 0;
      if (it.ch !== " ") {
        // The wilder the hand, the further off its place, the more turned, and the bigger and less even.
        const jx = (g(0) - 0.5) * size * (0.12 * plan.wander + c * 0.7);
        const jy = (g(1) - 0.5) * size * (0.16 * plan.wander + c * 0.9) + c * c * size * 0.5 * g(4);
        const x = plan.down ? (columns - 1 - ri) * step * (6 + plan.rowGap) + jx : along + jx;
        const y = plan.down
          ? along + jy
          : ri * step * (6 + plan.rowGap) + along * plan.slope + jy + bend * t * t * size * 3 + (1 - own) * 6 * step;
        const angle = plan.angle + (g(2) - 0.5) * (plan.turn + c * 1.3) + bend * t * 0.9;
        const scale = (1 + (g(3) - 0.5) * (0.16 * plan.wander + c * 0.7) + c * 0.3) * own;
        out.push({ item: it, x, y, angle, scale, w });
      }
      along += step * ((plan.down ? 6 : w) + plan.gap) * (1 + (g(5) - 0.4) * c * 0.9) * own;
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
  const below = plan.below ?? (plan.custom ? 0.12 : 0.6);
  let [x0, x1, y0, y1] = bounds(placed, size, below);
  // Too big for the room: smaller, but not too small to read. The hand wanders, so it's measured again after.
  for (let tries = 0; tries < 4; tries++) {
    const fit = Math.min((room - 0.1) / (x1 - x0), TALLEST / (y1 - y0));
    if (fit >= 1) break;
    size *= fit * 0.97;
    if (size < plan.least) return null;
    placed = place(plan, size, seed);
    [x0, x1, y0, y1] = bounds(placed, size, below);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  if (w > room || h > TALLEST) return null;
  const step = size / 6;

  const along = start + 0.05 + r(3) * Math.max(0, room - w - 0.1);
  // At eye height it's the writing that's at eye height, not whatever runs down from it.
  const body = h - size * below;
  // A person's, from eye height down to just off the floor.
  const top = plan.low
    ? Math.max(0.04, Math.min(0.96 - h, 0.3 + r(4) * Math.max(0, 0.62 - body)))
    : plan.eye
      ? Math.min(0.96 - h, Math.max(0.04, 0.32 + r(4) * 0.3 - body / 2))
      : 0.04 + r(4) * Math.max(0, 0.92 - h);
  const px = plan.px;
  const layout: Glyph[] = placed.map((p) => ({
    at: p.item.at,
    ch: p.item.ch,
    lost: !!p.item.lost,
    fade: p.item.fade ?? 0,
    flip: !!p.item.flip,
    x: (p.x - x0) * px,
    y: (p.y - y0) * px,
    cos: Math.cos(p.angle),
    sin: Math.sin(p.angle),
    step: step * p.scale * px,
    weight: p.item.weight,
    chaos: p.item.chaos,
    w: p.w,
    layer: p.item.layer,
    shake: p.item.shake,
    own: p.item.own,
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
    centre: { x: 0, y: 0, z: 0, nx: 0, ny: 0 },
    over: placed.some((p) => p.item.layer === 1),
    lost: plan.lost ?? "",
    blood: plan.colour === BLOOD,
    drag: !!plan.drag,
    wiped: !!plan.wiped,
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
  const pts = strokePoints(tag, glyph, def, stroke, k);
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
    // Where the can paused, the paint ran: a thin drip straight down, ending in a bead. Not from a pen: the cult
    // writes and draws with one.
    const pen = glyph.layer === 0 && (tag.kind === "cult" || tag.kind === "shrine" || tag.kind === "emblem");
    // What she draws has many more points than a letter: it runs at fewer of them, or it's all drips.
    const roll = pen ? 1 : hash3(tag.seed, k * 64 + i, 7753);
    if (roll < (glyph.own ? 0.03 : 0.14)) {
      const length = (2.4 + hash3(tag.seed, k * 64 + i, 7759) * 7) * radius;
      const thin = Math.max(0.5, radius * 0.45);
      dab(ax, ay, ax, ay + length, thin, thin + 0.6);
      dab(ax, ay + length, ax, ay + length, thin * 1.5, thin * 1.5 + 0.5);
    }
  }
}

/** A stroke's points in mask pixels: the glyph's grid turned, scaled and put in place, each point off a little as the hand shook. */
function strokePoints(tag: Tag, glyph: Glyph, def: GlyphDef, stroke: Stroke, k: number): (readonly [number, number])[] {
  const jitter = (i: number, a: number) =>
    (hash3(tag.seed, k * 64 + i * 2 + a, 7741) - 0.5) * (0.5 + glyph.chaos * 2.2) * glyph.shake;
  const mid = def.w / 2;
  return stroke.map(([gx, gy], i) => {
    const lx = ((glyph.flip ? def.w - gx : gx) + jitter(i, 0) - mid) * glyph.step;
    const ly = (gy + jitter(i, 1) - 3) * glyph.step;
    return [
      glyph.x + mid * glyph.step + lx * glyph.cos - ly * glyph.sin,
      glyph.y + 3 * glyph.step + lx * glyph.sin + ly * glyph.cos,
    ] as const;
  });
}

/** Smooth noise along a line, 0–1: a die at each whole number, eased between. */
function wobble(t: number, n: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash3(i, n, seed);
  const b = hash3(i + 1, n, seed);
  return a + (b - a) * f * f * (3 - 2 * f);
}

/**
 * Blood drawn along a stroke with a fingertip `radius` wide. Wet, it goes on solid with a soft, ragged edge; as the
 * finger dries it streaks along the way it moved and breaks up, lighter and browner, the wall showing through. No
 * drips and no overspray. `ink` is how much blood is on the finger to begin with, 0–1, and `dry` how far it goes, in
 * mask pixels, before that's down to about a third. Returns how much is left at the end.
 */
function smear(
  tag: Tag,
  paint: Uint8Array,
  pts: readonly (readonly [number, number])[],
  radius: number,
  k: number,
  ink: number,
  dry: number,
): number {
  const W = tag.maskW;
  const H = tag.maskH;
  const seed = tag.seed + k * 131;
  const soft = Math.max(1, radius * 0.35);
  let run = 0;
  const segments = Math.max(1, pts.length - 1);
  for (let si = 0; si < segments; si++) {
    const [ax, ay] = pts[si];
    const [bx, by] = pts[Math.min(si + 1, pts.length - 1)];
    const ex = bx - ax;
    const ey = by - ay;
    const length = Math.hypot(ex, ey);
    const len2 = length * length || 1;
    const reach = radius * 1.6;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + reach));
    const minY = Math.max(0, Math.floor(Math.min(ay, by) - reach));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by) + reach));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = clamp01((px * ex + py * ey) / len2);
        const s = run + t * length;
        const d = Math.hypot(px - ex * t, py - ey * t);
        // Pressed hardest where it went on, so a little wider there; the edge itself never quite straight.
        const press = 1 + 0.1 * Math.max(0, 1 - s / (radius * 2));
        const edge = radius * press * (0.85 + wobble(s / (radius * 0.7), 1, seed) * 0.3);
        if (d >= edge) continue;
        const left = ink * Math.exp(-s / dry);
        const parched = 1 - left;
        // The ridges of the skin: bands across the finger that run along the stroke, broken here and there. As it
        // dries, the fainter ones stop taking first.
        const across = length ? (px * ey - py * ex) / length / radius : 0;
        const ridge = (across + 1.3) * 3.2;
        const band = wobble(ridge, 2, seed) * 0.75 + wobble(s / (radius * 1.5), 3 + Math.floor(ridge), seed) * 0.25;
        if (band < parched * 1.15 - 0.2) continue;
        // And grit: specks where none took.
        if (hash3(x, y, seed) < parched * parched * 0.3) continue;
        const a = (0.3 + 0.67 * Math.min(1, left * 1.15)) * (0.55 + 0.45 * clamp01((edge - d) / soft));
        const i = y * W + x;
        const v = Math.round(a * 255);
        if (v > paint[i]) paint[i] = v;
      }
    }
    run += length;
  }
  return ink * Math.exp(-run / dry);
}

/**
 * A glyph in blood, stroke by stroke: the finger drying as it goes, and pressed for more when it runs low, so the
 * marks go dark, fade, and go dark again. Then, the further gone the hand, the more of it is smeared over, back and
 * forth with the side of a finger. Returns the blood left on the finger.
 */
function bleed(tag: Tag, paint: Uint8Array, glyph: Glyph, def: GlyphDef, gi: number, ink: number): number {
  const radius = glyph.step * FINGER * glyph.weight * (1 + glyph.chaos * 0.3);
  // Words run on far longer than a mark between squeezes: whoever it was pressed for more about once a word.
  const dry = glyph.step * DRY * (glyph.lost ? 2.5 : 1);
  // Running out, there's only so much left to squeeze.
  const most = 1 - glyph.fade * 0.95;
  if (glyph.fade) ink = Math.min(ink, most);
  def.strokes.forEach((stroke, si) => {
    const k = gi * 16 + si;
    if (ink < (0.55 + hash3(tag.seed, k, 7781) * 0.2) * most) ink = (0.82 + hash3(tag.seed, k, 7783) * 0.18) * most;
    ink = smear(tag, paint, strokePoints(tag, glyph, def, stroke, k), radius, k, ink, dry);
  });
  const smears = glyph.chaos > 0.4 ? 1 + Math.floor((glyph.chaos - 0.4) * 5) : 0;
  for (let e = 0; e < smears; e++) {
    const d = (n: number) => hash3(tag.seed, gi * 97 + e * 11 + n, 7787);
    const passes = 3 + Math.floor(d(0) * 3);
    const top = d(1) * 2;
    const stroke: Stroke = Array.from({ length: passes }, (_, p) => [
      p % 2 === 0 ? -0.6 + d(2 + p) * 1.2 : def.w - 0.6 + d(2 + p) * 1.2,
      top + (p / (passes - 1)) * (4 - top) + (d(8 + p) - 0.5),
    ] as const);
    const k = gi * 16 + 8 + e;
    smear(tag, paint, strokePoints(tag, glyph, def, stroke, k), radius * 2.2, k, 0.45 + d(14) * 0.25, dry * 0.7);
  }
  return ink;
}

/**
 * A bloody hand dragged down the wall from (x, y): four fingers side by side, the middle two reaching furthest,
 * wandering a little, until the blood gives out.
 */
function dragHand(tag: Tag, paint: Uint8Array, x: number, y: number, radius: number) {
  const length = tag.maskH - y - radius * 2;
  if (length < radius * 4) return;
  const spacing = radius * 2.3;
  const lean = (hash3(tag.seed, 1, 7789) - 0.5) * radius * 5;
  for (let f = 0; f < 4; f++) {
    const j = (n: number) => hash3(tag.seed, 10 + f * 16 + n, 7789);
    const middle = f === 1 || f === 2;
    const reach = length * (middle ? 0.85 + j(0) * 0.15 : 0.55 + j(0) * 0.3);
    const x0 = x + (f - 1.5) * spacing + (j(1) - 0.5) * radius * 0.6;
    const y0 = y + (middle ? 0 : radius * 1.5) + (j(2) - 0.5) * radius;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const t = i / 5;
      return [x0 + lean * t * t + (j(3 + i) - 0.5) * radius * 0.5, y0 + reach * t] as const;
    });
    smear(tag, paint, pts, radius * (f === 3 ? 0.85 : 1), 9000 + f, 0.95, reach * 0.6);
  }
}

/**
 * The lost's words wiped over with the flat of a hand: broad passes back and forth down the whole of them, the blood
 * already there dragged along, so the letters only show through.
 */
function wipe(tag: Tag, paint: Uint8Array) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, step = 0;
  for (const glyph of tag.layout) {
    if (!glyph.lost) continue;
    x0 = Math.min(x0, glyph.x);
    x1 = Math.max(x1, glyph.x + glyph.w * glyph.step);
    y0 = Math.min(y0, glyph.y);
    y1 = Math.max(y1, glyph.y + 6 * glyph.step);
    step = Math.max(step, glyph.step);
  }
  if (!step) return;
  const radius = step * FINGER * 7;
  const passes = Math.max(2, Math.ceil((y1 - y0) / radius) + 1);
  const d = (n: number) => hash3(tag.seed, n, 7797);
  const pts = Array.from({ length: passes }, (_, p) => {
    const x = p % 2 === 0 ? x0 + (d(p) - 0.5) * radius : x1 + (d(p) - 0.5) * radius;
    return [x, y0 + ((y1 - y0) * p) / (passes - 1) + (d(p + 50) - 0.5) * radius * 0.5] as const;
  });
  smear(tag, paint, pts, radius, 9100, 0.5, (x1 - x0) * passes * 0.6);
}

/** Half the size: each pixel the average of four. */
function halve(level: GraffitiLevel): GraffitiLevel {
  const w = Math.max(1, level.w >> 1);
  const h = Math.max(1, level.h >> 1);
  const shrink = (from: Uint8Array) => {
    const to = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            sum += from[Math.min(level.h - 1, y * 2 + j) * level.w + Math.min(level.w - 1, x * 2 + i)];
          }
        }
        to[y * w + x] = sum >> 2;
      }
    }
    return to;
  };
  return { w, h, paint: shrink(level.paint), over: level.over && shrink(level.over) };
}

/** Traces a drawing into the mask, turned and scaled as its glyph is, in its box (the glyph's width × 6). */
function trace(tag: Tag, target: Uint8Array, glyph: Glyph, drawing: Drawing, sprayed: boolean, k: number) {
  const W = tag.maskW;
  const H = tag.maskH;
  // Sprayed, it's traced into a scratch mask first, to be roughened before it goes on the wall.
  const paint = sprayed ? new Uint8Array(W * H) : target;
  // The hand's shake: a slow wander across and down, a share of the drawing's size.
  const shake = sprayed ? 0.012 : 0;
  const wander = (t: number, n: number) => {
    const i = Math.floor(t);
    const f = t - i;
    const a = hash3(i, n, tag.seed + k);
    const b = hash3(i + 1, n, tag.seed + k);
    return a + (b - a) * f * f * (3 - 2 * f) - 0.5;
  };
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
      let u = (px * glyph.cos + py * glyph.sin) / (glyph.w * glyph.step) + 0.5;
      let v = (py * glyph.cos - px * glyph.sin) / (6 * glyph.step) + 0.5;
      if (shake) {
        u += wander(v * 14, 1) * shake * 2;
        v += wander(u * 14, 2) * shake;
      }
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
  if (!sprayed) return;

  // Overspray: speckles in a ring round the strokes. Drips: now and then, from the underside of a stroke, a thin run
  // straight down ending in a bead. Then onto the wall.
  const ring = Math.max(1.5, glyph.step * 0.06);
  const dripLength = glyph.step * 0.5;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      const a = paint[i];
      if (a < 40) {
        let near = 0;
        for (let d = 0; d < 8; d++) {
          const sx = Math.round(x + Math.cos((d * Math.PI) / 4) * ring);
          const sy = Math.round(y + Math.sin((d * Math.PI) / 4) * ring);
          if (sx >= 0 && sy >= 0 && sx < W && sy < H) near = Math.max(near, paint[sy * W + sx]);
        }
        if (near > 128 && hash3(x, y, tag.seed + k + 1) < 0.35) target[i] = Math.max(target[i], 90 + hash3(x, y, tag.seed) * 90);
      }
      if (a > target[i]) target[i] = a;
      // The underside of a stroke: paint here, none a little below.
      if (a > 180 && y + 2 < H && paint[i + 2 * W] < 20 && hash3(x, y, tag.seed + k + 2) < 0.025) {
        const length = dripLength * (0.3 + hash3(x, y, tag.seed + k + 3) * 0.7);
        const wide = hash3(x, y, tag.seed + k + 4) < 0.5 ? 1 : 2;
        for (let dy = 1; dy <= length && y + dy < H; dy++) {
          for (let dx = 0; dx < wide && x + dx < W; dx++) target[(y + dy) * W + x + dx] = 230;
        }
        // The bead.
        const by = Math.min(H - 1, Math.floor(y + length));
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= wide; dx++) {
            const bx = x + dx;
            const yy = by + dy;
            if (bx >= 0 && bx < W && yy >= 0 && yy < H) target[yy * W + bx] = 230;
          }
        }
      }
    }
  }
}

/** The tag's mask as it reads now (`shown` is XN's text after SAN has had its say), at every size. */
function sprayTag(tag: Tag, shown: string, lostShown: string): GraffitiLevel[] {
  const base = new Uint8Array(tag.maskW * tag.maskH);
  const over = tag.over ? new Uint8Array(tag.maskW * tag.maskH) : null;
  // Blood on the finger, for what's written in it: more than it'll ever have again from the fresh bite, so the first
  // strokes go on wet before any of it starts to dry.
  let ink = 1.6;
  tag.layout.forEach((glyph, gi) => {
    const paint = glyph.layer && over ? over : base;
    const char = glyph.at >= 0 ? (glyph.lost ? lostShown : shown)[glyph.at].toUpperCase() : glyph.ch;
    const drawing = drawings.get(char);
    if (drawing) {
      trace(tag, paint, glyph, drawing, SPRAYED_DRAWINGS.has(char), gi * 31);
      return;
    }
    const def = glyph.own ?? GLYPHS[char];
    if (!def) return;
    if (tag.blood && !glyph.layer) {
      ink = bleed(tag, paint, glyph, def, gi, ink);
      return;
    }
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
  if (tag.wiped) wipe(tag, base);
  const last = tag.layout.filter((glyph) => !glyph.layer).pop();
  if (tag.drag && last) {
    // The hand comes down over the last of it.
    dragHand(tag, base, last.x + (last.w / 2) * last.step, last.y + 3 * last.step, last.step * FINGER * 1.3);
  }
  const levels: GraffitiLevel[] = [{ w: tag.maskW, h: tag.maskH, paint: base, over }];
  while (levels[levels.length - 1].h > 6) levels.push(halve(levels[levels.length - 1]));
  return levels;
}

/** Masks already sprayed, by tag and what it shows. Kept small: SAN only changes a word now and then. */
const sprayed = new Map<string, GraffitiLevel[]>();
const SPRAYED_MAX = 160;

/** The tag's mask showing `shown` (XN's words as read now) and `lostShown` (the lost's); "" where there are none. */
export function tagArt(tag: Tag, shown: string, lostShown: string): GraffitiLevel[] {
  const key = `${tag.seed}|${tag.from}|${shown}|${lostShown}`;
  let art = sprayed.get(key);
  if (!art) {
    art = sprayTag(tag, shown, lostShown);
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
  const pick = (k: number) => map.noise(lx * 2 + dir, ly * 2 + side, 500 + k);
  // Outside a pit room, often a warning in blood; past that roll, whatever any wall might have.
  const outside = map.pitOutside(lx, ly, dir, side);
  const warns = outside ? (PIT_WARNING * tuning.graffiti) / 100 : 0;
  const warning = pick(0) < warns;
  const chance = (CHANCE * tuning.graffiti) / 100;
  // The floor in front of it, halfway along: what's written is weighed by its zone, or it's in a camp.
  const facing = side ? 1 : -1;
  const [fx, fy] = dir === 0 ? [lx * 5 + 2, ly * 5 + facing] : [lx * 5 + facing, ly * 5 + 2];
  const drawn = (die: number) =>
    die < chance * heaviest(GRAFFITI_WEIGHTS) && die < chance * GRAFFITI_WEIGHTS[map.zoneAt(fx, fy)];
  const camp = map.roomAt(fx, fy) === "camp" ? map.fittedAt(fx, fy) : null;
  let kind: Kind | null = null;
  if (camp) {
    // Which of the camp's walls this is: north, south, west, east.
    const wall = dir === 0 ? (side ? 0 : 1) : side ? 2 : 3;
    const bed = campBed(camp, (k) => map.noise(camp.x0, camp.y0, 940 + k));
    if (tuning.graffiti > 0 && (wall === bed.wall || pick(0) < CAMP_WRITING)) {
      kind = wall === bed.wall || pick(1) < CAMP_TALLY ? "tally" : "plea";
    }
  } else if (warning || drawn(pick(0) - warns)) {
    kind = warning ? "plea" : kindOf(pick(1));
  }
  if (kind) {
    const [first, count] = openRun(map, lx, ly, dir, side);
    if (count) {
      const lines = kind === "cult" || kind === "shrine" ? CULT_TEXTS : GRAFFITI_TEXTS;
      const warnings = PLEAS.length - PIT_PLEAS;
      let line = Math.floor(pick(2) * (kind === "plea" ? PIT_PLEAS : lines.length));
      if (warning) line = PIT_PLEAS + Math.floor(pick(2) * warnings);
      const text = kind === "text" ? GRAFFITI_TEXTS[line] : "";
      const seed = Math.floor(pick(3) * 0x7fffffff);
      const r = (k: number) => hash3(seed, k, 7717);
      const plan = planOf(kind, text, line, r);
      // Seen from the north (side 0 of an east-running stretch) or the east (side 1 of a south-running one), the
      // world's axis runs right to left.
      const reversed = dir === 0 ? side === 0 : side === 1;
      tag = layOut(plan, kind, plan.text ?? text, seed, (dir === 0 ? lx : ly) * 5 + first, count, reversed);
      if (tag) {
        // Side 0 looks north (or west), out from the wall cells' near edge; side 1 south (or east), from the far one.
        const along = (tag.from + tag.to) / 2;
        const line = (dir === 0 ? ly : lx) * 5 + side;
        const out = side ? 1 : -1;
        const z = 1 - (tag.top + tag.bottom) / 2;
        tag.centre =
          dir === 0 ? { x: along, y: line, z, nx: 0, ny: out } : { x: line, y: along, z, nx: out, ny: 0 };
      }
    }
  }
  tags.set(key, tag);
  return tag;
}

/** Every tag whose middle is within `radius` of (x, y). */
export function graffitiNear(map: WorldMap, x: number, y: number, radius: number, tuning: Tuning): Tag[] {
  const out: Tag[] = [];
  for (let ly = Math.floor((y - radius) / 5) - 1; ly <= Math.floor((y + radius) / 5) + 1; ly++) {
    for (let lx = Math.floor((x - radius) / 5) - 1; lx <= Math.floor((x + radius) / 5) + 1; lx++) {
      for (let dir = 0; dir < 2; dir++) {
        for (let side = 0; side < 2; side++) {
          const tag = tagOn(map, lx, ly, dir, side, tuning);
          if (!tag || Math.hypot(tag.centre.x - x, tag.centre.y - y) > radius) continue;
          // Not one that looks into a burger room, where there's only XN's own.
          const fx = Math.floor(tag.centre.x + tag.centre.nx * 0.5);
          const fy = Math.floor(tag.centre.y + tag.centre.ny * 0.5);
          if (map.roomAt(fx, fy) === "burger") continue;
          out.push(tag);
        }
      }
    }
  }
  out.push(...burgerTagsNear(map, x, y, radius));
  return out;
}

/** What XN wrote in the burger rooms, and only there: nothing else is written in one. */
const BURGER_WORDS: readonly string[] = [
  "party at 4:20. bring a burger. or be one",
  "seat three is for you",
  "do not eat the pyramid. it holds up the ceiling",
  "one bite each. i took 13",
  "kara brought the burgers. i brought the room",
];

/**
 * What XN wrote outside a burger room, beside its doorway, on half of them: an invitation. The arrow points the way in
 * from wherever it's written.
 */
const BURGER_INVITES: readonly string[] = ["party →", "come in. the burgers are waiting"];
const INVITED = 0.5;

/** Each burger room's invitation, laid out once; null where there's none. */
const inviteKnown = new WeakMap<WorldMap, Map<string, Tag | null>>();

/**
 * The invitation outside a burger room, on the outside of the wall with the doorway in it, in the two cells of that
 * wall beside the doorway; null if it has none.
 */
function inviteTag(map: WorldMap, plan: BurgerPlan): Tag | null {
  let known = inviteKnown.get(map);
  if (!known) {
    known = new Map();
    inviteKnown.set(map, known);
  }
  const key = `${plan.x0},${plan.y0}`;
  const had = known.get(key);
  if (had !== undefined) return had;
  let tag: Tag | null = null;
  const roll = (k: number) => map.noise(plan.x0 * 7 + k, plan.y0, 970);
  if (roll(0) < INVITED) {
    const { side } = plan;
    const alongX = side < 2;
    // The wall's four cells run from one before the room to one after; the doorway is one of the middle two, and the
    // run is the two on the far side of it.
    const doorAt = (alongX ? plan.x0 : plan.y0) + plan.cell;
    const start = plan.cell === 0 ? doorAt + 1 : doorAt - 2;
    // Seen from outside: from the north, or the east, the place's axis runs right to left.
    const reversed = side === 0 || side === 3;
    // Whether the doorway is to the right of the writing, as it's read from outside.
    const doorRight = reversed ? plan.cell === 0 : plan.cell === 1;
    let text = BURGER_INVITES[Math.floor(roll(1) * BURGER_INVITES.length)];
    if (text.endsWith("→") && !doorRight) text = `← ${text.slice(0, -2)}`;
    const seed = Math.floor(roll(2) * 0x7fffffff);
    const r = (k: number) => hash3(seed, k, 7717);
    tag = layOut(planOf("text", text, 0, r), "text", text, seed, start, 2, reversed);
    if (tag) {
      const at = side === 0 ? plan.y0 - 1 : side === 1 ? plan.y0 + 3 : side === 2 ? plan.x0 - 1 : plan.x0 + 3;
      const out = side === 0 || side === 2 ? -1 : 1;
      const along = (tag.from + tag.to) / 2;
      const z = 1 - (tag.top + tag.bottom) / 2;
      tag.centre = alongX ? { x: along, y: at, z, nx: 0, ny: out } : { x: at, y: along, z, nx: out, ny: 0 };
    }
  }
  known.set(key, tag);
  return tag;
}

/** Each burger room's writing, by wall, laid out once. */
const burgerKnown = new WeakMap<WorldMap, Map<string, (Tag | null)[]>>();

/**
 * What XN wrote on the walls of a burger room, inside: on one or two of them, not the one with the doorway, a
 * different line on each. Indexed by wall: north, south, west, east; each wall two cells long.
 */
function burgerTags(map: WorldMap, plan: BurgerPlan): (Tag | null)[] {
  let known = burgerKnown.get(map);
  if (!known) {
    known = new Map();
    burgerKnown.set(map, known);
  }
  const key = `${plan.x0},${plan.y0}`;
  const had = known.get(key);
  if (had) return had;
  const tags: (Tag | null)[] = [null, null, null, null];
  const roll = (k: number) => map.noise(plan.x0 * 7 + k, plan.y0, 950);
  const walls = [0, 1, 2, 3].filter((side) => side !== plan.side);
  const first = Math.floor(roll(0) * walls.length);
  const count = roll(1) < 0.5 ? 1 : 2;
  const line = Math.floor(roll(2) * BURGER_WORDS.length);
  for (let n = 0; n < count; n++) {
    const side = walls[(first + n) % walls.length];
    // The wall's two cells along its line, which way it reads from inside, its line in the place, and the way out.
    const alongX = side < 2;
    const start = alongX ? plan.x0 : plan.y0;
    const reversed = side === 1 || side === 2;
    const at = side === 0 ? plan.y0 : side === 1 ? plan.y0 + 2 : side === 2 ? plan.x0 : plan.x0 + 2;
    const out = side === 0 || side === 2 ? 1 : -1;
    // A few tries at a line that fits.
    for (let t = 0; t < BURGER_WORDS.length; t++) {
      const text = BURGER_WORDS[(line + n + t) % BURGER_WORDS.length];
      const seed = Math.floor(roll(10 + n * 5 + t) * 0x7fffffff);
      const r = (k: number) => hash3(seed, k, 7717);
      const tag = layOut(planOf("text", text, 0, r), "text", text, seed, start, 2, reversed);
      if (!tag) continue;
      const along = (tag.from + tag.to) / 2;
      const z = 1 - (tag.top + tag.bottom) / 2;
      tag.centre = alongX ? { x: along, y: at, z, nx: 0, ny: out } : { x: at, y: along, z, nx: out, ny: 0 };
      tags[side] = tag;
      break;
    }
  }
  known.set(key, tags);
  return tags;
}

/** Every burger room's writing within `radius` of (x, y). */
function burgerTagsNear(map: WorldMap, x: number, y: number, radius: number): Tag[] {
  const out: Tag[] = [];
  for (let ly = Math.floor((y - radius) / 5); ly <= Math.floor((y + radius) / 5); ly++) {
    for (let lx = Math.floor((x - radius) / 5); lx <= Math.floor((x + radius) / 5); lx++) {
      const plan = map.burgerPlan(lx, ly);
      if (!plan) continue;
      for (const tag of [...burgerTags(map, plan), inviteTag(map, plan)]) {
        if (tag && Math.hypot(tag.centre.x - x, tag.centre.y - y) <= radius) out.push(tag);
      }
    }
  }
  return out;
}

/** Which way each face looks out from its wall cell, as for posters: seen from the west, east, north, south. */
const FACE_OUT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
/** The burger room wall a face is, seen from inside: seen from the south it's the north wall, and so on. */
const FACE_WALL = [3, 2, 1, 0];

/**
 * What's on one face of wall cell (cx, cy), or null. `face` is the side it's seen from, as for posters: 0 from the
 * west, 1 the east, 2 the north, 3 the south. Only the long faces of a stretch carry any.
 */
export function graffitiOn(map: WorldMap, cx: number, cy: number, face: number, tuning: Tuning): Tag | null {
  // Inside a burger room, only what XN wrote there.
  const fx = cx + FACE_OUT[face][0];
  const fy = cy + FACE_OUT[face][1];
  if (map.burgerInside(fx, fy)) {
    const plan = map.burgerAt(fx, fy);
    return plan ? burgerTags(map, plan)[FACE_WALL[face]] : null;
  }
  // Outside a burger room, on the wall with its doorway: the invitation, if it has one.
  const room = map.burgerAt(cx, cy);
  if (room && !map.burgerAt(fx, fy) && FACE_WALL[face] === [1, 0, 3, 2][room.side]) {
    const [dx, dy] = map.burgerDoorway(room);
    const sameWall = room.side < 2 ? cy === dy : cx === dx;
    if (sameWall) return inviteTag(map, room);
  }
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
 * The paint on the wall at this point of the tag, into `out`: `along` in world units, `down` from the ceiling.
 * Returns whether there's any.
 */
export function paintAt(
  tag: Tag,
  art: GraffitiLevel[],
  level: number,
  along: number,
  down: number,
  out: PaintSample,
): boolean {
  let u = (along - tag.from) / (tag.to - tag.from);
  if (tag.reversed) u = 1 - u;
  const v = (down - tag.top) / (tag.bottom - tag.top);
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  const l = art[Math.min(level, art.length - 1)];
  const k = Math.floor(v * l.h) * l.w + Math.floor(u * l.w);
  out.paint = (l.paint[k] / 255) * tag.strength;
  out.over = l.over ? (l.over[k] / 255) * 0.9 : 0;
  return out.paint > 0 || out.over > 0;
}
