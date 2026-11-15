import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSkin } from "../../../SkinContext";
import { MOBILE_QUERY } from "../../../shared/breakpoints";
import KereAvatar from "../avatar/KereAvatar";
import { THINKING_MS } from "../avatar/faces";
import { createReplyMemory, currentPeriod, detectLang, noteHint, pick, respond } from "./respond";
import { FACES } from "../avatar/faces";
import { XR_FACES } from "../xrer/faces";
import { loadXrMode } from "../xrer/load";
import { animate, coverAll, morphFace, NAME_MS, rollName, SCAN_MS, scanIn, scanOut } from "../xrer/transition";
import { prefersReducedMotion } from "../../../shared/motion";
import { GREETINGS, GREETING_OPTIONS, TIME_REPLIES, WELCOME_BACK } from "./script";
import { loadSfxEnabled, playOpenSfx, playReplySfx, saveSfxEnabled, unlockSfx } from "./sfx";
import { isReplyList, type Expression, type Lang, type QuickOption, type Reply } from "./types";
import { useChatViewport } from "./useChatViewport";
import "./assistant.css";

/** The greeting's language switch, typed out (spaces and case ignored). */
const SWITCH_WORDS = new Map<string, Lang>([
  ["切換為中文", "zh"],
  ["switchtoenglish", "en"],
]);

/** Long enough to read the sign-off line before the skin switches. */
const EXIT_DELAY_MS = 1000;
/** Kere's handover line stays up a while before the crossing into XR begins. */
const XR_HANDOFF_DELAY_MS = 900;
/** With reduced motion there's no crossing to watch, so the line just stays up longer. */
const XR_HANDOFF_STILL_MS = 3000;

/** The crossing between Kere and XR: which way, and how far along (see xrer/transition.ts). */
interface Crossing {
  dir: 1 | -1;
  /** Time into the crossing: name, face and scan all run from the same start. */
  t: number;
}

/** The crossing lasts as long as the slower of the scan and the name's roll. */
const CROSSING_MS = Math.max(SCAN_MS, NAME_MS);

/** Cells of the face that change, in order: hair over the left eye, the mouth, the right eye. */
const FACE_ORDER = [2, 3, 4];

type Message =
  | { id: number; from: "you"; text: string }
  | { id: number; from: "kere"; reply: Reply };

interface KereAssistantProps {
  /** Kere hands the visitor over to XR (the `xrer` easter egg). */
  /** `lang`: the language Kere answered the trigger in — Chinese only if it had Chinese in it. */
  onEnterXr: (lang: Lang) => void;
  /** Back from XR's review: open straight away with Kere's welcome back. */
  welcomeBack?: Lang;
}

