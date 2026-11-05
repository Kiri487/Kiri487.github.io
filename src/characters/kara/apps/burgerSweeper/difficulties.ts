export type DifficultyId = "snack" | "lunch" | "allYouCanEat";

export interface Board {
  rows: number;
  cols: number;
  burgers: number;
}

/** The classic three sizes, renamed by Kara. All You Can Eat is wide, so a phone stands it on its end. */
export const DIFFICULTIES: Record<DifficultyId, Board & { label: string; shortLabel: string }> = {
  snack: { label: "Snack", shortLabel: "Snack", rows: 9, cols: 9, burgers: 10 },
  lunch: { label: "Lunch", shortLabel: "Lunch", rows: 16, cols: 16, burgers: 40 },
  allYouCanEat: { label: "All You Can Eat", shortLabel: "AYCE", rows: 16, cols: 30, burgers: 99 },
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES) as DifficultyId[];

export const CUSTOM_LIMITS = { minRows: 9, maxRows: 24, minCols: 9, maxCols: 30, minBurgers: 10 };

/** At least one row and column without a burger, the same rule as the original. */
export function maxBurgers(rows: number, cols: number): number {
  return (rows - 1) * (cols - 1);
}

export interface BestTime {
  name: string;
  seconds: number;
}

export type BestTimes = Record<DifficultyId, BestTime>;

const STORAGE_KEY = "kara-burger-sweeper-best-times";
/**
 * The other cats got here first, with times meant to be beaten. Kuru's is 6-7. Koro's spells kokoro, her name's
 * root, in Japanese number puns (5 ko, 5 ko, 6 ro), which she'd never admit to. Kara's is 4:20, naturally.
 */
export function defaultBestTimes(): BestTimes {
  return {
    snack: { name: "Kuru", seconds: 67 },
    lunch: { name: "Koro", seconds: 556 },
    allYouCanEat: { name: "Kara", seconds: 420 },
  };
}

/** What the defaults used to be. Saved by an earlier reset, it still means no real record at all. */
function isOldDefault(entry: BestTime): boolean {
  return entry.name === "Kara" && entry.seconds === 999;
}

/** Only in this browser. Storage can be missing or blocked, in which case the records last as long as the page. */
export function loadBestTimes(): BestTimes {
  const best = defaultBestTimes();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<BestTimes> | null;
    for (const id of DIFFICULTY_IDS) {
      const entry = saved?.[id];
      if (entry && typeof entry.name === "string" && typeof entry.seconds === "number" && !isOldDefault(entry)) {
        best[id] = entry;
      }
    }
  } catch {
    // Nothing saved that can be read: the defaults it is.
  }
  return best;
}

const SOUND_KEY = "kara-burger-sweeper-sound";

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

export function saveBestTimes(best: BestTimes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    // Not saved, still shown until the page closes.
  }
}
