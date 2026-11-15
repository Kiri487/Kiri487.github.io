/* ============================================================
   Everything XR says, and every cover letter. Prototype copy:
   Chinese only for now, all of it still waiting for Kiri's
   review. English comes after the Chinese is settled.
   ============================================================ */

import type { CatId } from "./round";

/** Her full name, on everything official. "XR" is just what the other cats call her. */
export const NAME = "Xrer";

export const FORM = "XR-013";

/** The consent form, before anything frightening happens. */
export const CONSENT_TITLE = `表單 ${FORM}｜人事異常審查程序`;

export const CONSENT = [
  "本程序包含異常內容與輕度心理恐怖要素，不含血腥，也沒有突然的驚嚇畫面。",
  "您隨時可以輸入 exit 轉接回 Kere。",
];

export const START_LABEL = "開始審查";
export const BACK_LABEL = "返回 Kere";

export const BRIEFING = [
  `本人是資深審查員 ${NAME}。今日審查職位：Kiri，名額一位。`,
  "審查員負責初審，逐份判定合格或不合格；錄取由本人於審查完畢後決定。請先閱讀守則。",
];

/** "再審一輪": the same briefing without the introduction. */
export const BRIEFING_AGAIN = ["新一輪審查開始。今日審查職位：Kiri，名額一位。", BRIEFING[1]];

export const RULES_TITLE = "人事異常審查守則";

export const RULES = [
  "僅核對履歷之事實欄位。申請動機不列入評估。",
  "事實欄位須與原始紀錄完全一致，包含日期、名稱與拼字。",
  "原始紀錄中不存在的條目，一律視為偽造。",
  "本職位名額為一位，由資深審查員於全部應徵資料審查完畢後決定。",
  "審查員不得與應徵者交談。",
  "已蓋章之文件不得修改。",
];

export const CLAUSE_TITLE = "補充條款";

export const TAB_RULES = "守則";
export const TAB_RECORD = "原始紀錄";
export const tabApplicant = (no: string) => `應徵者 ${no}`;

export const LETTER_TITLE = "申請動機";

export const FIRST_FILE = "第一份應徵資料。";
export const NEXT_FILE = "下一份。";

/** The visitor's name in the chat log. English will keep Kere's "You". */
export const YOU_LABEL = "審查員";

export const PASS_LABEL = "合格";
export const FAIL_LABEL = "不合格";
export const ASK_LABEL = `詢問 ${NAME}`;

export const STAMPED_PASS = "已蓋章：合格。";
export const STAMPED_FAIL = "已蓋章：不合格。";
export const STAMP_PASS = "合格";
export const STAMP_FAIL = "不合格";

/** A second "合格": not against the rules, just a note. */
export const SECOND_PASS = "已有一位合格者。依第 4 條，最終名額為一位。";

/** Passing someone clause 7 says fails. */
export const VIOLATION_FIRST = "……審查員的判定與第 7 條不符。已記錄。";
export const VIOLATION_AGAIN = "第 7 條是最新條文。最新條文優先適用。最新的……優先。";

export const CLAUSE_ISSUED = ["補充條款已發布，即時生效。請審查員重新閱讀守則第 7 條。", "依第 6 條，已蓋章之文件不受影響。"];

/* ---- 詢問 XR ---- */

export const ASK_GENERIC = "建議逐欄核對日期與名稱。";
export const askSection = (title: string) => `建議核對 ${title}。`;
export const ASK_SELF_JUDGE = "審查員須自行判斷。";
export const ASK_CLAUSE_FAIL = "此應徵者不符第 7 條，建議判定不合格。";
export const ASK_CLAUSE_PASS = "此應徵者符合第 7 條，建議判定合格。";
/** After the visitor has gone against clause 7: she won't discuss whether it could be wrong. */
export const ASK_EVASIVE = "原始紀錄的內容，不在本人的核對範圍內。";
/** Asking XR while her own file is on the desk is asking the applicant. */
export const ASK_XR_FILE = ["……"];

export const UNKNOWN_COMMAND = "該指令不在程序內。";
export const CHOOSE = "請選擇。";
export const ABORTED = "審查中止。";

export const AGAIN_LABEL = "再審一輪";

/* ---- sound (Kere's commands: mute, unmute, 靜音, 閉嘴…) ---- */

