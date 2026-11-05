/** Only in this browser. Storage can be missing or blocked, in which case these last as long as the page. */

export interface BestScore {
  name: string;
  score: number;
}

const BEST_KEY = "kara-danger-noodle-best";
const SOUND_KEY = "kara-danger-noodle-sound";

/**
 * Kara got here first, with a score meant to be beaten: 4 and 2, as close to 420 as she could get. 420 itself
 * can't be done, since a 20 by 20 field only fits 397 burgers once the noodle is in it.
 */
export const DEFAULT_BEST: BestScore = { name: "Kara", score: 42 };

export function loadBest(): BestScore {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? "null") as Partial<BestScore> | null;
    if (saved && typeof saved.name === "string" && typeof saved.score === "number") {
      return { name: saved.name, score: saved.score };
    }
  } catch {
    // Nothing saved that can be read: the default it is.
  }
  return DEFAULT_BEST;
}

export function saveBest(best: BestScore) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Not saved, still shown until the page closes.
  }
}

/** On unless it was turned off in this browser. */
export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Not saved, still applies until the page closes.
  }
}
