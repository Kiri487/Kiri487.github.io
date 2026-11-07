import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../shared/motion";

/* The home page background: faint white lines across the screen that shiver, and shiver more when the music gets
   loud. A plain canvas, so the home page doesn't need a drawing library for it. When the visitor has asked for
   less motion, the lines are drawn once and stay still. */

const BACKGROUND = "rgb(157, 162, 178)";
const LINE_COLOR = "rgba(255, 255, 255, 0.39)";
const LINE_WIDTH = 2;
const LINE_GAP = 70;
const POINT_GAP = 10;
/** How far a line may bend: quiet, and at full volume. */
const MIN_AMP = 10;
const MAX_AMP = 100;
/** Average loudness (0–255) that already counts as full volume. */
const LOUD = 150;
/** How quickly the bend follows the music, per 60th of a second. */
const FOLLOW = 0.3;
/** How far the noise drifts each 60th of a second, which keeps the lines moving on their own. */
const DRIFT = 0.01;
/** How much the pointer moving across the screen shifts the lines. */
const POINTER_SHIFT = 0.001;
/**
 * The motion was tuned at 60 frames a second. Each frame moves by however much time has passed instead, so the lines
 * keep the same speed on any screen.
 */
const FRAME_MS = 1000 / 60;
/** After a long pause, such as a hidden tab, carry on instead of jumping ahead. */
const MAX_STEPS = 4;

/**
 * Smooth random values along a line, 0 to just under 1. Four layers, each twice as fine and half as strong, give
 * the wobble some grain. Neighbouring whole numbers are unrelated, so points a whole step apart move on their own.
 */
function createNoise() {
  const SIZE = 4096;
  const values = Float32Array.from({ length: SIZE }, () => Math.random());
  const at = (i: number) => values[((i % SIZE) + SIZE) % SIZE];
  const ease = (t: number) => 0.5 * (1 - Math.cos(t * Math.PI));

  return (x: number) => {
    let total = 0;
    let strength = 0.5;
    let scale = 1;
    for (let layer = 0; layer < 4; layer++) {
      const position = x * scale;
      const i = Math.floor(position);
      const a = at(i);
      total += strength * (a + (at(i + 1) - a) * ease(position - i));
      strength /= 2;
      scale *= 2;
    }
    return total;
  };
}

function WaveCanvas({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef(analyser);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = prefersReducedMotion();
    const noise = createNoise();
    const levels = new Uint8Array(128);
    let width = 0;
    let height = 0;
    let pointerX = 0;
    let amp = MIN_AMP;
    let drift = 0;
    let lastFrame: number | null = null;
    let frame = 0;

    // Drawn at the screen's own pixel density, so the lines stay sharp.
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const trackPointer = (event: PointerEvent) => {
      pointerX = event.clientX;
    };

    const draw = (now: number) => {
      if (!still) frame = requestAnimationFrame(draw);
      const steps = lastFrame === null ? 1 : Math.min((now - lastFrame) / FRAME_MS, MAX_STEPS);
      lastFrame = now;

      let target = MIN_AMP;
      const source = analyserRef.current;
      if (source && !still) {
        source.getByteFrequencyData(levels);
        let sum = 0;
        for (const level of levels) sum += level;
        const loudness = Math.min(sum / levels.length / LOUD, 1);
        target = MIN_AMP + loudness * (MAX_AMP - MIN_AMP);
      }
      amp += (target - amp) * (1 - (1 - FOLLOW) ** steps);

      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "miter";

      const shift = pointerX * POINTER_SHIFT + drift;
      for (let y = 0; y < height; y += LINE_GAP) {
        ctx.beginPath();
        for (let x = 0; x < width + POINT_GAP; x += POINT_GAP) {
          const pointY = y + amp * noise(x + shift + y);
          if (x === 0) ctx.moveTo(x, pointY);
          else ctx.lineTo(x, pointY);
        }
        ctx.stroke();
      }

      drift += DRIFT * steps;
    };

    // Still lines are only redrawn when the screen changes size.
    const redraw = () => {
      resize();
      if (still) draw(performance.now());
    };

    resize();
    window.addEventListener("resize", redraw);
    window.addEventListener("pointermove", trackPointer);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", redraw);
      window.removeEventListener("pointermove", trackPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="wave-canvas" aria-hidden="true" />;
}

export default WaveCanvas;