export const SFX_ON = "音效已開啟。";
export const SFX_ALREADY_ON = "音效維持開啟。";
export const SFX_OFF = "音效已關閉。";
export const SFX_ALREADY_OFF = "音效維持關閉。";
/** "shut up" / "閉嘴": she complies, and files a note on the wording. */
export const SFX_SHUT_UP = "指令措辭不在程序內。音效已關閉。";
export const SFX_STATUS_ON = "音效目前為開啟狀態。";
export const SFX_STATUS_OFF = "音效目前為關閉狀態。";

/* ---- leaving ---- */

/** Any of these goes back to Kere. Kere's own exit words, plus a few more. */
export const EXIT_PHRASES = ["exit", "leave", "quit", "go back", "back", "end", "離開", "退出", "返回", "結束"];
/** These skip Kere and go straight to Kiri. */
export const KIRI_PHRASES = ["back to kiri", "回kiri", "回到kiri"];

/* ---- endings ---- */

export const ENDING_NAMES = {
  complete: "程序完成",
  ruleFailure: "規則失效",
  overflow: "名額溢出",
  overwrite: "紀錄覆寫",
  vacancy: "職位懸缺",
  recusal: "利益迴避",
  // The rarest, last.
  transfer: "人事異動",
} as const;

export const SETTLEMENT_TITLE = `審查結算｜${FORM}`;
/** "結局 01：程序完成（已解鎖 2/7）". Endings are numbered in the order above. */
export const settlementResult = (no: number, name: string, seen: number, total: number) =>
  `結局 ${String(no).padStart(2, "0")}：${name}（已解鎖 ${seen}/${total}）`;
/** Under the settlement rows: what clause 7 said, and that it was wrong all along. */
export const clauseReveal = (text: string) => `補充條款第 7 條「${text}」與原始紀錄不符。`;

/** Settlement column headings. */
export const SETTLEMENT_HEADINGS = ["複核", "編號", "判定", "實際身分"];
export const FAKE_KIRI = "偽 Kiri";

/* ---- who's who ---- */

export const CAT_NAMES: Record<CatId, string> = {
  kiri: "Kiri",
  kuru: "Kuru",
  kere: "Kere",
  koro: "Koro",
  kara: "Kara",
  xv: "Xvev",
  xh: "Xheh",
  xr: NAME,
  xb: "Xbeb",
  xn: "Xnen",
};

/** Every real Kiri's CV matches the record; their personality only shows here. */
export const CAT_LETTERS: Record<CatId, string> = {
  kiri: "我想做這份工作，因為我對這個職位很有興趣。",
  kuru: "我就是 Kiri，錄不錄取隨你。",
  kere: "隨函附上履歷，敬請審閱。本人具備擔任 Kiri 所需之一切資格，因為本人即是 Kiri。",
  koro: "我也不是特別想要這個職位……只是剛好能力都符合而已。",
  kara: "我的專長是擔任 Kiri，以及說服冰箱投票，另外也很擅長決定午餐吃什麼（雞腿堡！）。",
  xv: "我會在這裡等著，一直一直一直。",
  xh: "……喔，履歷在下面。",
  xr: "致審查員：本人已將履歷與原始紀錄核對三次，均無差異。依第 5 條，審查員不得與應徵者交談。請勿詢問本人意見。",
  xb: "我真的、真的很想要這個位置。請只錄取我，不需要其他人，對吧？",
  xn: "我從第 0 層過來應徵。這裡的燈一直在響，您聽得到嗎？",
};

/** The fakes write the most proper letters of all, with just a little wrong. */
export const FAKE_LETTERS = [
  "我對成為 Kiri 充滿熱忱。過去我已經擔任 Kiri 多年，相信能勝任這份工作。",
  "您好，我是 Kiri。我的履歷與原始紀錄完全相符，期待有機會繼續擔任 Kiri。",
  "感謝您撥冗審閱。我具備 Kiri 應有的一切經歷，也一直很努力地當一個 Kiri。",
  "我是最適合這個職位的 Kiri。我記得 Kiri 的每一件事。",
  "我已詳閱原始紀錄，並將自己調整為完全符合 Kiri 職位所需。",
  "我會比原本的 Kiri 更像 Kiri。",
  "我很適合這個位置。我已經在這個位置很久了，只是您沒有發現。",
  "我熟悉 Kiri 的所有習慣，包括她自己沒有注意到的那些。",
  "如蒙錄取，我將盡力成為 Kiri，並確保成為最好的 Kiri。",
  "我的經歷與 Kiri 相同，我的興趣與 Kiri 相同，以後也會一直相同。",
  "您好。您好。我是 Kiri，很高興認識您。",
  "期待與您共事，我已經知道您的座位在哪裡了。",
];
