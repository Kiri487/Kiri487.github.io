import { getAudioContext } from "../../../shared/audio";

/* The desktop's sound: short synthesized tones, no audio files, all through the site's audio context. If the
   browser blocks one, it's simply not heard. */

/** Fixed level, no volume control, well under the radio. */
export const VOLUME = 0.1;
/** Roomy, since opening the audio device can take a while on some computers. */
const MAX_WAKE_UP_MS = 300;

/**
 * Plays now if the browser allows sound. A new context starts out suspended even when it's allowed, so that gets a
 * moment to wake up. Any later and the browser was blocking it: playing it then would be a sound for something
 * long over, and all the blocked ones at once.
 */
export function whenAudible(play: (c: AudioContext) => void) {
  const c = getAudioContext();
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
export function slide(
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

/** A burst of noise around one pitch, for anything that isn't a note: a crunch, a rustle. */
export function noise(c: AudioContext, center: number, start: number, duration: number, peak: number) {
  const length = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = center;
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(c.destination);
  source.onended = () => {
    gain.disconnect();
    filter.disconnect();
    source.disconnect();
  };
  source.start(start);
}
