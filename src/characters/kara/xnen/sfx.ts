import { getAudioContext } from "../../../shared/audio";
import { VOICE } from "../os/petSfx";
import { noise, slide, VOLUME, whenAudible } from "../os/sfx";

/* XN's sounds. All placeholders, synthesized like the rest of the desktop's, for Kiri to replace. */

export interface Hum {
  /** 0 silent, 1 full. */
  setLevel: (level: number) => void;
  stop: () => void;
}

/** The fluorescent hum: mains buzz, its overtone and a thin hiss. Starts silent; set its level to hear it. */
export function startHum(): Hum {
  const c = getAudioContext();
  const master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);

  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 420;
  lowpass.connect(master);
  const buzzGain = c.createGain();
  buzzGain.gain.value = 0.05;
  buzzGain.connect(lowpass);
  const buzz = c.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.value = 60;
  buzz.connect(buzzGain);

  const toneGain = c.createGain();
  toneGain.gain.value = 0.03;
  toneGain.connect(master);
  const tone = c.createOscillator();
  tone.type = "sine";
  tone.frequency.value = 120.4;
  tone.connect(toneGain);

  const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const hiss = c.createBufferSource();
  hiss.buffer = buffer;
  hiss.loop = true;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 0.6;
  const hissGain = c.createGain();
  hissGain.gain.value = 0.012;
  hiss.connect(band).connect(hissGain).connect(master);

  buzz.start();
  tone.start();
  hiss.start();

  return {
    setLevel(level) {
      master.gain.setTargetAtTime(level * 0.5, c.currentTime, 0.05);
    },
    stop() {
      for (const node of [buzz, tone, hiss]) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
        node.disconnect();
      }
      for (const node of [master, lowpass, buzzGain, toneGain, band, hissGain]) node.disconnect();
    },
  };
}

/** A soft footfall on wet carpet. */
export function playStepSfx() {
  whenAudible((c) => noise(c, 600 + Math.random() * 200, c.currentTime, 0.07, VOLUME * 0.15));
}

/**
 * ◄◄ REW: the button clunking down, then the motor and the tape running backwards, a fluttering hiss over a low
 * whir, speeding up a little towards the end. `seconds` is how long the picture rewinds.
 */
export function playRewindSfx(seconds: number) {
  whenAudible((c) => {
    const t = c.currentTime;
    noise(c, 1400, t, 0.04, VOLUME * 0.9);
    slide(c, "square", 140, 110, t, 0.05, VOLUME * 0.4);

    const start = t + 0.05;
    const end = start + seconds;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, start);
    out.gain.linearRampToValueAtTime(1, start + 0.08);
    out.gain.setValueAtTime(1, end - 0.12);
    out.gain.linearRampToValueAtTime(0.0001, end);
    out.connect(c.destination);

    const motor = c.createOscillator();
    motor.type = "triangle";
    motor.frequency.setValueAtTime(70, start);
    motor.frequency.linearRampToValueAtTime(95, end);
    const motorGain = c.createGain();
    motorGain.gain.value = VOLUME * 0.5;
    motor.connect(motorGain).connect(out);

    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * (seconds + 0.1)), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const hiss = c.createBufferSource();
    hiss.buffer = buffer;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.setValueAtTime(1800, start);
    band.frequency.linearRampToValueAtTime(2600, end);
    band.Q.value = 0.8;
    // The flutter: the hiss's level wobbling fast, a little faster as it speeds up.
    const tape = c.createGain();
    tape.gain.value = VOLUME * 0.35;
    const flutter = c.createOscillator();
    flutter.frequency.setValueAtTime(18, start);
    flutter.frequency.linearRampToValueAtTime(30, end);
    const depth = c.createGain();
    depth.gain.value = VOLUME * 0.25;
    flutter.connect(depth).connect(tape.gain);
    hiss.connect(band).connect(tape).connect(out);

    for (const node of [motor, flutter, hiss]) {
      node.start(start);
      node.stop(end + 0.02);
    }
    hiss.onended = () => {
      for (const node of [motor, flutter, hiss, motorGain, band, tape, depth, out]) node.disconnect();
    };
  });
}

/** ■ STOP: the mechanism clunking to a halt. Losing the signal sounds the same. */
export function playStopSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    slide(c, "sine", 170, 50, t, 0.16, VOLUME * 1.6);
    noise(c, 1100, t, 0.12, VOLUME * 0.8);
  });
}

/** ‖ PAUSE: a small click. */
export function playPauseSfx() {
  whenAudible((c) => noise(c, 2400, c.currentTime, 0.035, VOLUME * 0.6));
}

/** Her syllables last this many times Kara's, long enough to hear each one swell and stop: Kara's are too short. */
const XN_STRETCH = 2;
/** A second voice this far above each syllable grinds against it, as XR's does. */
const SEMITONE = 2 ** (1 / 12);
/** Each swell ends in a cut this short: abrupt, but not a click. */
const CUT = 0.006;

/** One of her syllables: Kara's backwards, sliding up and swelling from nothing, then cut. */
function backwardsSyllable(c: AudioContext, pitch: number, start: number, length: number, peak: number) {
  const end = start + length;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(pitch * VOICE.fall, start);
  osc.frequency.exponentialRampToValueAtTime(pitch, end);
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

/**
 * XN talking: Kara's voice backwards, the way XR's is Kere's: each syllable slides up instead of down and swells
 * instead of fading, then stops dead, with a second voice a semitone above grinding against it. Her syllables are
 * longer than Kara's, or none of that could be heard.
 */
export function playXnTalkSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    const length = VOICE.length * XN_STRETCH;
    const spacing = VOICE.spacing * XN_STRETCH;
    for (let i = 0; i < VOICE.syllables; i++) {
      const pitch = VOICE.lowest + Math.random() * VOICE.spread;
      const start = t + i * spacing;
      backwardsSyllable(c, pitch, start, length, VOICE.loudness);
      backwardsSyllable(c, pitch * SEMITONE, start, length, VOICE.loudness * 0.7);
    }
  });
}
