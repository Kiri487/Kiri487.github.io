/* Kara's sound effects: short synthesized tones, no audio files. If the browser blocks one, it's simply not heard. */

/** Fixed level, no volume control, well under the radio. */
const VOLUME = 0.1;
/** A fall this fast lands at full volume. */
const LOUDEST_LANDING_SPEED = 1400;
/** Roomy, since opening the audio device can take a while on some computers. */
const MAX_WAKE_UP_MS = 300;

let ctx: AudioContext | null = null;

/**
 * Plays now if the browser allows sound. A new context starts out suspended even when it's allowed, so that gets a
 * moment to wake up. Any later and the browser was blocking it: playing it then would be a sound for something
 * long over, and all the blocked ones at once.
 */
function whenAudible(play: (c: AudioContext) => void) {
  ctx ??= new AudioContext();
  const c = ctx;
  if (c.state === "running") {
    play(c);
    return;
  }
  const asked = performance.now();
  void c.resume().then(
    () => {
      if (performance.now() - asked <= MAX_WAKE_UP_MS) play(c);
    },
    () => {},
  );
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
  whenAudible((c) => slide(c, "triangle", 520, 1250, c.currentTime, 0.11, VOLUME));
}

/** Hit the ground: a soft thud, quieter with each bounce. ~130ms. */
export function playLandSfx(speed: number) {
  const loudness = Math.min(speed / LOUDEST_LANDING_SPEED, 1);
  whenAudible((c) => slide(c, "sine", 170, 52, c.currentTime, 0.13, VOLUME * 1.8 * loudness));
}

/** Talking: three syllables in no particular language, different every time. ~190ms. */
export function playTalkSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const pitch = 330 + Math.random() * 300;
      slide(c, "square", pitch, pitch * 0.85, t + i * 0.065, 0.055, VOLUME * 0.35);
    }
  });
}
