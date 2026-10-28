import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSkin } from "../../../SkinContext";
import { MOBILE_QUERY } from "../../../shared/breakpoints";
import KereAvatar from "../avatar/KereAvatar";
import { THINKING_MS } from "../avatar/faces";
import { respond, type ReplyMemory } from "./respond";
import { GREETING, GREETING_OPTIONS } from "./script";
import type { Expression, Reply } from "./types";
import "./assistant.css";

/** Long enough to read the sign-off line before the skin switches. */
const EXIT_DELAY_MS = 1000;

type Message =
  | { id: number; from: "you"; text: string }
  | { id: number; from: "kere"; reply: Reply };

function KereAssistant() {
  const { setSkin } = useSkin();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [expression, setExpression] = useState<Expression>("normal");
  // Once opened, the visitor knows Kere is clickable — drop the "Ask Kere" hint until the next page load.
  const [hintSeen, setHintSeen] = useState(false);

  const nextId = useRef(0);
  const memory = useRef<ReplyMemory>(new Map());
  const timer = useRef<number | undefined>(undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openPanel = () => {
    if (messages.length === 0) {
      setMessages([{ id: nextId.current++, from: "kere", reply: { lines: [GREETING], options: GREETING_OPTIONS } }]);
    }
    setOpen(true);
    setHintSeen(true);
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((m) => [...m, { id: nextId.current++, from: "you", text: trimmed }]);
    setInput("");
    setThinking(true);
    setExpression("thinking");
    timer.current = window.setTimeout(() => {
      const reply = respond(trimmed, memory.current);
      setMessages((m) => [...m, { id: nextId.current++, from: "kere", reply }]);
      setExpression(reply.expression ?? "normal");
      setThinking(false);
      if (reply.action === "exit") {
        timer.current = window.setTimeout(() => setSkin("kiri"), EXIT_DELAY_MS);
      }
    }, THINKING_MS);
  };

  const handleSubmit = (e: FormEvent) => {
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
      <button type="button" className="kere-launcher" onClick={openPanel} aria-label="Open Kere assistant">
        {!hintSeen && <span className="kere-launcher__hint">Ask Kere</span>}
        <KereAvatar backed expression={expression === "thinking" ? "normal" : expression} />
      </button>
    );
  }

  return (
    <div
      className="kere-chat"
      role="dialog"
      aria-label="Kere assistant"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <div className="kere-chat__head">
        {/* Keyed so the thinking animation restarts from the first frame every time. */}
        <KereAvatar key={expression} expression={expression} />
        <span className="kere-chat__name">Kere</span>
        <button type="button" className="kere-chat__minimize" onClick={() => setOpen(false)} aria-label="Minimize">
          –
        </button>
      </div>

      <div className="kere-chat__log" ref={logRef} aria-live="polite">
        {messages.map((m) =>
          m.from === "you" ? (
            <div key={m.id} className="kere-msg kere-msg--you">
              <span className="kere-msg__who">You</span>
              <div className="kere-msg__body">
                <p>{m.text}</p>
              </div>
            </div>
          ) : (
            <KereMessage key={m.id} reply={m.reply} onOption={send} onJump={jumpTo} disabled={thinking} />
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
        <input
          ref={inputRef}
          className="kere-chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Kere something…"
          aria-label="Message"
          maxLength={200}
        />
        <button type="submit" className="kere-chat__send" disabled={thinking || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

interface KereMessageProps {
  reply: Reply;
  onOption: (query: string) => void;
  onJump: (id: string) => void;
  disabled: boolean;
}

function KereMessage({ reply, onOption, onJump, disabled }: KereMessageProps) {
  const { jump } = reply;
  return (
    <div className="kere-msg">
      <span className="kere-msg__who">Kere</span>
      <div className="kere-msg__body">
        {reply.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {jump && (
          <button type="button" className="kere-msg__jump" onClick={() => onJump(jump.id)}>
            → {jump.label}
          </button>
        )}
        {reply.options && (
          <div className="kere-msg__options">
            {reply.options.map((o) => (
              <button key={o.query} type="button" onClick={() => onOption(o.query)} disabled={disabled}>
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
