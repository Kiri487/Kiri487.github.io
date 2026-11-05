/* Burger Sweeper's sounds. Placeholders built from the shared tones in os/sfx.ts: each event is one function, so
   any of them can be redesigned here without touching the game. */

import { noise, slide, VOLUME, whenAudible } from "../../os/sfx";

/** One cell opened, or a whole empty area: a single short tick either way. ~40ms. */
export function playDigSfx() {
  whenAudible((c) => slide(c, "triangle", 900, 700, c.currentTime, 0.04, VOLUME * 0.6));
}

/** Opening everything around a number at once: the same tick, a little brighter. ~50ms. */
export function playChordSfx() {
  whenAudible((c) => slide(c, "triangle", 1150, 850, c.currentTime, 0.05, VOLUME * 0.6));
}

/** A flag going in pops up; coming out, it pops down. ~60ms. */
export function playFlagSfx(placed: boolean) {
  whenAudible((c) =>
    placed
      ? slide(c, "sine", 600, 1000, c.currentTime, 0.06, VOLUME)
      : slide(c, "sine", 1000, 600, c.currentTime, 0.06, VOLUME * 0.8),
  );
}

/** Stepped on a burger, which means a bite of one: a crunch and a dropping gulp. ~200ms. */
export function playBiteSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    noise(c, 1400, t, 0.08, VOLUME * 1.5);
    slide(c, "sine", 300, 90, t + 0.03, 0.18, VOLUME * 1.6);
  });
}

/** Every burger left uneaten: four notes going up. ~450ms. */
export function playWinSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((pitch, i) => {
      slide(c, "triangle", pitch, pitch, t + i * 0.09, i === 3 ? 0.18 : 0.1, VOLUME * 0.8);
    });
  });
}
