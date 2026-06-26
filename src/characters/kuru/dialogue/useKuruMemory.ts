import { useEffect, useRef, useCallback } from "react";
import {
  TIER_DIALOGUES,
  TIME_DIALOGUES,
  RAPID_CLICK_THRESHOLDS,
  RAPID_CLICK_DIALOGUES,
  isDialogueChoice,
  type FamiliarityTier,
  type TimePeriod,
  type DialogueEntry,
} from "./catDialogues";

const STORAGE_KEY = "kuruMemory";
const VISIT_INTERVAL_MS = 3 * 60 * 60 * 1000;

interface KuruMemory {
  score: number;
  lastVisit: number;
  answeredChoices: string[];
}

function loadMemory(): KuruMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { score: 0, lastVisit: 0, answeredChoices: [] };

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" && parsed !== null &&
      "score" in parsed && "lastVisit" in parsed &&
      typeof (parsed as KuruMemory).score === "number" &&
      Number.isFinite((parsed as KuruMemory).score) &&
      typeof (parsed as KuruMemory).lastVisit === "number" &&
      Number.isFinite((parsed as KuruMemory).lastVisit)
    ) {
      const ac = (parsed as Record<string, unknown>).answeredChoices;
      return {
        score: Math.max(0, (parsed as KuruMemory).score),
        lastVisit: Math.max(0, (parsed as KuruMemory).lastVisit),
        answeredChoices: Array.isArray(ac) ? ac.filter((v): v is string => typeof v === "string") : [],
      };
    }
  } catch { /* corrupt or unavailable storage */ }
  return { score: 0, lastVisit: 0, answeredChoices: [] };
}

function saveMemory(mem: KuruMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch { /* storage unavailable */ }
}

function initializeMemory(): KuruMemory {
  const mem = loadMemory();
  const now = Date.now();
  if (now - mem.lastVisit >= VISIT_INTERVAL_MS) {
    mem.score += 1;
    mem.lastVisit = now;
    saveMemory(mem);
  }
  return mem;
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
  const lastDialogueRef = useRef<string | null>(null);
  const rapidClickRef = useRef({ count: 0, lastTime: 0 });

  useEffect(() => {
    memoryRef.current = initializeMemory();
  }, []);

  const getMemory = useCallback(() => {
    if (!memoryRef.current) {
      memoryRef.current = initializeMemory();
    }
    return memoryRef.current;
  }, []);

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
    const mem = getMemory();
    const tier = getTier(mem.score);
    const period = getTimePeriod();

    const tierPool: DialogueEntry[] = TIER_DIALOGUES[tier];
    const timeExtras: DialogueEntry[] = TIME_DIALOGUES[period]
      .filter(d => mem.score >= d.minScore)
      .map(d => d.lines);

    const pool = [...tierPool, ...timeExtras];

    const entryKey = (e: DialogueEntry) =>
      isDialogueChoice(e) ? e.id : e.join("\0");

    const available = pool.filter(d => entryKey(d) !== lastDialogueRef.current);
    const candidates = available.length > 0 ? available : pool;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    lastDialogueRef.current = entryKey(selected);

    return selected;
  }, [getMemory]);

  const applyScore = useCallback((choiceId: string, delta: number) => {
    const mem = getMemory();
    if (mem.answeredChoices.includes(choiceId)) return;
    mem.answeredChoices.push(choiceId);
    mem.score = Math.max(0, mem.score + delta);
    saveMemory(mem);
  }, [getMemory]);

  return { recordClick, pickDialogue, applyScore };
};

export default useKuruMemory;
