import { resumeAudioContext } from "../../../shared/audio";
import { clamp } from "../../../shared/math";
import { prefersReducedMotion } from "../../../shared/motion";
import { nearestStatue, Timecode } from "./engine/compass";
import { parseFigure } from "./engine/figure";
import {
  BURGER_SKIN,
  DOOR_SKIN,
  junkAround,
  monitorSkin,
  OFFICE_SKIN,
  placeJunk,
  SAFETY_SKIN,
  SIGN_SKIN,
  solidDistance,
  WOOD_SKIN,
  type Junk,
} from "./engine/junk";
import { Lighting } from "./engine/lighting";
import { LIGHT_DEAD, SPAWN, WorldMap, type Statue } from "./engine/map";
import { PLAYER_RADIUS, Player } from "./engine/player";
import { graffitiNear, inkOf, setDrawing, type DrawingName } from "./engine/graffiti";
import { agePosters } from "./engine/posters";
import { CLEAN, EYE, Renderer, type Camera, type Effects } from "./engine/render";
import {
  placeStatue,
  STATUE_RADIUS,
  type Prop,
  type StatueMesh,
  type StatueModel,
  type StatueSkin,
} from "./engine/statue";
import type { Tuning } from "./engine/tuning";
import { MUTTER } from "./lines";
import { garble, readAs } from "./rot13";
import { playPauseSfx, playRewindSfx, playStepSfx, playStopSfx, playXnTalkSfx, startHum } from "./sfx";
import { dateStamp, timeStamp } from "./stamp";
import { catsLost, passSanTime, xnReadable } from "./san";
import { forgetMeetings, Talk } from "./talk";
import {
  NOT_ON_WALLS,
  randomWalk,
  floorSpot,
  spotOn,
  topSpot,
  wallSpot,
  Xn,
  XN_ACTIONS,
  XN_RADIUS,
  type Point,
  type XnAction,
  type XnCrouch,
  type XnRoute,
  type XnSit,
  type XnWalk,
  type XnSpot,
  type XnSurface,
} from "./xn";

/*
 * Runs the place: input, the frame loop, the tape's PLAY / PAUSE / REW / STOP, sound. Everything here is plain DOM
 * and canvas; XnenWorld only lays out the page and shows what this reports.
 */

/**
 * What XN can do with something near her. Get up on a chair, a desk, a filing cabinet or a monitor lying back
 * (stand, crouch, or sit on the edge with her legs hanging, still or swinging), the same upside down under a chair
 * in the ceiling; stand at a door, or sit or crouch facing it or with her back to it; stand, sit or
 * crouch looking at graffiti (her head on one side if it's her drawing of herself) or a sign.
 */
export type PropTarget = "chair" | "desk" | "cabinet" | "monitor" | "hung" | "door" | "graffiti" | "portrait" | "sign";
export type PropPose = "stand" | "crouch" | "perch" | "swing" | "sit" | "sitBack" | "crouchBack";

/** Which poses go with which things. */
export const PROP_POSES: Record<PropTarget, readonly PropPose[]> = {
  chair: ["stand", "crouch", "perch", "swing"],
  desk: ["stand", "crouch", "perch", "swing"],
  cabinet: ["stand", "crouch", "perch", "swing"],
  monitor: ["stand", "crouch", "perch", "swing"],
  hung: ["stand", "crouch", "perch", "swing"],
  door: ["stand", "sit", "crouch", "sitBack", "crouchBack"],
  graffiti: ["stand", "sit", "crouch"],
  portrait: ["stand", "sit", "crouch"],
  sign: ["stand", "sit", "crouch"],
};

/** Kiri's dev panel: where XN is put and what she does, to look at each action on each surface. */
export interface XnPreview {
  surface: XnSurface;
  action: XnAction;
  tailUp: boolean;
  swingArms: boolean;
  crouch: XnCrouch;
  sit: XnSit;
  walk: XnWalk;
  /** She never notices the visitor, so the action can be watched. */
  ignore: boolean;
  /** She only watches a visitor this many cells off, or nearer. */
  noticeRange: number;
  /** She turns up and moves on by herself; off, she stays where the panel puts her. */
  auto: boolean;
}

/** What the tape is doing, shown top left. */
export type Mode = "play" | "pause" | "rewind" | "stop" | "lost";
/**
 * How the visitor left: through a statue, by stopping the tape, or by losing the signal, which the place does to them
 * (falling into a pit, for one).
 */
export type Exit = "rewind" | "stop" | "lost";

export interface GameParts {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The two lines of the stamp, bottom left. */
  timeLine: HTMLElement;
  dateLine: HTMLElement;
  joystick: HTMLElement;
  knob: HTMLElement;
  /** Kiri's dev panel: keys typed in it are its own. */
  devPanel: () => HTMLElement | null;
  model: StatueModel;
  atlasUrl: string;
  /** XN: her mesh and skeleton, and her atlas. */
  xnMeshUrl: string;
  xnAtlasUrl: string;
  /** The Weed Cat Cult's poster. */
  posterUrl: string;
  /** The drawings for the graffiti, traced from Kiri's: XN, Kara, the cult's cat god, and what XN does to it. */
  drawingUrls: Record<DrawingName, string>;
  /** Kara's wallpaper, for the desktop on the old monitors' screens. */
  wallpaperUrl: string;
  tuning: Tuning;
  xnPreview: XnPreview;
  touch: boolean;
  onMode: (mode: Mode) => void;
  onPrompt: (show: boolean) => void;
  /** XN's subtitle, as shown (ROT13'd), or null when there's none. */
  onLine: (line: string | null) => void;
  onLeave: (exit: Exit) => void;
  /** Dev builds: the new way XN walks, each time she turns up, for the dev panel to show. */
  onXnWalk?: (walk: XnWalk) => void;
}

export interface Game {
  /** The phone's stop button. */
  stop: () => void;
  /** The dev panel opened: pause so the mouse is free. */
  pause: () => void;
  /** New tuning from the dev panel; `freshMap` also starts over on a new map at the spawn point. */
  tune: (next: Tuning, freshMap: boolean) => void;
  /**
   * The dev panel: XN goes to a floor, ceiling or wall near the visitor, and `restart` starts her action from the
   * top; tail, arms, poses and noticing just change.
   */
  previewXn: (next: XnPreview, restart: boolean) => void;
  /** The dev panel: XN moves on now, as if the visitor had looked away long enough. */
  moveXnOn: () => void;
  /**
   * The dev panel: XN goes to the nearest thing of this kind to the visitor and does this with it; asked again for
   * the same, she goes to the next nearest, and so on round.
   */
  previewXnProp: (target: PropTarget, pose: PropPose) => void;
  /** The dev panel: XN forgets every meeting, as if the visitor had never been. */
  forgetXnMeetings: () => void;
  dispose: () => void;
}

/**
 * The most one frame counts towards SAN, in seconds: a frame drawn after a long stall (the browser busy elsewhere)
 * shouldn't count the whole stall.
 */
const MAX_REAL_STEP = 1;
/** Seconds the picture takes to come out of the snow. */
const ENTER_TIME = 0.9;
/** A rewind: running back along the walk, then a burst of static, then a quick fade onto the desktop. */
const REWIND_TIME = 1.45;
const BURST_TIME = 0.35;
const CUT_TIME = 0.2;
const STOP_TIME = 0.35;
/** Signal lost: the picture gone to snow, rolling and torn, for this long, then a quick fade onto the desktop. */
const LOST_TIME = 0.9;
const LOST_FADE = 0.2;
/** The walk is remembered every this many seconds, for rewinding. */
const TRAIL_STEP = 0.1;
/** How much of the walk is remembered, and how much of it a rewind runs back over, in steps. */
const TRAIL_KEEP = 600;
const REWIND_SPAN = 200;
/** With reduced motion, how long REW or STOP stays up while the page fades. */
const CALM_LEAVE_TIME = 0.5;
/** Statues further than this aren't drawn. */
const DRAW_RANGE = 28;
/**
 * How squarely a statue, or XN, has to be faced to touch it. Close enough is the tuning's statueReach or xnReach:
 * nearer than where the timecode starts reading 4:20 (AT_STATUE in compass.ts).
 */
