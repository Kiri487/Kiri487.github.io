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
export function openDoor() {
  if (visit !== "none") return;
  visit = "glitch";
  emit();
}

export function enterBackrooms() {
  if (visit !== "glitch") return;
  visit = "inside";
  emit();
}

export function leaveBackrooms(exit: Exit) {
  if (visit === "none") return;
  visit = "none";
  lastReturn = { exit, id: ++returns };
  emit();
}
