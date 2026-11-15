import type { CvData } from "../cv/data";
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

/** Shared with clause 6, which must quote it exactly. */
export const STRANGE_SKILL = "Being Human";

const FAKE_PROJECTS = ["Kiri Simulator", "Project Human"];

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

function impossibleDate(data: CvData): FlawedCv {
  const entry = pickOne(datedEntries(data));
  const period = periodOf(data, entry).replace(/^([A-Z][a-z]{2}) \d{4}/, "$1 1887");
  return {
    data: withEntry(data, entry, { period }),
    flaw: { kind: "impossibleDate", section: sectionOf(entry.list), note: `${nameOf(data, entry)}: ${startOf(period)}`, value: startOf(period) },
  };
}

function strangeSkill(data: CvData): FlawedCv {
  const [first, ...rest] = data.skills;
  const skills = [{ ...first, skills: [...first.skills, { name: STRANGE_SKILL, tech: first.skills[0].tech }] }, ...rest];
  return {
    data: { ...data, skills },
    flaw: { kind: "strangeSkill", section: "skills", note: `Skills: ${STRANGE_SKILL}`, value: STRANGE_SKILL },
  };
}

function extraEntry(data: CvData): FlawedCv {
  const title = pickOne(FAKE_PROJECTS);
  const newest = data.projects[0];
  const fake = {
    ...newest,
    title,
    description: "A faithful simulation of Kiri, accurate in every detail.",
    links: [],
    tags: newest.tags.slice(0, 1),
    kind: "Personal" as const,
  };
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

/** Drop one letter from a long word, somewhere it shows: "University" → "Universty". */
function misspellName(name: string): string | undefined {
  const words = name.split(" ");
  const candidates = words.map((w, i) => ({ w, i })).filter(({ w }) => /^[A-Za-z]{7,}$/.test(w));
  if (candidates.length === 0) return undefined;
  const { w, i } = pickOne(candidates);
  const spots = [...w].map((_, k) => k).filter((k) => k > 0 && k < w.length - 1 && w[k] !== w[k - 1] && w[k] !== w[k + 1]);
  const k = pickOne(spots);
  words[i] = w.slice(0, k) + w.slice(k + 1);
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

function dateShift(data: CvData): FlawedCv | undefined {
  const entries = datedEntries(data).filter((e) => !periodOf(data, e).startsWith("Jan "));
  if (entries.length === 0) return undefined;
  const entry = pickOne(entries);
  const period = periodOf(data, entry).replace(/^([A-Z][a-z]{2})/, (m) => MONTHS[MONTHS.indexOf(m) - 1]);
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
