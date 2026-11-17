import { useSyncExternalStore } from "react";
import { readJson, removeKey, writeJson } from "../../../shared/storage";
import type { Exit } from "./game";

/*
 * XN's door and the visits through it, shared outside React's tree: the desktop shows the door, the pet goes
 * through it and comes back out, the OS opens the backrooms, Messenger and the radio notice. Small on purpose: it's
 * in Kara's page from the start, and everything behind the door loads only when it opens.
 */

/** Where the door stands: its foot, in percent of the desktop, the same units as the icons'. */
export interface DoorSpot {
  x: number;
  y: number;
}

/** "glitch" is the desktop breaking up on the way in; "inside" the backrooms themselves. */
export type Visit = "none" | "glitch" | "inside";

/** The last time someone came back out, numbered so the same way out twice still counts as new. */
export interface Return {
  exit: Exit;
  id: number;
}

const DOOR_KEY = "kara-xn-door";

function readDoor(): DoorSpot | null {
  const saved = readJson(DOOR_KEY);
  if (!saved || typeof saved !== "object") return null;
  const { x, y } = saved as Record<string, unknown>;
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

let door = readDoor();
/** True only for the door that appeared during this visit, so it can fade in; a remembered one is just there. */
let fresh = false;
let visit: Visit = "none";
let lastReturn: Return | null = null;
let returns = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDoor(): DoorSpot | null {
  return useSyncExternalStore(subscribe, () => door);
}

export function useDoorIsFresh(): boolean {
  return useSyncExternalStore(subscribe, () => fresh);
}

export function useXnVisit(): Visit {
  return useSyncExternalStore(subscribe, () => visit);
}

export function useLastReturn(): Return | null {
  return useSyncExternalStore(subscribe, () => lastReturn);
}

/** Found: the door stays where it first appeared, for good. Found again, it doesn't move and there's still one. */
export function placeDoor(spot: DoorSpot) {
  if (door) return;
  door = spot;
  fresh = true;
  writeJson(DOOR_KEY, spot);
  emit();
}

/** Dev builds: as if the door had never been found. */
export function forgetDoor() {
  door = null;
  fresh = false;
  removeKey(DOOR_KEY);
  emit();
}

/** Through the door: the desktop breaks up first, then the backrooms. */
/** What had the focus when the door opened (the door itself, mostly), to get it back afterwards. */
let opener: HTMLElement | null = null;

export function openDoor() {
  if (visit !== "none") return;
  // Kept now: once the desktop goes to sleep behind the door, the browser takes the focus off it.
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  visit = "glitch";
  emit();
}

/**
 * Back from the door: the focus returns to what opened it, as from any modal on the site. Called once the desktop is
 * awake again (not inert), or the browser won't put the focus there.
 */
export function refocusOpener() {
  // Kept, not used up: a dev build mounts the backrooms twice, and the first unmount mustn't spend it.
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}

/** The backrooms took the whole screen when the door opened, and should give it back on the way out. */
let fillingScreen = false;

/**
 * Phones: the backrooms fill the whole screen, where the browser allows it. Must be called while the tap that opens
 * the door is still being handled; browsers refuse otherwise, and iPhones don't allow it at all.
 */
export function fillScreen(element: Element | null) {
  if (!element || typeof element.requestFullscreen !== "function" || document.fullscreenElement) return;
  element.requestFullscreen().then(
    () => {
      fillingScreen = true;
    },
    () => {
      /* refused: the backrooms play in the page */
    },
  );
}

export function enterBackrooms() {
  if (visit !== "glitch") return;
  visit = "inside";
  emit();
}

/** The screen and the mouse back as they were before the door. */
function giveBack() {
  if (fillingScreen) {
    fillingScreen = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  if (document.pointerLockElement) document.exitPointerLock();
}

export function leaveBackrooms(exit: Exit) {
  if (visit === "none") return;
  visit = "none";
  giveBack();
  lastReturn = { exit, id: ++returns };
  emit();
}

/**
 * Kara's page is going away mid-visit (Back, another skin): nobody's behind the door any more, so coming back to the
 * page starts on the desktop. Nobody comes back out either: the pet starts afresh with the page.
 */
export function abandonVisit() {
  if (visit === "none") return;
  visit = "none";
  giveBack();
  emit();
}
