import CvHeader from "../cv/CvHeader";
import CvSections from "../cv/CvSections";
import { KIRI_CV, type CvData } from "../cv/data";
import type { Clause } from "./clauses";
import type { RecordState } from "./endings";
import { CLAUSE_TITLE, LETTER_TITLE, RULES, RULES_TITLE, STAMP_FAIL, STAMP_PASS } from "./script";

/** The rulebook tab. Clause 7 appears once XR issues it. */
export function RulesDocument({ clause }: { clause?: Clause }) {
  return (
    <article className="kere xr-doc" lang="zh-Hant">
      <h2 className="kere-section__title">{RULES_TITLE}</h2>
      <ol className="xr-rules">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      {clause && (
        <>
          <h3 className="xr-rules__clause-title">{CLAUSE_TITLE}</h3>
          <ol className="xr-rules" start={RULES.length + 1}>
            <li className="xr-rules__clause">{clause.text}</li>
          </ol>
        </>
      )}
    </article>
  );
}

function Cv({ cv }: { cv: CvData }) {
  return (
    <>
      <CvHeader asDocument />
      <CvSections data={cv} />
    </>
  );
}

/** Kiri's real CV — unless the ending has rewritten or emptied it. */
export function RecordDocument({ record }: { record: RecordState }) {
  return (
    <article className="kere xr-doc">
      {record.type === "kiri" && <Cv cv={KIRI_CV} />}
      {record.type === "overwritten" && <Cv cv={record.cv} />}
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
        <p>{letter}</p>
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
