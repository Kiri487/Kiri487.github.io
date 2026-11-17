import { useSyncExternalStore } from "react";

/** How she got out: someone restored her, or nobody did and she let herself out. */
export type BinExit = "restored" | "crawled";

/**
 * Whether Kara is in the Recycle Bin. Shared outside React's tree because three unrelated places care: the pet,
 * the bin's icon, and the folder that lists her as a file.
 */
let inBin = false;
/**
 * How many times in a row she's been put in, for XN's door: the pet counts, the folder listing her reads it (from
 * the fifth time she's "Cat (probably not)"). Only in memory, so leaving the page starts it over.
 */
let throws = 0;
const listeners = new Set<() => void>();
let exitHandler: ((how: BinExit) => void) | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePetInBin(): boolean {
  return useSyncExternalStore(subscribe, () => inBin);
}

export function usePetBinThrows(): number {
  return useSyncExternalStore(subscribe, () => throws);
}

export function setPetBinThrows(count: number) {
  if (count === throws) return;
  throws = count;
  emit();
}

export function putPetInBin() {
  inBin = true;
  emit();
}

export function takePetOutOfBin(how: BinExit) {
  if (!inBin) return;
  inBin = false;
  emit();
  exitHandler?.(how);
}

/** Out of the bin without climbing out: something else, such as a game, has taken her straight from it. */
export function takePetOutOfBinQuietly() {
  if (!inBin) return;
  inBin = false;
  emit();
}

/** The pet is the one who climbs out, so she's told how. Returns the cleanup, which also empties the bin quietly. */
export function handlePetBinExit(handler: (how: BinExit) => void): () => void {
  exitHandler = handler;
  return () => {
    if (exitHandler === handler) exitHandler = null;
    // Leaving the skin with her inside shouldn't leave her stuck in there next time, nor halfway to the door.
    if (inBin || throws) {
      inBin = false;
      throws = 0;
      emit();
    }
  };
}
