import CvHeader from "../cv/CvHeader";
import CvSections, { type FieldFx } from "../cv/CvSections";
import { KIRI_CV, type CvData } from "../cv/data";
import type { Clause } from "./clauses";
import type { RecordState } from "./endings";
import { Fx } from "./fx";
import { decayStrength, type DocLevel } from "./recordFx";
import { chance } from "./seeded";
import { CLAUSE_TITLE, GROWN_CLAUSES, LETTER_TITLE, RULES, RULES_TITLE, STAMP_FAIL, STAMP_PASS } from "./script";

/** Per clause 1–6: the word that gets corrupted or "corrected", and a different word that gets blacked out. */
const RULE_WORDS = [
  { key: "事實欄位", hide: "申請動機" },
  { key: "完全一致", hide: "原始紀錄" },
  { key: "偽造", hide: "條目" },
  { key: "一位", hide: "資深審查員" },
  { key: "交談", hide: "應徵者" },
  { key: "不得修改", hide: "文件" },
];

/** Clauses 1–6 with their decay marked up for <Fx>: struck-and-rewritten words, corrupted words, redactions. */
function decayRule(rule: string, i: number, violations: number, level: DocLevel, seed: string): string {
  if (level === 3) return `{${rule}}`;
  if (violations === 0) return rule;
  const { key, hide } = RULE_WORDS[i];
  let out = rule;
  const roll = (what: string) => chance(`${seed}:rule${i}:${what}`);
  if (violations >= 2) out = out.replace(key, `{${key}}`);
  else if (roll("strike") < 0.3) out = out.replace(key, `~~${key}~~ ${key}`);
  if (violations >= 2 && roll("redact") < (violations >= 3 ? 0.6 : 0.35)) {
    out = out.replace(hide, "█".repeat(hide.length * 2));
  }
  if (violations >= 3 && roll("strike") < 0.5 && !out.includes(`{${key}}`)) out = out.replace(key, `~~${key}~~ ${key}`);
  return out;
}

interface RulesDocumentProps {
  /** Clause 7, once it has appeared. */
  clause?: Clause;
  /** Clauses that grew after it: "7-1", "8"… */
  grown: string[];
  level: DocLevel;
  violations: number;
  /** The round's seed, so the same words rot all round. */
  seed: string;
}

/**
 * The rulebook tab. Clause 7 and the ones after it appear by themselves, and the book rots as XR does. Clause 7 and
 * after are never blacked out: the reader needs them to judge.
 */
export function RulesDocument({ clause, grown, level, violations, seed }: RulesDocumentProps) {
  const strength = decayStrength(violations, level);
  const base = RULES.map((rule, i) => decayRule(rule, i, violations, level, seed));
  // Clause 8 carries its own correction, so it's left as written.
  const later = [
    ...(clause ? [{ no: "7", text: clause.text }] : []),
    ...grown.map((id) => ({ no: id, text: GROWN_CLAUSES[id] })),
  ].map(({ no, text }) => ({ no, text: violations >= 1 || level === 3 ? (text.includes("~~") ? text : `{${text}}`) : text }));
  return (
    <article className="kere xr-doc" lang="zh-Hant">
      <h2 className="kere-section__title">{RULES_TITLE}</h2>
      <ol className="xr-rules">
        {base.map((rule, i) => (
          <li key={i}>
            <Fx text={rule} strength={strength} seed={seed} />
          </li>
        ))}
      </ol>
      {later.length > 0 && (
        <>
          <h3 className="xr-rules__clause-title">{CLAUSE_TITLE}</h3>
          {/* Numbers like "7-1" can't come from <ol>, so they're written out. */}
          <ul className="xr-rules xr-rules--numbered">
            {later.map(({ no, text }) => (
              <li key={no}>
                {/* Clause 7 has to stay readable to judge by, so it never gets more than a light touch. */}
                <span className="xr-rules__no">{no}.</span> <Fx text={text} strength={no === "7" ? 1 : strength} seed={seed} />
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function Cv({ cv, fx }: { cv: CvData; fx?: FieldFx }) {
  return (
    <>
      <CvHeader asDocument />
      <CvSections data={cv} fx={fx} />
    </>
  );
}

/** Kiri's real CV — rotting as XR does, and in some endings rewritten or emptied. */
export function RecordDocument({ record, fx }: { record: RecordState; fx: FieldFx }) {
  return (
    <article className="kere xr-doc">
      {record.type === "kiri" && <Cv cv={KIRI_CV} fx={fx} />}
      {record.type === "overwritten" && <Cv cv={record.cv} fx={fx} />}
      {record.type === "blank" && <div className="xr-doc__blank" />}
    </article>
  );
}

interface ApplicantDocumentProps {
  cv: CvData;
  letter: string;
  /** The visitor's stamp, once given. */
  pass?: boolean;
}

/** One application: the cover letter on top, then the CV, laid out exactly like the real one. */
export function ApplicantDocument({ cv, letter, pass }: ApplicantDocumentProps) {
  return (
    <article className="kere xr-doc">
      <section className="kere-section xr-letter" lang="zh-Hant">
        <h2 className="kere-section__title">{LETTER_TITLE}</h2>
        <p>
          <Fx text={letter} strength={1} />
        </p>
      </section>
      {/* The stamp goes on the CV itself, level with the name. */}
      <div className="xr-doc__cv-head">
        {pass !== undefined && (
          <div className="xr-stamp" lang="zh-Hant">
            {pass ? STAMP_PASS : STAMP_FAIL}
          </div>
        )}
        <CvHeader asDocument />
      </div>
      <CvSections data={cv} />
    </article>
  );
}
