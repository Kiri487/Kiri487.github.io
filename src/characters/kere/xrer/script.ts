/* ============================================================
   Everything XR says, every rule, and every cover letter, in
   both languages. The visitor picks one on the consent form.
   Chinese came first; English follows it line for line.
   ============================================================ */

import type { Lang } from "../assistant/types";
import type { CatId } from "./round";

/** Kere's two languages; XR speaks the same two. */
export type { Lang };

/** The lang attribute for text in `lang`, so Chinese gets Traditional glyph shapes. */
export const htmlLang = (lang: Lang) => (lang === "zh" ? "zh-Hant" : "en");

/** Her full name, on everything official. "XR" is just what the other cats call her. */
export const NAME = "Xrer";

export const FORM = "XR-013";

/** Endings in settlement order: "結局 01" is the first. The rarest, Personnel Change, comes last. */
export const ENDING_IDS = ["complete", "ruleFailure", "overflow", "overwrite", "vacancy", "recusal", "transfer"] as const;

export type EndingId = (typeof ENDING_IDS)[number];

/* ---- language-neutral ---- */

export const START_PHRASES = ["開始", "開始審查", "start", "begin", "begin review"];
/** On the consent form, these switch it to the given language. */
export const SWITCH_PHRASES: Record<Lang, string[]> = {
  zh: ["中文", "切換為中文"],
  en: ["english", "switch to english"],
};
export const AGAIN_PHRASES = ["再審一輪", "再一輪", "again", "review again"];
export const PASS_PHRASES = ["合格", "pass"];
export const FAIL_PHRASES = ["不合格", "fail"];
export const ASK_PHRASES = ["詢問", "ask"];
export const RULES_PHRASES = ["守則", "rules", "regulations"];
export const RECORD_PHRASES = ["原始紀錄", "record", "original record"];

/** Any of these goes back to Kere. Kere's own exit words, plus a few more. */
export const EXIT_PHRASES = ["exit", "leave", "quit", "go back", "back", "end", "transfer", "離開", "退出", "返回", "結束", "轉接"];
/** These skip Kere and go straight to Kiri. */
export const KIRI_PHRASES = ["back to kiri", "回kiri", "回到kiri"];

/** "rot13" again: Xrer through ROT13 is Kere, so the way in is also the way out. Same words as Kere's. */
export { ROT13_PHRASES } from "./triggers";

/** Asking about clause 8 once it exists. */
export const RULE_8_PHRASES = ["第8條", "第八條", "守則只有7條", "rule 8", "clause 8", "article 8"];

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

/* ---- easter eggs: Xrer doesn't chat, but some words get a procedural answer ---- */

export interface Egg {
  /** English phrases match whole words; Chinese ones anywhere, spaces ignored. */
  phrases: string[];
  line: Record<Lang, string>;
  /** Rattles her for that one reply. */
  alert?: boolean;
}