function KereAssistant({ onEnterXr, welcomeBack }: KereAssistantProps) {
  const { setSkin } = useSkin();
  const [open, setOpen] = useState(welcomeBack !== undefined);
  const [messages, setMessages] = useState<Message[]>(() =>
    welcomeBack ? [{ id: -1, from: "kere", reply: { lines: [WELCOME_BACK[welcomeBack]], lang: welcomeBack } }] : [],
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [expression, setExpression] = useState<Expression>("normal");
  // Once opened, the visitor knows Kere is clickable — drop the "Ask Kere" hint until the next page load.
  const [hintSeen, setHintSeen] = useState(welcomeBack !== undefined);
  // Back from XR: start as Xrer, and turn back into Kere once the scan has withdrawn.
  const [crossing, setCrossing] = useState<Crossing | null>(() =>
    welcomeBack !== undefined && !prefersReducedMotion() ? { dir: -1, t: 0 } : null,
  );
  const [sfxEnabled, setSfxEnabled] = useState(loadSfxEnabled);
  // A reply landed while the panel was minimized — show "!" over the cat until it's reopened.
  const [unread, setUnread] = useState(false);

  const nextId = useRef(0);
  const memory = useRef(createReplyMemory());
  const timer = useRef<number | undefined>(undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  // Read by the reply timer, which outlives the render that started it.
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Don't deliver a pending reply after the skin unmounts.
  useEffect(() => {
    const pending = timer;
    return () => window.clearTimeout(pending.current);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, thinking, open]);

  useChatViewport(open, panelRef, logRef);

  // Back from XR: cover the page before it's ever painted, so XR's black doesn't flash white. XR's own clean-up
  // (taking the negative colours off) may not have run yet, so do that here too.
  useLayoutEffect(() => {
    if (welcomeBack === undefined || prefersReducedMotion()) return;
    document.documentElement.removeAttribute("data-xr");
    coverAll();
  }, [welcomeBack]);

  // ...then the scan withdraws while the face and name change back, all at once.
  useEffect(() => {
    if (welcomeBack === undefined || prefersReducedMotion()) return;
    let live = true;
    void Promise.all([scanOut(), animate(CROSSING_MS, (t) => live && setCrossing({ dir: -1, t }))]).then(
      () => live && setCrossing(null),
    );
    return () => {
      live = false;
    };
  }, [welcomeBack]);

  // Mid-crossing, the name and face shown in place of Kere's.
  const crossName =
    crossing && (crossing.dir === 1 ? rollName("Kere", crossing.t, 1) : rollName("Xrer", crossing.t, -1));
  const crossFace =
    crossing &&
    (crossing.dir === 1
      ? morphFace(FACES.normal, XR_FACES.normal, crossing.t, FACE_ORDER)
      : morphFace(XR_FACES.normal, FACES.normal, crossing.t, [...FACE_ORDER].reverse()));

  // Move focus with the panel: into the input on open, back to the cat on close, so keyboard users don't get lost.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) launcherRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const greeting = (lang: Lang): Message => {
    const lines: Reply["lines"] = [pick(memory.current, `greeting-${lang}`, GREETINGS[lang])];
    // Late at night is the one time Kere remarks on the hour without being asked.
    if (currentPeriod() === "night") lines.push(pick(memory.current, `night-greeting-${lang}`, TIME_REPLIES[lang].night));
    // The night line may hint at XR, and a greeting is a message like any other.
    noteHint(memory.current, lines);
    return { id: nextId.current++, from: "kere", reply: { lines, options: GREETING_OPTIONS[lang], lang } };
  };

  /** "切換為中文" / "Switch to English": the chat starts over, greeting and all, in that language. */
  const restartIn = (lang: Lang) => {
    if (thinking) return;
    setMessages([greeting(lang)]);
    setExpression("normal");
    if (sfxEnabled) playReplySfx();
  };

  const openPanel = () => {
    if (messages.length === 0) setMessages([greeting("en")]);
    setOpen(true);
    setHintSeen(true);
    setUnread(false);
    if (sfxEnabled) playOpenSfx();
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    // Typing the switch works like choosing it.
    const switchTo = SWITCH_WORDS.get(trimmed.toLowerCase().replace(/\s+/g, ""));
    if (switchTo) {
      setInput("");
      restartIn(switchTo);
      return;
    }
    setMessages((m) => [...m, { id: nextId.current++, from: "you", text: trimmed }]);
    setInput("");
    setThinking(true);
    setExpression("thinking");
    // Submitting is a user gesture; the tick plays after the timeout, which some browsers would otherwise block.
    unlockSfx();
    timer.current = window.setTimeout(() => {
      const reply = respond(trimmed, memory.current, sfxEnabled);
      setMessages((m) => [...m, { id: nextId.current++, from: "kere", reply }]);
      setExpression(reply.expression ?? "normal");
      setThinking(false);
      if (!openRef.current) setUnread(true);

      let soundOn = sfxEnabled;
      if (reply.action === "sfx-on" || reply.action === "sfx-off") {
        soundOn = reply.action === "sfx-on";
        setSfxEnabled(soundOn);
        saveSfxEnabled(soundOn);
      }
      // "sound on" confirms itself with the tick; "mute" stays silent.
      if (soundOn) playReplySfx();
      if (reply.action === "exit") {
        timer.current = window.setTimeout(() => setSkin("kiri"), EXIT_DELAY_MS);
      }
      if (reply.action === "xr") {
        // Start fetching XR's code now, so it's usually there by the time the crossing is over.
        void loadXrMode();
        const lang = reply.lang ?? "en";
        if (prefersReducedMotion()) {
          timer.current = window.setTimeout(() => onEnterXr(lang), XR_HANDOFF_STILL_MS);
        } else {
          // Name, face and scan all at once; XR takes the cover off once she's on screen.
          timer.current = window.setTimeout(async () => {
            await Promise.all([scanIn(), animate(CROSSING_MS, (t) => setCrossing({ dir: 1, t }))]);
            onEnterXr(lang);
          }, XR_HANDOFF_DELAY_MS);
        }
      }
    }, THINKING_MS);
  };

  const choose = (option: QuickOption) => {
    if (option.switchTo) restartIn(option.switchTo);
    else send(option.query);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  // A textarea's Enter adds a line break; here it sends. Not while an IME is composing, where Enter picks the
  // characters (Safari reports that keypress as keyCode 229 with isComposing already false).
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send(input);
  };

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // On phones the panel covers the page, so get out of the way.
    if (window.matchMedia(MOBILE_QUERY).matches) setOpen(false);
  };

  if (!open) {
    return (
      <button
        ref={launcherRef}
        type="button"
        className="kere-launcher"
        onClick={openPanel}
        aria-label={unread ? "Open Kere assistant, new message" : "Open Kere assistant"}
      >
        {!hintSeen && <span className="kere-launcher__hint">Ask Kere</span>}
        {hintSeen && unread && <span className="kere-launcher__hint kere-launcher__hint--alert">!</span>}
        <KereAvatar backed expression={expression === "thinking" ? "normal" : expression} />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="kere-chat"
      role="dialog"
      aria-label="Kere assistant"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <div className="kere-chat__head">
        {/* Keyed so the thinking animation restarts from the first frame every time. */}
        <KereAvatar key={expression} expression={expression} face={crossFace ?? undefined} />
        <span className="kere-chat__name">{crossName ?? "Kere"}</span>
        <button type="button" className="kere-chat__minimize" onClick={() => setOpen(false)} aria-label="Minimize">
          –
        </button>
      </div>

      <div className="kere-chat__log" ref={logRef} aria-live="polite">
        {messages.map((m) =>
          m.from === "you" ? (
            <div key={m.id} className="kere-msg kere-msg--you">
              <span className="kere-msg__who">You</span>
              <div className="kere-msg__body" lang={detectLang(m.text) === "zh" ? "zh-Hant" : undefined}>
                <p>{m.text}</p>
              </div>
            </div>
          ) : (
            <KereMessage key={m.id} reply={m.reply} onOption={choose} onJump={jumpTo} disabled={thinking} />
          ),
        )}
        {thinking && (
          <div className="kere-msg">
            <span className="kere-msg__who">Kere</span>
            <div className="kere-msg__body kere-msg__body--thinking">
              <KereAvatar expression="thinking" bare />
            </div>
          </div>
        )}
      </div>

      <form className="kere-chat__form" onSubmit={handleSubmit}>
        {/* A textarea, not an input: Chrome on phones puts its address/card/password bar above the keyboard for
            any text input (autocomplete="off" doesn't stop it), but never for a textarea. Kept to one line. */}
        <textarea
          ref={inputRef}
          className="kere-chat__input"
          rows={1}
          value={input}
          // Single-line chat: pasted line breaks become spaces.
          onChange={(e) => setInput(e.target.value.replace(/\r?\n/g, " "))}
          onKeyDown={handleKeyDown}
          placeholder="Ask Kere something…"
          aria-label="Message"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="submit"
          className="kere-chat__send"
          disabled={thinking || !input.trim()}
          // Don't take focus from the message box, so the phone keyboard stays up — same as its own send key.
          onMouseDown={(e) => e.preventDefault()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

interface KereMessageProps {
  reply: Reply;
  onOption: (option: QuickOption) => void;
  onJump: (id: string) => void;
  disabled: boolean;
}

function KereMessage({ reply, onOption, onJump, disabled }: KereMessageProps) {
  const { jump } = reply;
  return (
    <div className="kere-msg">
      <span className="kere-msg__who">Kere</span>
      {/* zh-Hant so browsers pick Traditional Chinese glyph shapes, not Japanese or Simplified ones. */}
      <div className="kere-msg__body" lang={reply.lang === "zh" ? "zh-Hant" : undefined}>
        {reply.lines.map((line, i) =>
          isReplyList(line) ? (
            <ul key={i} className="kere-msg__list">
              {line.list.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{line}</p>
          ),
        )}
        {jump && (
          <button type="button" className="kere-msg__jump" onClick={() => onJump(jump.id)}>
            → {jump.label}
          </button>
        )}
        {reply.options && (
          <div className="kere-msg__options">
            {reply.options.map((o) => (
              <button key={o.query} type="button" onClick={() => onOption(o)} disabled={disabled}>
                ▸ {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default KereAssistant;
