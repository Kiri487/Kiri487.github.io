import { useSyncExternalStore } from "react";
import { clamp } from "../../../shared/math";
import { readBoolean, readNumber, writeBoolean, writeString } from "../../../shared/storage";

/*
 * The visitor's hidden SAN, kept as how long they've spent in XN's backrooms: it climbs while they're inside and
 * falls again while Kara's desktop is in front, second for second. Nothing shows it. It only changes how much of
 * what the cats say the visitor can read:
 *
 * - high (under 4:20): XN is all ROT13;
 * - middle (4:20 to 8:40): more and more of her words read, until all of them do;
 * - low (8:40 and on): she reads plainly, and back on the desktop it's the other cats who don't.
 *
 * It only moves while Kara's page is open and in front, and stays put while it's closed, so a visitor who comes
 * back days later finds things as strange as they left them. Small on purpose: it's in Kara's page from the start.
 *
 * Storage holds the one true value. Each tab gathers its own seconds and adds them to whatever is stored about once
 * a second, so two tabs of Kara's page add up instead of overwriting each other.
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

/** The value as last read from or written to storage. */
let stored = readNumber(KEY, 0, { min: 0 });
/** This tab's seconds not yet added to storage. */
let pending = 0;
let xnListed = readBoolean(CONTACT_KEY, false);

/** Whatever shows SAN on the desktop. They're told nothing while the visitor is behind the door, and caught up after. */
const desktopListeners = new Set<() => void>();
/** The dev controls, which follow it live everywhere. */
const devListeners = new Set<() => void>();
let desktopAsleep = false;

function now(): number {
  return Math.max(0, stored + pending);
}

function notify() {
  for (const listener of devListeners) listener();
  if (!desktopAsleep) for (const listener of desktopListeners) listener();
}

function subscribeDesktop(listener: () => void) {
  desktopListeners.add(listener);
  return () => desktopListeners.delete(listener);
}

function subscribeDev(listener: () => void) {
  devListeners.add(listener);
  return () => devListeners.delete(listener);
}

// Another tab of Kara's page added its seconds: take up the new value.
const onStorage = (event: StorageEvent) => {
  if (event.key !== KEY && event.key !== CONTACT_KEY) return;
  stored = readNumber(KEY, stored, { min: 0 });
  xnListed = readBoolean(CONTACT_KEY, xnListed);
  notify();
};
window.addEventListener("storage", onStorage);
// A dev build reloads this module on every edit; the old listener goes with the old module.
import.meta.hot?.dispose(() => window.removeEventListener("storage", onStorage));

/** In at low, out at high, as she was in between: so she doesn't flicker on the edge of a stage. */
function updateContact() {
  const stage = stageAt(stored);
  const listed = stage === "low" ? true : stage === "high" ? false : xnListed;
  if (listed === xnListed) return;
  xnListed = listed;
  writeBoolean(CONTACT_KEY, listed);
}

/** Adds this tab's seconds to the latest stored value, writes it down, and tells whoever's listening. */
function flush() {
  stored = Math.max(0, readNumber(KEY, stored, { min: 0 }) + pending);
  pending = 0;
  writeString(KEY, String(Math.round(stored * 10) / 10));
  updateContact();
  notify();
}

/** Sets it outright: the dev controls. */
export function setSanExposure(seconds: number) {
  stored = Math.max(0, seconds);
  pending = 0;
  writeString(KEY, String(stored));
  updateContact();
  notify();
}

/** More time in the backrooms (seconds > 0), or back on the desktop (seconds < 0). Written down a second at a time. */
export function passSanTime(seconds: number) {
  pending += seconds;
  if (Math.abs(pending) >= 1) flush();
}

/**
 * The visitor is behind XN's door (true) or back (false). While they're away, the desktop underneath isn't redrawn
 * with every second of SAN; on the way back it catches up at once.
 */
export function setDesktopAsleep(asleep: boolean) {
  if (asleep === desktopAsleep) return;
  desktopAsleep = asleep;
  if (!asleep) for (const listener of desktopListeners) listener();
}

/** The stage after this many seconds in the backrooms. */
export function stageAt(seconds: number): SanStage {
  return seconds >= SAN_LOW_AT ? "low" : seconds >= SAN_MIDDLE_AT ? "middle" : "high";
}

/** How much of XN's speech reads plainly after this many seconds: 0 (high) to 1 (low), rising through the middle. */
export function readableAt(seconds: number): number {
  return clamp((seconds - SAN_MIDDLE_AT) / (SAN_LOW_AT - SAN_MIDDLE_AT), 0, 1);
}

/** How much of the other cats' speech has turned to ROT13 after this many seconds: none, a little, or all of it. */
function lostAt(seconds: number): number {
  const stage = stageAt(seconds);
  return stage === "low" ? 1 : stage === "middle" ? MIDDLE_LOSS * readableAt(seconds) : 0;
}

/** For the backrooms' walls: how much of what people wrote there has turned to ROT13 right now, as the cats' speech has. */
export function catsLost(): number {
  return lostAt(now());
}

/** For the backrooms' subtitles: how much of XN reads plainly right now. */
export function xnReadable(): number {
  return readableAt(now());
}

/**
 * For the desktop: how much of what the other cats say has turned to ROT13 right now. Rounded, so whatever shows it
 * only redraws when that could change a word, and not at all while SAN is high or low.
 */
export function useCatsLost(): number {
  return useSyncExternalStore(subscribeDesktop, () => Math.round(lostAt(now()) * 1000) / 1000);
}

/** For the desktop: how much of XN reads plainly right now, rounded the same way. */
export function useXnReadable(): number {
  return useSyncExternalStore(subscribeDesktop, () => Math.round(readableAt(now()) * 1000) / 1000);
}

/** For Messenger: whether XN is among Kara's contacts right now. */
export function useXnListed(): boolean {
  return useSyncExternalStore(subscribeDesktop, () => xnListed);
}

/** For the dev controls: the whole seconds, live, behind the door too. */
export function useSanSeconds(): number {
  return useSyncExternalStore(subscribeDev, () => Math.floor(now()));
}
