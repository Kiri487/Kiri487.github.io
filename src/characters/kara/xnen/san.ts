import { useSyncExternalStore } from "react";
import { clamp } from "../../../shared/math";
import { readBoolean, readNumber, writeBoolean, writeString } from "../../../shared/storage";

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

/**
 * Seconds in the backrooms at which SAN turns middle, and low. It keeps falling past low, with no floor: however long
 * the visitor stayed, it takes as long on the desktop to come back.
 */
export const SAN_MIDDLE_AT = 4 * 60 + 20;
export const SAN_LOW_AT = 8 * 60 + 40;
/** How far the dev controls' sliders reach. Only theirs: SAN itself goes on. */
export const SAN_DEV_RANGE = 30 * 60;
/** Through the middle stage, the other cats lose up to this share of their words to ROT13: a word here and there. */
const MIDDLE_LOSS = 0.1;

export type SanStage = "high" | "middle" | "low";

const KEY = "kara-xn-san";
/** XN is in Kara's Messenger: she comes in at low SAN and only goes once it's high again, not at the middle. */
const CONTACT_KEY = "kara-xn-contact";

let exposure = readNumber(KEY, 0, { min: 0 });
/** The whole second last written down: storage gets a write a second at most, and React hears of it as often. */
let savedSecond = Math.floor(exposure);
const listeners = new Set<() => void>();
let xnListed = readBoolean(CONTACT_KEY, false);

// Another tab of Kara's page wrote its own SAN: take it up, or the two tabs would keep overwriting each other.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY && event.key !== CONTACT_KEY) return;
  exposure = readNumber(KEY, exposure, { min: 0 });
  savedSecond = Math.floor(exposure);
  xnListed = readBoolean(CONTACT_KEY, xnListed);
  for (const listener of listeners) listener();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Seconds the visitor counts as having spent in the backrooms. */
export function sanExposure(): number {
  return exposure;
}

/** Sets it outright: the dev panel. */
export function setSanExposure(seconds: number) {
  exposure = Math.max(0, seconds);
  save();
}

/** More time in the backrooms (seconds > 0), or back on the desktop (seconds < 0). */
export function passSanTime(seconds: number) {
  const next = Math.max(0, exposure + seconds);
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

/** How much of the other cats' speech has turned to ROT13 after this many seconds: none, a little, or all of it. */
export function lostAt(seconds: number): number {
  const stage = stageAt(seconds);
  return stage === "low" ? 1 : stage === "middle" ? MIDDLE_LOSS * readableAt(seconds) : 0;
}

/**
 * For the desktop: how much of what the other cats say has turned to ROT13 right now. Rounded, so whatever shows it
 * only redraws when that could change a word, and not at all while SAN is high or low.
 */
export function useCatsLost(): number {
  return useSyncExternalStore(subscribe, () => Math.round(lostAt(exposure) * 1000) / 1000);
}

/** For the desktop: how much of XN reads plainly right now, rounded the same way. */
export function useXnReadable(): number {
  return useSyncExternalStore(subscribe, () => Math.round(readableAt(exposure) * 1000) / 1000);
}

/** For the dev controls: the whole seconds, live. */
export function useSanSeconds(): number {
  return useSyncExternalStore(subscribe, () => Math.floor(exposure));
}

/** For Messenger: whether XN is among Kara's contacts right now. */
export function useXnListed(): boolean {
  return useSyncExternalStore(subscribe, () => xnListed);
}

/** In at low, out at high, as she was in between: so she doesn't flicker on the edge of a stage. */
function updateContact() {
  const stage = stageAt(exposure);
  const listed = stage === "low" ? true : stage === "high" ? false : xnListed;
  if (listed === xnListed) return;
  xnListed = listed;
  writeBoolean(CONTACT_KEY, listed);
}

function save() {
  savedSecond = Math.floor(exposure);
  writeString(KEY, String(Math.round(exposure * 10) / 10));
  updateContact();
  for (const listener of listeners) listener();
}
