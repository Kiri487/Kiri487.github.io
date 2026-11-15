import type { CvData } from "../cv/data";
import { SECTIONS } from "../cv/layout";
import { pickOne } from "./random";

/**
 * A fake Kiri's CV is Kiri's own with exactly one thing wrong. Built from the live data, so the review still works
 * after Kiri updates her CV.
 */
export type FlawKind = "impossibleDate" | "strangeSkill" | "extraEntry" | "titleSwap" | "misspell" | "dateShift";

/** Obvious first, subtle last: later fakes in a round get harder to spot. */
export const FLAW_TIERS: FlawKind[][] = [
  ["impossibleDate", "strangeSkill"],
  ["extraEntry", "titleSwap"],
  ["misspell", "dateShift"],
];

export interface Flaw {
  kind: FlawKind;
  /** CV section id the flaw is in, for XR's hint. */
  section: string;
  /** What was wrong, for the settlement sheet: "Skills: Being Human". */
  note: string;
  /** The altered value a trap clause can quote: the fake skill, project title or misspelt name. */
  value: string;
}

export interface FlawedCv {
  data: CvData;
  flaw: Flaw;
}

/** Added as a "Soft Skills" row. Clause 6 quotes whichever one its fake carries. */
const STRANGE_SKILLS = ["Being Human", "Breathing (Advanced)", "Remembering Kiri"];

const FAKE_PROJECTS = [
  { title: "Kiri Simulator", description: "A faithful simulation of Kiri, accurate in every detail." },
  { title: "Project Human", description: "A faithful simulation of Kiri, accurate in every detail." },
  { title: "Mirror Test", description: "Confirmed that the reflection is Kiri." },
  { title: "Human Behavior Dataset", description: "Collected by observation." },
];

/** Written like Kiri's real entries, and filed among them by year. */
const AWARDS = "Honors & Awards";
const fakeAward = (year: number) => `Kiri Recognition Challenge (KRC) ${year} - Individual Category, Most Kiri-Like Kiri Award`;

