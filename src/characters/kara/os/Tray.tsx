import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PrinterIcon, SpeakerIcon, WarningIcon } from "../icons";
import Clock from "./Clock";
import { useDismiss } from "./useDismiss";

const BALLOON_DURATION_MS = 6000;

const TRAY_ITEMS: { id: string; label: string; content: ReactNode; balloon: string }[] = [
  {
    id: "printer",
    label: "The Printer",
    content: <PrinterIcon size={16} />,
    balloon: "The Printer is printing. It doesn't exist.",
  },
  {
    id: "security",
    label: "Security",
    content: <WarningIcon size={16} />,
    balloon: "Your computer might be at risk. Kara is using it.",
  },
  {
    id: "volume",
    label: "Volume",
    content: <SpeakerIcon size={16} />,
    balloon: "The volume is inside the radio. It likes it there.",
  },
  {
    id: "clock",
    label: "Clock",
    content: <Clock />,
    balloon: "Today is Tuesday (uninstalled).",
  },
];

function Tray() {
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenId(null), []);
  useDismiss(rootRef, openId !== null, close);

  useEffect(() => {
    if (openId === null) return;
    const timer = window.setTimeout(close, BALLOON_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [openId, close]);

  return (
    <div ref={rootRef} className="kara-tray">
      {TRAY_ITEMS.map(({ id, label, content, balloon }) => (
        <div key={id} className="kara-tray__slot">
          <button
            type="button"
            className="kara-tray__button"
            aria-label={label}
            aria-expanded={openId === id}
            onClick={() => setOpenId(openId === id ? null : id)}
          >
            {content}
          </button>
          {openId === id && (
            <div className="kara-balloon" role="status" onClick={close}>
              <p className="kara-balloon__text">{balloon}</p>
              <button type="button" className="kara-balloon__close" aria-label="Close">
                ×
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default Tray;
