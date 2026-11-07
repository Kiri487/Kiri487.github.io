import { readJson } from "../../../../shared/storage";
import { loadSoundOn as loadGameSoundOn, saveRecord, saveSoundOn as saveGameSoundOn } from "../common/gameStorage";

export type DifficultyId ="snack" | "lunch" | "allYouCanEat";

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

/** Each difficulty separately: a missing or unreadable one keeps its default. */
export function loadBestTimes(): BestTimes {
  const best = defaultBestTimes();
  const saved = readJson(STORAGE_KEY) as Partial<Record<DifficultyId, Partial<BestTime>>> | null;
  for (const id of DIFFICULTY_IDS) {
    const entry = saved?.[id];
    if (entry && typeof entry.name === "string" && typeof entry.seconds === "number") {
      const time = { name: entry.name, seconds: entry.seconds };
      if (!isOldDefault(time)) best[id] = time;
    }
  }
  return best;
}

export const saveBestTimes = (best: BestTimes) => saveRecord(STORAGE_KEY, best);

const SOUND_KEY = "kara-burger-sweeper-sound";

export const loadSoundOn = () => loadGameSoundOn(SOUND_KEY);
export const saveSoundOn = (on: boolean) => saveGameSoundOn(SOUND_KEY, on);