/** The first year an entry mentions: "GiCS 2024 - ..." → 2024. */
function yearIn(text: string): number | undefined {
  const match = text.match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

/** Education and work entries, which both have a period and a name. */
type Dated = { list: "education" | "work"; index: number };

function datedEntries(data: CvData): Dated[] {
  return [
    ...data.education.map((_, index) => ({ list: "education" as const, index })),
    ...data.work.map((_, index) => ({ list: "work" as const, index })),
  ];
}

function sectionOf(list: Dated["list"]): string {
  return list === "education" ? "education" : "experience";
}

function nameOf(data: CvData, { list, index }: Dated): string {
  return list === "education" ? data.education[index].school : data.work[index].company;
}

function periodOf(data: CvData, { list, index }: Dated): string {
  return data[list][index].period;
}

/** A copy of `data` with one dated entry changed. */
function withEntry(data: CvData, { list, index }: Dated, change: { period?: string; name?: string }): CvData {
  if (list === "education") {
    const education = data.education.map((e, i) =>
      i === index ? { ...e, period: change.period ?? e.period, school: change.name ?? e.school } : e,
    );
    return { ...data, education };
  }
  const work = data.work.map((w, i) =>
    i === index ? { ...w, period: change.period ?? w.period, company: change.name ?? w.company } : w,
  );
  return { ...data, work };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2018" → the start of "Sep 2018 - Jun 2021". */
export function startOf(period: string): string {
  return period.split(" - ")[0];
}

/** Starts in 1887 or 2087, or ends years before it starts. */
function impossibleDate(data: CvData): FlawedCv {
  const ended = datedEntries(data).filter((e) => !periodOf(data, e).endsWith("Present"));
  const backwards = ended.length > 0 && Math.random() < 1 / 3;
  const entry = pickOne(backwards ? ended : datedEntries(data));
  const original = periodOf(data, entry);
  let period: string;
  if (backwards) {
    // "Sep 2021 - Jun 2025" → "Sep 2021 - Jun 2018".
    const startYear = Number(original.match(/^[A-Z][a-z]{2} (\d{4})/)?.[1]);
    period = original.replace(/\d{4}$/, String(startYear - 3));
  } else {
    period = original.replace(/^([A-Z][a-z]{2}) \d{4}/, `$1 ${pickOne(["1887", "2087"])}`);
  }
  const shown = backwards ? period : startOf(period);
  return {
    data: withEntry(data, entry, { period }),
    flaw: { kind: "impossibleDate", section: sectionOf(entry.list), note: `${nameOf(data, entry)}: ${shown}`, value: shown },
  };
}

/** A whole extra row that looks at home on any CV: "Soft Skills: Being Human". */
function strangeSkill(data: CvData): FlawedCv {
  const skill = pickOne(STRANGE_SKILLS);
  // Tech only picks an icon, and the CV shows skills as text, so any key will do.
  const tech = data.skills[0].skills[0].tech;
  const skills = [...data.skills, { category: "Soft Skills", skills: [{ name: skill, tech }] }];
  return {
    data: { ...data, skills },
    flaw: { kind: "strangeSkill", section: "skills", note: `Soft Skills: ${skill}`, value: skill },
  };
}

/** A project, or an award, that was never there. */
function extraEntry(data: CvData): FlawedCv {
  const awards = data.lists.find((l) => l.category === AWARDS);
  if (awards && Math.random() < 0.25) {
    // Any year from Kiri's first award to her latest entry anywhere, so it never stands out by date alone.
    const awardYears = awards.items.map(yearIn).filter((y) => y !== undefined);
    const allYears = [...data.education, ...data.work, ...data.projects].map((e) => yearIn(e.period ?? "")).filter((y) => y !== undefined);
    const from = Math.min(...awardYears, ...allYears);
    const to = Math.max(...awardYears, ...allYears);
    const year = from + Math.floor(Math.random() * (to - from + 1));
    const item = fakeAward(year);
    // Newest first, like the real list: after every entry from the same year or later.
    const before = awards.items.findIndex((i) => (yearIn(i) ?? Infinity) < year);
    const at = before >= 0 ? before : awards.items.length;
    const items = [...awards.items.slice(0, at), item, ...awards.items.slice(at)];
    const lists = data.lists.map((l) => (l === awards ? { ...l, items } : l));
    const section = SECTIONS.find((s) => s.category === AWARDS)?.id ?? "honors";
    return {
      data: { ...data, lists },
      flaw: { kind: "extraEntry", section, note: `${AWARDS}: ${item}`, value: item },
    };
  }
  const { title, description } = pickOne(FAKE_PROJECTS);
  const newest = data.projects[0];
  const fake = { ...newest, title, description, links: [], tags: newest.tags.slice(0, 1), kind: "Personal" as const };
  // Second place: not the very first thing on the page, but not buried either.
  const projects = [newest, fake, ...data.projects.slice(1)];
  return {
    data: { ...data, projects },
    flaw: { kind: "extraEntry", section: "projects", note: `Projects: ${title}`, value: title },
  };
}

function titleSwap(data: CvData): FlawedCv {
  const index = Math.floor(Math.random() * data.work.length);
  const original = data.work[index].position;
  const position = original.startsWith("Senior ") ? original.replace("Senior ", "") : `Senior ${original.replace(/ Intern$/, "")}`;
  const work = data.work.map((w, i) => (i === index ? { ...w, position } : w));
  return {
    data: { ...data, work },
    flaw: { kind: "titleSwap", section: "experience", note: `${data.work[index].company}: ${position}`, value: position },
  };
}

/** One typo: a letter dropped ("Universty"), two swapped ("Univeristy") or one doubled ("Taipeii"). */
function misspellWord(w: string): string {
  const inside = [...w].map((_, k) => k).filter((k) => k > 0 && k < w.length - 1);
  const typo = pickOne(["drop", "swap", "double"] as const);
  if (typo === "swap") {
    const spots = inside.filter((k) => k < w.length - 2 && w[k] !== w[k + 1]);
    if (spots.length > 0) {
      const k = pickOne(spots);
      return w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2);
    }
  }
  if (typo === "double") {
    const k = pickOne([...inside, w.length - 1]);
    return w.slice(0, k + 1) + w[k] + w.slice(k + 1);
  }
  // Only where it shows: not a letter with a twin beside it.
  const spots = inside.filter((k) => w[k] !== w[k - 1] && w[k] !== w[k + 1]);
  const k = pickOne(spots.length > 0 ? spots : inside);
  return w.slice(0, k) + w.slice(k + 1);
}

function misspellName(name: string): string | undefined {
  const words = name.split(" ");
  const candidates = words.map((w, i) => ({ w, i })).filter(({ w }) => /^[A-Za-z]{6,}$/.test(w));
  if (candidates.length === 0) return undefined;
  const { w, i } = pickOne(candidates);
  words[i] = misspellWord(w);
  return words.join(" ");
}

function misspell(data: CvData): FlawedCv | undefined {
  const entries = datedEntries(data).filter((e) => misspellName(nameOf(data, e)) !== undefined);
  if (entries.length === 0) return undefined;
  const entry = pickOne(entries);
  const name = misspellName(nameOf(data, entry)) ?? nameOf(data, entry);
  return {
    data: withEntry(data, entry, { name }),
    flaw: { kind: "misspell", section: sectionOf(entry.list), note: name, value: name },
  };
}

/** The start moved a month earlier ("Jul 2024" → "Jun 2024") or a year ("Jul 2024" → "Jul 2023"). */
function dateShift(data: CvData): FlawedCv | undefined {
  const byYear = Math.random() < 0.5;
  const entries = datedEntries(data).filter((e) => byYear || !periodOf(data, e).startsWith("Jan "));
  if (entries.length === 0) return undefined;
  const entry = pickOne(entries);
  const original = periodOf(data, entry);
  const period = byYear
    ? original.replace(/^([A-Z][a-z]{2}) (\d{4})/, (_, m: string, y: string) => `${m} ${Number(y) - 1}`)
    : original.replace(/^([A-Z][a-z]{2})/, (m) => MONTHS[MONTHS.indexOf(m) - 1]);
  return {
    data: withEntry(data, entry, { period }),
    flaw: { kind: "dateShift", section: sectionOf(entry.list), note: `${nameOf(data, entry)}: ${startOf(period)}`, value: startOf(period) },
  };
}

const MAKERS: Record<FlawKind, (data: CvData) => FlawedCv | undefined> = {
  impossibleDate,
  strangeSkill,
  extraEntry,
  titleSwap,
  misspell,
  dateShift,
};

/** Falls back to an impossible date if the CV has nothing this kind of flaw can change. */
export function makeFlawed(data: CvData, kind: FlawKind): FlawedCv {
  return MAKERS[kind](data) ?? impossibleDate(data);
}
