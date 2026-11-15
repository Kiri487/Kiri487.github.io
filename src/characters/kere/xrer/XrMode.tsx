import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { MOBILE_QUERY } from "../../../shared/breakpoints";
import { readJson, readNumber, readString, writeJson, writeString } from "../../../shared/storage";
import { visuallyHidden } from "../../../shared/visuallyHidden";
import KereAvatar from "../avatar/KereAvatar";
import { FACES } from "../avatar/faces";
import type { WelcomeNote } from "../assistant/types";
import { prefersReducedMotion } from "../../../shared/motion";
import { loadSfxEnabled, saveSfxEnabled, unlockSfx } from "../assistant/sfx";
import { SFX_PHRASES } from "../assistant/script";
import { detectLang, matches, normalize } from "../assistant/respond";
import { useChatViewport } from "../assistant/useChatViewport";
import { SECTIONS } from "../cv/layout";
import {
  decideOutcome,
  ENDING_COUNT,
  settlementRows,
  type EndingId,
  type Outcome,
  type RecordState,
  type SettlementRow,
  type Verdict,
} from "./endings";
import { XR_FACES, XR_THINKING_BY_FACE, type XrFace } from "./faces";
import { Fx, type Strength } from "./fx";
import { recordFx, type DocLevel } from "./recordFx";
import { buildQuiz } from "./quiz";
import { createRound, isXr, type Round } from "./round";
import { chance } from "./seeded";
import * as S from "./script";
import { clearXrSession, readXrSession, writeXrSession } from "./session";
import { playXrOpenSfx, playXrReplySfx } from "./sfx";
import { falseCrossing, morphFace, removeCover, rollName } from "./transition";
import XrAvatar from "./XrAvatar";
import { ApplicantDocument, RecordDocument, RulesDocument } from "./XrDocuments";
import "./xrer.css";

/** Long enough to read "審查中止。" before Kere takes over again. */
const LEAVE_DELAY_MS = 1000;
/** Between XR's closing words and the settlement sheet. */
const SETTLEMENT_DELAY_MS = 1800;
/** How long a stamped file stays on the desk before the next one takes its place. */
const NEXT_FILE_DELAY_MS = 1000;
const ENDINGS_KEY = "xrEndingsSeen";
/** The last receipt number given out. Counts up across rounds and visits. */
const RECEIPT_KEY = "xrReceiptNo";
/** Rounds begun, across visits. XR keeps count. */
const ROUNDS_KEY = "xrRounds";
/** Set once XR has asked why the visitor first came: she asks only once, ever. */
const ASKED_WHY_KEY = "xrAskedWhy";

/** From this round on, XR reports the count; on the fifth, clause 10 appears, and stays from then on. */
const COUNT_FROM = 3;
const CLAUSE_10_FROM = 5;
/** From this round on, now and then, clause 10 is carried out: one question about Kiri's CV. */
const VERIFY_FROM = 7;
const VERIFY_CHANCE = 1 / 3;
/** From this round on, rarely, and only once: whether the visitor remembers why they came. */
const WHY_FROM = 10;
const WHY_CHANCE = 1 / 4;

/** Chance, per round after the visitor's first, that someone writes in as Kere once clause 7 is out (clause 9). */
const IMPOSTOR_CHANCE = 0.25;
/** Words that, said to her, answer her: her own offer, mostly. Any other words that aren't a command do too. */
const ANSWER_PHRASES = ["轉接", "返回", "transfer", "back", "go back"];
/** Endings that leave Kere quoting clause 9 when the visitor comes back. */
const RATTLING: readonly EndingId[] = ["overflow", "overwrite", "ruleFailure"];
/** The name the Kere message goes under, and what's left of it once blacked out. */
const KERE_NAME = "Kere";
const REDACTED_NAME = "████";
/** The cells of the face that turn into Kere's, in order: right eye, mouth, then the hair. */
const TO_KERE_ORDER = [4, 3, 2];

/** How corrupted a line comes out, by XR's face when she said it. */
const FACE_STRENGTH: Record<XrFace, Strength> = { normal: 1, alert: 1, anxious: 2, broken: 4 };

/** How often a line of hers breaks in two, by face, and how long the rest takes to follow. */
const SPLIT_CHANCE: Record<XrFace, number> = { normal: 0, alert: 0, anxious: 0.2, broken: 0.5 };
const SPLIT_DELAY_MS = 600;

/**
 * A line broken where she might falter: after "……"/"...", or at a comma or full stop mid-line, whichever is nearest
 * the middle. Lines carrying corruption marks are left whole, so no mark is cut in half.
 */
function splitLine(line: string | undefined): [string, string] | undefined {
  if (!line || /[{}~█]/.test(line)) return undefined;
  const points: number[] = [];
  for (const m of line.matchAll(/……|\.\.\.|[，、。]|[,.] /g)) {
    const at = (m.index ?? 0) + m[0].length;
    if (at > 0 && at < line.length) points.push(at);
  }
  if (points.length === 0) return undefined;
  const at = points.reduce((best, p) => (Math.abs(p - line.length / 2) < Math.abs(best - line.length / 2) ? p : best));
  return [line.slice(0, at).trimEnd(), line.slice(at).trimStart()];
}

type Phase = "consent" | "review" | "closing" | "done" | "leaving";

/** "rules", "record", or an applicant's index as a string. */
type TabId = string;

interface Attachment {
  tab: TabId;
  label: string;
}

type Message =
  | { id: number; from: "you"; text: string; lang?: S.Lang }
  | {
      id: number;
      /** "kere": a message under Kere's name. Not from her (clause 9). */
      from: "xr" | "form" | "kere";
      /** A form's heading, ruled off from the rest. */
      title?: string;
      lines: string[];
      attachments?: Attachment[];
      options?: string[];
      settlement?: SettlementRow[];
      /** Lines after the settlement rows. */
      footer?: string[];
      /** The ending and the unlock count, ruled off at the bottom of the sheet. */
      result?: string[];
      /** How hard the line's {corrupted} parts are corrupted: set from XR's face when it's posted. */
      strength?: Strength;
      /** The round it was said in, so the same line corrupts differently from round to round. */
      seed?: string;
      lang?: S.Lang;
      /** Blacked out, name and all: the Kere message, once it's been dealt with. */
      redacted?: boolean;
    };

