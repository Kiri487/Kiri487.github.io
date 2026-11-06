/* Pin Bun's sounds. Placeholders built from the shared tones in os/sfx.ts: each event is one function, so any of
   them can be redesigned here without touching the game. */

import { noise, slide, VOLUME, whenAudible } from "../../os/sfx";

/** A flipper going up: a short plastic clack. ~40ms. */
export function playFlipperSfx() {
  whenAudible((c) => noise(c, 1800, c.currentTime, 0.04, VOLUME * 1.2));
}

/** A burger bumper: a bright pop. ~90ms. */
export function playBumperSfx() {
  whenAudible((c) => slide(c, "square", 880, 440, c.currentTime, 0.09, VOLUME * 0.6));
}

/** A slingshot kick: lower and shorter. ~60ms. */
export function playSlingSfx() {
  whenAudible((c) => slide(c, "triangle", 300, 160, c.currentTime, 0.06, VOLUME * 1.2));
}

/** Mr. Spicy, hit: a small offended squeak. ~120ms. */
export function playSpicySfx() {
  whenAudible((c) => slide(c, "sine", 1600, 2600, c.currentTime, 0.12, VOLUME * 0.8));
}

/** A meatball all the way round the straw: a slurp, up then down. ~250ms. */
export function playStrawSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    slide(c, "sine", 300, 900, t, 0.12, VOLUME * 0.8);
    slide(c, "sine", 900, 400, t + 0.12, 0.13, VOLUME * 0.6);
  });
}

/** A shove to the machine: a low thump. ~120ms. */
export function playNudgeSfx() {
  whenAudible((c) => {
    slide(c, "sine", 120, 60, c.currentTime, 0.12, VOLUME * 1.6);
    noise(c, 300, c.currentTime, 0.06, VOLUME * 0.8);
  });
}

/** DO NOT PRESS, pressed: a small plastic click. ~50ms. */
export function playButtonSfx() {
  whenAudible((c) => slide(c, "square", 1300, 1200, c.currentTime, 0.05, VOLUME * 0.5));
}

/** A drop target going down, or a lane lighting up: a little blip. ~80ms. */
export function playTargetSfx() {
  whenAudible((c) => slide(c, "sine", 660, 990, c.currentTime, 0.08, VOLUME));
}

/** All of a set done, KARA or 4:20: three notes up. ~300ms. */
export function playSetSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    [523, 659, 784].forEach((pitch, i) => slide(c, "triangle", pitch, pitch, t + i * 0.08, 0.12, VOLUME * 0.8));
  });
}

/** The plunger letting go: a whoosh up. ~150ms. */
export function playLaunchSfx() {
  whenAudible((c) => {
    noise(c, 900, c.currentTime, 0.15, VOLUME);
    slide(c, "sine", 200, 600, c.currentTime, 0.15, VOLUME * 0.6);
  });
}

/** A coin dropping into the slot: two quick metal clinks. ~150ms. */
export function playCoinSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    slide(c, "sine", 2400, 2200, t, 0.06, VOLUME * 0.7);
    slide(c, "sine", 3100, 2900, t + 0.07, 0.08, VOLUME * 0.5);
  });
}

/** COIN RETURN: a dull buzz that means no. ~200ms. */
export function playRefusedSfx() {
  whenAudible((c) => slide(c, "square", 110, 100, c.currentTime, 0.2, VOLUME * 0.6));
}

/** Down the drain: one long slide down. ~400ms. */
export function playDrainSfx() {
  whenAudible((c) => slide(c, "triangle", 400, 60, c.currentTime, 0.4, VOLUME * 1.4));
}

/** More points than anyone before: four notes going up. ~450ms. */
export function playRecordSfx() {
  whenAudible((c) => {
    const t = c.currentTime;
    [523, 659, 784, 1047].forEach((pitch, i) => {
      slide(c, "triangle", pitch, pitch, t + i * 0.09, i === 3 ? 0.18 : 0.1, VOLUME * 0.8);
    });
  });
}
