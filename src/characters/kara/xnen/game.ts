import { resumeAudioContext } from "../../../shared/audio";
import { prefersReducedMotion } from "../../../shared/motion";
import { AT_STATUE, nearestStatue, Timecode } from "./engine/compass";
import { Lighting } from "./engine/lighting";
import { SPAWN, WorldMap, type Statue } from "./engine/map";
import { PLAYER_RADIUS, Player } from "./engine/player";
import { CLEAN, Renderer, type Camera, type Effects } from "./engine/render";
import { placeStatue, STATUE_RADIUS, type StatueMesh, type StatueModel, type StatueSkin } from "./engine/statue";
import type { Tuning } from "./engine/tuning";
import { playPauseSfx, playRewindSfx, playStepSfx, playStopSfx, startHum } from "./sfx";
import { dateStamp, timeStamp } from "./stamp";

/*
 * Runs the place: input, the frame loop, the tape's PLAY / PAUSE / REW / STOP, sound. Everything here is plain DOM
 * and canvas; XnenWorld only lays out the page and shows what this reports.
 */

/** What the tape is doing, shown top left. */
export type Mode = "play" | "pause" | "rewind" | "stop";
/** How the visitor left: through a statue, or by stopping the tape. */
export type Exit = "rewind" | "stop";

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
  tuning: Tuning;
  touch: boolean;
  onMode: (mode: Mode) => void;
  onPrompt: (show: boolean) => void;
  onLeave: (exit: Exit) => void;
}

export interface Game {
  /** The phone's stop button. */
  stop: () => void;
  /** The dev panel opened: pause so the mouse is free. */
  pause: () => void;
  /** New tuning from the dev panel; `freshMap` also starts over on a new map at the spawn point. */
  tune: (next: Tuning, freshMap: boolean) => void;
  dispose: () => void;
}

/** Seconds the picture takes to come out of the snow. */
const ENTER_TIME = 0.9;
/** A rewind: running back along the walk, then a burst of static, then a quick fade onto the desktop. */
const REWIND_TIME = 1.45;
const BURST_TIME = 0.35;
const CUT_TIME = 0.2;
const STOP_TIME = 0.35;
/** The walk is remembered every this many seconds, for rewinding. */
const TRAIL_STEP = 0.1;
/** How much of the walk is remembered, and how much of it a rewind runs back over, in steps. */
const TRAIL_KEEP = 600;
const REWIND_SPAN = 200;
/** With reduced motion, how long REW or STOP stays up while the page fades. */
const CALM_LEAVE_TIME = 0.5;
/** Statues further than this aren't drawn. */
const DRAW_RANGE = 28;
/** How squarely a statue has to be faced to touch it (close enough is AT_STATUE, where the timecode reads 4:20). */
const FACING = 0.55;
/** A touch shorter and stiller than this is a tap. */
const TAP_MS = 300;
const TAP_PX = 12;
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

function loadSkin(url: string, done: (skin: StatueSkin) => void) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    done({ data: ctx.getImageData(0, 0, image.width, image.height).data });
  };
  image.src = url;
}

export function createGame(parts: GameParts): Game {
  const { stage, canvas, tuning, touch } = parts;
  const reduced = prefersReducedMotion();
  const renderer = new Renderer(canvas);
  const light = new Lighting();
  let timecode = new Timecode();
  let player = new Player();
  let map = pickMap(tuning);
  const meshes = new Map<Statue, StatueMesh>();
  let skin: StatueSkin | null = null;
  loadSkin(parts.atlasUrl, (loaded) => {
    skin = loaded;
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
  let shownTime = "";
  let nearby: StatueMesh[] = [];

  parts.dateLine.textContent = dateStamp(new Date());

  const keys = new Set<string>();
  const joy = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  let lookId = -1;
  let lookX = 0;
  let lookY = 0;
  let tap: { id: number; x: number; y: number; at: number } | null = null;
  let pausedBand = -1;
  let nextJitter = 0;

  const locked = () => document.pointerLockElement !== null;
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

  const leaveBy = (exit: Exit) => {
    if (mode === "rewind" || mode === "stop") return;
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

  const interact = () => {
    if (mode === "play" && prompt) leaveBy("rewind");
  };

  const blocked = (x: number, y: number) => {
    for (const mesh of nearby) {
      if (Math.hypot(x - mesh.x, y - mesh.y) < STATUE_RADIUS) return true;
    }
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
      if (dist <= AT_STATUE && (dx * fx + dy * fy) / (dist || 1) > FACING) reachable = true;
    }
    return reachable;
  };

  const update = (dt: number, now: number) => {
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
    trailClock += dt;
    if (trailClock >= TRAIL_STEP) {
      trailClock = 0;
      trail.push(playerCamera());
      if (trail.length > TRAIL_KEEP) trail = trail.slice(-TRAIL_KEEP);
    }
    if (light.needsBuild(player.x, player.y)) light.build(player.x, player.y, map);
    setPrompt(lookAround(playerCamera()));
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
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const now = t / 1000;
    const dt = last < 0 ? 0 : Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (left) return;
    if (mode === "pause") {
      pausedFrame(now);
      return;
    }
    nextJitter = 0;
    if (mode === "play") update(dt, now);
    const fx = effects(dt);
    const cam = camera();
    if (mode !== "play") {
      if (light.needsBuild(cam.x, cam.y)) light.build(cam.x, cam.y, map);
      lookAround(cam);
    }
    light.step(dt, reduced, tuning.bright / 100);
    renderer.render(
      cam,
      light,
      map,
      tuning,
      { meshes: nearby, model: parts.model, skin },
      fx,
      reduced,
    );
    const ending = mode === "rewind" ? REWIND_TIME + BURST_TIME + CUT_TIME : mode === "stop" ? STOP_TIME : 0;
    if (ending && fxTime >= (reduced ? CALM_LEAVE_TIME : ending)) {
      left = true;
      parts.onLeave(mode === "rewind" ? "rewind" : "stop");
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

  const fit = () => renderer.resize(stage.clientWidth, stage.clientHeight, tuning.res);
  const resizer = new ResizeObserver(fit);
  resizer.observe(stage);
  fit();
  raf = requestAnimationFrame(frame);

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
        trail = [];
      }
      fit();
      light.forget();
      if (mode === "play") hum.setLevel(tuning.hum ? 1 : 0);
      // The panel is used paused, so the held frame is redrawn to show the change.
      if (mode === "pause") {
        light.build(player.x, player.y, map);
        light.step(0, reduced, tuning.bright / 100);
        lookAround(playerCamera());
        renderer.render(
          { ...playerCamera(), bob: 0 },
          light,
          map,
          tuning,
          { meshes: nearby, model: parts.model, skin },
          CLEAN,
          reduced,
        );
        renderer.hold();
        nextJitter = 0;
      }
    },
    dispose() {
      left = true;
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
