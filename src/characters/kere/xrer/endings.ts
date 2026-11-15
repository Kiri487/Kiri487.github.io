import type { CvData } from "../cv/data";
import type { XrFace } from "./faces";
import { isRealKiri, isXr, type Applicant, type Round } from "./round";
import { CAT_NAMES, COPY, ENDING_IDS, type EndingId, type Lang } from "./script";

export type { EndingId };

export const ENDING_COUNT = ENDING_IDS.length;

/** The visitor's stamp on one file. */
export interface Verdict {
  pass: boolean;
  /** Stamped after clause 7 was issued. */
  afterClause: boolean;
}

/** One message in XR's closing, shown `delay` ms after the previous one. */
export interface Step {
  lines: string[];
  face: XrFace;
  delay: number;
}

/** What the 原始紀錄 tab shows once the review is over. */
export type RecordState = { type: "kiri" } | { type: "overwritten"; cv: CvData } | { type: "blank" };

export interface Outcome {
  id: EndingId;
  steps: Step[];
  record: RecordState;
  /** Point the visitor at the 原始紀錄 tab at the end. */
  showRecord: boolean;
}

const PAUSE = 1600;

function step(lines: string[], face: XrFace, delay = PAUSE): Step {
  return { lines, face, delay };
}

/** Which ending a finished round lands on. Order matters: see the plan's priority list. */
export function decideOutcome(round: Round, verdicts: Verdict[], lang: Lang): Outcome {
  const t = COPY[lang];
  const { applicants, clause } = round;
  const passed = applicants.filter((_, i) => verdicts[i]?.pass);
  const xr = applicants.find(isXr);
  const kiri: RecordState = { type: "kiri" };

  if (xr) {
    const others = passed.filter((a) => a !== xr);
    const xrPassed = passed.includes(xr);
    if (xrPassed && others.length === 0) {
      return {
        id: "transfer",
        record: kiri,
        showRecord: false,
        steps: [
          step([t.onePassed(xr.no)], "normal", 0),
          step([t.IS_ME], "alert"),
          step([t.HIRED, t.SENIOR_VACANT], "normal"),
          step([t.FILL_IT], "normal", 2000),
        ],
      };
    }
    const hire = others[0];
    const hireLine = hire ? t.hire(hire.no) : t.VACANT;
    return {
      id: "recusal",
      record: kiri,
      showRecord: false,
      steps: xrPassed
        ? [
            step([t.passedCount(passed.length)], "alert", 0),
            step([t.RECUSE], "normal"),
            step([hireLine], "normal"),
          ]
        : [
            step([t.markedFail(xr.no)], "normal", 0),
            step([t.PROCEDURE_CORRECT], "normal", 2000),
            step([hireLine], "normal"),
          ],
    };
  }

  const fake = passed.find((a) => !isRealKiri(a));
  if (fake) {
    return {
      id: "overwrite",
      record: { type: "overwritten", cv: fake.cv },
      showRecord: true,
      steps: [
        step([t.hiredFake(fake.no), t.RECORD_UPDATED], "normal", 0),
        step([t.CHECK_RECORD], "alert"),
      ],
    };
  }

  if (passed.length === 0) {
    return {
      id: "vacancy",
      record: { type: "blank" },
      showRecord: true,
      steps: [step(t.NONE_PASSED, "alert", 0)],
    };
  }

  if (passed.length > 1) {
    const [a, b] = passed;
    return {
      id: "overflow",
      record: kiri,
      showRecord: false,
      steps: [
        step([t.passedCount(passed.length), ...t.ONE_OPENING], "alert", 0),
        step([t.sameFields(a.no, b.no)], "anxious"),
        step([t.IDENTICAL], "anxious"),
        step([t.ARTICLE_LOOP], "anxious"),
        // Held on the shrunken eye a while before it goes out; then the one time she says "I", not "this Senior Reviewer".
        step([t.CANT_TELL], "broken", 2600),
        step([t.ALL_OF_THEM], "broken", 2200),
      ],
    };
  }

  const only = passed[0];
  const onlyIndex = applicants.indexOf(only);
  if (verdicts[onlyIndex]?.afterClause) {
    return {
      id: "ruleFailure",
      record: kiri,
      showRecord: false,
      steps: [
        step([t.onePassed(only.no)], "alert", 0),
        step([t.NOT_ARTICLE_7, t.article7(clause.text[lang])], "anxious"),
        step(t.RECORD_DISAGREES, "anxious"),
        step([t.CHECK_AGAIN], "anxious"),
      ],
    };
  }

  const rejectedKiri = applicants.some((a, i) => isRealKiri(a) && verdicts[i] && !verdicts[i].pass);
  return {
    id: "complete",
    record: kiri,
    showRecord: false,
    steps: [
      step([`${t.onePassed(only.no)}${lang === "zh" ? "" : " "}${t.HIRED}`, t.ARCHIVED], "normal", 0),
      step([rejectedKiri ? t.WAITING : t.NOTHING_FURTHER], "normal", 2000),
    ],
  };
}

/** One settlement row per applicant. */
export interface SettlementRow {
  no: string;
  pass: boolean;
  /** Did the visitor judge them right? */
  right: boolean;
  /** Who they really were. */
  who: string;
  /** For a fake: what gave them away. */
  note?: string;
}

export function settlementRows(round: Round, verdicts: Verdict[], lang: Lang): SettlementRow[] {
  return round.applicants.map((a: Applicant, i) => {
    const pass = verdicts[i]?.pass ?? false;
    const real = a.identity.type === "cat";
    return {
      no: a.no,
      pass,
      right: pass === real,
      who: a.identity.type === "cat" ? CAT_NAMES[a.identity.cat] : COPY[lang].FAKE_KIRI,
      note: a.identity.type === "fake" ? a.identity.flaw.note : undefined,
    };
  });
}
