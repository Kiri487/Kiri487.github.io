import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pickDifferent } from "../apps/common/pickDifferent";
import type { AppId } from "../apps/registry";
import muteSprite from "../assets/pet/kara-mute.webp";
import talkSprite from "../assets/pet/kara-talk.webp";
import { DRAGGING_CLASS, useOs, useOsState } from "./context";
import { isFourTwenty } from "./fourTwenty";
import { findLedge, refreshLedge, type Ledge } from "./petLedges";
import { playGrabSfx, playLandSfx, playTalkSfx } from "./petSfx";
import { useIsPhone } from "./useIsPhone";
import { readViewport } from "./windowManager";

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
const SHUTDOWN_REACTION = "that's a light switch";
const FOUR_TWENTY_LINE = "it's time";

type Mode = "idle" | "walk" | "drag" | "fall";

function restDuration(): number {
  return MIN_REST_MS + Math.random() * (MAX_REST_MS - MIN_REST_MS);
}

/** Somewhere on what she's standing on. A window's edge may also send her just past its end. */
function pickWalkTarget(ledge: Ledge | null, maxX: number): number {
  if (!ledge) return Math.random() * maxX;
  if (Math.random() < WALK_OFF_CHANCE) {
    const edge = Math.random() < 0.5 ? ledge.left - 1 : ledge.right + 1;
    return Math.min(Math.max(edge - WIDTH / 2, 0), maxX);
  }
  const room = Math.max(0, ledge.right - ledge.left - WIDTH);
  return Math.min(Math.max(ledge.left + Math.random() * room, 0), maxX);
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
  });
  const lastWalkOffLineRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    wasFalling: boolean;
  } | null>(null);
  const lastLineRef = useRef<string | null>(null);
  const isSpeakingRef = useRef(false);
  const seenWindowsRef = useRef(new Set<string>());
  const spokenRef = useRef(new Set<string>());
  const reactionTimerRef = useRef<number | undefined>(undefined);

  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Once carried she stays in front of the windows, until one of them is focused and covers her like any other window would.
  const [inFront, setInFront] = useState(false);
  if (inFront && focusedId !== null) setInFront(false);
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
        const remaining = motion.targetX - motion.x;
        const step = WALK_SPEED * seconds;
        if (Math.abs(remaining) <= step) {
          motion.x = motion.targetX;
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

        const root = rootRef.current?.closest(".kara-os");
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
  }, []);

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
   * Returns whether she actually said it.
   */
  const remark = useCallback(
    (text: string) => {
      const { mode } = motionRef.current;
      if (mode === "drag" || mode === "fall" || isSpeakingRef.current) return false;
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
    let wasFourTwenty = false;
    const timer = window.setInterval(() => {
      const now = isFourTwenty(new Date());
      if (now && !wasFourTwenty) remark(FOUR_TWENTY_LINE);
      wasFourTwenty = now;
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
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - motion.x,
      offsetY: event.clientY - motion.y,
      moved: false,
      wasFalling: motion.mode === "fall",
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
      playGrabSfx();
      setDragging(true);
      setInFront(true);
      // Over a video, an iframe would otherwise swallow the pointer.
      event.currentTarget.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
    }

    const viewport = readViewport();
    const nextX = Math.min(Math.max(x, 0), Math.max(0, viewport.width - WIDTH));
    // A small dead zone, so a shaky hand holding her still doesn't make her flip back and forth.
    if (Math.abs(nextX - motion.x) >= FACING_DEAD_ZONE) setFacingRight(nextX > motion.x);
    motion.x = nextX;
    // Partly off the top is fine: it's how she reaches a window near the top of the screen.
    motion.y = Math.min(Math.max(y, -HEIGHT / 2), viewport.height - HEIGHT);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    const motion = motionRef.current;
    if (drag.moved) {
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
