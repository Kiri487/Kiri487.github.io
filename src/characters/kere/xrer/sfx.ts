import { resumeAudioContext } from "../../../shared/audio";
import type { XrFace } from "./faces";

/* XR's sounds: Kere's two (see ../assistant/sfx.ts) played backwards. Same pitches, so they carry on any speaker,
   but each note swells up instead of fading out and stops dead, like a recording run in reverse; it sags in pitch
   as it goes, and a second note a semitone above grinds against it. Kere's on/off setting covers both. */

/** Same level as Kere's, and the reply tick at the same 60% of it. */
const VOLUME = 0.08;
const SEMITONE = 2 ** (1 / 12);
/** The fade-in of a reversed note ends in a cut this short: abrupt, but not a click. */
const CUT = 0.006;

/** One reversed note: silent → `peak` over `duration`, then cut. Its pitch slides to `frequency * sag` meanwhile. */
function reversed(c: AudioContext, frequency: number, start: number, duration: number, peak: number, sag: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const end = start + duration;
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(frequency * sag, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, end);
  gain.gain.linearRampToValueAtTime(0, end + CUT);
  osc.connect(gain).connect(c.destination);
  osc.onended = () => {
    gain.disconnect();
    osc.disconnect();
  };
  osc.start(start);
  osc.stop(end + CUT + 0.01);
}

/** A reversed note with a second one `off` above it, grinding. */
function grind(c: AudioContext, frequency: number, start: number, duration: number, peak: number, off: number, sag: number) {
  reversed(c, frequency, start, duration, peak, sag);
  reversed(c, frequency * off, start, duration, peak * 0.7, sag);
}

/** XR takes over: Kere's "660, 990" turned around, "990, 660", each one reversed. ~350ms. */
export function playXrOpenSfx() {
  const c = resumeAudioContext();
  const t = c.currentTime;
  grind(c, 990, t, 0.15, VOLUME, SEMITONE, 0.97);
  grind(c, 660, t + 0.17, 0.18, VOLUME, SEMITONE, 0.94);
}

/** How the reply tick goes wrong as XR does: the second note drifts further off, the pitch sags further. */
const UNEASE: Record<XrFace, { off: number; sag: number } | null> = {
  normal: { off: SEMITONE, sag: 0.98 },
  alert: { off: SEMITONE * 1.015, sag: 0.95 },
  anxious: { off: SEMITONE * 1.035, sag: 0.9 },
  // When he breaks, nothing: the silence says more.
  broken: null,
};

/** XR replies: Kere's 880 Hz tick, reversed and soured. ~110ms. */
export function playXrReplySfx(face: XrFace) {
  const unease = UNEASE[face];
  if (!unease) return;
  const c = resumeAudioContext();
  grind(c, 880, c.currentTime, 0.11, VOLUME * 0.6, unease.off, unease.sag);
}