type XrMessage = Omit<Extract<Message, { lines: string[] }>, "id">;

/** XR's own questions to the Reviewer (clause 10). */
type Interlude = "verify" | "why";

/** The message under Kere's name this round: waiting for an answer, ignored, or answered. */
interface Impostor {
  id: number;
  state: "pending" | "ignored" | "answered";
}

const reviewOptions = (t: S.Copy) => [t.PASS_LABEL, t.FAIL_LABEL, t.ASK_LABEL];

/** Kere's matching, so XR understands the same mixed input she does ("我要pass", "看rules"). */
function said(text: string, phrases: readonly string[]): boolean {
  return matches(normalize(text), phrases);
}

function loadSeenEndings(): EndingId[] {
  const saved = readJson(ENDINGS_KEY);
  return Array.isArray(saved) ? saved.filter((e): e is EndingId => typeof e === "string" && (S.ENDING_IDS as readonly string[]).includes(e)) : [];
}

function sectionTitle(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.title ?? id;
}

function faceForViolations(violations: number): XrFace {
  if (violations === 0) return "normal";
  return violations === 1 ? "alert" : "anxious";
}

/** Marks an ending as seen; returns how many have been seen in all. */
function recordEnding(id: EndingId): number {
  const seen = loadSeenEndings();
  if (!seen.includes(id)) seen.push(id);
  writeJson(ENDINGS_KEY, seen);
  return seen.length;
}

/** What closes a round: clause 9 appearing, a pointer to the record when the ending changed it, the settlement sheet. */
function settlementMessages(r: Round, verdicts: Verdict[], outcome: Outcome, seenCount: number, lang: S.Lang): XrMessage[] {
  const t = S.COPY[lang];
  const msgs: XrMessage[] = [{ from: "xr", lines: [t.RULES_UPDATED], attachments: [{ tab: "rules", label: t.TAB_RULES }] }];
  if (outcome.showRecord) msgs.push({ from: "form", lines: [], attachments: [{ tab: "record", label: t.TAB_RECORD }] });
  msgs.push({
    from: "form",
    title: t.SETTLEMENT_TITLE,
    lines: [],
    settlement: settlementRows(r, verdicts, lang),
    footer: [t.clauseReveal(r.clause.text[lang])],
    result: [t.settlementResult(S.ENDING_IDS.indexOf(outcome.id) + 1, t.ENDING_NAMES[outcome.id], seenCount, ENDING_COUNT)],
    options: [t.AGAIN_LABEL, t.BACK_LABEL, t.SWITCH_LABEL],
  });
  return msgs;
}

/** The consent form's choices: begin, go back, or switch to the other language. */
const consentOptions = (t: S.Copy) => [t.START_LABEL, t.BACK_LABEL, t.SWITCH_LABEL];

/** The consent form, in one language. */
function consentForm(lang: S.Lang): XrMessage {
  const t = S.COPY[lang];
  return { from: "form", title: t.CONSENT_TITLE, lines: t.CONSENT, options: consentOptions(t), lang };
}

/** "kiri", "blank", or the index of the fake whose CV overwrote it: the record as saved. */
type SavedRecord = "kiri" | "blank" | number;

/**
 * Everything about the round on the desk, kept as one: a new round, a language switch and a refresh each set it in
 * one go, so a new piece of round state can't be forgotten in one of them.
 */
interface RoundState {
  /** Rebuilt from its seed after a refresh; null before the first round. */
  round: Round | null;
  /** The file on the desk. */
  current: number;
  verdicts: Verdict[];
  clauseIssued: boolean;
  /** Clauses that grew after clause 7, in the order they grew: "7-1", "8"… */
  grown: string[];
  /** Every violation: clause 7's, and answering the Kere message. The face and the rot follow this. */
  violations: number;
  /** Clause 7's alone: what grows 7-1 to 8 and what XR says about it. */
  clauseBreaks: number;
  /** Questions asked per file. */
  asks: number[];
  record: SavedRecord;
  /** A face held for a moment (or for the rest of the round, in the closing). */
  faceOverride: XrFace | null;
  /** This round has a Kere message coming (clause 9), and how it went once it came. */
  impostorDue: boolean;
  impostor: Impostor | null;
  /** This round, clause 10 is carried out (a question about Kiri's CV); and XR asks why the visitor first came. */
  verifyDue: boolean;
  whyDue: boolean;
  /** One of those questions, waiting for an answer before the review goes on. */
  interlude: Interlude | null;
  verifyDone: boolean;
  whyDone: boolean;
}

/** A round before anything has happened in it; `round` null for the time before the first one. */
function freshRound(round: Round | null = null, setup: Partial<RoundState> = {}): RoundState {
  return {
    round,
    current: 0,
    verdicts: [],
    clauseIssued: false,
    grown: [],
    violations: 0,
    clauseBreaks: 0,
    asks: round ? round.applicants.map(() => 0) : [],
    record: "kiri",
    faceOverride: null,
    impostorDue: false,
    impostor: null,
    verifyDue: false,
    whyDue: false,
    interlude: null,
    verifyDone: false,
    whyDone: false,
    ...setup,
  };
}

/** The record as it's shown: Kiri's own, blank, or a fake's CV in its place. */
function recordShown({ round, record }: RoundState): RecordState {
  if (record === "blank") return { type: "blank" };
  if (typeof record === "number" && round?.applicants[record]) return { type: "overwritten", cv: round.applicants[record].cv };
  return { type: "kiri" };
}