const FACING = 0.55;
/** A touch shorter and stiller than this is a tap. */
const TAP_MS = 300;
const TAP_PX = 12;
/** The dev panel puts XN this far in front of the visitor. */
const XN_AHEAD = 1.7;
/** Looking for a wall for XN: how far from the visitor, and how far from her, for facing one. */
const WALL_SEARCH = 6;
const FACE_WALL_SEARCH = 4;
/** Facing a wall, her feet are this far from it. */
const FACE_WALL_GAP = 0.16;
/** Lights she might stare at are at most this far off. */
const LAMP_SEARCH = 3.5;
/*
 * XN walking. Each time she sets off she goes one of three ways, as likely as each other: wandering, turning off when
 * the way ahead is blocked or she feels like it; back and forth along a stretch; or round and round a light or a
 * pillar near her (wandering, if there's none she can walk round).
 */
/** How fast she turns as she walks, in radians a second. */
const XN_TURN = 1.6;
/** Wandering: how far ahead she wants room, and seconds, at least and at most, before she feels like a new way. */
const XN_LOOK_AHEAD = 0.45;
const XN_WANDER_TURN = [3, 8] as const;
/**
 * Seconds her way can be blocked (by a wall, a statue or the visitor) before she tries another way when wandering,
 * and before she gives up the other routes and wanders.
 */
const XN_HELD = 0.4;
const XN_STUCK = 1;
/** Back and forth: the stretch, at least and at most, in cells. */
const XN_PACE_SPAN = [1.5, 4] as const;
/** Round and round: how far off she looks for something to walk round, and how far from its middle she walks. */
const XN_ROUND_SEARCH = 3;
const XN_ROUND_LAMP = [0.5, 1.2] as const;
const XN_ROUND_PILLAR = [0.95, 1.4] as const;
/*
 * XN turns up by herself. The first time a while after the visitor comes in; then, whenever she's been out of their
 * view long enough, she's somewhere else near them: or now and then nowhere, for a while. Wherever she turns up, it's
 * out of their view, and where a turn of the head would find her if there's such a place.
 */
/** Seconds, at least and at most: before she first turns up; out of view before she moves on; gone, when she goes. */
const XN_FIRST_WAIT = [20, 40] as const;
const XN_UNSEEN = [4, 10] as const;
const XN_AWAY = [20, 60] as const;
/** How likely she is to go for a while, instead of turning up somewhere else at once. */
const XN_AWAY_CHANCE = 0.4;
/** She turns up this many cells from the visitor, at least and at most. */
const XN_NEAR = 4;
const XN_FAR = 20;
/** How often she turns up on each surface. */
const XN_SURFACES: readonly [XnSurface, number][] = [
  ["floor", 5],
  ["ceiling", 3],
  ["wall", 2],
];
/** How likely her tail is up, and her arms swing, each time she turns up. */
const XN_TAIL_UP = 0.3;
const XN_SWING_ARMS = 0.3;
/** Spots tried for her, each time. */
const XN_TRIES = 80;
/** How likely she is, each time she turns up, to be at something near her (getting up on it, looking at it). */
const XN_PROP_CHANCE = 0.5;
/** Looking at graffiti or a sign, she's this far from it, at least and at most. */
const XN_LOOK_AWAY = [0.45, 0.8] as const;
/** At a door: facing it, how far off she stands or sits; with her back to it, how far her heels are. */
const XN_DOOR_FACING = 0.3;
const XN_DOOR_BACK = 0.12;
/** Her head tipped this far, looking at her own drawing. */
const XN_CURIOUS = 0.3;
/** Sitting on an edge, her hips this far back from it. */
const XN_EDGE_BACK = 0.035;

/** Somewhere between the two, at random. */
function between([low, high]: readonly [number, number]) {
  return low + Math.random() * (high - low);
}

/** Whether a light hangs over the cell, if it's open: lights hang over cells 1, 4, 7… on both axes. */
function lightOver(x: number, y: number) {
  return ((x % 3) + 3) % 3 === 1 && ((y % 3) + 3) % 3 === 1;
}

function pickSurface(): XnSurface {
  const total = XN_SURFACES.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [surface, weight] of XN_SURFACES) {
    roll -= weight;
    if (roll < 0) return surface;
  }
  return "floor";
}

/**
 * Seconds of play a subtitle stays: at least LINE_TIME, and longer lines a little longer, LINE_BASE plus this much
 * a character, so the longest stay about seven and a half.
 */
const LINE_TIME = 4;
/** A subtitle goes once the visitor is further than this many cells from her. */
const LINE_RANGE = 2;
const LINE_BASE = 2;
const LINE_PER_CHARACTER = 0.07;

/** The four sides of a cell. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/** Maps tried for one whose nearest statue is a fair walk away. */
const MAP_TRIES = 80;

const MOVE_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

/** A random map whose nearest statue is between spawnMin and spawnMax cells from the spawn point. */
function pickMap(tuning: Tuning): WorldMap {
  const middle = (tuning.spawnMin + tuning.spawnMax) / 2;
  let best = new WorldMap(1 + Math.floor(Math.random() * 999_999), tuning);
  let bestMiss = Infinity;
  for (let i = 0; i < MAP_TRIES; i++) {
    const map = i === 0 ? best : new WorldMap(1 + Math.floor(Math.random() * 999_999), tuning);
    const d = nearestStatue(map, SPAWN.x, SPAWN.y);
    if (d >= tuning.spawnMin && d <= tuning.spawnMax) return map;
    const miss = d === Infinity ? 1e9 : Math.abs(d - middle);
    if (miss < bestMiss) {
      best = map;
      bestMiss = miss;
    }
  }
  return best;
}

/** An image's pixels, RGBA, once it has loaded. */
function loadPixels(url: string, done: (data: Uint8ClampedArray, width: number, height: number) => void) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    done(ctx.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
  };
  image.src = url;
}

function loadSkin(url: string, done: (skin: StatueSkin) => void) {
  loadPixels(url, (data) => done({ data }));
}

