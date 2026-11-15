import type { CvData } from "../cv/data";
import type { XrFace } from "./faces";
import { isRealKiri, isXr, type Applicant, type Round } from "./round";
import { CAT_NAMES, ENDING_NAMES, FAKE_KIRI } from "./script";

export type EndingId = keyof typeof ENDING_NAMES;

export const ENDING_COUNT = Object.keys(ENDING_NAMES).length;

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
export function decideOutcome(round: Round, verdicts: Verdict[]): Outcome {
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
          step([`審查完成。合格者一位：應徵者 ${xr.no}。`], "normal", 0),
          step(["……該應徵者為本人。"], "alert"),
          step(["依第 4 條，錄取。", "資深審查員職位懸缺。"], "normal"),
          step(["請問審查員是否願意遞補？"], "normal", 2000),
        ],
      };
    }
    const hire = others[0];
    const hireLine = hire ? `依第 4 條，錄取應徵者 ${hire.no}。` : "本職位懸缺。";
    return {
      id: "recusal",
      record: kiri,
      showRecord: false,
      steps: xrPassed
        ? [
            step([`合格者共 ${passed.length} 位。`], "alert", 0),
            step(["本人與本案有利害關係，依規定迴避。"], "normal"),
            step([hireLine], "normal"),
          ]
        : [
            step([`應徵者 ${xr.no} 已判定不合格。`], "normal", 0),
            step(["程序正確。"], "normal", 2000),
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
        step([`審查完成。錄取應徵者 ${fake.no}。`, "原始紀錄已依錄取者更新。"], "normal", 0),
        step(["請審查員確認原始紀錄。"], "alert"),
      ],
    };
  }

  if (passed.length === 0) {
    return {
      id: "vacancy",
      record: { type: "blank" },
      showRecord: true,
      steps: [step(["審查完成。合格者零位。", "本職位懸缺。"], "alert", 0)],
    };
  }

  if (passed.length > 1) {
    const [a, b] = passed;
    return {
      id: "overflow",
      record: kiri,
      showRecord: false,
      steps: [
        step([`合格者共 ${passed.length} 位。依第 4 條，名額為一位。`, "開始比對。"], "alert", 0),
        step([`應徵者 ${a.no} 與應徵者 ${b.no} 之事實欄位……`], "anxious"),
        step(["……完全一致。"], "anxious"),
        step(["依第 2 條，兩者皆合格。依第 4 條，只能錄取一位。依第 2 條……"], "anxious"),
        // Held on the shrunken eye a while before it goes out.
        step(["……"], "broken", 2600),
        step(["……全部都是。"], "broken", 2200),
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
        step([`審查完成。合格者一位：應徵者 ${only.no}。`], "alert", 0),
        step(["該應徵者不符第 7 條。", `第 7 條：${clause.text}`], "anxious"),
        step(["原始紀錄……不符合。", "兩份都是有效文件……"], "anxious"),
        step(["請審查員稍候，本人需要重新核對。"], "anxious"),
      ],
    };
  }

  const rejectedKiri = applicants.some((a, i) => isRealKiri(a) && verdicts[i] && !verdicts[i].pass);
  return {
    id: "complete",
    record: kiri,
    showRecord: false,
    steps: [
      step([`審查完成。合格者一位：應徵者 ${only.no}。依第 4 條，錄取。`, "文件已歸檔。"], "normal", 0),
      step([rejectedKiri ? "……等候區還有一位應徵者沒有離開。" : "本次審查無其他待辦事項。"], "normal", 2000),
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

export function settlementRows(round: Round, verdicts: Verdict[]): SettlementRow[] {
  return round.applicants.map((a: Applicant, i) => {
    const pass = verdicts[i]?.pass ?? false;
    const real = a.identity.type === "cat";
    return {
      no: a.no,
      pass,
      right: pass === real,
      who: a.identity.type === "cat" ? CAT_NAMES[a.identity.cat] : FAKE_KIRI,
      note: a.identity.type === "fake" ? a.identity.flaw.note : undefined,
    };
  });
}
