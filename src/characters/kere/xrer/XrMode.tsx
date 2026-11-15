import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { readJson, writeJson } from "../../../shared/storage";
import { visuallyHidden } from "../../../shared/visuallyHidden";
import KereAvatar from "../avatar/KereAvatar";
import { loadSfxEnabled, saveSfxEnabled, unlockSfx } from "../assistant/sfx";
import { SFX_PHRASES } from "../assistant/script";
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
import { XR_THINKING_MS, type XrFace } from "./faces";
import { createRound, isXr, type Round } from "./round";
import * as S from "./script";
import { playXrOpenSfx, playXrReplySfx } from "./sfx";
import XrAvatar from "./XrAvatar";
import { ApplicantDocument, RecordDocument, RulesDocument } from "./XrDocuments";
import "./xrer.css";

/** Long enough to read "審查中止。" before Kere takes over again. */
const LEAVE_DELAY_MS = 1000;
/** Between XR's closing words and the settlement sheet. */
const SETTLEMENT_DELAY_MS = 1800;
const ENDINGS_KEY = "xrEndingsSeen";

type Phase = "consent" | "review" | "closing" | "done" | "leaving";

/** "rules", "record", or an applicant's index as a string. */
type TabId = string;

interface Attachment {
  tab: TabId;
  label: string;
}

type Message =
  | { id: number; from: "you"; text: string }
  | {
      id: number;
      from: "xr" | "form";
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
    };

type XrMessage = Omit<Extract<Message, { from: "xr" | "form" }>, "id">;

const REVIEW_OPTIONS = [S.PASS_LABEL, S.FAIL_LABEL, S.ASK_LABEL];

