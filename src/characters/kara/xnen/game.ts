import { resumeAudioContext } from "../../../shared/audio";
import { prefersReducedMotion } from "../../../shared/motion";
import { nearestStatue, Timecode } from "./engine/compass";
import { parseFigure } from "./engine/figure";
import {
  BURGER_SKIN,
  CAMP_SKIN,
  CANDLE_SKIN,
  DOOR_SKIN,
  heldBurger,
  KITCHEN_SKIN,
  MEETING_SKIN,
  junkAround,
  monitorSkin,
  OFFICE_SKIN,
  placeJunk,
  SAFETY_SKIN,
  SIGN_SKIN,
  STAIRS_SKIN,
  STORAGE_SKIN,
  VENDING_SKIN,
  WOOD_SKIN,
  type Junk,
} from "./engine/junk";
import { Lighting } from "./engine/lighting";
import { SPAWN, WorldMap, type Statue } from "./engine/map";
import { PLAYER_RADIUS, Player } from "./engine/player";
import { inkOf, setDrawing, type DrawingName } from "./engine/graffiti";
import { agePosters } from "./engine/posters";
import { CLEAN, EYE, Renderer, type Camera, type Effects } from "./engine/render";
import { whiteboardSkin } from "./engine/whiteboard";
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
  Xn,
  XN_ACTIONS,
  XN_RADIUS,
  type Point,
  type XnAction,
  type XnCrouch,
  type XnSit,
  type XnWalk,
  type XnSurface,
} from "./xn";
import { between, createXnPlaces, type PropPose, type PropTarget } from "./xnPlaces";

/*
 * Runs the place: input, the frame loop, the tape's PLAY / PAUSE / REW / STOP, sound. Everything here is plain DOM
 * and canvas; XnenWorld only lays out the page and shows what this reports.
 */

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
  /** Dev builds: how the frames are going, every half second or so. */
  onFrameStats?: (stats: FrameStats) => void;
}

/** Over the last half second or so: frames a second, and the work of one frame (input, XN, drawing), in ms. */
export interface FrameStats {
  fps: number;
  work: number;
  worst: number;
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
/**
 * Falling into a pit: how fast, in ceiling heights a second squared, and how far down the eye goes before the tape
 * stops: the pits have no bottom, and by then it's all dark.
 */
const FALL_PULL = 3.6;
const FALL_END = -2.6;
/**
 * How far the visitor's middle can be out over a pit before they fall: until then a foot is still on the rim. Under
 * PLAYER_RADIUS, so they lean out over the dark a little first.
 */
const PIT_FOOTING = 0.08;
/** While falling, the view tips down this much, as a share of the picture's height. */
const FALL_TIP = 0.25;
/** Dev builds: how often the frame stats are reported, in seconds. */
const STATS_EVERY = 0.5;
/** How brightly candle flames light themselves, and how much they flicker. */
const FLAME_GLOW = 1.5;
const FLAME_FLICKER = 0.25;
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
/** How likely her tail is up, and her arms swing, each time she turns up. */
const XN_TAIL_UP = 0.3;
const XN_SWING_ARMS = 0.3;
/** How likely she is, each time she turns up, to be at something near her (getting up on it, looking at it). */
const XN_PROP_CHANCE = 0.5;
/**
 * With a burger room this near the visitor, she's most often at its party, across the table from Kara's seat, a
 * burger in her hands.
 */
const XN_PARTY_NEAR = 10;
const XN_PARTY_CHANCE = 0.75;
/** Otherwise, with a dark hall this near, she's often under its one light. */
const XN_SPOTLIGHT_NEAR = 12;
const XN_SPOTLIGHT_CHANCE = 0.5;

/**
 * Seconds of play a subtitle stays: at least LINE_TIME, and longer lines a little longer, LINE_BASE plus this much
 * a character, so the longest stay about seven and a half.
 */
const LINE_TIME = 4;
/** A subtitle goes once the visitor is further than this many cells from her. */
const LINE_RANGE = 2;
const LINE_BASE = 2;
const LINE_PER_CHARACTER = 0.07;

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
  /** Falling into a pit: the eye's height and how fast it's going down. Null while on solid floor. */
  let fall: { z: number; speed: number } | null = null;
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
  // Where XN can be, and what she does there.
  const {
    intoJunk,
    spotAhead,
    startXnAction,
    sees,
    pickXnSpot,
    thingsNear,
    planFor,
    carryOut,
    pickXnProp,
  } = createXnPlaces({
    get map() {
      return map;
    },
    get player() {
      return player;
    },
    get statues() {
      return nearby;
    },
    get junk() {
      return nearJunk;
    },
    tuning,
    spread: () => renderer.spread(tuning.fov),
  });
  /** What the picture draws besides the place itself, built again each frame. */
  let props: Prop[] = [];
  /** Seconds of flicker so far. */
  let flameClock = 0;

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
    // With a burger in her hands, she's at a party.
    const line = talk.next(!!xn && xn.holding !== "none");
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