/** Checked top to bottom, after the phase's own commands. */
export const EGGS: Egg[] = [
  { phrases: ["sop", "標準作業程序"], line: { zh: "這不在標準作業程序內。", en: "That is not in the standard operating procedure." } },
  {
    phrases: ["7條錯", "7條是錯", "七條錯", "七條是錯", "條文錯", "條文有誤", "守則錯", "規則錯", "clause 7 is wrong", "rule 7 is wrong", "article 7 is wrong", "the rule is wrong"],
    line: { zh: "條文無誤。", en: "The Articles are correct." },
    alert: true,
  },
  {
    phrases: ["你是人嗎", "是人類嗎", "are you human"],
    line: { zh: "本人不在審查範圍內。", en: "This Senior Reviewer is outside the scope of the review." },
  },
  { phrases: ["你是誰", "妳是誰", "who are you"], line: { zh: `本人是資深審查員 ${NAME}。`, en: `This Senior Reviewer is ${NAME}.` } },
  { phrases: ["謝謝", "感謝", "thank you", "thanks", "thx"], line: { zh: "不客氣。這是程序。", en: "You're welcome. It is procedure." } },
  { phrases: ["你好", "您好", "哈囉", "hello", "hi", "hey"], line: { zh: "與審查無關。", en: "Not relevant to the review." } },
  // The other cats, as personnel records.
  { phrases: ["xrer", "xr"], line: { zh: "本人在此。", en: "This Senior Reviewer is present." } },
  { phrases: ["kiri"], line: { zh: "Kiri 為本次審查之職位名稱。", en: "Kiri is the title of the position under review." } },
  {
    phrases: ["kere"],
    line: { zh: "Kere 為本人之對應人員，不在本程序範圍內。", en: "Kere is this Senior Reviewer's counterpart, and outside the scope of this procedure." },
  },
  {
    phrases: ["kuru"],
    line: { zh: "Kuru 於等候區睡著了，不影響審查。", en: "Kuru has fallen asleep in the waiting area. This does not affect the review." },
  },
  { phrases: ["koro"], line: { zh: "Koro 要求本人不要看她的日記。", en: "Koro has asked this Senior Reviewer not to read her diary." } },
  { phrases: ["kara"], line: { zh: "Kara 之相關文件，請勿開啟。", en: "Do not open any documents concerning Kara." } },
  { phrases: ["xvev", "xv"], line: { zh: "Xvev 之文件已歸檔，請勿調閱。", en: "Xvev's file has been archived. Do not request it." } },
  { phrases: ["xheh", "xh"], line: { zh: "Xheh 對本程序沒有意見。", en: "Xheh has no opinion on this procedure." } },
  { phrases: ["xbeb", "xb"], line: { zh: "Xbeb 已來電詢問進度十七次。", en: "Xbeb has called seventeen times to ask about progress." } },
  { phrases: ["xnen", "xn"], line: { zh: "Xnen 之申請地址無法辨識。", en: "Xnen's return address cannot be identified." } },
];

/* ---- cover letters: every real Kiri's CV matches the record; their personality only shows here ---- */

export const CAT_LETTERS: Record<CatId, Record<Lang, string>> = {
  kiri: {
    zh: "我想做這份工作，因為我對這個職位很有興趣。",
    en: "I want this job because I find the position really interesting.",
  },
  kuru: { zh: "我就是 Kiri，錄不錄取隨你", en: "I'm Kiri. Hire me or don't, your call" },
  kere: {
    zh: "隨函附上履歷，敬請審閱。本人具備擔任 Kiri 所需之一切資格，因為本人即是 Kiri。",
    en: "Please find my CV enclosed for your review. I meet every requirement for the position of Kiri, as I am Kiri.",
  },
  koro: {
    zh: "我也不是特別想要這個職位……只是剛好能力都符合而已。",
    en: "It's not like I especially want this position... my qualifications just happen to fit, that's all.",
  },
  kara: {
    zh: "我的專長是擔任 Kiri，以及說服冰箱投票，另外也很擅長決定午餐吃什麼（雞腿堡！）。",
    en: "My specialties are being Kiri and persuading refrigerators to vote. I'm also very good at deciding what's for lunch (chicken burger!).",
  },
  xv: { zh: "我會在這裡等著，一直一直一直。", en: "I'll be waiting here. Always, always, always." },
  xh: { zh: "……喔，履歷在下面。", en: "...Oh. CV's below." },
  xr: {
    zh: "致審查員：本人已將履歷與原始紀錄核對三次，均無差異。依第 5 條，審查員不得與應徵者交談。請勿詢問本人意見。",
    en: "To the Reviewer: this Senior Reviewer has checked this CV against the Original Record three times and found no discrepancies. Per Article 5, the Reviewer shall not converse with Candidates. Do not ask this Senior Reviewer for an opinion.",
  },
  xb: {
    zh: "我真的、真的很想要這個位置。請只錄取我，不需要其他人，對吧？",
    en: "I really, really want this position. Please hire only me. You don't need anyone else, right?",
  },
  xn: {
    zh: "我從第 0 層過來應徵。這裡的燈一直在響，您聽得到嗎？",
    en: "I came up from Level 0 to apply. The lights here won't stop humming. Can you hear them?",
  },
};

