import { useEffect, useRef, useState } from "react";
import CharacterAvatar from "../../CharacterAvatar";
import { useWindow } from "../../os/context";
import { CHAT_PARTNERS, chatTime, pickNudgeReply, type ChatArgs, type ChatPartnerId } from "./conversations";
import "./chat.css";

const SHAKE: Keyframe[] = [
  { translate: "0 0" },
  { translate: "-7px 2px" },
  { translate: "6px -3px" },
  { translate: "-5px -2px" },
  { translate: "5px 3px" },
  { translate: "-3px 1px" },
  { translate: "0 0" },
];

function Conversation({ partnerId }: { partnerId: ChatPartnerId }) {
  const partner = CHAT_PARTNERS[partnerId];
  const rootRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastReplyRef = useRef<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);

  // Opens at the top so the history reads from the start. Only a nudge jumps to the bottom, where its notice lands.
  useEffect(() => {
    if (notices.length > 0 && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [notices]);

  const nudge = () => {
    const reply = pickNudgeReply(partner.nudgeReplies, lastReplyRef.current);
    lastReplyRef.current = reply;
    setNotices((current) => [...current, "You have just sent a nudge.", reply]);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // `translate` is separate from the transform that holds the window's position, so the two don't fight.
    rootRef.current?.closest(".kara-window")?.animate(SHAKE, { duration: 420 });
  };

  return (
    <div ref={rootRef} className="kara-chat">
      <div className="kara-chat__main">
        <div ref={historyRef} className="kara-chat__history">
          {partner.conversations.map((conversation, conversationIndex) => (
            <section key={conversation.date} className="kara-chat__conversation">
              <h3 className="kara-chat__date">{conversation.date}</h3>
              {conversation.lines.map((line, lineIndex) =>
                "system" in line ? (
                  <p key={lineIndex} className="kara-chat__notice">
                    {line.system}
                  </p>
                ) : (
                  <p key={lineIndex} className="kara-chat__message">
                    <span className="kara-chat__sender">
                      {line.from === "kara" ? "Kara" : partner.name} ({chatTime(conversationIndex, lineIndex)}):
                    </span>{" "}
                    {line.text}
                  </p>
                ),
              )}
            </section>
          ))}
          {notices.map((notice, index) => (
            <p key={index} className="kara-chat__notice">
              {notice}
            </p>
          ))}
        </div>

        <div className="kara-chat__avatars">
          <CharacterAvatar character={partnerId} size={72} />
          <CharacterAvatar character="kara" size={72} />
        </div>
      </div>

      <div className="kara-chat__footer">
        <button type="button" className="kara-chat__nudge" onClick={nudge}>
          Nudge
        </button>
        <span className="kara-chat__status">{partner.name} appears to be offline.</span>
      </div>
    </div>
  );
}

function ChatApp() {
  const { args } = useWindow();
  const { partner } = args as ChatArgs;

  // The key starts a clean window when the visitor switches to another character.
  return <Conversation key={partner} partnerId={partner} />;
}

export default ChatApp;