  /** Puts XN somewhere new near the visitor, doing something new. False if there was nowhere. */
  const relocateXn = (who: Xn, cam: Camera) => {
    // At the party, if there's one near; or under a dark hall's light; otherwise half the time at something near the
    // visitor, if there's anything.
    const party = Math.random() < XN_PARTY_CHANCE ? pickXnProp(who, cam, "party", XN_PARTY_NEAR) : null;
    const lit =
      party ??
      (Math.random() < XN_SPOTLIGHT_CHANCE ? pickXnProp(who, cam, "spotlight", XN_SPOTLIGHT_NEAR) : null);
    const prop = lit ?? (Math.random() < XN_PROP_CHANCE ? pickXnProp(who, cam) : null);
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
    pitch: fall ? player.pitch + FALL_TIP * Math.min(1, (EYE - fall.z) / (EYE - FALL_END)) : player.pitch,
    bob: fall ? 0 : player.bob,
    z: fall ? fall.z : EYE,
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
    // Candle flames, bright, and all flickering a little together; still, with reduced motion.
    flameClock += dt;
    const flicker = Math.sin(flameClock * 11) * Math.sin(flameClock * 4.3);
    const flameGlow = reduced ? FLAME_GLOW : FLAME_GLOW + FLAME_FLICKER * flicker;
    if (skin) for (const mesh of nearby) props.push({ mesh, model: parts.model, skin });
    for (const junk of nearJunk) {
      // A monitor waits for its screen's picture. A board XN's written on has its own, as she reads now.
      const { writing } = junk;
      const read = (text: string) => readAs(text, xnReadable());
      const junkSkin = writing ? whiteboardSkin(writing.index, writing.seed, read) : junk.office ? OFFICE_SKIN : {
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
        bedding: CAMP_SKIN,
        can: CAMP_SKIN,
        kitchen: KITCHEN_SKIN,
        board: MEETING_SKIN,
        storage: STORAGE_SKIN,
        candle: CANDLE_SKIN,
        flame: CANDLE_SKIN,
        partition: OFFICE_SKIN,
        vending: VENDING_SKIN,
        stairs: STAIRS_SKIN,
      }[junk.kind];
      if (!junkSkin) continue;
      let mesh = junkMeshes.get(junk.key);
      if (!mesh) {
        mesh = placeJunk(junk.model, junk);
        junkMeshes.set(junk.key, mesh);
      }
      props.push({ mesh, model: junk.model, skin: junkSkin, clip: true, glow: junk.glow ? flameGlow : undefined });
    }
    if (xn && xnHere && xnSkin && Math.hypot(xn.x - cam.x, xn.y - cam.y) <= DRAW_RANGE) {
      const eye: Point = [cam.x, cam.y, cam.z ?? EYE];
      props.push({ mesh: xn.update(dt, eye, reduced), model: xn.figure.look, skin: xnSkin });
      // What she has in her hands.
      const held = xn.held();
      if (held) props.push({ ...heldBurger(held.x, held.y, held.z, held.yaw, held.tip), skin: BURGER_SKIN });
    }
  };

  /** dt is capped to keep the walk steady; `real` is the time that actually passed, which is what SAN counts. */
  const update = (dt: number, real: number, now: number) => {
    // Falling into a pit: nothing to do but drop, and once it's all dark the tape stops.
    if (fall) {
      passSanTime(real);
      fall.speed += FALL_PULL * dt;
      fall.z -= fall.speed * dt;
      if (fall.z <= FALL_END) {
        fall.z = FALL_END;
        leaveBy("lost");
      }
      return;
    }
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
    if (map.pitAt(player.x, player.y, PIT_FOOTING)) {
      // Over the edge. With reduced motion there's no drop to watch: the tape just stops.
      showLine(null);
      setPrompt(false);
      keys.clear();
      resetJoystick();
      if (reduced) leaveBy("lost");
      else fall = { z: EYE, speed: 0 };
      return;
    }
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
  /** Dev builds: frames, their work and the worst of it, and the seconds they took, since the stats were last sent. */
  const stats = { frames: 0, work: 0, worst: 0, time: 0 };
  /** Counts one frame's work, in ms, and sends the stats on once there's enough of them. */
  const countFrame = (work: number, real: number) => {
    const send = parts.onFrameStats;
    if (!send) return;
    stats.frames++;
    stats.work += work;
    stats.worst = Math.max(stats.worst, work);
    stats.time += real;
    if (stats.time < STATS_EVERY) return;
    send({ fps: stats.frames / stats.time, work: stats.work / stats.frames, worst: stats.worst });
    stats.frames = 0;
    stats.work = 0;
    stats.worst = 0;
    stats.time = 0;
  };
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
    const started = parts.onFrameStats ? performance.now() : 0;
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
    if (parts.onFrameStats) countFrame(performance.now() - started, real);
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
