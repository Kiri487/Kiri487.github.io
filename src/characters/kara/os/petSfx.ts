/* Kara's sound effects: short synthesized tones, no audio files. If the browser blocks one, it's simply not heard. */

/** Fixed level, no volume control, well under the radio. */
const VOLUME = 0.1;
/** A fall this fast lands at full volume. */
const LOUDEST_LANDING_SPEED = 1400;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One note sliding between two pitches: quick attack, exponential decay. */
function slide(
  c: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
  peak: number,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.onended = () => {
    gain.disconnect();
    osc.disconnect();
  };
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

/** Picked up: a squeak that goes up in surprise. ~110ms. */
export function playGrabSfx() {
  const c = getCtx();
  slide(c, "triangle", 520, 1250, c.currentTime, 0.11, VOLUME);
}

/** Hit the ground: a soft thud, quieter with each bounce. ~130ms. */
export function playLandSfx(speed: number) {
  const c = getCtx();
  const loudness = Math.min(speed / LOUDEST_LANDING_SPEED, 1);
  slide(c, "sine", 170, 52, c.currentTime, 0.13, VOLUME * 1.8 * loudness);
}

/** Talking: three syllables in no particular language, different every time. ~190ms. */
export function playTalkSfx() {
  const c = getCtx();
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const pitch = 330 + Math.random() * 300;
    slide(c, "square", pitch, pitch * 0.85, t + i * 0.065, 0.055, VOLUME * 0.35);
  }
}
