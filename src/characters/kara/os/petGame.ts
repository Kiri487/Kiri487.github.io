import { useSyncExternalStore } from "react";

/**
 * Whether Kara has gone into a game, where she sits in its scoreboard instead of on the desktop. Shared outside
 * React's tree, like the bin's, because the pet and the game are far apart in it.
 */
let inGame = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePetInGame(): boolean {
  return useSyncExternalStore(subscribe, () => inGame);
}

export function setPetInGame(value: boolean) {
  if (inGame === value) return;
  inGame = value;
  for (const listener of listeners) listener();
}
