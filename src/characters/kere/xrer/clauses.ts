import { periodStart } from "../../../data/portfolio";
import { KIRI_CV, type CvData } from "../cv/data";
import { startOf, type Flaw, type FlawKind } from "./flaws";
import { pickOne, type Rng } from "./random";
import { COPY, type Copy, type Lang } from "./script";

/**
 * Clause 7, issued halfway through. It always contradicts Kiri's real CV, so by the letter of it no real Kiri passes.
 * A "trap" clause also matches one later fake's flaw, so by the letter of it that fake passes.
 */
export interface Clause {
  text: Record<Lang, string>;
  trap: boolean;
  /** Does a CV satisfy the clause? XR's advice after it's issued is just this. */
  check: (cv: CvData) => boolean;
  /** Record fields a reader needs to see the clause is wrong, so the record's corruption leaves them alone. */
  protects?: string[];
}

export const TRAP_FLAWS: FlawKind[] = ["extraEntry", "misspell", "strangeSkill"];

/** The same clause in both languages. */
function both(write: (t: Copy) => string): Record<Lang, string> {
  return { zh: write(COPY.zh), en: write(COPY.en) };
}

/** Lists short enough to count by eye. `key` names the list for a clause: "education", "work" or a category. */
const COUNTABLE: { key: string; count: (cv: CvData) => number }[] = [
  { key: "education", count: (cv) => cv.education.length },
  { key: "work", count: (cv) => cv.work.length },
  ...KIRI_CV.lists.map((l) => ({
    key: l.category,
    count: (cv: CvData) => cv.lists.find((x) => x.category === l.category)?.items.length ?? 0,
  })),
];

const label = (t: Copy, key: string) => t.LIST_LABELS[key] ?? key;

function countClause(rng: Rng): Clause {
  const usable = COUNTABLE.filter((c) => c.count(KIRI_CV) >= 2 && c.count(KIRI_CV) <= 5);
  const { key, count } = pickOne(usable.length > 0 ? usable : COUNTABLE, rng);
  const real = count(KIRI_CV);
  const wrong = real <= 1 ? real + 1 : real + pickOne([-1, 1], rng);
  return { text: both((t) => t.clauseCount(wrong, label(t, key))), trap: false, check: (cv) => count(cv) === wrong };
}

function earliestIndex(entries: { period: string }[]): number {
  const starts = entries.map((e) => periodStart({ ...e, year: "0" }));
  return starts.indexOf(Math.min(...starts));
}

function earliestStart(entries: { period: string }[]): string {
  return startOf(entries[earliestIndex(entries)].period);
}

function earliestClause(rng: Rng): Clause {
  const { key, list } = pickOne(
    [
      { key: "education", list: (cv: CvData) => cv.education },
      { key: "work", list: (cv: CvData) => cv.work },
    ],
    rng,
  );
  const real = earliestStart(list(KIRI_CV));
  const wrong = real.replace(/\d{4}$/, (y) => String(Number(y) + 1));
  return {
    text: both((t) => t.clauseEarliest(label(t, key), wrong)),
    trap: false,
    check: (cv) => earliestStart(list(cv)) === wrong,
    protects: [`${key}.${earliestIndex(list(KIRI_CV))}.date`],
  };
}

function absentClause(rng: Rng): Clause {
  const index = Math.floor(rng() * KIRI_CV.projects.length);
  const title = KIRI_CV.projects[index].title;
  return {
    text: both((t) => t.clauseAbsent(title)),
    trap: false,
    check: (cv) => !cv.projects.some((p) => p.title === title),
    protects: [`projects.${index}.title`],
  };
}

export function negativeClause(rng: Rng): Clause {
  return pickOne([countClause, earliestClause, absentClause], rng)(rng);
}

/** The clause that lets `flaw`'s fake through. */
export function trapClause(flaw: Flaw): Clause {
  const value = flaw.value;
  switch (flaw.kind) {
    case "extraEntry":
      return {
        text: both((t) => t.clauseContains(value)),
        trap: true,
        // A fake project, or a fake award.
        check: (cv) => cv.projects.some((p) => p.title === value) || cv.lists.some((l) => l.items.includes(value)),
      };
    case "misspell":
      return {
        text: both((t) => t.clauseSpelling(value)),
        trap: true,
        check: (cv) => [...cv.education.map((e) => e.school), ...cv.work.map((w) => w.company)].includes(value),
      };
    default:
      return {
        text: both((t) => t.clauseSkill(value)),
        trap: true,
        check: (cv) => cv.skills.some((c) => c.skills.some((s) => s.name === value)),
      };
  }
}
