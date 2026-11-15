import type { FieldFx } from "../cv/CvSections";
import { Corrupt, Redact, Struck, type Strength } from "./fx";
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
}

/** How Kiri's record decays as XR does. Everything the reader needs to judge this round's files stays legible. */
export function recordFx({ level, violations, seed, protect }: RecordFxOptions): FieldFx {
  return (field, text) => {
    if (level === 0 && violations === 0) return text;
    if (protect.includes(field) || !MAY_ROT.some((r) => r.test(field))) return text;
    // Separate rolls, so which fields are redacted, corrupted and "corrected" don't line up.
    if (redacted(field, chance(`${seed}:redact:${field}`), violations, level)) return <Redact length={text.length} />;
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
