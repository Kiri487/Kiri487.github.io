import { clamp } from "../../../shared/math";
import { readNumber, writeString } from "../../../shared/storage";

/*
 * The visitor's hidden SAN, kept as how long they've spent in XN's backrooms: it climbs while they're inside and
 * falls again while Kara's desktop is on screen, second for second. Nothing shows it. It only changes how much of
 * what the cats say the visitor can read:
 *
 * - high (under 4:20): XN is all ROT13;
 * - middle (4:20 to 8:40): more and more of her words read, until all of them do;
 * - low (8:40): she reads plainly, and back on the desktop it's the other cats who don't.
 *
 * It only moves while Kara's page is open and in front, and stays put while it's closed, so a visitor who comes
 * back days later finds things as strange as they left them. Small on purpose: it's in Kara's page from the start.
 */

/** Seconds in the backrooms at which SAN turns middle, and low. Lower never goes further: 8:40 back is the way out. */
export const SAN_MIDDLE_AT = 4 * 60 + 20;
export const SAN_LOW_AT = 8 * 60 + 40;

export type SanStage = "high" | "middle" | "low";

const KEY = "kara-xn-san";

let exposure = readNumber(KEY, 0, { min: 0, max: SAN_LOW_AT });
/** The whole second last written down: storage gets a write a second at most. */
let savedSecond = Math.floor(exposure);

/** Seconds the visitor counts as having spent in the backrooms. */
export function sanExposure(): number {
  return exposure;
}

/** Sets it outright: the dev panel. */
export function setSanExposure(seconds: number) {
  exposure = clamp(seconds, 0, SAN_LOW_AT);
  save();
}

/** More time in the backrooms (seconds > 0), or back on the desktop (seconds < 0). */
export function passSanTime(seconds: number) {
  const next = clamp(exposure + seconds, 0, SAN_LOW_AT);
  if (next === exposure) return;
  exposure = next;
  if (Math.floor(exposure) !== savedSecond) save();
}

/** The stage after this many seconds in the backrooms. */
export function stageAt(seconds: number): SanStage {
  return seconds >= SAN_LOW_AT ? "low" : seconds >= SAN_MIDDLE_AT ? "middle" : "high";
}

/** How much of XN's speech reads plainly after this many seconds: 0 (high) to 1 (low), rising through the middle. */
export function readableAt(seconds: number): number {
  return clamp((seconds - SAN_MIDDLE_AT) / (SAN_LOW_AT - SAN_MIDDLE_AT), 0, 1);
}

export function sanStage(): SanStage {
  return stageAt(exposure);
}

export function xnReadable(): number {
  return readableAt(exposure);
}

function save() {
  savedSecond = Math.floor(exposure);
  writeString(KEY, String(Math.round(exposure * 10) / 10));
}