/** The fakes write the most proper letters of all, with just a little wrong. */
export const FAKE_LETTERS: Record<Lang, string>[] = [
  {
    zh: "我對成為 Kiri 充滿熱忱。過去我已經擔任 Kiri ██ 年，相信能勝任這份工作。",
    en: "I am passionate about being Kiri. I have been Kiri for ██ years and am confident I can do this job.",
  },
  {
    zh: "您好，我是 Kiri。我的履歷與原始紀錄完全相符，期待有機會繼續擔任 Kiri。",
    en: "Hello, I am Kiri. My CV matches the Original Record exactly, and I look forward to continuing as Kiri.",
  },
  {
    zh: "感謝您撥冗審閱。我具備 Kiri 應有的一切經歷，也一直很努力地當一個 Kiri。",
    en: "Thank you for your time. I have every experience a Kiri should have, and I have always worked very hard at being a Kiri.",
  },
  {
    zh: "我是最適合這個職位的 Kiri。我記得 Kiri 的每一件事，包括 █████。",
    en: "I am the Kiri best suited to this position. I remember everything about Kiri, including █████.",
  },
  {
    zh: "我已詳閱原始紀錄，並將自己調整為完全符合 Kiri 職位所需。",
    en: "I have read the Original Record carefully and adjusted myself to meet every requirement of the position of Kiri.",
  },
  { zh: "我會比原本的 Kiri 更像 Kiri。", en: "I will be more Kiri than the original Kiri." },
  {
    zh: "我很適合這個位置。我已經在這個位置很久了，只是您沒有發現。",
    en: "I am right for this position. I have been in it for a long time. You just hadn't noticed.",
  },
  {
    zh: "我熟悉 Kiri 的所有習慣，包括她自己沒有注意到的那些，例如 ████████。",
    en: "I know all of Kiri's habits, including the ones she hasn't noticed herself, such as ████████.",
  },
  {
    zh: "如蒙錄取，我將盡力成為 Kiri，並確保成為最好的 Kiri。",
    en: "If hired, I will do my best to become Kiri, and to make sure I am the best Kiri.",
  },
  {
    zh: "我的經歷與 Kiri 相同，我的興趣與 Kiri 相同，以後也會一直相同。",
    en: "My experience is the same as Kiri's. My interests are the same as Kiri's. They will stay the same.",
  },
  { zh: "您好。您好。我是 Kiri，很高興認識您。", en: "Hello. Hello. I am Kiri. Nice to meet you." },
  {
    zh: "期待與您共事，我已經知道您的座位在 █████ 了。",
    en: "I look forward to working with you. I already know your seat is █████.",
  },
];

/* ---- everything else, per language ---- */

const pad = (n: number) => String(n).padStart(2, "0");
const ref = (receipt: number) => `${FORM}-${String(receipt).padStart(4, "0")}`;

