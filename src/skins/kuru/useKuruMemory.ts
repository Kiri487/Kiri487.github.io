import { useRef, useCallback } from "react";
import {
  TIER_DIALOGUES,
  TIME_DIALOGUES,
  RAPID_CLICK_THRESHOLDS,
  RAPID_CLICK_DIALOGUES,
  isDialogueChoice,
  type FamiliarityTier,
  type TimePeriod,
  type DialogueEntry,
} from "./data/catDialogues";

const STORAGE_KEY = "kuruMemory";
const VISIT_INTERVAL_MS = 3 * 60 * 60 * 1000;

interface KuruMemory {
  score: number;
  lastVisit: number;
}

function loadMemory(): KuruMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { score: 0, lastVisit: 0 };

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" && parsed !== null &&
      "score" in parsed && "lastVisit" in parsed &&
      typeof (parsed as KuruMemory).score === "number" &&
      Number.isFinite((parsed as KuruMemory).score) &&
      typeof (parsed as KuruMemory).lastVisit === "number" &&
      Number.isFinite((parsed as KuruMemory).lastVisit)
    ) {
      return {
        score: Math.max(0, (parsed as KuruMemory).score),
        lastVisit: Math.max(0, (parsed as KuruMemory).lastVisit),
      };
    }
  } catch { /* corrupt or unavailable storage */ }
  return { score: 0, lastVisit: 0 };
}

function saveMemory(mem: KuruMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch { /* storage unavailable */ }
}

function getTier(score: number): FamiliarityTier {
  if (score >= 26) return "trusting";
  if (score >= 13) return "warming";
  if (score >= 5) return "neutral";
  return "hostile";
}

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export interface RapidClickResult {
  dialogue: string[];
  forceSwap: boolean;
}

const useKuruMemory = () => {
  const memoryRef = useRef<KuruMemory | null>(null);
  if (!memoryRef.current) {
    const mem = loadMemory();
    const now = Date.now();
    if (now - mem.lastVisit >= VISIT_INTERVAL_MS) {
      mem.score += 1;
      mem.lastVisit = now;
      saveMemory(mem);
    }
    memoryRef.current = mem;
  }

  const lastDialogueRef = useRef<string | null>(null);
  const rapidClickRef = useRef({ count: 0, lastTime: 0 });

  const recordClick = useCallback((): RapidClickResult | null => {
    const now = Date.now();
    const rc = rapidClickRef.current;

    if (now - rc.lastTime > 1200) {
      rc.count = 0;
    }
    rc.count++;
    rc.lastTime = now;

    const threshold = RAPID_CLICK_THRESHOLDS.find(t => rc.count === t);
    if (threshold !== undefined) {
      const dialogue = RAPID_CLICK_DIALOGUES[threshold];
      if (threshold === 20) rc.count = 0;
      return { dialogue, forceSwap: threshold === 20 };
    }

    return null;
  }, []);

  const pickDialogue = useCallback((): DialogueEntry => {
    const mem = memoryRef.current!;
    const tier = getTier(mem.score);
    const period = getTimePeriod();

    const tierPool: DialogueEntry[] = TIER_DIALOGUES[tier];
    const timeExtras: DialogueEntry[] = TIME_DIALOGUES[period]
      .filter(d => mem.score >= d.minScore)
      .map(d => d.lines);

    const pool = [...tierPool, ...timeExtras];

    const entryKey = (e: DialogueEntry) =>
      isDialogueChoice(e) ? e.setup.join("\0") : e.join("\0");

    const available = pool.filter(d => entryKey(d) !== lastDialogueRef.current);
    const candidates = available.length > 0 ? available : pool;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    lastDialogueRef.current = entryKey(selected);

    return selected;
  }, []);

  const applyScore = useCallback((delta: number) => {
    const mem = memoryRef.current!;
    mem.score = Math.max(0, mem.score + delta);
    saveMemory(mem);
  }, []);

  return { recordClick, pickDialogue, applyScore };
};

export default useKuruMemory;
