import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pickDifferent } from "../apps/common/pickDifferent";
import type { AppId } from "../apps/registry";
import muteSprite from "../assets/pet/kara-mute.webp";
import talkSprite from "../assets/pet/kara-talk.webp";
import { DRAGGING_CLASS, useOs, useOsState } from "./context";
import { isFourTwenty } from "./fourTwenty";
import { handlePetBinExit, putPetInBin, takePetOutOfBin, takePetOutOfBinQuietly, type BinExit } from "./petBin";
import { setPetSeat } from "./petGame";
import { findLedge, refreshLedge, type Ledge } from "./petLedges";
import { playGrabSfx, playLandSfx, playTalkSfx } from "./petSfx";
import { useIsPhone } from "./useIsPhone";
import { readViewport } from "./windowManager";
import { clamp } from "../../../shared/math";

/** Half the sprite files' size, so they stay sharp on high-density screens. */
const WIDTH = 126;
const HEIGHT = 130;

const WALK_SPEED = 55;
const GRAVITY = 2400;
const BOUNCE = 0.35;
const MIN_BOUNCE_SPEED = 180;
const DRAG_THRESHOLD = 4;
const FACING_DEAD_ZONE = 2;
const MIN_WALK_DISTANCE = 80;
const MIN_REST_MS = 2500;
const MAX_REST_MS = 7000;
const TALK_MS = 4200;
/** Long enough for a new window to appear first, as if she noticed it. */
const REACTION_DELAY_MS = 500;
const CLOCK_CHECK_MS = 1000;
/** How often a walk along a window ends with her walking off it, as if she hadn't noticed where it stops. */
const WALK_OFF_CHANCE = 0.15;
/** Dropped with her feet this far below a window's top edge, she still counts as put on it. */
const LEDGE_SNAP = 40;
/** Roughly a two-line balloon and its tail. With less room than this above her, it moves down into view. */
const BALLOON_ROOM = 75;

const LINES = [
  "smoke weed everyday",
  "this is a very formal leaf",
  "have you seen thursday",
  "the printer says hi",
  "i live here now",
  "mr. spicy owes me rent",
  "i've been thinking about a door",
  "why is there a recycle bin but no compost bin",
  "you're doing great. i can't explain why",
  "i moved the chair again",
];

/** Said the first time each one opens, once per visit. Only her own asdf.txt counts as the notepad. */
const OPEN_REACTIONS: Partial<Record<AppId, string>> = {
  radio: "the washing machine is my favorite part",
  messenger: "if kuru asks, i'm asleep",
  projects: "you can't remove them. i tried",
  about: "yes it's registered to kiri. no i won't explain",
  works: "i'm in there. probably",
  recycleBin: "don't touch mr. spicy's web",
  notepad: "that letter is very formal. be careful",
};
/** After walking off the end of something on her own, and only sometimes. */
const WALK_OFF_LINES = ["i meant to do that", "that edge was new", "the floor moved"];
const WALK_OFF_LINE_CHANCE = 0.5;
/** Long enough to look like she's thought about what to say. */
const WALK_OFF_LINE_DELAY_MS = 400;
/** Stepping off something barely above the ground isn't a fall worth explaining. */
const WALK_OFF_LINE_MIN_DROP = 60;
/** Left in the Recycle Bin this long, she lets herself out. */
const BIN_TIMEOUT_MS = 30_000;
/** Matches the shrink in style.css. */
const BIN_ENTER_MS = 300;
/** Upward, so climbing out is a little hop before she falls to wherever is below. */
const BIN_HOP_SPEED = 700;
/** A moment after landing, to look around first. */
const BIN_EXIT_LINE_DELAY_MS = 300;
/** Said on landing, depending on how she got out. Nothing on the way in: she's in a bin. */
const BIN_EXIT_LINES: Record<BinExit, string[]> = {
  restored: ["i was about to become compost", "took you long enough", "i was getting comfortable"],
  crawled: ["you can't delete me. i tried", "thursday is in there. we talked", "i was looking for the burger"],
};
/** Apps she goes into while they're open, to sit in their scoreboard. */
const GAME_APPS: AppId[] = ["burgerSweeper", "dangerNoodle", "pinBun"];
/** Said on landing after a game closes or is minimized, which lets her back out. */
const GAME_EXIT_LINES = ["i was winning", "i let you win", "the burgers are still in there"];
/** How small she gets going into the bin. A game's seat says its own size. */
const BIN_SCALE = 0.1;
const SHUTDOWN_REACTION = "that's a light switch";
const FOUR_TWENTY_LINE = "it's time";