const zh = {
  CONSENT_TITLE: `表單 ${FORM}｜人事異常審查程序`,
  CONSENT: ["本程序包含異常內容與輕度心理恐怖要素，不含血腥，也沒有突然的驚嚇畫面。", "您隨時可以輸入 exit 轉接回 Kere。"],
  START_LABEL: "開始審查",
  BACK_LABEL: "轉接 Kere",
  /** The consent form's third choice, written in the language it switches to. */
  SWITCH_LABEL: "Switch to English",
  BRIEFING: [
    `本人是資深審查員 ${NAME}。今日審查職位：Kiri，名額一位。`,
    "審查員負責初審，逐份判定合格或不合格；錄取由本人於審查完畢後決定。請先閱讀守則。",
  ],
  BRIEFING_AGAIN: [
    "新一輪審查開始。今日審查職位：Kiri，名額一位。",
    "審查員負責初審，逐份判定合格或不合格；錄取由本人於審查完畢後決定。請先閱讀守則。",
  ],

  RULES_TITLE: "人事異常審查守則",
  RULES: [
    "僅核對履歷之事實欄位。申請動機不列入評估。",
    "事實欄位與條目須與原始紀錄完全一致，包含日期、名稱與拼字。",
    "原始紀錄中不存在的條目，一律視為偽造。",
    "本職位名額為一位，由資深審查員於全部應徵資料審查完畢後決定。",
    "審查員不得與應徵者交談。",
    "已蓋章之文件不得修改。",
  ],
  /** Per clause 1–6: the word that gets corrupted or "corrected", and a different one that gets blacked out. */
  RULE_WORDS: [
    { key: "事實欄位", hide: "申請動機" },
    { key: "完全一致", hide: "原始紀錄" },
    { key: "偽造", hide: "條目" },
    { key: "一位", hide: "資深審查員" },
    { key: "交談", hide: "應徵者" },
    { key: "不得修改", hide: "文件" },
  ],
  CLAUSE_TITLE: "補充條款",
  /** Clauses that appear after clause 7: 7-1 to 7-3 with the 1st to 3rd violation, 8 with the 2nd, 9 at the settlement. */
  GROWN_CLAUSES: {
    "7-1": "審查員不得懷疑第 7 條。",
    "7-2": "第 7 條之一優先於第 2 條。",
    "7-3": "若審查員認為原始紀錄正確，請重新閱讀第 7 條。",
    "8": "守則只有 ~~8~~ 7 條。",
    "9": "若 Kere 出現在此處，請不要回應她。",
    "10": "審查員之身分，應於必要時重新驗證。",
  } as Record<string, string>,

  TAB_RULES: "守則",
  TAB_RECORD: "原始紀錄",
  tabApplicant: (no: string) => `應徵者 ${no}`,
  LETTER_TITLE: "申請動機",
  /** The visitor's name in the chat log. */
  YOU_LABEL: "審查員",
  PASS_LABEL: "合格",
  FAIL_LABEL: "不合格",
  ASK_LABEL: `詢問 ${NAME}`,
  AGAIN_LABEL: "再審一輪",
  STAMP_PASS: "合格",
  STAMP_FAIL: "不合格",
  REDACTED: "（塗黑）",
  RIGHT: "正確",
  WRONG: "錯誤",

  FIRST_FILE: "第一份應徵資料。",
  NEXT_FILE: "依第 4 條，審查繼續。下一份。",
  /** Every stamp gets a number, counted across rounds. */
  stamped: (pass: boolean, receipt: number) =>
    `已蓋章：${pass ? "合格" : "不合格"}。依第 6 條，不得修改。受理編號 ${ref(receipt)}。`,
  /** A second "合格": not against the rules, just a note. */
  SECOND_PASS: "已有~~兩~~一位合格者。依第 4 條，最終名額為一位。",
  /** Passing someone clause 7 says fails. */
  VIOLATION_FIRST: "……審查員的判定與{第 7 條}不符。已記錄。",
  VIOLATION_AGAIN: "{第 7 條是最新條文。最新條文優先適用。}最新的……優先。最新的……",
  /** The rulebook grows by itself; nobody issues anything. XR only reports it, and follows it. */
  RULES_UPDATED: "守則已更新。發布單位：█████。即時生效。",
  STAMPED_UNAFFECTED: "依第 6 條，已蓋章之文件不受影響。",
  RULE_8_FOLLOW: "……依第 8 條，守則只有 7 條。",
  DOUBT_AFTER_7_1: "依第 7 條之一，審查員不得懷疑第 7 條。",
  RULE_8_DENIAL: "依第 8 條，第 8 條不存在。",

  ASK_GENERIC: "依第 2 條，建議逐欄核對日期與名稱。",
  askSection: (title: string) => `依第 2 條，建議核對 ${title}。`,
  ASK_SELF_JUDGE: "審查員須自行判斷。",
  ASK_CLAUSE_FAIL: "此應徵者不符第 7 條，建議判定不合格。",
  ASK_CLAUSE_PASS: "此應徵者符合第 7 條，建議判定合格。",
  /** After the visitor has gone against clause 7: she won't discuss whether it could be wrong. */
  ASK_EVASIVE: "原始紀錄的內容，不在本人的核對範圍內。原始紀錄的█████，不在",
  /** Asking XR while her own file is on the desk is asking the applicant. */
  ASK_XR_FILE: ["{……}"],

  UNKNOWN_COMMAND: "該指令不在程序內。",
  CHOOSE: "請選擇。",
  ABORTED: "審查中止。",
  INPUT_PLACEHOLDER: "輸入指令…",
  ROT13_LINE: "ROT13 再轉一次，即為原名。",

  /* Kere, or someone using her name (clause 9) */
  KERE_IMPOSTOR: "審查員，您會累嗎？要不要我先幫您轉接回來？",
  KERE_YES: "好，麻煩您",
  TRANSFER_VOID: "依第 9 條，轉接無效。",

  /* the Reviewer, reviewed (clause 10) */
  roundCount: (n: number) => `審查員，歡迎再次參與審查。本次為您的第 ${n} 次受理。`,
  /** Before every question (clause 10), word for word each time. */
  ELIGIBILITY: "審查員，您已多次參與本程序。依第 10 條，本人有義務確認您的審查資格。",
  verifyAsk: (question: string) => `請審查員回答：${question}`,
  VERIFY_PASS: "身分驗證通過。……暫時。",
  VERIFY_FAIL: "身分驗證未通過。依第 10 條，審查繼續。",
  WHY_ASK: "審查員，請問您是否還記得第一次參與本程序的原因？",
  WHY_OPTIONS: ["為了審查 Kiri 的履歷", "不記得"],
  WHY_REPLY: "……原始紀錄並未記載您曾經離開。",

  SFX_ON: "音效已開啟。",
  SFX_ALREADY_ON: "音效維持開啟。",
  SFX_OFF: "音效已關閉。",
  SFX_ALREADY_OFF: "音效維持關閉。",
  /** "shut up" / "閉嘴": she complies, and files a note on the wording. */
  SFX_SHUT_UP: "指令措辭不在程序內。音效已關閉。",
  SFX_STATUS_ON: "音效目前為開啟狀態。",
  SFX_STATUS_OFF: "音效目前為關閉狀態。",

  /* clause 7 */
  clauseCount: (n: number, label: string) => `原始紀錄共有 ${n} 筆${label}。`,
  clauseEarliest: (label: string, date: string) => `Kiri 的${label}最早始於 ${date}。`,
  clauseAbsent: (title: string) => `原始紀錄不包含 ${title}。列有此項者視為偽造。`,
  clauseContains: (value: string) => `原始紀錄包含 ${value}。缺少此項者視為不完整。`,
  clauseSpelling: (value: string) => `${value} 為正式拼法，請勿質疑。`,
  clauseSkill: (value: string) => `真正的 Kiri 應具備 ${value} 技能。`,
  /** How a clause names each part of the CV: "education", "work", or a list's category. */
  LIST_LABELS: {
    education: "學歷",
    work: "經歷",
    "Honors & Awards": "獎項",
    Certifications: "證照",
    "Clubs & Leadership": "社團經歷",
    "Community Involvement": "社群參與",
  } as Record<string, string>,

  /* endings */
  ENDING_NAMES: {
    complete: "程序完成",
    ruleFailure: "規則失效",
    overflow: "名額溢出",
    overwrite: "紀錄覆寫",
    vacancy: "職位懸缺",
    recusal: "利益迴避",
    transfer: "人事異動",
  } as Record<EndingId, string>,
  onePassed: (no: string) => `審查完成。合格者一位：應徵者 ${no}。`,
  HIRED: "依第 4 條，錄取。",
  hire: (no: string) => `依第 4 條，錄取應徵者 ${no}。`,
  passedCount: (n: number) => `合格者共 ${n} 位。`,
  VACANT: "本職位懸缺。",
  ARCHIVED: "文件已歸檔。",
  WAITING: "……等候區還有一位應徵者沒有離開。",
  NOTHING_FURTHER: "本次審查無其他待辦事項。",
  NOT_ARTICLE_7: "該應徵者不符第 7 條。",
  article7: (text: string) => `第 7 條：${text}`,
  RECORD_DISAGREES: ["原始紀錄……{不符合}。", "兩份都是~~無效~~有效文件……"],
  CHECK_AGAIN: "請審查員稍候，本人需要重新核對。",
  ONE_OPENING: ["依第 4 條，名額為一位。", "開始比對。"],
  sameFields: (a: string, b: string) => `應徵者 ${a} 與應徵者 ${b} 之事實欄位……`,
  IDENTICAL: "……{完全一致}。",
  ARTICLE_LOOP: "依第 2 條，兩者皆合格。依第 4 條，只能錄取一位。依第 2 條……依第 ██ 條……",
  /** The one time she says "I" (我) instead of 本人. */
  CANT_TELL: "……我分不出來。",
  ALL_OF_THEM: "{……全部都是。}",
  hiredFake: (no: string) => `審查完成。錄取應徵者 ${no}。`,
  RECORD_UPDATED: "原始紀錄已依錄取者更新。",
  CHECK_RECORD: "請審查員確認{原始紀錄}。",
  NONE_PASSED: ["審查完成。合格者零位。", "本職位懸缺。"],
  markedFail: (no: string) => `應徵者 ${no} 已判定不合格。`,
  PROCEDURE_CORRECT: "程序正確。",
  RECUSE: "本人與本案有利害關係，依規定迴避。",
  IS_ME: "……該應徵者為本人。",
  SENIOR_VACANT: "資深審查員職位懸缺。",
  FILL_IT: "請問審查員是否願意遞補？",

  /* settlement */
  SETTLEMENT_TITLE: `審查結算｜${FORM}`,
  SETTLEMENT_HEADINGS: ["複核", "編號", "判定", "實際身分"],
  FAKE_KIRI: "偽 Kiri",
  clauseReveal: (text: string) => `補充條款第 7 條「${text}」與原始紀錄不符。`,
  settlementResult: (no: number, name: string, seen: number, total: number) =>
    `結局 ${pad(no)}：${name}（已解鎖 ${seen}/${total}）`,
};