/** Lowercase, punctuation → spaces, padded so English phrases match whole words. */
function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, " ").trim()} `;
}

function said(text: string, phrases: readonly string[]): boolean {
  const n = normalize(text);
  const compact = n.replace(/ /g, "");
  return phrases.some((p) => (/[㐀-鿿]/.test(p) ? compact.includes(p.replace(/ /g, "")) : n.includes(` ${p} `)));
}

function loadSeenEndings(): EndingId[] {
  const saved = readJson(ENDINGS_KEY);
  return Array.isArray(saved) ? saved.filter((e): e is EndingId => typeof e === "string" && e in S.ENDING_NAMES) : [];
}

function sectionTitle(id: string): string {
  return SECTIONS.find((s) => s.id === id)?.title ?? id;
}

function faceForViolations(violations: number): XrFace {
  if (violations === 0) return "normal";
  return violations === 1 ? "alert" : "anxious";
}

interface XrModeProps {
  onLeave: (to: "kere" | "kiri") => void;
}

function XrMode({ onLeave }: XrModeProps) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [round, setRound] = useState<Round | null>(null);
  /** The file on the desk. */
  const [current, setCurrent] = useState(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [clauseIssued, setClauseIssued] = useState(false);
  const [violations, setViolations] = useState(0);
  /** Questions asked per file. */
  const [asks, setAsks] = useState<number[]>([]);
  const [record, setRecord] = useState<RecordState>({ type: "kiri" });
  /** A face held for a moment (or for the rest of the round, in the closing). */
  const [faceOverride, setFaceOverride] = useState<XrFace | null>(null);
  const [tab, setTab] = useState<TabId>("record");

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "form", title: S.CONSENT_TITLE, lines: S.CONSENT, options: [S.START_LABEL, S.BACK_LABEL] },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [open, setOpen] = useState(true);
  const [unread, setUnread] = useState(false);
  // Kere's sound setting covers XR too: muting either one mutes both.
  const [sfxEnabled] = useState(loadSfxEnabled);
  /** The live setting: a mute command takes effect on its own reply, before the next render. */
  const soundOn = useRef(sfxEnabled);

  const nextId = useRef(1);
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

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, thinking, open]);

  useChatViewport(open, panelRef, logRef);

  // The whole page goes negative while XR is here (see xrer.css).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-xr", "");
    return () => root.removeAttribute("data-xr");
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
    const numbered = msgs.map((msg) => ({ ...msg, id: nextId.current++ }) as Message);
    setMessages((m) => [...m, ...numbered]);
    if (!openRef.current) setUnread(true);
    if (soundOn.current) playXrReplySfx(faceRef.current);
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
  const busy = thinking || phase === "closing" || phase === "leaving";
  /** Same speaker as the message before: drop the name and tuck it closer. Forms always stand alone. */
  const continues = (i: number) => {
    const m = messages[i];
    const prev = messages[i - 1];
    return m.from !== "form" && prev !== undefined && prev.from === m.from;
  };

  /* ---- the review itself ---- */

  const fileMessage = (r: Round, index: number, first: boolean): XrMessage => ({
    from: "xr",
    lines: [first ? S.FIRST_FILE : S.NEXT_FILE],
    attachments: [{ tab: String(index), label: S.tabApplicant(r.applicants[index].no) }],
    options: REVIEW_OPTIONS,
  });

  const startRound = (again: boolean) => {
    const r = createRound();
    setRound(r);
    setCurrent(0);
    setVerdicts([]);
    setClauseIssued(false);
    setViolations(0);
    setAsks(r.applicants.map(() => 0));
    setRecord({ type: "kiri" });
    setFaceOverride(null);
    setTab("rules");
    setPhase("review");
    post(
      {
        from: "xr",
        lines: again ? S.BRIEFING_AGAIN : S.BRIEFING,
        attachments: [{ tab: "rules", label: S.TAB_RULES }],
      },
      fileMessage(r, 0, true),
    );
  };

  const ask = (r: Round) => {
    const applicant = r.applicants[current];
    const n = asks[current] ?? 0;
    setAsks((a) => a.map((v, i) => (i === current ? v + 1 : v)));

    if (isXr(applicant)) {
      setFaceOverride("anxious");
      post({ from: "xr", lines: S.ASK_XR_FILE, options: REVIEW_OPTIONS });
      return;
    }
    let line: string;
    if (n >= 2) line = S.ASK_SELF_JUDGE;
    else if (n === 1) line = S.askSection(sectionTitle(applicant.hintSection));
    else if (!clauseIssued) line = S.ASK_GENERIC;
    else if (violations > 0) line = S.ASK_EVASIVE;
    else line = r.clause.check(applicant.cv) ? S.ASK_CLAUSE_PASS : S.ASK_CLAUSE_FAIL;
    setFaceOverride(null);
    post({ from: "xr", lines: [line], options: REVIEW_OPTIONS });
  };

  /** XR's closing words, step by step, then the settlement sheet. */
  const close = (r: Round, finalVerdicts: Verdict[]) => {
    setPhase("closing");
    const outcome: Outcome = decideOutcome(r, finalVerdicts);
    setRecord(outcome.record);

    let at = 0;
    outcome.steps.forEach((s) => {
      at += s.delay + 1200;
      later(() => {
        setFaceOverride(s.face);
        faceRef.current = s.face;
        post({ from: "xr", lines: s.lines });
      }, at);
    });

    at += SETTLEMENT_DELAY_MS;
    later(() => {
      const seen = loadSeenEndings();
      if (!seen.includes(outcome.id)) seen.push(outcome.id);
      writeJson(ENDINGS_KEY, seen);
      const sheet: XrMessage = {
        from: "form",
        title: S.SETTLEMENT_TITLE,
        lines: [],
        settlement: settlementRows(r, finalVerdicts),
        footer: [S.clauseReveal(r.clause.text)],
        result: [
          S.settlementResult(
            Object.keys(S.ENDING_NAMES).indexOf(outcome.id) + 1,
            S.ENDING_NAMES[outcome.id],
            seen.length,
            ENDING_COUNT,
          ),
        ],
        options: [S.AGAIN_LABEL, S.BACK_LABEL],
      };
      const msgs: XrMessage[] = [];
      if (outcome.showRecord) msgs.push({ from: "form", lines: [], attachments: [{ tab: "record", label: S.TAB_RECORD }] });
      msgs.push(sheet);
      post(...msgs);
      setPhase("done");
    }, at);
  };

  const stamp = (r: Round, pass: boolean) => {
    const applicant = r.applicants[current];
    const violation = pass && clauseIssued && !r.clause.check(applicant.cv);
    const passedBefore = verdicts.filter((v) => v.pass).length;
    const nextVerdicts = [...verdicts, { pass, afterClause: clauseIssued }];
    setVerdicts(nextVerdicts);

    const ack: string[] = [pass ? S.STAMPED_PASS : S.STAMPED_FAIL];
    let held: XrFace | null = null;
    if (violation) {
      ack.push(violations === 0 ? S.VIOLATION_FIRST : S.VIOLATION_AGAIN);
      setViolations((v) => v + 1);
    } else if (pass && passedBefore > 0) {
      ack.push(S.SECOND_PASS);
      held = "alert";
    }
    setFaceOverride(held);

    const msgs: XrMessage[] = [{ from: "xr", lines: ack }];
    const stamped = current + 1;
    const issueNow = !clauseIssued && stamped === r.clauseAfter;
    if (issueNow) {
      setClauseIssued(true);
      msgs.push({ from: "xr", lines: S.CLAUSE_ISSUED, attachments: [{ tab: "rules", label: S.TAB_RULES }] });
    }

    if (stamped < r.applicants.length) {
      setCurrent(stamped);
      msgs.push(fileMessage(r, stamped, false));
      post(...msgs);
      return;
    }

    post(...msgs);
    close(r, nextVerdicts);
  };

  /* ---- input ---- */

  /** Leave at any point, even mid-closing: XR doesn't argue. */
  const abort = (to: "kere" | "kiri") => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setThinking(false);
    setPhase("leaving");
    post({ from: "xr", lines: [S.ABORTED] });
    later(() => onLeave(to), LEAVE_DELAY_MS);
  };

  const reply = (text: string) => {
    if (said(text, S.KIRI_PHRASES) || said(text, S.EXIT_PHRASES)) {
      abort(said(text, S.KIRI_PHRASES) ? "kiri" : "kere");
      return;
    }

    // Sound commands work at any point, with whatever choices were on screen.
    const options =
      phase === "consent" ? [S.START_LABEL, S.BACK_LABEL] : phase === "done" ? [S.AGAIN_LABEL, S.BACK_LABEL] : REVIEW_OPTIONS;
    const setSound = (on: boolean, line: string) => {
      // Turning sound on confirms itself with the tick; turning it off stays silent.
      soundOn.current = on;
      saveSfxEnabled(on);
      post({ from: "xr", lines: [line], options });
    };
    if (said(text, SFX_PHRASES.on)) {
      if (soundOn.current) post({ from: "xr", lines: [S.SFX_ALREADY_ON], options });
      else setSound(true, S.SFX_ON);
      return;
    }
    if (said(text, SFX_PHRASES.shutUp)) {
      setFaceOverride("alert");
      if (soundOn.current) setSound(false, S.SFX_SHUT_UP);
      else post({ from: "xr", lines: [S.SFX_ALREADY_OFF], options });
      return;
    }
    if (said(text, SFX_PHRASES.off)) {
      if (soundOn.current) setSound(false, S.SFX_OFF);
      else post({ from: "xr", lines: [S.SFX_ALREADY_OFF], options });
      return;
    }
    if (said(text, SFX_PHRASES.status)) {
      post({ from: "xr", lines: [soundOn.current ? S.SFX_STATUS_ON : S.SFX_STATUS_OFF], options });
      return;
    }

    if (phase === "consent") {
      if (said(text, [S.START_LABEL, "開始", "start"])) startRound(false);
      else post({ from: "form", lines: [S.CHOOSE], options: [S.START_LABEL, S.BACK_LABEL] });
      return;
    }

    if (phase === "done") {
      if (said(text, [S.AGAIN_LABEL, "再一輪", "again"])) startRound(true);
      else post({ from: "form", lines: [S.CHOOSE], options: [S.AGAIN_LABEL, S.BACK_LABEL] });
      return;
    }

    if (phase !== "review" || !round) return;
    // 不合格 contains 合格, so it's checked first.
    if (said(text, [S.FAIL_LABEL, "fail"])) stamp(round, false);
    else if (said(text, [S.PASS_LABEL, "pass"])) stamp(round, true);
    else if (said(text, ["詢問", "ask"])) ask(round);
    else if (said(text, [S.TAB_RULES, "rules"])) {
      post({ from: "xr", lines: [], attachments: [{ tab: "rules", label: S.TAB_RULES }], options: REVIEW_OPTIONS });
    } else if (said(text, [S.TAB_RECORD, "record"])) {
      post({ from: "xr", lines: [], attachments: [{ tab: "record", label: S.TAB_RECORD }], options: REVIEW_OPTIONS });
    } else {
      setFaceOverride("alert");
      post({ from: "xr", lines: [S.UNKNOWN_COMMAND], options: REVIEW_OPTIONS });
    }
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const id = nextId.current++;
    setMessages((m) => [...m, { id, from: "you", text: trimmed }]);
    setInput("");
    setThinking(true);
    // A user gesture: lets the reply tick play after the timeout.
    unlockSfx();
    later(() => {
      setThinking(false);
      reply(trimmed);
    }, XR_THINKING_MS);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send(input);
  };

  /** An attachment means "go read this": the chat steps aside on every screen, so it doesn't cover the stamp. */
  const openTab = (id: TabId) => {
    setTab(id);
    window.scrollTo(0, 0);
    setOpen(false);
  };

  /* ---- page ---- */

  const delivered = round ? (phase === "review" ? current + 1 : round.applicants.length) : 0;
  const tabs: Attachment[] = [
    ...(round ? [{ tab: "rules", label: S.TAB_RULES }] : []),
    { tab: "record", label: S.TAB_RECORD },
    ...(round ? round.applicants.slice(0, delivered).map((a, i) => ({ tab: String(i), label: S.tabApplicant(a.no) })) : []),
  ];

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].tab);
    document.getElementById(`xr-tab-${tabs[next].tab}`)?.focus();
  };

  let panel: ReactNode = null;
  if (tab === "rules") panel = <RulesDocument clause={clauseIssued ? round?.clause : undefined} />;
  else if (tab === "record") panel = <RecordDocument record={record} />;
  else if (round) {
    const i = Number(tab);
    const a = round.applicants[i];
    panel = <ApplicantDocument cv={a.cv} letter={a.letter} pass={verdicts[i]?.pass} />;
  }

  return (
    <>
      <div className="xr">
        <h1 style={visuallyHidden} lang="zh-Hant">
          {S.CONSENT_TITLE}
        </h1>
        <div className="xr-tabs" role="tablist" aria-label={S.FORM} lang="zh-Hant">
          {tabs.map((t, i) => (
            <button
              key={t.tab}
              id={`xr-tab-${t.tab}`}
              type="button"
              role="tab"
              className="xr-tabs__tab"
              aria-selected={tab === t.tab}
              aria-controls="xr-panel"
              tabIndex={tab === t.tab ? 0 : -1}
              onClick={() => setTab(t.tab)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="xr-tabs__leave" onClick={() => abort("kere")} disabled={phase === "leaving"}>
            ▸ {S.BACK_LABEL}
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
            <XrAvatar key={String(thinking)} face={face} thinking={thinking} />
            <span className="kere-chat__name">{S.NAME}</span>
            <button type="button" className="kere-chat__minimize" onClick={() => setOpen(false)} aria-label="Minimize">
              –
            </button>
          </div>

          <div className="kere-chat__log" ref={logRef} aria-live="polite">
            {messages.map((m, i) =>
              m.from === "you" ? (
                <div key={m.id} className={continues(i) ? "kere-msg kere-msg--you xr-msg--cont" : "kere-msg kere-msg--you"}>
                  <span className="kere-msg__who">{continues(i) ? "" : S.YOU_LABEL}</span>
                  <div className="kere-msg__body" lang="zh-Hant">
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
                  <div className="kere-msg__body" lang="zh-Hant">
                    {m.title && <p className="xr-form__title">{m.title}</p>}
                    {m.lines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {m.settlement && (
                      <table className="xr-settlement">
                        <thead>
                          <tr>
                            {S.SETTLEMENT_HEADINGS.map((h) => (
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
                                <span style={visuallyHidden}>{row.right ? "正確" : "錯誤"}</span>
                              </td>
                              <td>{row.no}</td>
                              <td>{row.pass ? S.PASS_LABEL : S.FAIL_LABEL}</td>
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
              placeholder="輸入指令…"
              aria-label="Message"
              lang="zh-Hant"
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
