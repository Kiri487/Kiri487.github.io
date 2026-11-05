/* Danger Noodle's sounds. Placeholders built from the shared tones in os/sfx.ts: each event is one function, so
   any of them can be redesigned here without touching the game. */

import { slide, VOLUME, whenAudible } from "../../os/sfx";

/** A burger gone in one: a quick pop up. ~70ms. */
export function playEatSfx() {
  whenAudible((c) => slide(c, "sine", 500, 1100, c.currentTime, 0.07, VOLUME));
}

/** Into a wall or itself: one long slide down. ~350ms. */
export function playCrashSfx() {
  whenAudible((c) => slide(c, "triangle", 420, 70, c.currentTime, 0.35, VOLUME * 1.4));
}

/** More burgers than anyone before: four notes going up. ~450ms. */
export function playRecordSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((pitch, i) => {
      slide(c, "triangle", pitch, pitch, t + i * 0.09, i === 3 ? 0.18 : 0.1, VOLUME * 0.8);
    });
  });
}