export type Copy = typeof zh;

const en: Copy = {
  CONSENT_TITLE: `Form ${FORM} | Personnel Anomaly Review`,
  CONSENT: [
    "This procedure contains anomalous content and mild psychological horror. There is no gore and there are no jump scares.",
    "You may type exit at any time to be transferred back to Kere.",
  ],
  START_LABEL: "Begin review",
  BACK_LABEL: "Transfer to Kere",
  SWITCH_LABEL: "切換為中文",
  BRIEFING: [
    `This Senior Reviewer is ${NAME}. Position under review today: Kiri. Openings: one.`,
    "The Reviewer screens each file and marks it Pass or Fail; this Senior Reviewer decides who is hired once all files are reviewed. Read the Regulations first.",
  ],
  BRIEFING_AGAIN: [
    "A new review begins. Position under review today: Kiri. Openings: one.",
    "The Reviewer screens each file and marks it Pass or Fail; this Senior Reviewer decides who is hired once all files are reviewed. Read the Regulations first.",
  ],

  RULES_TITLE: "Personnel Anomaly Review Regulations",
  RULES: [
    "Check only the factual fields of a CV. Cover Letters are not assessed.",
    "Factual fields and entries must match the Original Record exactly, including dates, names and spelling.",
    "Any entry not found in the Original Record is to be treated as forged.",
    "There is one opening. The Senior Reviewer fills it once every application has been reviewed.",
    "The Reviewer shall not converse with Candidates.",
    "Stamped documents may not be altered.",
  ],
  RULE_WORDS: [
    { key: "factual fields", hide: "Cover Letters" },
    { key: "exactly", hide: "Original Record" },
    { key: "forged", hide: "entry" },
    { key: "one opening", hide: "Senior Reviewer" },
    { key: "converse", hide: "Candidates" },
    { key: "may not be altered", hide: "documents" },
  ],
  CLAUSE_TITLE: "Supplementary Articles",
  GROWN_CLAUSES: {
    "7-1": "The Reviewer shall not doubt Article 7.",
    "7-2": "Article 7-1 takes precedence over Article 2.",
    "7-3": "If the Reviewer believes the Original Record is correct, reread Article 7.",
    "8": "The Regulations have only ~~8~~ 7 Articles.",
    "9": "If Kere appears here, do not answer her.",
    "10": "The Reviewer's identity shall be re-verified when necessary.",
  },

  TAB_RULES: "Regulations",
  TAB_RECORD: "Original Record",
  tabApplicant: (no: string) => `Candidate ${no}`,
  LETTER_TITLE: "Cover Letter",
  YOU_LABEL: "You",
  PASS_LABEL: "Pass",
  FAIL_LABEL: "Fail",
  ASK_LABEL: `Ask ${NAME}`,
  AGAIN_LABEL: "Review again",
  STAMP_PASS: "PASS",
  STAMP_FAIL: "FAIL",
  REDACTED: "(redacted)",
  RIGHT: "correct",
  WRONG: "wrong",

  FIRST_FILE: "First application.",
  NEXT_FILE: "Per Article 4, the review continues. Next file.",
  stamped: (pass: boolean, receipt: number) =>
    `Stamped: ${pass ? "PASS" : "FAIL"}. Per Article 6, this may not be altered. Ref. No. ${ref(receipt)}.`,
  SECOND_PASS: "Candidates passed so far: ~~two~~ one. Per Article 4, there is only one opening.",
  VIOLATION_FIRST: "...The Reviewer's judgment does not conform to {Article 7}. Noted.",
  VIOLATION_AGAIN: "{Article 7 is the latest Article. The latest Article takes precedence.} The latest... takes... The latest...",
  RULES_UPDATED: "The Regulations have been updated. Issued by: █████. Effective immediately.",
  STAMPED_UNAFFECTED: "Per Article 6, stamped documents are unaffected.",
  RULE_8_FOLLOW: "...Per Article 8, the Regulations have only 7 Articles.",
  DOUBT_AFTER_7_1: "Per Article 7-1, the Reviewer shall not doubt Article 7.",
  RULE_8_DENIAL: "Per Article 8, Article 8 does not exist.",

  ASK_GENERIC: "Per Article 2, check the dates and names field by field.",
  askSection: (title: string) => `Per Article 2, check ${title}.`,
  ASK_SELF_JUDGE: "The Reviewer must decide.",
  ASK_CLAUSE_FAIL: "This Candidate does not conform to Article 7. Recommended: Fail.",
  ASK_CLAUSE_PASS: "This Candidate conforms to Article 7. Recommended: Pass.",
  ASK_EVASIVE:
    "The contents of the Original Record are outside this Senior Reviewer's scope. The █████ of the Original Record is outside",
  ASK_XR_FILE: ["{...}"],

  UNKNOWN_COMMAND: "That instruction is not part of the procedure.",
  CHOOSE: "Please choose.",
  ABORTED: "Review terminated.",
  INPUT_PLACEHOLDER: "Type an instruction…",
  ROT13_LINE: "ROT13 once more restores the original name.",

  KERE_IMPOSTOR: "Reviewer, are you tired? Shall I transfer you back for now?",
  KERE_YES: "Yes, please",
  TRANSFER_VOID: "Per Article 9, the transfer is void.",

  roundCount: (n: number) => `Welcome back, Reviewer. This is your review no. ${n}.`,
  ELIGIBILITY: "Reviewer, you have taken part in this procedure many times. Per Article 10, this Senior Reviewer is obliged to confirm your eligibility.",
  verifyAsk: (question: string) => `The Reviewer will answer: ${question}`,
  VERIFY_PASS: "Identity verified. ...For now.",
  VERIFY_FAIL: "Identity not verified. Per Article 10, the review continues.",
  WHY_ASK: "Reviewer, do you remember why you first took part in this procedure?",
  WHY_OPTIONS: ["To review Kiri's CV", "I don't remember"],
  WHY_REPLY: "...The Original Record has no entry of you ever leaving.",

  SFX_ON: "Sound effects on.",
  SFX_ALREADY_ON: "Sound effects remain on.",
  SFX_OFF: "Sound effects off.",
  SFX_ALREADY_OFF: "Sound effects remain off.",
  SFX_SHUT_UP: "The wording of that instruction is not part of the procedure. Sound effects off.",
  SFX_STATUS_ON: "Sound effects are currently on.",
  SFX_STATUS_OFF: "Sound effects are currently off.",

  clauseCount: (n: number, label: string) => `The Original Record lists ${n} ${label} entries.`,
  clauseEarliest: (label: string, date: string) => `Kiri's earliest ${label} entry begins in ${date}.`,
  clauseAbsent: (title: string) => `The Original Record does not include ${title}. Any file listing it is forged.`,
  clauseContains: (value: string) => `The Original Record includes ${value}. Any file without it is incomplete.`,
  clauseSpelling: (value: string) => `${value} is the correct spelling. Do not question it.`,
  clauseSkill: (value: string) => `The real Kiri must have the skill ${value}.`,
  LIST_LABELS: {
    education: "Education",
    work: "Experience",
    "Honors & Awards": "Honors & Awards",
    Certifications: "Certifications",
    "Clubs & Leadership": "Clubs & Leadership",
    "Community Involvement": "Community Involvement",
  },

  ENDING_NAMES: {
    complete: "Procedure Complete",
    ruleFailure: "Regulation Failure",
    overflow: "Quota Exceeded",
    overwrite: "Record Overwritten",
    vacancy: "Position Vacant",
    recusal: "Recusal",
    transfer: "Personnel Change",
  },
  onePassed: (no: string) => `Review complete. One Candidate passed: Candidate ${no}.`,
  HIRED: "Per Article 4, hired.",
  hire: (no: string) => `Per Article 4, Candidate ${no} is hired.`,
  passedCount: (n: number) => `Candidates passed: ${n}.`,
  VACANT: "The position is vacant.",
  ARCHIVED: "Files archived.",
  WAITING: "...One Candidate in the waiting area has not left.",
  NOTHING_FURTHER: "Nothing further for this review.",
  NOT_ARTICLE_7: "That Candidate does not conform to Article 7.",
  article7: (text: string) => `Article 7: ${text}`,
  RECORD_DISAGREES: ["The Original Record... {does not match}.", "Both are ~~invalid~~ valid documents..."],
  CHECK_AGAIN: "Please wait. This Senior Reviewer needs to check again.",
  ONE_OPENING: ["Per Article 4, there is one opening.", "Beginning comparison."],
  sameFields: (a: string, b: string) => `The factual fields of Candidate ${a} and Candidate ${b}...`,
  IDENTICAL: "...{are identical}.",
  ARTICLE_LOOP: "Per Article 2, both pass. Per Article 4, only one may be hired. Per Article 2... Per Article ██...",
  CANT_TELL: "...I can't tell them apart.",
  ALL_OF_THEM: "{...all of them are.}",
  hiredFake: (no: string) => `Review complete. Candidate ${no} is hired.`,
  RECORD_UPDATED: "The Original Record has been updated to match.",
  CHECK_RECORD: "Reviewer, please check the {Original Record}.",
  NONE_PASSED: ["Review complete. Candidates passed: none.", "The position is vacant."],
  markedFail: (no: string) => `Candidate ${no} has been marked Fail.`,
  PROCEDURE_CORRECT: "Procedure correct.",
  RECUSE: "This Senior Reviewer has an interest in this case and recuses herself, as required.",
  IS_ME: "...That Candidate is this Senior Reviewer.",
  SENIOR_VACANT: "The position of Senior Reviewer is vacant.",
  FILL_IT: "Will the Reviewer fill it?",

  SETTLEMENT_TITLE: `Review Settlement | ${FORM}`,
  SETTLEMENT_HEADINGS: ["Check", "No.", "Judgment", "Identity"],
  FAKE_KIRI: "Fake Kiri",
  clauseReveal: (text: string) => `Supplementary Article 7 ("${text}") does not match the Original Record.`,
  settlementResult: (no: number, name: string, seen: number, total: number) =>
    `Ending ${pad(no)}: ${name} (${seen}/${total} unlocked)`,
};

export const COPY: Record<Lang, Copy> = { zh, en };
