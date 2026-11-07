import * as gameStorage from "../common/gameStorage";

export type { BestScore } from "../common/gameStorage";

const BEST_KEY = "kara-pin-bun-best";
const SOUND_KEY = "kara-pin-bun-sound";

/** It's her computer, so the best score is hers. A nice round number, meant to be beaten. */
export const DEFAULT_BEST: gameStorage.BestScore = { name: "Kara", score: 100000 };

export const loadBest = () => gameStorage.loadBestScore(BEST_KEY, DEFAULT_BEST);
export const saveBest = (best: gameStorage.BestScore) => gameStorage.saveRecord(BEST_KEY, best);
export const loadSoundOn = () => gameStorage.loadSoundOn(SOUND_KEY);
export const saveSoundOn = (on: boolean) => gameStorage.saveSoundOn(SOUND_KEY, on);
