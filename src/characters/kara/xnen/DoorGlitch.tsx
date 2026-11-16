import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../shared/motion";
import { loadXnenWorld } from "./load";
import "./doorGlitch.css";

/*
 * Kara's desktop breaking up on the way through the door: the whole screen jumps and smears while torn rows of snow
 * spread over it, until it's all snow, which is where the backrooms' own picture starts. It also waits for the
 * backrooms to finish loading, so there's never an empty moment between the two.
 */

/** Seconds of breaking up. */
const GLITCH_TIME = 1;
/** The snow is drawn this small and stretched, like the tape's picture. */
const W = 160;
const H = 90;

function DoorGlitch({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const os = canvas?.closest(".kara-os");
    if (!canvas || !ctx) return;
    const calm = prefersReducedMotion();
    let loaded = false;
    let finished = false;
    let raf = 0;
    const finish = () => {
      if (finished || !loaded) return;
      finished = true;
      doneRef.current();
    };
    loadXnenWorld().then(
      () => {
        loaded = true;
        if (calm) finish();
      },
      () => {
        // Couldn't load: the boundary around the backrooms will send everyone back to the desktop.
        loaded = true;
        finish();
      },
    );
    if (calm) return;

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
      cancelAnimationFrame(raf);
      os?.classList.remove("kara-os--glitching");
    };
  }, []);

  return <canvas ref={canvasRef} className="kara-door-glitch" width={W} height={H} aria-hidden="true" />;
}

export default DoorGlitch;
