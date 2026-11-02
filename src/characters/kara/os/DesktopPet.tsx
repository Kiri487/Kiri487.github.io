import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pickDifferent } from "../apps/common/pickDifferent";
import muteSprite from "../assets/pet/kara-mute.webp";
import talkSprite from "../assets/pet/kara-talk.webp";
import { DRAGGING_CLASS, useOs, useOsState } from "./context";
import { readViewport } from "./windowManager";

/** Half the sprite files' size, so they stay sharp on high-density screens. */
const WIDTH = 126;
const HEIGHT = 130;
/** Wide enough for the balloon: closer to the left edge than this, it opens to the right instead. */
const BALLOON_WIDTH = 240;

const WALK_SPEED = 55;
const GRAVITY = 2400;
const BOUNCE = 0.35;
const MIN_BOUNCE_SPEED = 180;
const DRAG_THRESHOLD = 4;
const MIN_WALK_DISTANCE = 80;
const MIN_REST_MS = 2500;
const MAX_REST_MS = 7000;
const TALK_MS = 4200;

const LINES = [
  "smoke weed everyday",
  "this is a very formal leaf",
  "have you seen tuesday",
  "the printer says hi",
  "i live here now",
];

type Mode = "idle" | "walk" | "drag" | "fall";

function restDuration(): number {
  return MIN_REST_MS + Math.random() * (MAX_REST_MS - MIN_REST_MS);
}

/** Kara herself. She lives on the desktop, behind the windows, until somebody picks her up and puts her in front. */
function DesktopPet() {
  const os = useOs();
  const rootRef = useRef<HTMLButtonElement>(null);
  // The position lives here and goes straight to the DOM, so walking never re-renders anything.
  const motionRef = useRef({ mode: "idle" as Mode, x: 0, y: 0, targetX: 0, velocityY: 0, nextDecision: 0 });
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const lastLineRef = useRef<string | null>(null);

  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Once carried she stays in front of the windows, until one of them is focused and covers her like any other window would.
  const [inFront, setInFront] = useState(false);
  const { focusedId } = useOsState();
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

      if (motion.mode === "idle") {
        if (!stayStill && now >= motion.nextDecision) {
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
    if (line === null) return;
    const end = window.setTimeout(() => setLine(null), TALK_MS);
    return () => window.clearTimeout(end);
  }, [line]);

  const talk = () => {
    const motion = motionRef.current;
    motion.mode = "idle";
    motion.nextDecision = performance.now() + TALK_MS + restDuration();
    setWalking(false);
    setBalloonOnRight(motion.x < BALLOON_WIDTH);

    const next = pickDifferent(LINES, lastLineRef.current);
    lastLineRef.current = next;
    setLine(next);
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
