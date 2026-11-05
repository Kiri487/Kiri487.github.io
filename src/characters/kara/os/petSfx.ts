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