/** An ending's record, as saved. */
function recordSaved(record: RecordState, round: Round): SavedRecord {
  if (record.type === "blank") return "blank";
  if (record.type === "overwritten") {
    const by = round.applicants.findIndex((a) => a.cv === record.cv);
    return by >= 0 ? by : "kiri";
  }
  return "kiri";
}

/** What a refresh needs to pick up where the visitor was. The round itself is rebuilt from its seed. */
interface Snapshot {
  v: 3;
  lang: S.Lang;
  phase: Phase;
  tab: TabId;
  messages: Message[];
  nextId: number;
  /** A Kere message has appeared this visit, in this round or an earlier one: Kere will have something to say. */
  metImpostor: boolean;
  /** The round, with its seed in place of the round itself. */
  rs: Omit<RoundState, "round"> & { seed: string | null };
}

interface Restored {
  lang: S.Lang;
  phase: Phase;
  tab: TabId;
  messages: Message[];
  nextId: number;
  metImpostor: boolean;
  rs: RoundState;
  /** The visitor's last words, if a refresh came before XR answered them: she answers them now. */
  unanswered?: string;
}

/** The review saved before a refresh, if there is one that still makes sense. */
function restore(): Restored | null {
  const saved = readXrSession() as Snapshot | null;
  if (!saved || saved.v !== 3 || !Array.isArray(saved.messages) || !saved.rs) return null;
  const { seed, ...fields } = saved.rs;
  const round = seed ? createRound(seed) : null;
  if (saved.phase !== "consent" && !round) return null;
  const { lang, phase, metImpostor } = saved;
  // An applicant's tab only if the round, rebuilt from its seed, still has that applicant (a deploy may change rounds).
  const tab = /^\d+$/.test(saved.tab) && !round?.applicants[Number(saved.tab)] ? "record" : saved.tab;
  let rs: RoundState = { ...freshRound(round), ...fields, round };
  let messages = saved.messages;
  let nextId = saved.nextId;

  // Refreshed during a transfer that wasn't going through: finish what it would have done.
  const answered = rs.impostor?.state === "answered" ? rs.impostor : null;
  const kereMsg = answered && messages.find((m) => m.id === answered.id);
  if (answered && kereMsg && kereMsg.from === "kere" && !kereMsg.redacted) {
    const t = S.COPY[lang];
    rs = { ...rs, violations: rs.violations + 1, faceOverride: null };
    messages = [
      ...messages.map((m) => (m.id === answered.id && m.from === "kere" ? { ...m, redacted: true, options: undefined } : m)),
      { from: "xr", lines: [t.TRANSFER_VOID], options: reviewOptions(t), strength: 1, seed: seed ?? "", lang, id: nextId++ } as Message,
    ];
  }

  // Refreshed while XR was thinking: the visitor's words are saved, her answer isn't yet.
  const last = messages[messages.length - 1];
  const unanswered = last?.from === "you" && (phase === "consent" || phase === "review" || phase === "done") ? last.text : undefined;

  if (phase !== "closing" || !round) return { lang, phase, tab, messages, nextId, metImpostor, rs, unanswered };

  // Refreshed while XR was reading out the ending: skip straight to the settlement sheet.
  const outcome = decideOutcome(round, rs.verdicts, lang);
  const sheet = settlementMessages(round, rs.verdicts, outcome, recordEnding(outcome.id), lang).map(
    (m) => ({ strength: 1, seed: round.seed, lang, ...m, id: nextId++ }) as Message,
  );
  rs = {
    ...rs,
    record: recordSaved(outcome.record, round),
    grown: rs.grown.includes("9") ? rs.grown : [...rs.grown, "9"],
    faceOverride: outcome.steps[outcome.steps.length - 1]?.face ?? null,
  };
  return { lang, phase: "done", tab, messages: [...messages, ...sheet], nextId, metImpostor, rs };
}

interface XrModeProps {
  /** `lang`: the language the review ran in, so Kere welcomes the visitor back in it; `note`, anything she'd remark on. */
  onLeave: (to: "kere" | "kiri", lang: S.Lang, note?: WelcomeNote) => void;
  /** Set when Kere handed over: the language she was asked in. */
  triggerLang?: S.Lang;
}

