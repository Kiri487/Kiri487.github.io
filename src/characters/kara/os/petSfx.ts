/* Kara's own sounds. The audio plumbing is shared with the rest of the desktop, in sfx.ts. */

import { slide, VOLUME, whenAudible } from "./sfx";

/** A fall this fast lands at full volume. */
const LOUDEST_LANDING_SPEED = 1400;

/** Picked up: a squeak that goes up in surprise. ~110ms. */
export function playGrabSfx() {
  whenAudible((c) => slide(c, "triangle", 520, 1250, c.currentTime, 0.11, VOLUME));
}

/** Hit the ground: a soft thud, quieter with each bounce. ~130ms. */
export function playLandSfx(speed: number) {
  const loudness = Math.min(speed / LOUDEST_LANDING_SPEED, 1);
  whenAudible((c) => slide(c, "sine", 170, 52, c.currentTime, 0.13, VOLUME * 1.8 * loudness));
}

/**
 * Kara's voice: syllables of a square wave, each a random pitch sliding down. XN talks with the same voice played
 * backwards (xnen/sfx.ts), so tuning it here changes hers too.
 */
export const VOICE = {
  syllables: 3,
  /** Seconds from one syllable to the next, and how long each lasts. */
  spacing: 0.065,
  length: 0.055,
  /** Each syllable's starting pitch in Hz: lowest, and how much higher it can be. */
  lowest: 330,
  spread: 300,
  /** Where each one's pitch ends, as a share of where it starts. */
  fall: 0.85,
  loudness: VOLUME * 0.35,
};

/** Talking: three syllables in no particular language, different every time. ~190ms. */
export function playTalkSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    for (let i = 0; i < VOICE.syllables; i++) {
      const pitch = VOICE.lowest + Math.random() * VOICE.spread;
      slide(c, "square", pitch, pitch * VOICE.fall, t + i * VOICE.spacing, VOICE.length, VOICE.loudness);
    }
  });
}
