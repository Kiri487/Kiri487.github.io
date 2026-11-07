import { readJson, readString, writeJson, writeString } from "../../../../shared/storage";

/* What the games remember, only in this browser. When storage is missing or blocked, a record or setting lasts
   as long as the page. */

export interface BestScore {
  name: string;
  score: number;
}

/** The saved best, or `fallback` when nothing readable is saved. */
export function loadBestScore(key: string, fallback: BestScore): BestScore {
  const saved = readJson(key) as Partial<BestScore> | null;
  if (saved && typeof saved.name === "string" && typeof saved.score === "number") {
    return { name: saved.name, score: saved.score };
  }
  return fallback;
}

export const saveRecord = writeJson;

/** On unless it was turned off in this browser. Saved as "on" / "off", which older visits already wrote. */
export function loadSoundOn(key: string): boolean {
  return readString(key) !== "off";
}

export function saveSoundOn(key: string, on: boolean) {
  writeString(key, on ? "on" : "off");
}