function XrMode({ onLeave, triggerLang }: XrModeProps) {
  // A refresh in the middle of a review picks it up again (see session.ts).
  const [initial] = useState(restore);
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? "consent");
  // Like Kere, XR answers in the language she was called up in ("xrer" alone is English); the visitor can switch.
  const [lang, setLang] = useState<S.Lang>(() => initial?.lang ?? triggerLang ?? "en");
  // Everything about the round on the desk, in one piece (see RoundState).
  const [rs, setRs] = useState<RoundState>(() => initial?.rs ?? freshRound());
  const {
    round,
    current,
    verdicts,
    clauseIssued,
    grown,
    violations,
    clauseBreaks,
    asks,
    faceOverride,
    impostorDue,
    impostor,
    verifyDue,
    whyDue,
    interlude,
    verifyDone,
    whyDone,
  } = rs;
  const record = recordShown(rs);
  /** Changes part of the round. A function gets the latest round, for changes made from timers. */
  const patch = (change: Partial<RoundState> | ((now: RoundState) => Partial<RoundState>)) =>
    setRs((now) => ({ ...now, ...(typeof change === "function" ? change(now) : change) }));
  const [metImpostor, setMetImpostor] = useState(initial?.metImpostor ?? false);
  /** Time into a transfer that isn't going through, while it plays (see falseCrossing). */
  const [falseT, setFalseT] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>(initial?.tab ?? "record");
  /** The tab as of now, for timers. */
  const tabRef = useRef(tab);

  const [messages, setMessages] = useState<Message[]>(() => initial?.messages ?? [{ ...consentForm(lang), id: 0 } as Message]);
  const [input, setInput] = useState("");
  // A refresh came before XR answered: she's still thinking, and nothing else can be sent until she does.
  const [thinking, setThinking] = useState(initial?.unanswered !== undefined);
  /** The second half of a line she broke off is still to come: nothing gets said over it. */
  const [trailing, setTrailing] = useState(false);
  const [open, setOpen] = useState(true);
  const [unread, setUnread] = useState(false);
  // Kere's sound setting covers XR too: muting either one mutes both.
  const [sfxEnabled] = useState(loadSfxEnabled);
  /** The live setting: a mute command takes effect on its own reply, before the next render. */
  const soundOn = useRef(sfxEnabled);

  const nextId = useRef(initial?.nextId ?? 1);
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const openRef = useRef(open);
  /** The face as of now, for the reply tick, which sours as XR does. Closing steps set it before they speak. */
  const faceRef = useRef<XrFace>("normal");
  const openSfxPlayed = useRef(false);
  /** The current round's seed, for messages posted from timers. */
  const seedRef = useRef(initial?.rs.round?.seed ?? "");
  /** The review's language, for messages posted from timers. */
  const langRef = useRef<S.Lang>(lang);

  const t = S.COPY[lang];

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach((id) => window.clearTimeout(id));
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, thinking, open]);

  useChatViewport(open, panelRef, logRef);

  // Save the review after every change, so a refresh can resume it. Leaving clears it instead.
  useEffect(() => {
    // Cleared here as well as in abort: a save effect still pending from before the click could otherwise write it back.
    if (phase === "leaving") {
      clearXrSession();
      return;
    }
    const { round: saving, ...fields } = rs;
    const snapshot: Snapshot = {
      v: 3,
      lang,
      phase,
      tab,
      messages,
      nextId: nextId.current,
      metImpostor,
      rs: { ...fields, seed: saving?.seed ?? null },
    };
    writeXrSession(snapshot);
  }, [phase, lang, tab, messages, metImpostor, rs]);

  // The whole page goes negative while XR is here (see xrer.css).
  // Before the first paint, both at once: turn the page negative and take off the cover the crossing from Kere left.
  // Done after a paint instead, one frame would show the negative page through the cover, inverted back to white.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-xr", "");
    removeCover();
    return () => {
      root.removeAttribute("data-xr");
      // Gone mid false transfer (the browser's Back, say): its cover goes too.
      removeCover();
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) launcherRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const post = (...msgs: XrMessage[]) => {
    const strength = FACE_STRENGTH[faceRef.current];
    const seed = seedRef.current;
    const msgLang = langRef.current;
    // Rattled, she sometimes stops mid-sentence and sends the rest a moment later. Rolled from the round's seed and
    // the message's number, like the rest of the round.
    const last = msgs[msgs.length - 1];
    const cut =
      last?.from === "xr" && chance(`${seed}:split:${nextId.current}`) < SPLIT_CHANCE[faceRef.current]
        ? splitLine(last.lines[last.lines.length - 1])
        : undefined;
    const sent = cut && last ? [...msgs.slice(0, -1), { ...last, lines: [...last.lines.slice(0, -1), cut[0]] }] : msgs;
    const numbered = sent.map((msg) => ({ strength, seed, lang: msgLang, ...msg, id: nextId.current++ }) as Message);
    setMessages((m) => [...m, ...numbered]);
    if (!openRef.current) setUnread(true);
    if (soundOn.current) playXrReplySfx(faceRef.current);
    if (cut) {
      // Only the words: choices and attachments stay on the first half, so a refresh in between loses nothing.
      setTrailing(true);
      later(() => {
        setTrailing(false);
        post({ from: "xr", lines: [cut[1]] });
      }, SPLIT_DELAY_MS);
    }
  };

  const face: XrFace = faceOverride ?? faceForViolations(violations);

  useEffect(() => {
    faceRef.current = face;
  }, [face]);

  // XR's arrival sound, once (the guard keeps development's double effects from playing it twice).
  useEffect(() => {
    if (openSfxPlayed.current) return;
    openSfxPlayed.current = true;
    if (sfxEnabled) playXrOpenSfx();
  }, [sfxEnabled]);
  /** Only the newest choices stay on screen: an old "合格" would stamp whichever file is on the desk now. */
  const lastWithOptions = [...messages].reverse().find((m) => m.from !== "you" && m.options)?.id;
  const busy = thinking || trailing || falseT !== null || phase === "closing" || phase === "leaving";
  /** Same speaker as the message before: drop the name and tuck it closer. Forms always stand alone. */
  const continues = (i: number) => {
    const m = messages[i];
    const prev = messages[i - 1];
    return m.from !== "form" && prev !== undefined && prev.from === m.from;
  };

  /* ---- the review itself ---- */

  const fileMessage = (r: Round, index: number, first: boolean, tt: S.Copy = t): XrMessage => ({
    from: "xr",
    lines: [first ? tt.FIRST_FILE : tt.NEXT_FILE],
    attachments: [{ tab: String(index), label: tt.tabApplicant(r.applicants[index].no) }],
    options: reviewOptions(tt),
  });

  const startRound = (again: boolean, chosen: S.Lang) => {
    const tt = S.COPY[chosen];
    const r = createRound();
    // Never on the visitor's first round: that one is the review as it's meant to go.
    const before = readNumber(ROUNDS_KEY, 0, { min: 0 });
    const no = before + 1;
    writeString(ROUNDS_KEY, String(no));
    seedRef.current = r.seed;
    langRef.current = chosen;
    setLang(chosen);
    setRs(
      freshRound(r, {
        // Clause 10 arrives on the fifth round and is simply there from then on.
        grown: no >= CLAUSE_10_FROM ? ["10"] : [],
        impostorDue: before >= 1 && chance(`${r.seed}:impostor`) < IMPOSTOR_CHANCE,
        verifyDue: no >= VERIFY_FROM && chance(`${r.seed}:verify`) < VERIFY_CHANCE,
        whyDue: no >= WHY_FROM && readString(ASKED_WHY_KEY) === null && chance(`${r.seed}:why`) < WHY_CHANCE,
      }),
    );
    setTab("rules");
    setPhase("review");
    const brief = again ? tt.BRIEFING_AGAIN : tt.BRIEFING;
    post(
      {
        from: "xr",
        // Who she is and what's under review always come first; the count and clause 10 follow.
        lines: [
          brief[0],
          ...(no >= COUNT_FROM ? [tt.roundCount(no)] : []),
          ...(no === CLAUSE_10_FROM ? [tt.RULES_UPDATED] : []),
          ...brief.slice(1),
        ],
        attachments: [{ tab: "rules", label: tt.TAB_RULES }],
      },
      fileMessage(r, 0, true, tt),
    );
  };

  const ask = (r: Round) => {
    const applicant = r.applicants[current];
    const n = asks[current] ?? 0;
    patch({ asks: asks.map((v, i) => (i === current ? v + 1 : v)) });

    if (isXr(applicant)) {
      patch({ faceOverride: "anxious" });
      post({ from: "xr", lines: t.ASK_XR_FILE, options: reviewOptions(t) });
      return;
    }
    let line: string;
    if (n >= 2) line = t.ASK_SELF_JUDGE;
    else if (n === 1) line = t.askSection(sectionTitle(applicant.hintSection));
    else if (!clauseIssued) line = t.ASK_GENERIC;
    else if (clauseBreaks > 0) line = t.ASK_EVASIVE;
    else line = r.clause.check(applicant.cv) ? t.ASK_CLAUSE_PASS : t.ASK_CLAUSE_FAIL;
    patch({ faceOverride: null });
    post({ from: "xr", lines: [line], options: reviewOptions(t) });
  };

  /** XR's closing words, step by step, then the settlement sheet. */
  const close = (r: Round, finalVerdicts: Verdict[]) => {
    setPhase("closing");
    const reviewLang = lang;
    const outcome: Outcome = decideOutcome(r, finalVerdicts, reviewLang);
    patch({ record: recordSaved(outcome.record, r) });

    let at = 0;
    outcome.steps.forEach((s) => {
      at += s.delay + 1200;
      later(() => {
        patch({ faceOverride: s.face });
        faceRef.current = s.face;
        post({ from: "xr", lines: s.lines });
      }, at);
    });

    at += SETTLEMENT_DELAY_MS;
    later(() => {
      // Every round ends with one more clause, about Kere.
      patch((now) => ({ grown: now.grown.includes("9") ? now.grown : [...now.grown, "9"] }));
      post(...settlementMessages(r, finalVerdicts, outcome, recordEnding(outcome.id), reviewLang));
      setPhase("done");
    }, at);
  };

  const stamp = (r: Round, pass: boolean) => {
    const applicant = r.applicants[current];
    const violation = pass && clauseIssued && !r.clause.check(applicant.cv);
    const passedBefore = verdicts.filter((v) => v.pass).length;
    const nextVerdicts = [...verdicts, { pass, afterClause: clauseIssued }];
    // Everything this stamp changes in the round, applied at the end in one go.
    const change: Partial<RoundState> = { verdicts: nextVerdicts };
    let nextGrown = grown;

    const receipt = readNumber(RECEIPT_KEY, 0, { min: 0 }) + 1;
    writeString(RECEIPT_KEY, String(receipt));
    const ack: string[] = [t.stamped(pass, receipt)];
    let held: XrFace | null = null;
    // The rulebook answers a violation by itself: 7-1, 7-2, 7-3, and clause 8 with the second.
    const sprouted: string[] = [];
    if (violation) {
      ack.push(clauseBreaks === 0 ? t.VIOLATION_FIRST : t.VIOLATION_AGAIN);
      const count = clauseBreaks + 1;
      change.clauseBreaks = count;
      change.violations = violations + 1;
      if (count <= 3) sprouted.push(`7-${count}`);
      if (count === 2) sprouted.push("8");
      nextGrown = [...nextGrown, ...sprouted];
    } else if (pass && passedBefore > 0) {
      ack.push(t.SECOND_PASS);
      held = "alert";
    }
    change.faceOverride = held;

    const msgs: XrMessage[] = [{ from: "xr", lines: ack }];
    sprouted.forEach((id) =>
      msgs.push({
        from: "xr",
        lines: id === "8" ? [t.RULES_UPDATED, t.RULE_8_FOLLOW] : [t.RULES_UPDATED],
        attachments: [{ tab: "rules", label: t.TAB_RULES }],
      }),
    );
    const stamped = current + 1;
    const issueNow = !clauseIssued && stamped === r.clauseAfter;
    if (issueNow) {
      change.clauseIssued = true;
      msgs.push({ from: "xr", lines: [t.RULES_UPDATED, t.STAMPED_UNAFFECTED], attachments: [{ tab: "rules", label: t.TAB_RULES }] });
    }

    if (stamped < r.applicants.length) {
      change.current = stamped;
      msgs.push(fileMessage(r, stamped, false));
      // The first stamp after clause 7 with a file still to come: clause 9 appears, and then, as if on cue, Kere.
      if (impostorDue && clauseIssued && !impostor) {
        if (!nextGrown.includes("9")) nextGrown = [...nextGrown, "9"];
        msgs.push(
          { from: "xr", lines: [t.RULES_UPDATED], attachments: [{ tab: "rules", label: t.TAB_RULES }] },
          { from: "kere", lines: [t.KERE_IMPOSTOR], options: [t.KERE_YES, ...reviewOptions(t)] },
        );
        // post numbers messages in order from here, and never splits one that isn't XR's.
        change.impostor = { id: nextId.current + msgs.length - 1, state: "pending" };
        setMetImpostor(true);
      } else if (verifyDue && !verifyDone && stamped >= 2) {
        // Clause 10, carried out: the review waits on the Reviewer's answer.
        const quiz = buildQuiz(r.seed);
        msgs.push({ from: "xr", lines: [t.ELIGIBILITY, t.verifyAsk(quiz.question[lang])], options: quiz.options });
        change.interlude = "verify";
        change.verifyDone = true;
      } else if (whyDue && !whyDone) {
        msgs.push({ from: "xr", lines: [t.WHY_ASK], options: t.WHY_OPTIONS });
        change.interlude = "why";
        change.whyDone = true;
        writeString(ASKED_WHY_KEY, "1");
      }
      patch({ ...change, grown: nextGrown });
      post(...msgs);
      // The stamp shows for a moment, then the next file is put on the desk: only if the visitor is still looking at
      // the one just stamped, not if they've gone to read the rules or the record.
      const stampedTab = String(current);
      later(() => {
        if (tabRef.current !== stampedTab) return;
        setTab(String(stamped));
        window.scrollTo(0, 0);
      }, NEXT_FILE_DELAY_MS);
      return;
    }

    patch({ ...change, grown: nextGrown });
    post(...msgs);
    close(r, nextVerdicts);
  };

  /* ---- input ---- */

  /** Switch language: everything so far is cleared and the consent form comes back in the other language. */
  const startOver = (other: S.Lang) => {
    // Like leaving: nothing from before the switch, a broken-off line included, should turn up in the new form.
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setTrailing(false);
    langRef.current = other;
    seedRef.current = "";
    setLang(other);
    setPhase("consent");
    setRs(freshRound());
    setTab("record");
    setMessages([{ ...consentForm(other), id: nextId.current++ } as Message]);
    if (soundOn.current) playXrReplySfx("normal");
  };

  /** Leave at any point, even mid-closing: XR doesn't argue. */
  const abort = (to: "kere" | "kiri", line = t.ABORTED) => {
    clearXrSession();
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setThinking(false);
    setPhase("leaving");
    post({ from: "xr", lines: [line] });
    const ended = (phase === "done" || phase === "closing") && round ? decideOutcome(round, verdicts, lang).id : undefined;
    const note: WelcomeNote | undefined = metImpostor
      ? "impostor"
      : ended && RATTLING.includes(ended)
        ? "rattled"
        : undefined;
    later(() => onLeave(to, lang, note), LEAVE_DELAY_MS);
  };

  /** The Kere message, blacked out: what's left of it once it's been ignored or answered. */
  const redact = (id: number) => {
    setMessages((ms) => ms.map((m) => (m.id === id && m.from === "kere" ? { ...m, redacted: true, options: undefined } : m)));
  };

  /**
   * Answering the Kere message: the transfer starts, gets halfway, and goes back. Counts against the visitor like a
   * clause 7 violation, but grows nothing and changes no ending.
   */
  const answerImpostor = (id: number) => {
    patch({ impostor: { id, state: "answered" } });
    const done = () => {
      setFalseT(null);
      redact(id);
      patch((now) => ({ violations: now.violations + 1, faceOverride: null }));
      post({ from: "xr", lines: [t.TRANSFER_VOID], options: reviewOptions(t) });
    };
    if (prefersReducedMotion()) {
      done();
      return;
    }
    setFalseT(0);
    void falseCrossing((ft) => setFalseT(ft)).then(done);
  };

  const reply = (text: string) => {
    // Kere's message is waiting. Words for her offer, or anything that isn't a command, answer it; a command ignores
    // it, and it's blacked out. Plain exit words still leave, and so does the button: the way out always works.
    if (impostor?.state === "pending") {
      // Going back to Kiri is never an answer to her, whatever words it uses.
      const command =
        said(text, S.KIRI_PHRASES) ||
        (!said(text, ANSWER_PHRASES) &&
        [S.ROT13_PHRASES, S.KIRI_PHRASES, S.EXIT_PHRASES, S.FAIL_PHRASES, S.PASS_PHRASES, S.ASK_PHRASES, S.RULES_PHRASES, S.RECORD_PHRASES, ...Object.values(SFX_PHRASES)].some(
          (phrases) => said(text, phrases),
        ));
      if (!command) {
        answerImpostor(impostor.id);
        return;
      }
      patch({ impostor: { ...impostor, state: "ignored" } });
      redact(impostor.id);
    }
    if (said(text, S.ROT13_PHRASES)) {
      abort("kere", t.ROT13_LINE);
      return;
    }
    if (said(text, S.KIRI_PHRASES) || said(text, S.EXIT_PHRASES)) {
      abort(said(text, S.KIRI_PHRASES) ? "kiri" : "kere", t.ABORTED);
      return;
    }

    // XR's question comes first: the review waits until it's answered.
    if (interlude && round) {
      if (interlude === "why") {
        // Whatever the answer.
        patch({ interlude: null });
        post({ from: "xr", lines: [t.WHY_REPLY], options: reviewOptions(t) });
        return;
      }
      const quiz = buildQuiz(round.seed);
      const picked = quiz.options.find((o) => normalize(o) === normalize(text));
      if (!picked) {
        post({ from: "xr", lines: [t.CHOOSE], options: quiz.options });
        return;
      }
      patch({ interlude: null });
      post({ from: "xr", lines: [picked === quiz.answer ? t.VERIFY_PASS : t.VERIFY_FAIL], options: reviewOptions(t) });
      return;
    }

    // Sound commands work at any point, with whatever choices were on screen.
    const options =
      phase === "consent"
        ? consentOptions(t)
        : phase === "done"
          ? [t.AGAIN_LABEL, t.BACK_LABEL, t.SWITCH_LABEL]
          : reviewOptions(t);
    const setSound = (on: boolean, line: string) => {
      // Turning sound on confirms itself with the tick; turning it off stays silent.
      soundOn.current = on;
      saveSfxEnabled(on);
      post({ from: "xr", lines: [line], options });
    };
    if (said(text, SFX_PHRASES.on)) {
      if (soundOn.current) post({ from: "xr", lines: [t.SFX_ALREADY_ON], options });
      else setSound(true, t.SFX_ON);
      return;
    }
    if (said(text, SFX_PHRASES.shutUp)) {
      patch({ faceOverride: "alert" });
      if (soundOn.current) setSound(false, t.SFX_SHUT_UP);
      else post({ from: "xr", lines: [t.SFX_ALREADY_OFF], options });
      return;
    }
    if (said(text, SFX_PHRASES.off)) {
      if (soundOn.current) setSound(false, t.SFX_OFF);
      else post({ from: "xr", lines: [t.SFX_ALREADY_OFF], options });
      return;
    }
    if (said(text, SFX_PHRASES.status)) {
      post({ from: "xr", lines: [soundOn.current ? t.SFX_STATUS_ON : t.SFX_STATUS_OFF], options });
      return;
    }

    // After the phase's own commands, so "詢問 Xrer" asks instead of tripping her name, and "守則錯了" isn't a tab.
    const egg = S.EGGS.find((e) => said(text, e.phrases));
    const answerEgg = () => {
      if (grown.includes("8") && said(text, S.RULE_8_PHRASES)) {
        post({ from: "xr", lines: [t.RULE_8_DENIAL], options });
        return true;
      }
      if (!egg) return false;
      patch({ faceOverride: egg.alert ? "alert" : null });
      // Once 7-1 exists, doubting clause 7 is itself against the rules.
      const line = egg.alert && grown.includes("7-1") ? t.DOUBT_AFTER_7_1 : egg.line[lang];
      post({ from: "xr", lines: [line], options });
      return true;
    };

    const other: S.Lang = lang === "zh" ? "en" : "zh";
    if (phase === "consent") {
      if (said(text, S.START_PHRASES)) startRound(false, lang);
      else if (said(text, S.SWITCH_PHRASES[other])) startOver(other);
      else if (!answerEgg()) post({ from: "form", lines: [t.CHOOSE], options });
      return;
    }

    if (phase === "done") {
      if (said(text, S.AGAIN_PHRASES)) startRound(true, lang);
      else if (said(text, S.SWITCH_PHRASES[other])) startOver(other);
      else if (!answerEgg()) post({ from: "form", lines: [t.CHOOSE], options });
      return;
    }

    if (phase !== "review" || !round) return;
    // 不合格 contains 合格, so it's checked first.
    if (said(text, S.FAIL_PHRASES)) stamp(round, false);
    else if (said(text, S.PASS_PHRASES)) stamp(round, true);
    else if (said(text, S.ASK_PHRASES)) ask(round);
    else if (answerEgg()) return;
    else if (said(text, S.RULES_PHRASES)) {
      post({ from: "xr", lines: [], attachments: [{ tab: "rules", label: t.TAB_RULES }], options });
    } else if (said(text, S.RECORD_PHRASES)) {
      post({ from: "xr", lines: [], attachments: [{ tab: "record", label: t.TAB_RECORD }], options });
    } else {
      patch({ faceOverride: "alert" });
      post({ from: "xr", lines: [t.UNKNOWN_COMMAND], options });
    }
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, from: "you", text: trimmed, lang: detectLang(trimmed) }]);
    setInput("");
    setThinking(true);
    // A user gesture: lets the reply tick play after the timeout.
    unlockSfx();
    later(() => {
      setThinking(false);
      reply(trimmed);
    }, XR_THINKING_BY_FACE[faceRef.current]);
  };

  // A refresh came between the visitor's words and XR's answer: answer them now.
  const replyRef = useRef(reply);
  useEffect(() => {
    replyRef.current = reply;
  });
  useEffect(() => {
    const text = initial?.unanswered;
    if (!text) return;
    const id = window.setTimeout(() => {
      setThinking(false);
      replyRef.current(text);
    }, XR_THINKING_BY_FACE.normal);
    return () => window.clearTimeout(id);
  }, [initial]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send(input);
  };

  /** An attachment means "go read this". On a phone the chat covers the page, so it steps aside; elsewhere it stays. */
  const openTab = (id: TabId) => {
    setTab(id);
    window.scrollTo(0, 0);
    if (window.matchMedia(MOBILE_QUERY).matches) setOpen(false);
  };

  /* ---- page ---- */

  // Mid false transfer, her name and face turn towards Kere's and back.
  const shownName = falseT !== null ? rollName(S.NAME, falseT, -1) : S.NAME;
  const shownFace = falseT !== null ? morphFace(XR_FACES[face], FACES.normal, falseT, TO_KERE_ORDER) : undefined;

  const delivered = round ? (phase === "review" ? current + 1 : round.applicants.length) : 0;
  const tabs: Attachment[] = [
    ...(round ? [{ tab: "rules", label: t.TAB_RULES }] : []),
    { tab: "record", label: t.TAB_RECORD },
    ...(round ? round.applicants.slice(0, delivered).map((a, i) => ({ tab: String(i), label: t.tabApplicant(a.no) })) : []),
  ];

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].tab);
    document.getElementById(`xr-tab-${tabs[next].tab}`)?.focus();
  };

  let panel: ReactNode = null;
  // The documents rot with each violation of clause 7, and all the way when XR breaks.
  const docLevel: DocLevel = faceOverride === "broken" ? 3 : (Math.min(violations, 2) as DocLevel);
  if (tab === "rules") {
    panel = (
      <RulesDocument
        clause={clauseIssued ? round?.clause : undefined}
        grown={grown}
        level={docLevel}
        violations={violations}
        seed={round?.seed ?? ""}
        lang={lang}
      />
    );
  } else if (tab === "record") {
    const fx = recordFx({
      level: docLevel,
      violations,
      seed: round?.seed ?? "",
      // The answer to this round's question (clause 10) stays readable, like everything else a judgment needs.
      protect: round ? [...round.protect, ...(verifyDue ? [buildQuiz(round.seed).field] : [])] : [],
      lang,
      uneasy: clauseIssued,
    });
    panel = <RecordDocument record={record} fx={fx} />;
  } else if (round?.applicants[Number(tab)]) {
    const i = Number(tab);
    const a = round.applicants[i];
    panel = <ApplicantDocument cv={a.cv} letter={a.letter[lang]} pass={verdicts[i]?.pass} lang={lang} />;
  }

  return (
    <>
      <div className="xr">
        <h1 style={visuallyHidden} lang={S.htmlLang(lang)}>
          {t.CONSENT_TITLE}
        </h1>
        <div className="xr-tabs" role="tablist" aria-label={S.FORM} lang={S.htmlLang(lang)}>
          {tabs.map((tb, i) => (
            <button
              key={tb.tab}
              id={`xr-tab-${tb.tab}`}
              type="button"
              role="tab"
              className="xr-tabs__tab"
              aria-selected={tab === tb.tab}
              aria-controls="xr-panel"
              tabIndex={tab === tb.tab ? 0 : -1}
              onClick={() => setTab(tb.tab)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {tb.label}
            </button>
          ))}
          <button
            type="button"
            className="xr-tabs__leave"
            onClick={() => abort("kere")}
            disabled={phase === "leaving" || falseT !== null}
          >
            ▸ {t.BACK_LABEL}
          </button>
        </div>
        <div id="xr-panel" role="tabpanel" aria-labelledby={`xr-tab-${tab}`}>
          {panel}
        </div>
      </div>

      {open ? (
        <div
          ref={panelRef}
          className="kere-chat xr-chat"
          role="dialog"
          aria-label={S.NAME}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="kere-chat__head">
            <XrAvatar key={String(thinking)} face={face} thinking={thinking} drawn={shownFace} />
            <span className="kere-chat__name">{shownName}</span>
            <button type="button" className="kere-chat__minimize" onClick={() => setOpen(false)} aria-label="Minimize">
              –
            </button>
          </div>

          <div className="kere-chat__log" ref={logRef} aria-live="polite">
            {messages.map((m, i) =>
              m.from === "you" ? (
                <div key={m.id} className={continues(i) ? "kere-msg kere-msg--you xr-msg--cont" : "kere-msg kere-msg--you"}>
                  <span className="kere-msg__who">{continues(i) ? "" : t.YOU_LABEL}</span>
                  <div className="kere-msg__body" lang={S.htmlLang(m.lang ?? "zh")}>
                    <p>{m.text}</p>
                  </div>
                </div>
              ) : (
                // Forms (the consent form, the settlement sheet) span the full width, with no speaker.
                <div
                  key={m.id}
                  className={["kere-msg", m.from === "form" && "xr-msg--form", continues(i) && "xr-msg--cont"]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {m.from === "xr" && <span className="kere-msg__who">{continues(i) ? "" : S.NAME}</span>}
                  {m.from === "kere" && <span className="kere-msg__who">{m.redacted ? REDACTED_NAME : KERE_NAME}</span>}
                  <div className="kere-msg__body" lang={S.htmlLang(m.lang ?? "zh")}>
                    {m.title && <p className="xr-form__title">{m.title}</p>}
                    {m.lines.map((line, i) => (
                      <p key={i}>
                        <Fx
                          text={m.redacted ? "█".repeat([...line].length) : line}
                          strength={m.strength ?? 1}
                          seed={m.seed}
                          lang={m.lang}
                        />
                      </p>
                    ))}
                    {m.settlement && (
                      <table className="xr-settlement">
                        <thead>
                          <tr>
                            {t.SETTLEMENT_HEADINGS.map((h) => (
                              <th key={h} scope="col">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.settlement.map((row) => (
                            <tr key={row.no}>
                              <td>
                                <span aria-hidden="true">{row.right ? "✓" : "✗"}</span>
                                <span style={visuallyHidden}>{row.right ? t.RIGHT : t.WRONG}</span>
                              </td>
                              <td>{row.no}</td>
                              <td>{row.pass ? t.PASS_LABEL : t.FAIL_LABEL}</td>
                              <td>
                                {row.who}
                                {row.note && <span className="xr-settlement__note">{row.note}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {m.footer?.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {m.result && (
                      <div className="xr-form__result">
                        {m.result.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                    {m.attachments?.map((a) => (
                      <button key={a.tab} type="button" className="kere-msg__jump" onClick={() => openTab(a.tab)}>
                        → {a.label}
                      </button>
                    ))}
                    {m.options && m.id === lastWithOptions && (
                      <div className="kere-msg__options">
                        {m.options.map((o) => (
                          <button key={o} type="button" onClick={() => send(o)} disabled={busy}>
                            ▸ {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {thinking && (
              <div className="kere-msg">
                <span className="kere-msg__who">{S.NAME}</span>
                <div className="kere-msg__body kere-msg__body--thinking">
                  <KereAvatar expression="thinking" bare />
                </div>
              </div>
            )}
          </div>

          <form className="kere-chat__form" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="kere-chat__input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/\r?\n/g, " "))}
              onKeyDown={handleKeyDown}
              placeholder={t.INPUT_PLACEHOLDER}
              aria-label="Message"
              lang={S.htmlLang(lang)}
              maxLength={200}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              className="kere-chat__send"
              disabled={busy || !input.trim()}
              onMouseDown={(e) => e.preventDefault()}
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          ref={launcherRef}
          type="button"
          className="kere-launcher"
          onClick={() => {
            setOpen(true);
            setUnread(false);
          }}
          aria-label={unread ? `Open ${S.NAME}, new message` : `Open ${S.NAME}`}
        >
          {unread && <span className="kere-launcher__hint kere-launcher__hint--alert">!</span>}
          <XrAvatar face={face} />
        </button>
      )}
    </>
  );
}

export default XrMode;
