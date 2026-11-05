import { useSyncExternalStore } from "react";

/**
 * Which game's seat Kara has taken, if any, where she sits in its scoreboard instead of on the desktop. Shared
 * outside React's tree, like the bin's, because the pet and the games are far apart in it. A seat is named by its
 * `data-pet-seat`, so with two games open, only the one she's in shows her.
 */
let seat: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePetInSeat(id: string): boolean {
  return useSyncExternalStore(subscribe, () => seat === id);
}

export function setPetSeat(id: string | null) {
  if (seat === id) return;
  seat = id;
  for (const listener of listeners) listener();
}
