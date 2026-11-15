import type { FieldFx } from "../cv/CvSections";
import { KIRI_CV } from "../cv/data";
import { SECTIONS } from "../cv/layout";
import { Corrupt, Redact, Struck, type Strength } from "./fx";
import type { Lang } from "./script";
import { chance } from "./seeded";

/** How far gone the documents are: 0 clean, 1–2 with each clause-7 violation, 3 once XR breaks. */
export type DocLevel = 0 | 1 | 2 | 3;

/** Corruption strength by how many times clause 7 has been broken (3 means XR herself has broken). */
export function decayStrength(violations: number, level: DocLevel): Strength {
  if (level === 3) return 4;
  return Math.min(Math.max(violations, 1), 3) as Strength;
}

/**
 * Fields of Kiri's record that may rot. Never a school, company, position, department, or any organisation in the
 * honours, certification, club or community lists: Kiri doesn't want real names defaced. In the clubs list only her
 * own role and the dates may go. Section headings and skill lines may rot too; links and contacts never do.
 */
const MAY_ROT = [
  /^section\.[a-z-]+$/,
  /^skills\.\d+$/,
  /^(education|work)\.\d+\.(date|location)$/,
  /^projects\.\d+\.(title|tags|date|description)$/,
  /^lists\.Clubs & Leadership\.\d+\.(title|date)$/,
];

/** Redaction comes on slowly: some locations, then more, then descriptions; a few of everything else on the way. */
function redacted(field: string, c: number, violations: number, level: DocLevel): boolean {
  // Headings only ever corrupt: a blacked-out heading would just look like a missing section.
  if (field.startsWith("section.")) return false;
  if (level === 3) return c < 0.6;
  if (field.endsWith(".location")) return violations >= 3 || c < (violations >= 2 ? 0.66 : violations >= 1 ? 0.33 : 0);
  if (field.endsWith(".description")) return violations >= 3 ? c < 0.5 : violations >= 2 && c < 0.33;
  return c < (violations >= 3 ? 0.25 : violations >= 2 ? 0.15 : violations >= 1 ? 0.08 : 0);
}

/** Share of the remaining fields that get corrupted. */
function corruptShare(violations: number, level: DocLevel): number {
  if (level === 3) return 0.85;
  if (violations >= 3) return 0.65;
  return violations >= 2 ? 0.5 : violations >= 1 ? 0.3 : 0;
}

interface RecordFxOptions {
  level: DocLevel;
  violations: number;
  /** Changes every round, so a different part rots each time. */
  seed: string;
  /** Fields the reader needs this round (what a fake changed, what clause 7 contradicts): left readable. */
  protect: readonly string[];
  lang: Lang;
  /** Clause 7 is out: even an untouched record shows a "correction" or two, though nothing has changed. */
  uneasy?: boolean;
}

/** Every field of Kiri's record that may rot, named as CvSections names them. */
function rottableFields(protect: readonly string[]): string[] {
  const cv = KIRI_CV;
  const fields = [
    ...SECTIONS.map((s) => `section.${s.id}`),
    ...cv.skills.map((_, i) => `skills.${i}`),
    ...(["education", "work"] as const).flatMap((list) =>
      cv[list].flatMap((e, i) => [`${list}.${i}.date`, ...(e.location ? [`${list}.${i}.location`] : [])]),
    ),
    // Only what's drawn as text: no tags line without tags, no description that's more than a string.
    ...cv.projects.flatMap((p, i) => [
      `projects.${i}.title`,
      `projects.${i}.date`,
      ...(p.tags.length > 0 ? [`projects.${i}.tags`] : []),
      ...(typeof p.description === "string" ? [`projects.${i}.description`] : []),
    ]),
    ...cv.lists.flatMap((l) => l.items.flatMap((_, j) => [`lists.${l.category}.${j}.title`, `lists.${l.category}.${j}.date`])),
  ];
  return fields.filter((f) => !protect.includes(f) && MAY_ROT.some((r) => r.test(f)));
}

/**
 * Before any violation, once clause 7 is out: one or two fields "corrected" to what they already said. Picked from
 * the round's seed, so the same ones every time the record is drawn.
 */
function uneasyFields(seed: string, protect: readonly string[]): Set<string> {
  const count = chance(`${seed}:uneasy`) < 0.5 ? 1 : 2;
  const ranked = rottableFields(protect).sort((a, b) => chance(`${seed}:uneasy:${a}`) - chance(`${seed}:uneasy:${b}`));
  return new Set(ranked.slice(0, count));
}

/** How Kiri's record decays as XR does. Everything the reader needs to judge this round's files stays legible. */
export function recordFx({ level, violations, seed, protect, lang, uneasy = false }: RecordFxOptions): FieldFx {
  const clean = level === 0 && violations === 0;
  const struck = clean && uneasy ? uneasyFields(seed, protect) : undefined;
  return (field, text) => {
    if (clean) return struck?.has(field) ? <Struck text={text} /> : text;
    if (protect.includes(field) || !MAY_ROT.some((r) => r.test(field))) return text;
    // Separate rolls, so which fields are redacted, corrupted and "corrected" don't line up.
    if (redacted(field, chance(`${seed}:redact:${field}`), violations, level)) return <Redact length={text.length} lang={lang} />;
    // Projects hold most of the fields, so each counts for less, or the corruption would bunch up there.
    const share = corruptShare(violations, level) * (field.startsWith("projects.") ? 0.5 : 1);
    if (chance(`${seed}:corrupt:${field}`) < share) {
      return <Corrupt text={text} strength={decayStrength(violations, level)} seed={seed} />;
    }
    // Now and then a field has been "corrected" to exactly what it already said.
    if (chance(`${seed}:strike:${field}`) < 0.08) return <Struck text={text} />;
    return text;
  };
}
