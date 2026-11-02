import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pickDifferent } from "../apps/common/pickDifferent";
import type { AppId } from "../apps/registry";
import muteSprite from "../assets/pet/kara-mute.webp";
import talkSprite from "../assets/pet/kara-talk.webp";
import { DRAGGING_CLASS, useOs, useOsState } from "./context";
import { isFourTwenty } from "./fourTwenty";
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
const MIN_WALK_DISTANCE = 80;
const MIN_REST_MS = 2500;
const MAX_REST_MS = 7000;
const TALK_MS = 4200;
/** Long enough for a new window to appear first, as if she noticed it. */
const REACTION_DELAY_MS = 500;
const CLOCK_CHECK_MS = 1000;

const LINES = [
  "smoke weed everyday",
  "this is a very formal leaf",
  "have you seen tuesday",
  "the printer says hi",
  "i live here now",
];

/** Said the first time each one opens, once per visit. Only her own asdf.txt counts as the notepad. */
const OPEN_REACTIONS: Partial<Record<AppId, string>> = {
  radio: "the washing machine is my favorite part",
  messenger: "if kuru asks, i'm asleep",
  projects: "you can't remove them. i tried",
  about: "yes it's registered to kiri. no i won't explain",
  works: "i'm in there. probably",
  recycleBin: "don't touch greg's web",
  notepad: "that letter is very formal. be careful",
};
const SHUTDOWN_REACTION = "that's a light switch";
const FOUR_TWENTY_LINE = "it's time";

type Mode = "idle" | "walk" | "drag" | "fall";

function restDuration(): number {
  return MIN_REST_MS + Math.random() * (MAX_REST_MS - MIN_REST_MS);
}

/** Kara herself. She lives on the desktop, behind the windows, until somebody picks her up and puts her in front. */
function DesktopPet({ shuttingDown }: { shuttingDown: boolean }) {
  const os = useOs();
  const { windows, focusedId } = useOsState();
  const isPhone = useIsPhone();
  const pausedRef = useRef(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  // The position lives here and goes straight to the DOM, so walking never re-renders anything.
  const motionRef = useRef({ mode: "idle" as Mode, x: 0, y: 0, targetX: 0, velocityY: 0, nextDecision: 0 });
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
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

      if (motion.mode === "idle") {
        if (!stayStill && !pausedRef.current && now >= motion.nextDecision) {
          const targetX = Math.random() * maxX;
          if (Math.abs(targetX - motion.x) >= MIN_WALK_DISTANCE) {
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
        motion.velocityY += GRAVITY * seconds;
        motion.y += motion.velocityY * seconds;
        if (motion.y >= ground) {
          motion.y = ground;
          motion.velocityY *= -BOUNCE;
          if (Math.abs(motion.velocityY) < MIN_BOUNCE_SPEED) {
            motion.mode = "idle";
            motion.velocityY = 0;
            motion.nextDecision = now + restDuration();
          }
        }
      }

      // Also what keeps her on screen when the browser window gets smaller.
      if (motion.mode !== "drag") {
        motion.x = Math.min(motion.x, maxX);
        if (motion.mode !== "fall") motion.y = ground;
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
    motion.mode = "idle";
    motion.nextDecision = performance.now() + TALK_MS + restDuration();
    setWalking(false);
    // Toward whichever side of the screen has more room.
    setBalloonOnRight(motion.x + WIDTH / 2 < window.innerWidth / 2);
    setLine(text);
  }, []);

  /** Unprompted remarks never interrupt: not while she's in the air, and not over something she's already saying. */
  const remark = useCallback(
    (text: string) => {
      const { mode } = motionRef.current;
      if (mode === "drag" || mode === "fall" || isSpeakingRef.current) return;
      speak(text);
    },
    [speak],
  );

  const reactOnce = useCallback(
    (key: string, text: string) => {
      if (spokenRef.current.has(key)) return;
      spokenRef.current.add(key);
      window.clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = window.setTimeout(() => remark(text), REACTION_DELAY_MS);
    },
    [remark],
  );

  useEffect(() => () => window.clearTimeout(reactionTimerRef.current), []);

  // On a phone every window fills the screen, so she's out of sight behind it: nowhere to walk, nobody to hear her.
  const hiddenByWindow = isPhone && windows.some((win) => !win.minimized);

  useEffect(() => {
    pausedRef.current = hiddenByWindow;
  }, [hiddenByWindow]);

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
      setDragging(true);
      setInFront(true);
      // Over a video, an iframe would otherwise swallow the pointer.
      event.currentTarget.closest(".kara-os")?.classList.add(DRAGGING_CLASS);
    }

    const viewport = readViewport();
    motion.x = Math.min(Math.max(x, 0), Math.max(0, viewport.width - WIDTH));
    motion.y = Math.min(Math.max(y, 0), viewport.height - HEIGHT);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;

    const motion = motionRef.current;
    if (drag.moved) {
      motion.mode = "fall";
      setDragging(false);
      event.currentTarget.closest(".kara-os")?.classList.remove(DRAGGING_CLASS);
    } else {
      motion.mode = "idle";
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
        <span className={`kara-balloon kara-pet__balloon${balloonOnRight ? " kara-balloon--right" : ""}`} role="status">
          <span className="kara-balloon__text">{line}</span>
        </span>
      )}
    </button>
  );
}

export default DesktopPet;
