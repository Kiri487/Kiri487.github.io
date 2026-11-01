import { useEffect, useRef, useState } from "react";
import CharacterAvatar from "../../CharacterAvatar";
import { useWindow } from "../../os/context";
import { CHAT_PARTNERS, type ChatArgs, type ChatPartnerId } from "./conversations";
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
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [notices]);

  const nudge = () => {
    setNotices((current) => [
      ...current,
      "You have just sent a nudge.",
      ...(partner.nudgeReply ? [partner.nudgeReply] : []),
    ]);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // `translate` is separate from the transform that holds the window's position, so the two don't fight.
    rootRef.current?.closest(".kara-window")?.animate(SHAKE, { duration: 420 });
  };

  const isEmpty = partner.messages.length === 0 && notices.length === 0;

  return (
    <div ref={rootRef} className="kara-chat">
      <div className="kara-chat__main">
        <div ref={historyRef} className="kara-chat__history">
          <h3 className="kara-chat__history-title">Message history</h3>
          {isEmpty && <p className="kara-chat__notice">No messages yet.</p>}
          {partner.messages.map((message, index) => (
            <p key={index} className="kara-chat__message">
              <span className="kara-chat__sender">
                {message.from === "kara" ? "Kara" : partner.name} ({message.time}):
              </span>{" "}
              {message.text}
            </p>
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
