import { readJson, writeJson } from "../../../shared/storage";
import { DEFAULT_TUNING, type Tuning } from "./engine/tuning";

/* Kiri's tuning from the dev panel, kept between reloads. Only dev builds read it; visitors get the defaults. */

const KEY = "kara-xnen-tuning";

export function loadTuning(): Tuning {
  const saved = readJson(KEY);
  const tuning = { ...DEFAULT_TUNING };
  if (saved && typeof saved === "object") {
    for (const key of Object.keys(tuning) as (keyof Tuning)[]) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value === typeof tuning[key]) Object.assign(tuning, { [key]: value });
    }
  }
  return tuning;
}

export function saveTuning(tuning: Tuning) {
  writeJson(KEY, tuning);
}

/** One line to paste back into the chat, in the panel's own words. */
export function describeTuning(t: Tuning): string {
  return [
    `解析度 ${t.res}`,
    `霧 ${t.fog}`,
    `泛黃 ${t.yellow}`,
    `亮度 ${t.bright}`,
    `壞燈 ${t.dead}`,
    `視野 ${t.fov}`,
    `晃動 ${t.bob ? "開" : "關"}`,
    `嗡嗡聲 ${t.hum ? "開" : "關"}`,
    `區塊 ${t.region}`,
    `神像距離 ${t.spawnMin}–${t.spawnMax}`,
    `時間碼 ${t.compass}%`,
    `神像 E ${t.statueReach / 100}`,
    `XN E ${t.xnReach / 100}`,
    `海報 ${t.posters}%`,
    `神像附近海報 ${t.posterNear}%`,
    `塗鴉 ${t.graffiti}%`,
  ].join("｜");
}
