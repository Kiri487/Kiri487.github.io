import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../shared/motion";
import { loadXnenWorld } from "./load";
import "./doorGlitch.css";

/*
 * Kara's desktop breaking up on the way through the door: the whole screen jumps and smears while torn rows of snow
 * spread over it, until it's all snow, which is where the backrooms' own picture starts. It also waits for the
 * backrooms to finish loading, so there's never an empty moment between the two. Meanwhile the desktop underneath
 * takes no keys or clicks; Escape gives up and goes back, as does waiting too long on a slow connection.
 */

/** Seconds of breaking up. */
const GLITCH_TIME = 1;
/** Still loading after this many seconds: give up and go back to the desktop. */
const LOAD_LIMIT = 12;
/** The snow is drawn this small and stretched, like the tape's picture. */
const W = 160;
const H = 90;

interface DoorGlitchProps {
  /** The backrooms are loaded and the snow has run its course. */
  onDone: () => void;
  /** Escape, or loading took too long or failed: back to the desktop. */
  onGiveUp: () => void;
}

function DoorGlitch({ onDone, onGiveUp }: DoorGlitchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  const giveUpRef = useRef(onGiveUp);

  useEffect(() => {
    doneRef.current = onDone;
    giveUpRef.current = onGiveUp;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const os = canvas?.closest(".kara-os");
    if (!canvas || !ctx) return;
    const calm = prefersReducedMotion();
    let loaded = false;
    /** Done, given up, or gone: nothing more happens. */
    let finished = false;
    let raf = 0;
    const finish = () => {
      if (finished || !loaded) return;
      finished = true;
      doneRef.current();
    };
    const giveUp = () => {
      if (finished) return;
      finished = true;
      giveUpRef.current();
    };
    loadXnenWorld().then(
      () => {
        loaded = true;
        if (calm) finish();
      },
      giveUp,
    );
    const tooLong = window.setTimeout(giveUp, LOAD_LIMIT * 1000);

    // The desktop underneath sleeps: no focus, no clicks, no keys but Escape, which goes back.
    const asleep: HTMLElement[] = [];
    for (const sibling of Array.from(canvas.parentElement?.children ?? [])) {
      if (sibling !== canvas && sibling instanceof HTMLElement && !sibling.inert) {
        sibling.inert = true;
        asleep.push(sibling);
      }
    }
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.key === "Escape") giveUp();
    };
    window.addEventListener("keydown", onKey, true);
    const wake = () => {
      finished = true;
      window.clearTimeout(tooLong);
      window.removeEventListener("keydown", onKey, true);
      for (const sibling of asleep) sibling.inert = false;
    };
    if (calm) return wake;

    os?.classList.add("kara-os--glitching");
    const image = ctx.createImageData(W, H);
    const d = image.data;
    const start = performance.now();
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / 1000 / GLITCH_TIME);
      // More and more rows torn into snow, and more solid, until the last stretch is snow from edge to edge.
      const rowChance = t > 0.8 ? 1 : 0.08 + t * 0.7;
      const alpha = t > 0.8 ? 255 : 90 + t * 165;
      for (let y = 0; y < H; y++) {
        const torn = Math.random() < rowChance;
        for (let x = 0, o = y * W * 4; x < W; x++, o += 4) {
          const s = Math.random() * 255;
          d[o] = s;
          d[o + 1] = s;
          d[o + 2] = s;
          d[o + 3] = torn ? alpha : 0;
        }
      }
      ctx.putImageData(image, 0, 0);
      if (t < 1) raf = requestAnimationFrame(draw);
      else if (loaded) finish();
      else raf = requestAnimationFrame(draw);
      // Past the end and still loading: keep the snow going rather than stop on a frame.
    };
    raf = requestAnimationFrame(draw);
    return () => {
      wake();
      cancelAnimationFrame(raf);
      os?.classList.remove("kara-os--glitching");
    };
  }, []);

  return <canvas ref={canvasRef} className="kara-door-glitch" width={W} height={H} aria-hidden="true" />;
}

export default DoorGlitch;
