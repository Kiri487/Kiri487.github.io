import { readBoolean, writeBoolean } from "../../../shared/storage";

/* Kere's chat sound effects: two short synthesized tones, no audio files.
   On by default; visitors toggle them by telling Kere ("mute" / "unmute"). */

/** Kere's own key — never Kiri/Kuru's `bgmEnabled`, or turning on music there would unmute Kere. */
const STORAGE_KEY = "kereSfxEnabled";

/** Fixed level, no volume control. The tones stay quiet by design. */
const VOLUME = 0.08;

export function loadSfxEnabled(): boolean {
  return readBoolean(STORAGE_KEY, true);
}

export function saveSfxEnabled(enabled: boolean) {
  writeBoolean(STORAGE_KEY, enabled);
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a click or submit, so later sounds (played after a timeout) aren't blocked by the browser. */
export function unlockSfx() {
  getCtx();
}

/** One sine blip: quick attack, exponential decay. */
function tone(c: AudioContext, frequency: number, start: number, duration: number, peak: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(c.destination);
  osc.onended = () => {
    gain.disconnect();
    osc.disconnect();
  };
  osc.start(start);
  osc.stop(start + duration + 0.01);
}

/** Chat opened: two rising notes, like an old terminal acknowledging you. ~80ms. */
export function playOpenSfx() {
  const c = getCtx();
  const t = c.currentTime;
  tone(c, 660, t, 0.035, VOLUME);
  tone(c, 990, t + 0.04, 0.04, VOLUME);
}

/** Reply finished: one soft tick, quieter than the open sound. ~40ms. */
export function playReplySfx() {
  const c = getCtx();
  tone(c, 880, c.currentTime, 0.04, VOLUME * 0.6);
}
