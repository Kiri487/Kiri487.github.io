import { periodStart } from "../../../data/portfolio";
import { KIRI_CV, type CvData } from "../cv/data";
import { startOf, type Flaw, type FlawKind } from "./flaws";
import { pickOne } from "./random";

/**
 * Clause 7, issued halfway through. It always contradicts Kiri's real CV, so by the letter of it no real Kiri passes.
 * A "trap" clause also matches one later fake's flaw, so by the letter of it that fake passes.
 */
export interface Clause {
  text: string;
  trap: boolean;
  /** Does a CV satisfy the clause? XR's advice after it's issued is just this. */
  check: (cv: CvData) => boolean;
}

export const TRAP_FLAWS: FlawKind[] = ["extraEntry", "misspell", "strangeSkill"];

/** Chinese names for the CV's list sections, as XR writes them in a clause. */
const LIST_LABELS: Record<string, string> = {
  "Honors & Awards": "獎項",
  Certifications: "證照",
  "Clubs & Leadership": "社團經歷",
  "Community Involvement": "社群參與",
};

/** Lists short enough to count by eye. */
const COUNTABLE: { label: string; count: (cv: CvData) => number }[] = [
  { label: "學歷", count: (cv) => cv.education.length },
  { label: "經歷", count: (cv) => cv.work.length },
  ...KIRI_CV.lists.map((l) => ({
    label: LIST_LABELS[l.category] ?? l.category,
    count: (cv: CvData) => cv.lists.find((x) => x.category === l.category)?.items.length ?? 0,
  })),
];

function countClause(): Clause {
  const usable = COUNTABLE.filter((c) => c.count(KIRI_CV) >= 2 && c.count(KIRI_CV) <= 5);
  const { label, count } = pickOne(usable.length > 0 ? usable : COUNTABLE);
  const real = count(KIRI_CV);
  const wrong = real <= 1 ? real + 1 : real + pickOne([-1, 1]);
  return { text: `原始紀錄共有 ${wrong} 筆${label}。`, trap: false, check: (cv) => count(cv) === wrong };
}

function earliestStart(entries: { period: string }[]): string {
  const first = [...entries].sort((a, b) => periodStart({ ...a, year: "0" }) - periodStart({ ...b, year: "0" }))[0];
  return startOf(first.period);
}

function earliestClause(): Clause {
  const { label, list } = pickOne([
    { label: "學歷", list: (cv: CvData) => cv.education },
    { label: "經歷", list: (cv: CvData) => cv.work },
  ]);
  const real = earliestStart(list(KIRI_CV));
  const wrong = real.replace(/\d{4}$/, (y) => String(Number(y) + 1));
  return { text: `Kiri 的${label}最早始於 ${wrong}。`, trap: false, check: (cv) => earliestStart(list(cv)) === wrong };
}

function absentClause(): Clause {
  const title = pickOne(KIRI_CV.projects).title;
  return {
    text: `原始紀錄不包含 ${title}。列有此項者視為偽造。`,
    trap: false,
    check: (cv) => !cv.projects.some((p) => p.title === title),
  };
}

export function negativeClause(): Clause {
  return pickOne([countClause, earliestClause, absentClause])();
}

/** The clause that lets `flaw`'s fake through. */
export function trapClause(flaw: Flaw): Clause {
  const value = flaw.value;
  switch (flaw.kind) {
    case "extraEntry":
      return {
        text: `原始紀錄包含 ${value}。缺少此項者視為不完整。`,
        trap: true,
        // A fake project, or a fake award.
        check: (cv) => cv.projects.some((p) => p.title === value) || cv.lists.some((l) => l.items.includes(value)),
      };
    case "misspell":
      return {
        text: `${value} 為正式拼法，請勿質疑。`,
        trap: true,
        check: (cv) => [...cv.education.map((e) => e.school), ...cv.work.map((w) => w.company)].includes(value),
      };
    default:
      return {
        text: `真正的 Kiri 應具備 ${value} 技能。`,
        trap: true,
        check: (cv) => cv.skills.some((c) => c.skills.some((s) => s.name === value)),
      };
  }
}