/** "away" is off the desktop: on her way into the bin or a game, or in one. */
type Mode = "idle" | "walk" | "drag" | "fall" | "away";
type Away = "bin" | "game";
/** "entering" and "in" mean she's actually gone. "leaving" lasts as long as the pop back out. */
type AwayStage = "out" | "entering" | "in" | "leaving";
/** Where she flies to, and how small she gets on the way. */
interface AwayTarget {
  x: number;
  y: number;
  scale: number;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The Recycle Bin's icon, if anyone could see it where it is. A window over it means there's no bin to aim for. */
function findVisibleBin(root: Element, pet: Element): HTMLElement | null {
  const bin = root.querySelector<HTMLElement>('.kara-icon[data-app-id="recycleBin"]');
  if (!bin) return null;
  const box = bin.getBoundingClientRect();
  if (box.width === 0) return null;
  const top = document
    .elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    .find((element) => !pet.contains(element));
  return top && bin.contains(top) ? bin : null;
}

interface Seat extends AwayTarget {
  id: string;
}

/**
 * Her place in an open game's scoreboard, sized and placed for the sprite to land exactly on it. Given an id, that
 * seat or nothing. Otherwise the focused game's, then the frontmost one's, or with `focusedOnly`, the focused
 * game's or nothing. A minimized game's seat is still there, only hidden, so it doesn't count.
 */
function findSeat(root: Element, { id, focusedOnly = false }: { id?: string; focusedOnly?: boolean } = {}): Seat | null {
  let found: { element: HTMLElement; z: number } | null = null;
  for (const element of root.querySelectorAll<HTMLElement>("[data-pet-seat]")) {
    const win = element.closest<HTMLElement>(".kara-window");
    if (!win || win.classList.contains("kara-window--minimized")) continue;
    if (id !== undefined && element.dataset.petSeat !== id) continue;
    const focused = win.classList.contains("kara-window--focused");
    if (focusedOnly && !focused) continue;
    // Focus beats being in front: a focused window is always the front one anyway, unless nothing is focused.
    const z = focused ? Infinity : Number(win.style.zIndex);
    if (!found || z > found.z) found = { element, z };
  }
  const box = found?.element.getBoundingClientRect();
  if (!found || !box || box.width === 0) return null;
  return {
    id: found.element.dataset.petSeat ?? "",
    x: box.left + box.width / 2 - WIDTH / 2,
    y: box.top + box.height / 2 - HEIGHT / 2,
    scale: box.width / WIDTH,
  };
}

function restDuration(): number {
  return MIN_REST_MS + Math.random() * (MAX_REST_MS - MIN_REST_MS);
}

/** Somewhere on what she's standing on. A window's edge may also send her just past its end. */
function pickWalkTarget(ledge: Ledge | null, maxX: number): number {
  if (!ledge) return Math.random() * maxX;
  if (Math.random() < WALK_OFF_CHANCE) {
    const edge = Math.random() < 0.5 ? ledge.left - 1 : ledge.right + 1;
    return clamp(edge - WIDTH / 2, 0, maxX);
  }
  const room = Math.max(0, ledge.right - ledge.left - WIDTH);
  return clamp(ledge.left + Math.random() * room, 0, maxX);
}

/** Kara herself. She lives on the desktop, behind the windows, until somebody picks her up and puts her in front or on top of one. */
function DesktopPet({ shuttingDown }: { shuttingDown: boolean }) {
  const os = useOs();
  const { windows, focusedId } = useOsState();
  const isPhone = useIsPhone();
  const pausedRef = useRef(false);
  const isPhoneRef = useRef(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  // The position lives here and goes straight to the DOM, so walking never re-renders anything.
  const motionRef = useRef({
    mode: "idle" as Mode,
    x: 0,
    y: 0,
    targetX: 0,
    velocityY: 0,
    nextDecision: 0,
    ledge: null as Ledge | null,
    ledgeTops: new Map<HTMLElement, number>(),
    walkedOff: false,
    walkedOffY: 0,
    /** Set on the way out of the bin or a game, so landing is when she says something about it. */
    exitLine: null as string | null,
    away: null as Away | null,
    awayStage: "out" as AwayStage,
    /** Whether a game is open for her to go into. Told by the windows, acted on by the frame loop. */
    wantsGame: false,
    /** Where she sat in the game, last seen. The game is gone by the time she comes out of it. */
    seat: null as Seat | null,
  });
  const lastWalkOffLineRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    wasFalling: boolean;
    /** Measured once she starts moving, since nothing else can move during a drag. */
    bin: { element: HTMLElement; box: Rect } | null;
    overBin: boolean;
  } | null>(null);
  const lastLineRef = useRef<string | null>(null);
  const isSpeakingRef = useRef(false);
  const seenWindowsRef = useRef(new Set<string>());
  const spokenRef = useRef(new Set<string>());
  const reactionTimerRef = useRef<number | undefined>(undefined);
  const binTimerRef = useRef<number | undefined>(undefined);
  const awayTargetRef = useRef<AwayTarget>({ x: 0, y: 0, scale: BIN_SCALE });
  const focusedIdRef = useRef<string | null>(null);

  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Once carried, or out of the bin, she stays in front of the windows until focus moves to another one, which then
  // covers her like any other window would. Holds the window focused at the time, null for none.
  const [frontOf, setFrontOf] = useState<string | null | undefined>(undefined);
  if (frontOf !== undefined && focusedId !== frontOf) setFrontOf(undefined);
  const inFront = frontOf !== undefined;
  const [awayStage, setAwayStage] = useState<AwayStage>("out");
  const [exitLandings, setExitLandings] = useState(0);
  const [facingRight, setFacingRight] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [balloonOnRight, setBalloonOnRight] = useState(false);
  const [balloonDrop, setBalloonDrop] = useState(0);
  const [walkOffLandings, setWalkOffLandings] = useState(0);

  useLayoutEffect(() => {
    const viewport = readViewport();
    const motion = motionRef.current;
    motion.x = Math.max(0, viewport.width * 0.6 - WIDTH / 2);
    motion.y = viewport.height - HEIGHT;
    motion.nextDecision = performance.now() + restDuration();
    if (rootRef.current) rootRef.current.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
  }, []);

  /** The frame loop reads the stage too, so it's kept on the motion as well as in state. */
  const setStage = useCallback((stage: AwayStage) => {
    motionRef.current.awayStage = stage;
    setAwayStage(stage);
  }, []);

  /** Off the desktop, into the bin or a game. The flight itself starts once the class for it is on. */
  const goAway = useCallback(
    (place: Away, target: AwayTarget) => {
      const motion = motionRef.current;
      motion.mode = "away";
      motion.away = place;
      awayTargetRef.current = target;
      setWalking(false);
      setLine(null);
      setStage("entering");
      // A game is a window, and she'd fly in behind it.
      if (place === "game") setFrontOf(focusedIdRef.current);
    },
    [setStage],
  );

  /** Back out at this point, with a hop, to fall to whatever is below and say something on landing. */
  const comeOut = useCallback(
    (centerX: number, centerY: number, line: string) => {
      const motion = motionRef.current;
      const viewport = readViewport();
      motion.x = clamp(centerX - WIDTH / 2, 0, viewport.width - WIDTH);
      motion.y = centerY - HEIGHT / 2;
      motion.mode = "fall";
      motion.velocityY = -BIN_HOP_SPEED;
      motion.ledge = null;
      motion.away = null;
      motion.exitLine = line;
      if (rootRef.current) rootRef.current.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;
      setStage("leaving");
      // In front of whatever window let her out, or she'd climb out behind it. Not over a phone's full-screen
      // window, where she'd sit on top of it with nowhere to go.
      if (!isPhoneRef.current) setFrontOf(focusedIdRef.current);
    },
    [setStage],
  );

  useEffect(() => {
    const stayStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = motionRef.current;
    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      // A long gap means the tab was hidden. Picking up from there shouldn't launch her across the screen.
      const seconds = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      const viewport = readViewport();
      const maxX = Math.max(0, viewport.width - WIDTH);
      const ground = viewport.height - HEIGHT;

      const root = rootRef.current?.closest(".kara-os");

      // Into a game as soon as it's open and drawn, straight out of the bin if that's where she is. Not while
      // she's carried, or still on her way into something.
      if (
        root &&
        motion.wantsGame &&
        motion.away !== "game" &&
        motion.mode !== "drag" &&
        motion.awayStage !== "entering"
      ) {
        const seat = findSeat(root);
        if (seat) {
          if (motion.away === "bin") {
            window.clearTimeout(binTimerRef.current);
            takePetOutOfBinQuietly();
          }
          motion.seat = seat;
          goAway("game", seat);
        }
      }

      if (motion.away === "game" && motion.awayStage === "in") {
        // Followed while she's in, since the window can be moved. Once it's closed, the last place seen is all there is.
        // Not mid-drag: reading where she is every frame of a drag makes a big board's window lag behind the pointer,
        // and nothing can close the window until it's let go of anyway.
        // Her own seat, not just any: with two games open, closing hers lets her out even though the other is there.
        const dragging = root?.classList.contains(DRAGGING_CLASS);
        const seat = root && !dragging && motion.seat ? findSeat(root, { id: motion.seat.id }) : null;
        if (seat) {
          motion.seat = seat;
          // Kept over her seat while hidden there, so a trip to another game starts from where she really is.
          if (rootRef.current) rootRef.current.style.transform = `translate3d(${seat.x}px, ${seat.y}px, 0)`;
        }
        if (!dragging && (!motion.wantsGame || !seat)) {
          setPetSeat(null);
          const last = motion.seat ?? awayTargetRef.current;
          comeOut(last.x + WIDTH / 2, last.y + HEIGHT / 2, pickDifferent(GAME_EXIT_LINES, null));
        } else if (root && !dragging) {
          // Another game focused: she goes over to it, straight from one scoreboard to the other.
          const focused = findSeat(root, { focusedOnly: true });
          if (focused && focused.id !== motion.seat?.id) {
            setPetSeat(null);
            motion.seat = focused;
            goAway("game", focused);
          }
        }
      }

      // In the bin or a game, or on her way in: that, not the floor, decides where she is.
      if (motion.mode === "away") {
        frame = requestAnimationFrame(tick);
        return;
      }

      if (pausedRef.current && motion.mode === "walk") {
        motion.mode = "idle";
        setWalking(false);
      }

      // Read every frame rather than told: dragging a window writes straight to the DOM too. If its edge drops, she
      // falls and lands back on it. If it rises, she's simply carried up, off the screen if it comes to that.
      if (motion.ledge && (motion.mode === "idle" || motion.mode === "walk")) {
        const ledge = refreshLedge(motion.ledge);
        const centerX = motion.x + WIDTH / 2;
        if (!ledge || ledge.top > motion.ledge.top || centerX < ledge.left || centerX > ledge.right) {
          motion.walkedOff = motion.mode === "walk" && ledge !== null && ledge.top <= motion.ledge.top;
          motion.walkedOffY = motion.y;
          motion.mode = "fall";
          motion.velocityY = 0;
          motion.ledge = null;
          setWalking(false);
        } else {
          motion.ledge = ledge;
        }
      }

      if (motion.mode === "idle") {
        if (!stayStill && !pausedRef.current && now >= motion.nextDecision) {
          const targetX = pickWalkTarget(motion.ledge, maxX);
          const targetCenter = targetX + WIDTH / 2;
          // An icon is too narrow to ever be a proper walk away from its end.
          const walksOff = motion.ledge && (targetCenter < motion.ledge.left || targetCenter > motion.ledge.right);
          if (walksOff || Math.abs(targetX - motion.x) >= MIN_WALK_DISTANCE) {
            motion.mode = "walk";
            motion.targetX = targetX;
            setFacingRight(targetX > motion.x);
            setWalking(true);
          } else {
            motion.nextDecision = now + restDuration();
          }
        }
      } else if (motion.mode === "walk") {
        // The screen may have shrunk since she set off, which would leave the target out of reach.
        const targetX = Math.min(motion.targetX, maxX);
        const remaining = targetX - motion.x;
        const step = WALK_SPEED * seconds;
        if (Math.abs(remaining) <= step) {
          motion.x = targetX;
          motion.mode = "idle";
          motion.nextDecision = now + restDuration();
          setWalking(false);
        } else {
          motion.x += Math.sign(remaining) * step;
        }
      } else if (motion.mode === "fall") {
        const previousFeet = motion.y + HEIGHT;
        motion.velocityY += GRAVITY * seconds;
        motion.y += motion.velocityY * seconds;

        const ledge =
          root && !isPhoneRef.current
            ? findLedge(
                root,
                motion.x + WIDTH / 2,
                previousFeet,
                Math.min(motion.y + HEIGHT, viewport.height),
                motion.ledgeTops,
              )
            : null;
        const floor = ledge ? ledge.top - HEIGHT : ground;

        if (motion.y >= floor) {
          motion.y = floor;
          if (motion.velocityY >= MIN_BOUNCE_SPEED) playLandSfx(motion.velocityY);
          // Always upward: a rising window can catch her on the way up too.
          motion.velocityY = -Math.abs(motion.velocityY) * BOUNCE;
          if (Math.abs(motion.velocityY) < MIN_BOUNCE_SPEED) {
            motion.mode = "idle";
            motion.velocityY = 0;
            motion.nextDecision = now + restDuration();
            motion.ledge = ledge;
            if (motion.walkedOff) {
              motion.walkedOff = false;
              if (motion.y - motion.walkedOffY >= WALK_OFF_LINE_MIN_DROP) setWalkOffLandings((count) => count + 1);
            }
            if (motion.exitLine !== null) setExitLandings((count) => count + 1);
          }
        }
      }

      if (motion.mode !== "fall") motion.ledgeTops.clear();

      // Also what keeps her on screen when the browser window gets smaller.
      if (motion.mode !== "drag") {
        motion.x = Math.min(motion.x, maxX);
        if (motion.mode !== "fall") motion.y = motion.ledge ? motion.ledge.top - HEIGHT : ground;
      }
      if (rootRef.current) rootRef.current.style.transform = `translate3d(${motion.x}px, ${motion.y}px, 0)`;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [goAway, comeOut]);

  useEffect(() => {
    isSpeakingRef.current = line !== null;
    if (line === null) return;
    const end = window.setTimeout(() => setLine(null), TALK_MS);
    return () => window.clearTimeout(end);
  }, [line]);

  const speak = useCallback((text: string) => {
    const motion = motionRef.current;
    // Only a walk stops for talking: she can talk on the way down or while carried, and stay in the air.
    if (motion.mode === "walk") motion.mode = "idle";
    motion.nextDecision = performance.now() + TALK_MS + restDuration();
    playTalkSfx();
    setWalking(false);
    // Toward whichever side of the screen has more room.
    setBalloonOnRight(motion.x + WIDTH / 2 < window.innerWidth / 2);
    setBalloonDrop(Math.max(0, BALLOON_ROOM - motion.y));
    setLine(text);
  }, []);

  /**
   * Unprompted remarks never interrupt: not while she's in the air, and not over something she's already saying.
   * Nor does she talk from behind a phone's full-screen window. Returns whether she actually said it.
   */
  const remark = useCallback(
    (text: string) => {
      const { mode } = motionRef.current;
      if (mode === "drag" || mode === "fall" || mode === "away" || isSpeakingRef.current || pausedRef.current) {
        return false;
      }
      speak(text);
      return true;
    },
    [speak],
  );

  /**
   * Only counts as said once she has said it, so a missed reaction gets another chance next time. There's no queue
   * on purpose: opening several windows at once gets a remark about the latest, not twelve seconds about all of them.
   */
  const reactOnce = useCallback(
    (key: string, text: string) => {
      if (spokenRef.current.has(key)) return;
      window.clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = window.setTimeout(() => {
        if (remark(text)) spokenRef.current.add(key);
      }, REACTION_DELAY_MS);
    },
    [remark],
  );

  useEffect(() => () => window.clearTimeout(reactionTimerRef.current), []);

  useEffect(() => {
    if (walkOffLandings === 0 || Math.random() >= WALK_OFF_LINE_CHANCE) return;
    const timer = window.setTimeout(() => {
      const next = pickDifferent(WALK_OFF_LINES, lastWalkOffLineRef.current);
      lastWalkOffLineRef.current = next;
      remark(next);
    }, WALK_OFF_LINE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [walkOffLandings, remark]);

  useEffect(() => {
    focusedIdRef.current = focusedId;
  }, [focusedId]);

  // The flight needs its class on before she's moved, or there'd be nothing to animate.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (awayStage !== "entering" || !root) return;
    const { x, y, scale } = awayTargetRef.current;
    root.style.setProperty("--pet-away-scale", String(scale));
    root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    const timer = window.setTimeout(() => {
      setStage("in");
      if (motionRef.current.away === "game") {
        setPetSeat(motionRef.current.seat?.id ?? null);
        return;
      }
      putPetInBin();
      binTimerRef.current = window.setTimeout(() => takePetOutOfBin("crawled"), BIN_TIMEOUT_MS);
    }, BIN_ENTER_MS);
    return () => window.clearTimeout(timer);
  }, [awayStage, setStage]);

  useEffect(
    () =>
      handlePetBinExit((how) => {
        window.clearTimeout(binTimerRef.current);
        const viewport = readViewport();
        const root = rootRef.current?.closest(".kara-os");
        const box = root?.querySelector('.kara-icon[data-app-id="recycleBin"]')?.getBoundingClientRect();
        // Out of the bin's middle, wherever it is now. Without one, up from the floor.
        const centerX = box ? box.left + box.width / 2 : viewport.width / 2;
        const centerY = box ? box.top + box.height / 2 : viewport.height - HEIGHT / 2;
        comeOut(centerX, centerY, pickDifferent(BIN_EXIT_LINES[how], null));
      }),
    [comeOut],
  );

  // Leaving the skin from inside a game shouldn't leave her stuck in there next time.
  useEffect(() => () => setPetSeat(null), []);

  useEffect(() => () => window.clearTimeout(binTimerRef.current), []);

  useEffect(() => {
    if (exitLandings === 0) return;
    const motion = motionRef.current;
    const text = motion.exitLine;
    motion.exitLine = null;
    if (!text) return;
    const timer = window.setTimeout(() => remark(text), BIN_EXIT_LINE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [exitLandings, remark]);

  const gameOpen = windows.some((win) => GAME_APPS.includes(win.appId) && !win.minimized);

  useEffect(() => {
    motionRef.current.wantsGame = gameOpen;
  }, [gameOpen]);

  // On a phone every window fills the screen, so she's out of sight behind it: nowhere to walk, nobody to hear her.
  const hiddenByWindow = isPhone && windows.some((win) => !win.minimized);

  useEffect(() => {
    pausedRef.current = hiddenByWindow;
  }, [hiddenByWindow]);

  useEffect(() => {
    isPhoneRef.current = isPhone;
  }, [isPhone]);

  useEffect(() => {
    const seen = seenWindowsRef.current;
    for (const win of windows) {
      if (seen.has(win.id)) continue;
      seen.add(win.id);
      const reaction = OPEN_REACTIONS[win.appId];
      if (reaction && !win.instanceKey && !isPhone) reactOnce(win.appId, reaction);
    }
  }, [windows, isPhone, reactOnce]);

  useEffect(() => {
    if (shuttingDown) reactOnce("shutdown", SHUTDOWN_REACTION);
  }, [shuttingDown, reactOnce]);

  useEffect(() => {
    let said = false;
    const timer = window.setInterval(() => {
      // Keeps trying for the whole minute, in case she was busy when it started.
      if (!isFourTwenty(new Date())) said = false;
      else if (!said) said = remark(FOUR_TWENTY_LINE);
    }, CLOCK_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [remark]);

  const talk = () => {
    const next = pickDifferent(LINES, lastLineRef.current);
    lastLineRef.current = next;
    speak(next);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    os.blurWindows();
    if (event.button !== 0) return;

    const motion = motionRef.current;
    if (motion.mode === "away") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - motion.x,
      offsetY: event.clientY - motion.y,
      moved: false,
      wasFalling: motion.mode === "fall",
      bin: null,
      overBin: false,
    };
    motion.mode = "drag";
    motion.velocityY = 0;
    setWalking(false);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const motion = motionRef.current;
    const x = event.clientX - drag.offsetX;
    const y = event.clientY - drag.offsetY;

    if (!drag.moved) {
      if (Math.hypot(x - motion.x, y - motion.y) < DRAG_THRESHOLD) return;
      drag.moved = true;
      motion.ledge = null;
      motion.walkedOff = false;
      // Caught on the way out of the bin: she's too busy being carried to remark on it.
      motion.exitLine = null;
      const root = event.currentTarget.closest(".kara-os");
      const bin = root && findVisibleBin(root, event.currentTarget);
      if (bin) {
        const { left, top, right, bottom } = bin.getBoundingClientRect();
        drag.bin = { element: bin, box: { left, top, right, bottom } };
      }
      playGrabSfx();
      setDragging(true);
      setFrontOf(null);
      // Over a video, an iframe would otherwise swallow the pointer.
      event.currentTarget.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
    }

    const viewport = readViewport();
    const nextX = clamp(x, 0, viewport.width - WIDTH);
    // A small dead zone, so a shaky hand holding her still doesn't make her flip back and forth.
    if (Math.abs(nextX - motion.x) >= FACING_DEAD_ZONE) setFacingRight(nextX > motion.x);
    motion.x = nextX;
    // Partly off the top is fine: it's how she reaches a window near the top of the screen.
    motion.y = clamp(y, -HEIGHT / 2, viewport.height - HEIGHT);

    if (drag.bin) {
      const { box, element } = drag.bin;
      // Any part of her over any part of the icon: aiming a cat shouldn't take skill.
      const overBin =
        motion.x < box.right && motion.x + WIDTH > box.left && motion.y < box.bottom && motion.y + HEIGHT > box.top;
      if (overBin !== drag.overBin) {
        drag.overBin = overBin;
        element.toggleAttribute("data-drop-target", overBin);
      }
    }
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    const motion = motionRef.current;
    drag.bin?.element.removeAttribute("data-drop-target");
    if (drag.moved && drag.bin && drag.overBin) {
      const { box } = drag.bin;
      setDragging(false);
      goAway("bin", {
        x: (box.left + box.right) / 2 - WIDTH / 2,
        y: (box.top + box.bottom) / 2 - HEIGHT / 2,
        scale: BIN_SCALE,
      });
      event.currentTarget.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    } else if (drag.moved) {
      const feet = motion.y + HEIGHT;
      const root = event.currentTarget.closest(".kara-os");
      const ledge =
        root && !isPhoneRef.current ? findLedge(root, motion.x + WIDTH / 2, feet - LEDGE_SNAP, feet) : null;
      if (ledge) motion.y = ledge.top - HEIGHT;
      motion.mode = "fall";
      setDragging(false);
      event.currentTarget.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    } else {
      // Clicked in mid-air: she says something and keeps falling, rather than appearing on the ground.
      motion.mode = drag.wasFalling ? "fall" : "idle";
      if (event.type === "pointerup") talk();
    }
  };

  const classNames = ["kara-pet"];
  if (walking) classNames.push("kara-pet--walking");
  if (inFront) classNames.push("kara-pet--in-front");
  if (dragging) classNames.push("kara-pet--dragging");
  if (facingRight) classNames.push("kara-pet--facing-right");
  if (awayStage === "entering" || awayStage === "in") classNames.push("kara-pet--going-away");
  if (awayStage === "in") classNames.push("kara-pet--away");
  if (awayStage === "leaving") classNames.push("kara-pet--coming-back");

  return (
    <button
      ref={rootRef}
      type="button"
      className={classNames.join(" ")}
      style={{ width: WIDTH, height: HEIGHT }}
      aria-label="Kara"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onAnimationEnd={(event) => {
        // The sprite's walking and dangling bubble up here too.
        if (event.animationName === "kara-pet-pop") setStage("out");
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        talk();
      }}
    >
      <span className="kara-pet__sprite">
        {/* Both stay loaded, so the first word never waits for a download. */}
        <img src={muteSprite} alt="" draggable={false} hidden={line !== null} />
        <img src={talkSprite} alt="" draggable={false} hidden={line === null} />
      </span>
      {line && (
        <span
          className={`kara-balloon kara-pet__balloon${balloonOnRight ? " kara-balloon--right" : ""}`}
          style={balloonDrop > 0 ? { translate: `0 ${balloonDrop}px` } : undefined}
          role="status"
        >
          <span className="kara-balloon__text">{line}</span>
        </span>
      )}
    </button>
  );
}

export default DesktopPet;
