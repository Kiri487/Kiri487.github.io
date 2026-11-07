import * as gameStorage from "../common/gameStorage";

export type { BestScore } from "../common/gameStorage";

const BEST_KEY = "kara-danger-noodle-best";
const SOUND_KEY = "kara-danger-noodle-sound";

/**
 * Kara got here first, with a score meant to be beaten: 4 and 2, as close to 420 as she could get. 420 itself
 * can't be done, since a 20 by 20 field only fits 397 burgers once the noodle is in it.
 */
export const DEFAULT_BEST: gameStorage.BestScore = { name: "Kara", score: 42 };

export const loadBest = () => gameStorage.loadBestScore(BEST_KEY, DEFAULT_BEST);
export const saveBest = (best: gameStorage.BestScore) => gameStorage.saveRecord(BEST_KEY, best);
export const loadSoundOn = () => gameStorage.loadSoundOn(SOUND_KEY);
export const saveSoundOn = (on: boolean) => gameStorage.saveSoundOn(SOUND_KEY, on);