export function createGame(parts: GameParts): Game {
  const { stage, canvas, tuning, touch } = parts;
  const reduced = prefersReducedMotion();
  const renderer = new Renderer(canvas);
  // XN's graffiti reads as her subtitles do: through the visitor's SAN, a word at a time.
  renderer.setGraffitiReader((text) => readAs(text, xnReadable()));
  renderer.setLostReader((text) => garble(text, catsLost()));
  const light = new Lighting();
  let timecode = new Timecode();
  let player = new Player();
  let map = pickMap(tuning);
  const meshes = new Map<Statue, StatueMesh>();
  let skin: StatueSkin | null = null;
  loadSkin(parts.atlasUrl, (loaded) => {
    skin = loaded;
  });
  let xn: Xn | null = null;
  /** The dev panel's last thing-and-pose for XN, and how many times running it's been asked for. */
  let propKey = "";
  let propTurn = 0;
  let xnSkin: StatueSkin | null = null;
  let xnPreview = { ...parts.xnPreview };
  /** She's in the place now; when she isn't, she turns up once `xnAway` runs out. */
  let xnHere = !xnPreview.auto;
  let xnAway = between(XN_FIRST_WAIT);
  /** Seconds she's been out of view, and how long she'll stay put out of view this time. */
  let xnUnseen = 0;
  let xnPatience = between(XN_UNSEEN);
  let disposed = false;
  loadSkin(parts.xnAtlasUrl, (loaded) => {
    xnSkin = loaded;
  });
  loadPixels(parts.posterUrl, (data, width, height) => {
    if (!disposed) renderer.setPosters(agePosters(data, width, height));
  });
  // The graffiti's drawings, each as it comes.
  for (const [name, url] of Object.entries(parts.drawingUrls) as [DrawingName, string][]) {
    loadPixels(url, (data, width, height) => {
      if (!disposed) setDrawing(name, inkOf(data, width, height));
    });
  }
  let monitor: StatueSkin | null = null;
  loadPixels(parts.wallpaperUrl, (data, width, height) => {
    monitor = monitorSkin(data, width, height);
  });
  const junkMeshes = new Map<string, StatueMesh>();
  fetch(parts.xnMeshUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`XN's mesh: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      if (disposed) return;
      xn = new Xn(parseFigure(buffer), spotAhead(SPAWN.x, SPAWN.y, SPAWN.angle, xnPreview.surface));
      xn.ignore = xnPreview.ignore;
      xn.noticeRange = xnPreview.noticeRange;
      xn.manner = { tailUp: xnPreview.tailUp, swingArms: xnPreview.swingArms };
      xn.crouch = { ...xnPreview.crouch };
      xn.sit = { ...xnPreview.sit };
      xn.walk = { ...xnPreview.walk };
      startXnAction(xn, xnPreview.action);
    })
    .catch(() => {
      /* she doesn't turn up; the place still works */
    });

  const hum = startHum();
  hum.setLevel(tuning.hum ? 1 : 0);

  let mode: Mode = "play";
  let left = false;
  /** Seconds into the current transition. */
  let fxTime = 0;
  let enterLeft = reduced ? 0 : ENTER_TIME;
  let bandPhase = 0;
  /** The rewind's burst has started (and made its sound). */
  let burst = false;
  /** Where the camera has been, oldest first, for the rewind to run back over. */
  let trail: Camera[] = [];
  let trailClock = 0;
  let prompt = false;
  /** What pressing E would do now. */
  let reach: "xn" | "statue" | null = null;
  let talk = new Talk();
  let shownLine: string | null = null;
  let lineLeft = 0;
  let shownTime = "";
  let nearby: StatueMesh[] = [];
  /** The junk in drawing range: the old monitors stuck through things. */
  let nearJunk: Junk[] = [];
  /**
   * Whether (x, y) is inside a piece of junk, with `room` to spare: on the floor the junk down there, on the ceiling
   * the junk up there, on a wall (or not knowing) any.
   */
  const intoJunk = (x: number, y: number, room: number, surface: XnSurface = "wall") =>
    nearJunk.some(
      (junk) =>
        junk.solid &&
        (surface === "wall" || !!junk.solid.overhead === (surface === "ceiling")) &&
        solidDistance(junk.solid, x, y) < junk.solid.r + room,
    );
  /** What the picture draws besides the place itself, built again each frame. */
  let props: Prop[] = [];

  parts.dateLine.textContent = dateStamp(new Date());

  const keys = new Set<string>();
  const joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  let lookId = -1;
  let lookX = 0;
  let lookY = 0;
  let tap: { id: number; x: number; y: number; at: number } | null = null;
  let pausedBand = -1;
  let nextJitter = 0;

  // iPhones have no pointer lock at all: there the element is undefined, not null, and exitPointerLock is missing.
  const locked = () => !!document.pointerLockElement;
  const lock = () => {
    try {
      // A promise in newer browsers, nothing in older ones.
      const pending: unknown = stage.requestPointerLock();
      if (pending instanceof Promise) pending.catch(() => {});
    } catch {
      /* not allowed now: dragging still looks around */
    }
  };
  const unlock = () => {
    if (locked()) document.exitPointerLock();
  };

  const resetJoystick = () => {
    joy.id = -1;
    joy.x = 0;
    joy.y = 0;
    parts.joystick.hidden = true;
  };

  const setMode = (next: Mode) => {
    mode = next;
    parts.onMode(next);
  };

  const setPrompt = (show: boolean) => {
    if (show === prompt) return;
    prompt = show;
    parts.onPrompt(show);
  };

  const pause = () => {
    if (mode !== "play") return;
    renderer.hold();
    keys.clear();
    resetJoystick();
    lookId = -1;
    hum.setLevel(0);
    playPauseSfx();
    pausedBand = Math.floor(Math.random() * renderer.pictureHeight * 0.8);
    setPrompt(false);
    setMode("pause");
    unlock();
  };

  const resume = () => {
    if (mode !== "pause") return;
    resumeAudioContext();
    hum.setLevel(tuning.hum ? 1 : 0);
    setMode("play");
    if (!touch) lock();
  };

  const showLine = (line: string | null) => {
    if (line === null && shownLine === null) return;
    shownLine = line;
    if (line !== null) lineLeft = Math.max(LINE_TIME, LINE_BASE + line.length * LINE_PER_CHARACTER);
    parts.onLine(line);
  };

  const leaveBy = (exit: Exit) => {
    if (mode === "rewind" || mode === "stop" || mode === "lost") return;
    showLine(null);
    fxTime = 0;
    bandPhase = 0;
    burst = false;
    keys.clear();
    resetJoystick();
    hum.setLevel(0);
    setPrompt(false);
    unlock();
    trail.push(playerCamera());
    if (exit === "rewind") playRewindSfx(REWIND_TIME);
    else playStopSfx();
    setMode(exit);
  };

  /** XN's next line: often only "...", which makes no sound; her words with her voice, as much read as SAN allows. */
  const speak = () => {
    const line = talk.next();
    if (line === MUTTER) {
      showLine(line);
      return;
    }
    showLine(readAs(line, xnReadable()));
    playXnTalkSfx();
  };

  const interact = () => {
    if (mode !== "play" || !prompt) return;
    if (reach === "xn") speak();
    else if (reach === "statue") leaveBy("rewind");
  };

  // ---- where XN can go ----

  /** No wall on the straight line between two points. */
  const clearBetween = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.1);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (map.wall(Math.floor(x0 + (x1 - x0) * k), Math.floor(y0 + (y1 - y0) * k))) return false;
    }
    return true;
  };

  /** Room for XN's middle at (x, y): no wall within her reach. */
  const roomFor = (x: number, y: number) => {
    const r = XN_RADIUS;
    return (
      !map.wall(Math.floor(x - r), Math.floor(y - r)) &&
      !map.wall(Math.floor(x + r), Math.floor(y - r)) &&
      !map.wall(Math.floor(x - r), Math.floor(y + r)) &&
      !map.wall(Math.floor(x + r), Math.floor(y + r))
    );
  };

  /** Every face of wall within `reach` cells of (x, y) that has open floor in front of it. */
  const wallFaces = (x: number, y: number, reach: number) => {
    const faces: { x: number; y: number; nx: number; ny: number }[] = [];
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    for (let j = -reach; j <= reach; j++) {
      for (let i = -reach; i <= reach; i++) {
        if (!map.wall(cx + i, cy + j)) continue;
        for (const [nx, ny] of SIDES) {
          if (map.wall(cx + i + nx, cy + j + ny)) continue;
          faces.push({ x: cx + i + 0.5 + nx * 0.5, y: cy + j + 0.5 + ny * 0.5, nx, ny });
        }
      }
    }
    return faces;
  };

  /**
   * XN on the given surface in front of someone at (x, y) looking along `angle`, facing back at them: on the floor
   * or the ceiling up to XN_AHEAD ahead, nearer if a wall's in the way; on a wall, the face of wall about two cells off
   * that looks their way.
   */
  const spotAhead = (x: number, y: number, angle: number, surface: XnSurface): XnSpot => {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    if (surface === "wall") {
      let best: XnSpot | null = null;
      let bestScore = Infinity;
      for (const face of wallFaces(x, y, WALL_SEARCH)) {
        const dx = x - face.x;
        const dy = y - face.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.8 || (dx * face.nx + dy * face.ny) / dist < 0.25) continue;
        if (!clearBetween(x, y, face.x + face.nx * 0.3, face.y + face.ny * 0.3)) continue;
        // About two cells off, and in front of them rather than behind.
        const behind = -(dx * fx + dy * fy) / dist < 0 ? 3 : 0;
        const score = Math.abs(dist - 2) + behind;
        if (score >= bestScore) continue;
        bestScore = score;
        // Her front along the wall, toward their side of her.
        const along = dx * -face.ny + dy * face.nx < 0 ? -1 : 1;
        best = wallSpot(face.x, face.y, Math.atan2(face.ny, face.nx), along);
      }
      // Nowhere to cling to: the floor.
      if (best) return best;
    }
    let d = XN_AHEAD;
    while (d > 0.6 && !(roomFor(x + fx * d, y + fy * d) && clearBetween(x, y, x + fx * d, y + fy * d))) d -= 0.1;
    return spotOn(surface, x + fx * d, y + fy * d, angle + Math.PI);
  };

  /** A ceiling light near her to stare at: one she can turn her head to, and that works, if there's one. */
  const lampFor = (who: Xn): Point | null => {
    const { front } = who.where;
    const facing = Math.atan2(front[1], front[0]);
    let best: Point | null = null;
    let bestScore = Infinity;
    const r = Math.ceil(LAMP_SEARCH);
    const cx = Math.floor(who.x);
    const cy = Math.floor(who.y);
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const lx = cx + i;
        const ly = cy + j;
        if (!lightOver(lx, ly) || map.wall(lx, ly)) continue;
        const dx = lx + 0.5 - who.x;
        const dy = ly + 0.5 - who.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LAMP_SEARCH) continue;
        const off = Math.atan2(dy, dx) - facing;
        const turn = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
        const score = dist + (dist > 0.3 && turn > 1.1 ? 3 : 0) + (map.light(lx, ly) === LIGHT_DEAD ? 1.5 : 0);
        if (score >= bestScore) continue;
        bestScore = score;
        best = [lx + 0.5, ly + 0.5, 1];
      }
    }
    return best;
  };

  // ---- XN walking ----

  /** Room for her middle at (x, y) as she walks: no wall, statue or visitor there. */
  const freeFor = (x: number, y: number) => {
    if (!roomFor(x, y) || Math.hypot(x - player.x, y - player.y) < XN_RADIUS + PLAYER_RADIUS) return false;
    if (intoJunk(x, y, XN_RADIUS)) return false;
    return nearby.every((mesh) => Math.hypot(x - mesh.x, y - mesh.y) >= STATUE_RADIUS + XN_RADIUS);
  };

  /** Room for her all the way from (x, y) `far` cells along `angle`. */
  const wayClear = (x: number, y: number, angle: number, far: number) => {
    const n = Math.max(1, Math.ceil(far / 0.1));
    for (let i = 1; i <= n; i++) {
      const k = (far * i) / n;
      if (!freeFor(x + Math.cos(angle) * k, y + Math.sin(angle) * k)) return false;
    }
    return true;
  };

  /**
   * Which way she wants to go from (x, y), given which way she faces, the seconds since the last pose, and how many
   * seconds her way has been blocked. Null gives up: she wanders off instead.
   */
  type Aim = (x: number, y: number, facing: number, dt: number, held: number) => number | null;

  /** A way from (x, y) with room to walk, near `facing` if there's one; back the way she came if there's none. */
  const openWay = (x: number, y: number, facing: number) => {
    for (let i = 0; i < 12; i++) {
      const a = facing + (Math.random() * 2 - 1) * (i < 6 ? 1.2 : Math.PI);
      if (wayClear(x, y, a, 1)) return a;
    }
    return facing + Math.PI;
  };

  /** Wandering: on ahead until the way is blocked, or she feels like going another way. */
  const wanderAim = (): Aim => {
    let want: number | null = null;
    let restless = between(XN_WANDER_TURN);
    return (x, y, facing, dt, held) => {
      restless -= dt;
      if (want === null) want = facing;
      if (restless <= 0 || held > XN_HELD || !wayClear(x, y, want, XN_LOOK_AHEAD)) {
        restless = between(XN_WANDER_TURN);
        want = openWay(x, y, want);
      }
      return want;
    };
  };

  /**
   * A route that turns her a little at a time toward the way `aim` gives and walks her on along her front: slower the
   * further she still has to turn, and never into a wall or a statue, or nearer into the visitor.
   */
  const walker = (aim: Aim): XnRoute => {
    let steer = aim;
    let held = 0;
    return (spot, distance, dt) => {
      const facing = Math.atan2(spot.front[1], spot.front[0]);
      let want = steer(spot.x, spot.y, facing, dt, held);
      if (want === null) {
        steer = wanderAim();
        held = 0;
        want = steer(spot.x, spot.y, facing, dt, held) ?? facing;
      }
      const off = Math.atan2(Math.sin(want - facing), Math.cos(want - facing));
      const turned = facing + clamp(off, -XN_TURN * dt, XN_TURN * dt);
      const go = distance * Math.max(0, Math.cos(off));
      if (go <= 0) return spotOn(spot.surface, spot.x, spot.y, turned);
      const x = spot.x + Math.cos(turned) * go;
      const y = spot.y + Math.sin(turned) * go;
      const near = Math.hypot(x - player.x, y - player.y);
      const intoVisitor = near < XN_RADIUS + PLAYER_RADIUS && near < Math.hypot(spot.x - player.x, spot.y - player.y);
      const intoStatue =
        nearby.some((mesh) => Math.hypot(x - mesh.x, y - mesh.y) < STATUE_RADIUS + XN_RADIUS) ||
        intoJunk(x, y, XN_RADIUS, spot.surface);
      if (!roomFor(x, y) || intoVisitor || intoStatue) {
        held += dt;
        return spotOn(spot.surface, spot.x, spot.y, turned);
      }
      held = 0;
      return spotOn(spot.surface, x, y, turned);
    };
  };

  /** Back and forth between where she is and somewhere a straight walk off. Null if there's no room for it. */
  const backAndForth = (from: XnSpot): Aim | null => {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const far = between(XN_PACE_SPAN);
      if (!wayClear(from.x, from.y, a, far)) continue;
      const ends = [
        [from.x, from.y],
        [from.x + Math.cos(a) * far, from.y + Math.sin(a) * far],
      ];
      let to = 1;
      return (x, y, _facing, _dt, held) => {
        // Turning round can swing her off the line and into a corner: she gives up and wanders.
        if (held > XN_STUCK) return null;
        if (Math.hypot(ends[to][0] - x, ends[to][1] - y) < 0.1) to = 1 - to;
        return Math.atan2(ends[to][1] - y, ends[to][0] - x);
      };
    }
    return null;
  };

  /**
   * Round and round a light, or a pillar, near her: one with room all round it, and a clear walk to it. Null if
   * there's none.
   */
  const roundAbout = (from: XnSpot): Aim | null => {
    const rings: [number, number, number][] = [];
    const r = XN_ROUND_SEARCH;
    const cx = Math.floor(from.x);
    const cy = Math.floor(from.y);
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        const lx = cx + i;
        const ly = cy + j;
        const pillar = map.wall(lx, ly);
        if (!pillar && !lightOver(lx, ly)) continue;
        const ox = lx + 0.5;
        const oy = ly + 0.5;
        const away = Math.hypot(from.x - ox, from.y - oy);
        if (away > r) continue;
        const radius = between(pillar ? XN_ROUND_PILLAR : XN_ROUND_LAMP);
        let room = true;
        for (let k = 0; k < 16 && room; k++) {
          const a = (k / 16) * Math.PI * 2;
          room = roomFor(ox + Math.cos(a) * radius, oy + Math.sin(a) * radius);
        }
        // The nearest point of the ring, and a clear walk there.
        const toward = Math.atan2(oy - from.y, ox - from.x);
        if (room && wayClear(from.x, from.y, away > radius ? toward : toward + Math.PI, Math.abs(away - radius))) {
          rings.push([ox, oy, radius]);
        }
      }
    }
    if (!rings.length) return null;
    const [ox, oy, radius] = rings[Math.floor(Math.random() * rings.length)];
    const turn = Math.random() < 0.5 ? -1 : 1;
    return (x, y, _facing, _dt, held) => {
      // Spiralling in, she can meet a wall the straight walk missed: she gives up and wanders.
      if (held > XN_STUCK) return null;
      // Along the ring, leaning in or out toward it when she's off it.
      const off = clamp((Math.hypot(x - ox, y - oy) - radius) * 2, -0.8, 0.8);
      return Math.atan2(y - oy, x - ox) + turn * (Math.PI / 2 + off);
    };
  };

  /** One of her three ways of walking, at random. */
  const routeFor = (who: Xn): XnRoute => {
    const roll = Math.floor(Math.random() * 3);
    const aim = (roll === 1 && backAndForth(who.where)) || (roll === 2 && roundAbout(who.where)) || wanderAim();
    return walker(aim);
  };

  /** Starts an action: moves her to a wall to face it, and finds what she stares at. */
  const startXnAction = (who: Xn, action: XnAction) => {
    const surface = who.surface;
    // Sticking out of a wall, she can't face it or walk.
    let chosen = surface === "wall" && NOT_ON_WALLS.has(action) ? "stand" : action;
    if (action === "faceWall" && surface !== "wall") {
      // The face of wall nearest her, preferably one where the visitor can see her.
      let best: XnSpot | null = null;
      let bestScore = Infinity;
      for (const face of wallFaces(who.x, who.y, FACE_WALL_SEARCH)) {
        const sx = face.x + face.nx * FACE_WALL_GAP;
        const sy = face.y + face.ny * FACE_WALL_GAP;
        const mx = sx + face.nx * 0.1;
        const my = sy + face.ny * 0.1;
        if (!roomFor(mx, my) || intoJunk(mx, my, XN_RADIUS)) continue;
        const score = Math.hypot(sx - who.x, sy - who.y) + (clearBetween(player.x, player.y, mx, my) ? 0 : 4);
        if (score >= bestScore) continue;
        bestScore = score;
        const facing = Math.atan2(-face.ny, -face.nx);
        best = spotOn(surface, sx, sy, facing);
      }
      // No wall near enough: she just stands.
      if (best) who.moveTo(best);
      else chosen = "stand";
    }
    let gaze: Point | null = null;
    if (chosen === "lamp") gaze = lampFor(who);
    if (chosen === "carpet") {
      const { x, y, front } = who.where;
      // Just ahead of her feet, or the floor under her.
      gaze = surface === "floor" ? [x + front[0] * 0.3, y + front[1] * 0.3, 0] : [who.x, who.y, 0];
    }
    who.act(chosen, gaze);
    if (chosen === "walk") who.route = routeFor(who);
  };

  /** XN is in the visitor's view: in the picture's width, give or take hers, with no wall between. */
  const sees = (cam: Camera, x: number, y: number) => {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const fx = Math.cos(cam.angle);
    const fy = Math.sin(cam.angle);
    const ahead = dx * fx + dy * fy;
    if (ahead <= 0) return false;
    if (Math.abs(dy * fx - dx * fy) - XN_RADIUS > ahead * renderer.spread(tuning.fov)) return false;
    return clearBetween(cam.x, cam.y, x, y);
  };

  /**
   * Somewhere for XN to turn up near the visitor, out of their view: one with nothing between them, so a turn of the
   * head finds her, if any of the spots tried is; any out of view otherwise. Null if none is.
   */
  const pickXnSpot = (who: Xn, cam: Camera): XnSpot | null => {
    let fallback: XnSpot | null = null;
    for (let i = 0; i < XN_TRIES; i++) {
      const surface = pickSurface();
      const angle = Math.random() * Math.PI * 2;
      const dist = between([XN_NEAR, XN_FAR]);
      const x = cam.x + Math.cos(angle) * dist;
      const y = cam.y + Math.sin(angle) * dist;
      let spot: XnSpot;
      if (surface === "wall") {
        const faces = wallFaces(x, y, 1);
        if (!faces.length) continue;
        const face = faces[Math.floor(Math.random() * faces.length)];
        spot = wallSpot(face.x, face.y, Math.atan2(face.ny, face.nx), Math.random() < 0.5 ? -1 : 1);
      } else {
        if (!roomFor(x, y)) continue;
        spot = spotOn(surface, x, y, Math.random() * Math.PI * 2);
      }
      const [mx, my] = who.middleOf(spot);
      if (intoJunk(mx, my, XN_RADIUS, surface)) continue;
      const away = Math.hypot(mx - cam.x, my - cam.y);
      if (away < XN_NEAR || away > XN_FAR || sees(cam, mx, my)) continue;
      if (clearBetween(cam.x, cam.y, mx, my)) return spot;
      if (!fallback) fallback = spot;
    }
    return fallback;
  };

  /** She's just turned up (or the panel put her somewhere): she stays put until she's been out of view a while. */
  const settleXn = () => {
    xnHere = true;
    xnUnseen = 0;
    xnPatience = between(XN_UNSEEN);
    talk.newMeeting();
    showLine(null);
  };

  /** She's gone for a while. */
  const sendXnAway = (seconds: number) => {
    xnHere = false;
    xnAway = seconds;
    showLine(null);
  };

  /** Near enough XN, and facing her, to talk to her. */
  const xnInReach = () => {
    if (!xn || !xnHere) return false;
    const dx = xn.x - player.x;
    const dy = xn.y - player.y;
    const dist = Math.hypot(dx, dy);
    return dist <= tuning.xnReach / 100 && (dx * Math.cos(player.angle) + dy * Math.sin(player.angle)) / (dist || 1) > FACING;
  };

  // ---- XN and things ----

  /** Something near her that XN can do something with: what it is, how far it is, and where. */
  interface Thing {
    target: PropTarget;
    x: number;
    y: number;
    junk: Junk | null;
    /** To get up on: the middle of its top, the way its front faces, how far its front edge is. */
    perch?: { x: number; y: number; z: number; yaw: number; edge: number };
    /** A door's foot and the way it faces, and whether its back is free. */
    door?: { x: number; y: number; yaw: number; both: boolean };
    /** To look at: its middle and the way it faces out. */
    look?: { x: number; y: number; z: number; nx: number; ny: number };
  }

  /** Everything near (x, y) she could do something with. */
  const thingsNear = (x: number, y: number, radius: number): Thing[] => {
    const out: Thing[] = [];
    for (const junk of junkAround(map, x, y, radius)) {
      if (junk.perch) {
        const target = junk.perch.ceiling ? "hung" : (junk.kind as PropTarget);
        out.push({ target, x: junk.perch.x, y: junk.perch.y, junk, perch: junk.perch });
      }
      if (junk.doorway) out.push({ target: "door", x: junk.x, y: junk.y, junk, door: junk.doorway });
      if (junk.plate) {
        const { x: px, y: py, z, yaw } = junk.plate;
        const look = { x: px, y: py, z, nx: Math.cos(yaw), ny: Math.sin(yaw) };
        out.push({ target: "sign", x: px, y: py, junk, look });
      }
    }
    for (const tag of graffitiNear(map, x, y, radius, tuning)) {
      const target = tag.kind === "portrait" ? "portrait" : "graffiti";
      out.push({ target, x: tag.centre.x, y: tag.centre.y, junk: null, look: tag.centre });
    }
    return out;
  };

  /** Whether there's room for her middle at (x, y) on the floor, minding everything but the thing she's at. */
  const roomBy = (x: number, y: number, except: Junk | null) =>
    roomFor(x, y) &&
    !nearJunk.some(
      (junk) =>
        junk !== except &&
        junk.solid &&
        !junk.solid.overhead &&
        solidDistance(junk.solid, x, y) < junk.solid.r + XN_RADIUS,
    );

  /** Where she goes and what she does, to do `pose` with `thing`; null if there's no room for it. */
  interface Plan {
    spot: XnSpot;
    action: XnAction;
    gaze: Point | null;
    swing: boolean;
    curious: number;
    /** Her tail up: on a chair's seat there's a backrest behind her for it to go through. */
    tailUp?: boolean;
  }

  const planFor = (thing: Thing, pose: PropPose): Plan | null => {
    const still = { swing: false, curious: 0 };
    if (thing.perch) {
      const { x, y, z, yaw, edge } = thing.perch;
      const hanging = thing.target === "hung";
      if (pose === "perch" || pose === "swing") {
        // On the front edge, hips just back from it, facing out over it.
        const back = edge - XN_EDGE_BACK;
        const spot = topSpot(x + Math.cos(yaw) * back, y + Math.sin(yaw) * back, z, yaw, hanging);
        const chair = thing.target === "chair" || hanging;
        return { spot, action: "perch", gaze: null, swing: pose === "swing", curious: 0, tailUp: chair };
      }
      if (pose !== "stand" && pose !== "crouch") return null;
      // Upside down under a chair in the ceiling, her feet on the underside of its seat.
      const spot = topSpot(x, y, z, yaw + (Math.random() - 0.5) * 1.2, hanging);
      return { spot, action: pose, gaze: null, ...still };
    }
    if (thing.door) {
      const { x, y, yaw, both } = thing.door;
      const side = both && Math.random() < 0.5 ? -1 : 1;
      const nx = Math.cos(yaw) * side;
      const ny = Math.sin(yaw) * side;
      const back = pose === "sitBack" || pose === "crouchBack";
      const d = back ? XN_DOOR_BACK : XN_DOOR_FACING;
      const sx = x + nx * d;
      const sy = y + ny * d;
      // Her middle out from the door, whichever way she faces.
      const mx = x + nx * (d + 0.06);
      const my = y + ny * (d + 0.06);
      if (!roomBy(mx, my, thing.junk)) return null;
      const action: XnAction = pose === "stand" ? "stand" : pose === "sit" || pose === "sitBack" ? "sit" : "crouch";
      const facing = back ? Math.atan2(ny, nx) : Math.atan2(-ny, -nx);
      const gaze: Point | null = back ? null : [x, y, 0.4];
      return { spot: floorSpot(sx, sy, facing), action, gaze, ...still };
    }
    if (thing.look) {
      const { x, y, z, nx, ny } = thing.look;
      const d = between(XN_LOOK_AWAY);
      const sx = x + nx * d;
      const sy = y + ny * d;
      if (!roomBy(sx, sy, thing.junk)) return null;
      const action: XnAction = pose === "sit" ? "sit" : pose === "crouch" ? "crouch" : "stand";
      // Facing it, a little off square.
      const facing = Math.atan2(-ny, -nx) + (Math.random() - 0.5) * 0.4;
      return {
        spot: floorSpot(sx, sy, facing),
        action,
        gaze: [x, y, z],
        swing: false,
        curious: thing.target === "portrait" ? XN_CURIOUS * (Math.random() < 0.5 ? -1 : 1) : 0,
      };
    }
    return null;
  };

  /** Puts her there, doing that. */
  const carryOut = (who: Xn, plan: Plan) => {
    who.moveTo(plan.spot);
    who.act(plan.action, plan.gaze);
    who.swingLegs = plan.swing;
    who.curious = plan.curious;
    if (plan.tailUp) who.manner = { ...who.manner, tailUp: true };
  };

  /**
   * Something near the visitor for XN to do something with, out of their view: one with nothing between, if any of
   * those near is; any out of view otherwise. Null if none is.
   */
  const pickXnProp = (who: Xn, cam: Camera): Plan | null => {
    const things = thingsNear(cam.x, cam.y, XN_FAR);
    for (let i = things.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [things[i], things[j]] = [things[j], things[i]];
    }
    let fallback: Plan | null = null;
    for (const thing of things) {
      const poses = PROP_POSES[thing.target];
      const plan = planFor(thing, poses[Math.floor(Math.random() * poses.length)]);
      if (!plan) continue;
      const [mx, my] = who.middleOf(plan.spot);
      const away = Math.hypot(mx - cam.x, my - cam.y);
      if (away < XN_NEAR || away > XN_FAR || sees(cam, mx, my)) continue;
      if (clearBetween(cam.x, cam.y, mx, my)) return plan;
      if (!fallback) fallback = plan;
    }
    return fallback;
  };

  /** Puts XN somewhere new near the visitor, doing something new. False if there was nowhere. */
  const relocateXn = (who: Xn, cam: Camera) => {
    // Half the time, at something near the visitor, if there's anything.
    const prop = Math.random() < XN_PROP_CHANCE ? pickXnProp(who, cam) : null;
    if (prop) {
      who.manner = { tailUp: Math.random() < XN_TAIL_UP, swingArms: false };
      carryOut(who, prop);
      settleXn();
      return true;
    }
    const spot = pickXnSpot(who, cam);
    if (!spot) return false;
    who.moveTo(spot);
    who.manner = { tailUp: Math.random() < XN_TAIL_UP, swingArms: Math.random() < XN_SWING_ARMS };
    // If she walks, it's a new way of walking each time; the dev panel shows it, so its sliders start from it.
    who.walk = randomWalk();
    xnPreview = { ...xnPreview, walk: who.walk };
    parts.onXnWalk?.(who.walk);
    const actions = XN_ACTIONS.filter((action) => !(spot.surface === "wall" && NOT_ON_WALLS.has(action)));
    startXnAction(who, actions[Math.floor(Math.random() * actions.length)]);
    // Going to a wall to face it can bring her into view; then she just stands where she turned up.
    if (sees(cam, who.x, who.y)) {
      who.moveTo(spot);
      startXnAction(who, "stand");
    }
    settleXn();
    return true;
  };

  /** XN's own comings and goings, by dt seconds of play. */
  const runXn = (dt: number) => {
    if (!xn || !xnPreview.auto) return;
    const cam = playerCamera();
    if (!xnHere) {
      xnAway -= dt;
      // Nowhere to turn up: she tries again in a second.
      if (xnAway <= 0 && !relocateXn(xn, cam)) xnAway = 1;
      return;
    }
    if (sees(cam, xn.x, xn.y)) {
      xnUnseen = 0;
      return;
    }
    xnUnseen += dt;
    if (xnUnseen < xnPatience) return;
    if (Math.random() < XN_AWAY_CHANCE || !relocateXn(xn, cam)) sendXnAway(between(XN_AWAY));
  };

  const blocked = (x: number, y: number) => {
    for (const mesh of nearby) {
      if (Math.hypot(x - mesh.x, y - mesh.y) < STATUE_RADIUS) return true;
    }
    if (xn && xnHere && Math.hypot(x - xn.x, y - xn.y) < XN_RADIUS) return true;
    if (intoJunk(x, y, 0.1, "floor")) return true;
    const r = PLAYER_RADIUS;
    return (
      !!light.wallAt(Math.floor(x - r), Math.floor(y - r), map) ||
      !!light.wallAt(Math.floor(x + r), Math.floor(y - r), map) ||
      !!light.wallAt(Math.floor(x - r), Math.floor(y + r), map) ||
      !!light.wallAt(Math.floor(x + r), Math.floor(y + r), map)
    );
  };

  const playerCamera = (): Camera => ({
    x: player.x,
    y: player.y,
    angle: player.angle,
    pitch: player.pitch,
    bob: player.bob,
  });

  /** Where the camera is while rewinding: running back along the walk, faster and faster. */
  const rewindCamera = (): Camera => {
    const lastIndex = trail.length - 1;
    const p = Math.min(1, fxTime / REWIND_TIME);
    const at = Math.max(0, lastIndex - p * p * Math.min(lastIndex, REWIND_SPAN));
    const i = Math.floor(at);
    const a = trail[i];
    const b = trail[Math.min(lastIndex, i + 1)];
    const k = at - i;
    // Turn the short way round between the two.
    const turn = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      angle: a.angle + turn * k,
      pitch: a.pitch + (b.pitch - a.pitch) * k,
      bob: 0,
    };
  };

  const camera = (): Camera => (mode === "rewind" && !reduced && trail.length ? rewindCamera() : playerCamera());

  /** The statues in drawing range of the camera, and whether one is close enough to touch. */
  const lookAround = (cam: Camera) => {
    nearby = [];
    let reachable = false;
    const fx = Math.cos(cam.angle);
    const fy = Math.sin(cam.angle);
    for (const statue of map.statuesAround(cam.x, cam.y, DRAW_RANGE)) {
      const dx = statue.x - cam.x;
      const dy = statue.y - cam.y;
      const dist = Math.hypot(dx, dy);
      if (dist > DRAW_RANGE) continue;
      let mesh = meshes.get(statue);
      if (!mesh) {
        mesh = placeStatue(parts.model, statue);
        meshes.set(statue, mesh);
      }
      nearby.push(mesh);
      if (dist <= tuning.statueReach / 100 && (dx * fx + dy * fy) / (dist || 1) > FACING) reachable = true;
    }
    nearJunk = junkAround(map, cam.x, cam.y, DRAW_RANGE);
    return reachable;
  };

  /** Everything to draw from this camera. XN moves on by dt seconds; she watches the camera. */
  const gather = (cam: Camera, dt: number) => {
    props = [];
    if (skin) for (const mesh of nearby) props.push({ mesh, model: parts.model, skin });
    for (const junk of nearJunk) {
      // A monitor waits for its screen's picture.
      const junkSkin = {
        monitor,
        chair: WOOD_SKIN,
        sign: SIGN_SKIN,
        door: DOOR_SKIN,
        exit: SAFETY_SKIN,
        wetFloor: SAFETY_SKIN,
        cabinet: OFFICE_SKIN,
        desk: WOOD_SKIN,
        socket: OFFICE_SKIN,
        burger: BURGER_SKIN,
      }[junk.kind];
      if (!junkSkin) continue;
      let mesh = junkMeshes.get(junk.key);
      if (!mesh) {
        mesh = placeJunk(junk.model, junk);
        junkMeshes.set(junk.key, mesh);
      }
      props.push({ mesh, model: junk.model, skin: junkSkin, clip: true });
    }
    if (xn && xnHere && xnSkin && Math.hypot(xn.x - cam.x, xn.y - cam.y) <= DRAW_RANGE) {
      const eye: Point = [cam.x, cam.y, EYE];
      props.push({ mesh: xn.update(dt, eye, reduced), model: xn.figure.look, skin: xnSkin });
    }
  };

  /** dt is capped to keep the walk steady; `real` is the time that actually passed, which is what SAN counts. */
  const update = (dt: number, real: number, now: number) => {
    const held = (code: string) => (keys.has(code) ? 1 : 0);
    const step = player.move(
      dt,
      {
        forward: held("KeyW") + held("ArrowUp") - held("KeyS") - held("ArrowDown") - joy.y,
        strafe: held("KeyD") - held("KeyA") + joy.x,
        turn: held("ArrowRight") - held("ArrowLeft"),
        run: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      },
      blocked,
      tuning.bob && !reduced ? renderer.pictureHeight : 0,
    );
    if (step) playStepSfx();
    // Time in here wears the visitor's SAN down, at the clock's pace however slowly the picture draws. Only while
    // playing: paused, hidden or leaving doesn't count.
    passSanTime(real);
    trailClock += dt;
    if (trailClock >= TRAIL_STEP) {
      trailClock = 0;
      trail.push(playerCamera());
      if (trail.length > TRAIL_KEEP) trail = trail.slice(-TRAIL_KEEP);
    }
    if (light.needsBuild(player.x, player.y)) light.build(player.x, player.y, map);
    const atStatue = lookAround(playerCamera());
    runXn(dt);
    // She comes first: a statue by her can wait.
    reach = xnInReach() ? "xn" : atStatue ? "statue" : null;
    setPrompt(reach !== null);
    // Her line stays until the next, its time is up, or the visitor walks off.
    lineLeft -= dt;
    const off = !xn || !xnHere || Math.hypot(xn.x - player.x, xn.y - player.y) > LINE_RANGE;
    if (shownLine !== null && (off || lineLeft <= 0)) showLine(null);
    // She stops walking while the visitor can talk to her, and until her line is done.
    if (xn) xn.halted = reach === "xn" || shownLine !== null;
    const digits = timecode.update(nearestStatue(map, player.x, player.y), tuning.compass, now, reduced);
    const line = timeStamp(digits);
    if (line !== shownTime) {
      shownTime = line;
      parts.timeLine.textContent = line;
    }
  };

  const effects = (dt: number): Effects => {
    if (mode === "play") {
      if (enterLeft <= 0) return CLEAN;
      enterLeft -= dt;
      const k = Math.max(0, enterLeft / ENTER_TIME);
      // The snow clears first; strips of wall stay without their lower half a little longer.
      return { ...CLEAN, snow: k * k, tear: k, wallGaps: Math.sqrt(k) };
    }
    fxTime += dt;
    if (mode === "rewind") {
      if (reduced) return { ...CLEAN, snow: 0.3 };
      if (fxTime < REWIND_TIME) {
        const p = fxTime / REWIND_TIME;
        bandPhase += dt * (1.2 + 2 * p);
        return { ...CLEAN, snow: 0.08 + 0.3 * p, tear: 0.5 + 0.5 * p, bands: 0.6 + 0.4 * p, bandPhase, bleed: 1 + 2 * p };
      }
      // The burst: a white flash, then the picture torn apart and jumping, and the tape fading off the desktop. It
      // sounds like STOP: the tape done rewinding.
      if (!burst) {
        burst = true;
        playStopSfx();
      }
      const into = fxTime - REWIND_TIME;
      if (into > BURST_TIME) stage.style.opacity = String(Math.max(0, 1 - (into - BURST_TIME) / CUT_TIME));
      return {
        ...CLEAN,
        snow: 0.85 + Math.random() * 0.15,
        tear: 1,
        roll: Math.random() < 0.5 ? Math.random() * renderer.pictureHeight : 0,
        bleed: 3,
        flash: Math.max(0, 1 - into / 0.08),
      };
    }
    if (mode === "lost") {
      if (reduced) return { ...CLEAN, snow: 1 };
      // No picture at all: snow, slipping and rolling as the tracking hunts for a signal that isn't there.
      if (fxTime > LOST_TIME) stage.style.opacity = String(Math.max(0, 1 - (fxTime - LOST_TIME) / LOST_FADE));
      return {
        ...CLEAN,
        snow: 1,
        tear: 0.6 + Math.random() * 0.4,
        roll: Math.random() < 0.25 ? Math.random() * renderer.pictureHeight : 0,
        bleed: 2,
      };
    }
    return { ...CLEAN, snow: reduced ? 0.6 : 1, tear: reduced ? 0 : 1 };
  };

  const pausedFrame = (now: number) => {
    if (reduced) {
      if (nextJitter === 0) {
        renderer.renderPaused(0, -1);
        nextJitter = 1;
      }
      return;
    }
    if (now < nextJitter) return;
    nextJitter = now + 0.08 + Math.random() * 0.08;
    renderer.renderPaused(Math.random() < 0.5 ? 0 : Math.random() < 0.5 ? -1 : 1, pausedBand);
  };

  let raf = 0;
  let last = -1;
  /**
   * Something broke while running: an error boundary never sees errors thrown here, so the loop stops itself, lets
   * go of the mouse and leaves, which puts the visitor back on the desktop.
   */
  const crash = (error: unknown) => {
    if (left) return;
    left = true;
    cancelAnimationFrame(raf);
    hum.setLevel(0);
    unlock();
    console.error("XN's backrooms stopped:", error);
    parts.onLeave("stop");
  };
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    try {
      runFrame(t);
    } catch (error) {
      crash(error);
    }
  };
  const runFrame = (t: number) => {
    const now = t / 1000;
    const real = last < 0 ? 0 : Math.min(MAX_REAL_STEP, Math.max(0, (t - last) / 1000));
    const dt = Math.min(0.05, real);
    last = t;
    if (left) return;
    if (mode === "pause") {
      pausedFrame(now);
      return;
    }
    nextJitter = 0;
    if (mode === "play") update(dt, real, now);
    const fx = effects(dt);
    const cam = camera();
    if (mode !== "play") {
      if (light.needsBuild(cam.x, cam.y)) light.build(cam.x, cam.y, map);
      lookAround(cam);
    }
    light.step(dt, reduced, tuning.bright / 100);
    gather(cam, dt);
    renderer.render(cam, light, map, tuning, props, fx, reduced);
    const ending =
      mode === "rewind"
        ? REWIND_TIME + BURST_TIME + CUT_TIME
        : mode === "stop"
          ? STOP_TIME
          : mode === "lost"
            ? LOST_TIME + LOST_FADE
            : 0;
    if (ending && fxTime >= (reduced ? CALM_LEAVE_TIME : ending)) {
      left = true;
      parts.onLeave(mode === "rewind" || mode === "lost" ? mode : "stop");
    }
  };

  // ---- input ----

  const inDevPanel = (target: EventTarget | null) => {
    const panel = parts.devPanel();
    return !!panel && target instanceof Node && panel.contains(target);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (inDevPanel(e.target)) return;
    // Nothing reaches the desktop underneath while the tape plays.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode === "play") pause();
      else if (mode === "pause") leaveBy("stop");
      return;
    }
    resumeAudioContext();
    if (mode !== "play") return;
    if (MOVE_KEYS.has(e.code)) {
      keys.add(e.code);
      if (e.code.startsWith("Arrow")) e.preventDefault();
    }
    if (e.code === "KeyE" && !e.repeat) interact();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  const onBlur = () => {
    keys.clear();
    pause();
  };
  const onVisibility = () => {
    if (document.hidden) pause();
  };
  const onLockChange = () => {
    // Losing the lock is how the browser reports the first Esc; it keeps the key itself.
    if (!locked() && mode === "play" && !touch) pause();
  };
  const onMouseMove = (e: MouseEvent) => {
    if (mode === "play" && locked()) player.look(e.movementX, e.movementY, 1);
  };

  const onPointerDown = (e: PointerEvent) => {
    resumeAudioContext();
    if (mode === "pause") {
      e.preventDefault();
      resume();
      return;
    }
    if (mode !== "play") return;
    if (e.pointerType === "mouse") {
      if (e.button !== 0) return;
      if (locked()) {
        interact();
        return;
      }
      lock();
      // Until the lock takes (or if the browser refuses it), dragging looks around.
      lookId = e.pointerId;
      lookX = e.clientX;
      lookY = e.clientY;
      return;
    }
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now() };
    const box = stage.getBoundingClientRect();
    if (joy.id === -1 && e.clientX - box.left < box.width * 0.45) {
      joy.id = e.pointerId;
      joy.ox = e.clientX;
      joy.oy = e.clientY;
      joy.x = 0;
      joy.y = 0;
      parts.joystick.style.left = `${e.clientX - box.left}px`;
      parts.joystick.style.top = `${e.clientY - box.top}px`;
      parts.knob.style.transform = "";
      parts.joystick.hidden = false;
    } else if (lookId === -1) {
      lookId = e.pointerId;
      lookX = e.clientX;
      lookY = e.clientY;
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (mode !== "play") return;
    if (e.pointerId === joy.id) {
      let jx = (e.clientX - joy.ox) / 44;
      let jy = (e.clientY - joy.oy) / 44;
      const len = Math.hypot(jx, jy);
      if (len > 1) {
        jx /= len;
        jy /= len;
      }
      joy.x = jx;
      joy.y = jy;
      parts.knob.style.transform = `translate(${jx * 30}px, ${jy * 30}px)`;
    } else if (e.pointerId === lookId && !locked()) {
      if (e.pointerType === "mouse" && !(e.buttons & 1)) return;
      player.look(e.clientX - lookX, e.clientY - lookY, e.pointerType === "mouse" ? 1 : 2.4);
      lookX = e.clientX;
      lookY = e.clientY;
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    // Again as the finger lifts: iPhones don't count a finger coming down as asking for sound, only one lifting.
    resumeAudioContext();
    if (tap && tap.id === e.pointerId) {
      const still = Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP_PX;
      if (still && performance.now() - tap.at < TAP_MS) interact();
      tap = null;
    }
    if (e.pointerId === joy.id) resetJoystick();
    if (e.pointerId === lookId) lookId = -1;
  };
  const onContextMenu = (e: Event) => e.preventDefault();

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("pointerlockchange", onLockChange);
  document.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);

  const fit = () => {
    renderer.resize(stage.clientWidth, stage.clientHeight, tuning.res);
    // Paused (a phone turned, a window resized): the held frame went with the old size, so it's drawn again at the
    // new one, and the noise band moves to somewhere on it.
    if (mode === "pause") {
      pausedBand = Math.floor(Math.random() * renderer.pictureHeight * 0.8);
      redrawHeld();
    }
  };
  const resizer = new ResizeObserver(fit);
  resizer.observe(stage);
  fit();
  raf = requestAnimationFrame(frame);

  /** The dev panel is used paused, so the held frame is redrawn to show a change. */
  const redrawHeld = () => {
    if (mode !== "pause") return;
    light.build(player.x, player.y, map);
    light.step(0, reduced, tuning.bright / 100);
    lookAround(playerCamera());
    gather(playerCamera(), 0);
    renderer.render({ ...playerCamera(), bob: 0 }, light, map, tuning, props, CLEAN, reduced);
    renderer.hold();
    nextJitter = 0;
  };

  return {
    stop: () => leaveBy("stop"),
    pause,
    tune(next, freshMap) {
      Object.assign(tuning, next);
      if (freshMap) {
        map = pickMap(tuning);
        player = new Player();
        timecode = new Timecode();
        meshes.clear();
        nearby = [];
        junkMeshes.clear();
        nearJunk = [];
        trail = [];
        if (xnPreview.auto) {
          // A new start: she turns up a while from now, as when the visitor comes in.
          sendXnAway(between(XN_FIRST_WAIT));
        } else if (xn) {
          xn.moveTo(spotAhead(player.x, player.y, player.angle, xnPreview.surface));
          startXnAction(xn, xnPreview.action);
          settleXn();
        }
      }
      fit();
      light.forget();
      if (mode === "play") hum.setLevel(tuning.hum ? 1 : 0);
      redrawHeld();
    },
    previewXn(next, restart) {
      // A surface or action from the panel brings her in front of the visitor, as does turning her own comings and
      // goings off while she's gone.
      const bring = restart || (!next.auto && !xnHere);
      const moved = next.surface !== xnPreview.surface || (bring && !xnHere);
      xnPreview = { ...next };
      if (!xn) return;
      xn.ignore = next.ignore;
      xn.noticeRange = next.noticeRange;
      xn.manner = { tailUp: next.tailUp, swingArms: next.swingArms };
      xn.crouch = { ...next.crouch };
      xn.sit = { ...next.sit };
      xn.walk = { ...next.walk };
      if (moved) xn.moveTo(spotAhead(player.x, player.y, player.angle, next.surface));
      if (bring) {
        startXnAction(xn, next.action);
        settleXn();
      } else {
        xn.repose();
      }
      redrawHeld();
    },
    forgetXnMeetings() {
      forgetMeetings();
      talk = new Talk();
    },
    moveXnOn() {
      if (xn && relocateXn(xn, playerCamera())) redrawHeld();
    },
    previewXnProp(target, pose) {
      if (!xn) return;
      // The things of this kind near the visitor, nearest first; asked again, the next one.
      const things = thingsNear(player.x, player.y, 25)
        .filter((thing) => thing.target === target)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      const key = `${target}:${pose}`;
      propTurn = key === propKey ? propTurn + 1 : 0;
      propKey = key;
      for (let k = 0; k < things.length; k++) {
        const plan = planFor(things[(propTurn + k) % things.length], pose);
        if (!plan) continue;
        carryOut(xn, plan);
        settleXn();
        redrawHeld();
        return;
      }
    },
    dispose() {
      left = true;
      disposed = true;
      cancelAnimationFrame(raf);
      resizer.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      hum.stop();
      // No unlocking here: every way out (rewind, stop, a crash's boundary) already lets go of the mouse, and a dev
      // build mounts this twice, where letting go would read as the visitor pressing Esc and pause the tape.
    },
  };
}
