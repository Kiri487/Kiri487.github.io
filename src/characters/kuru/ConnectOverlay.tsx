import { useEffect, useState } from "react";
import type { SectionId } from "./KuruApp";

interface ConnectOverlayProps {
  section: SectionId | null;
  active: boolean;
  onDone: () => void;
}

const LINES: Record<SectionId, string[]> = {
  about: [
    "> LINK sec:about",
    "> AUTH ··· OK",
    "> LOADING USER PROFILE",
  ],
  projects: [
    "> LINK sec:projects",
    "> SCAN ··· OK",
    "> LOADING PROJECT INDEX",
  ],
  works: [
    "> LINK sec:works",
    "> SYNC ··· OK",
    "> LOADING GALLERY DATA",
  ],
  credits: [
    "> LINK sec:credits",
    "> VERIFY ··· OK",
    "> LOADING SYSTEM INFO",
  ],
};

function ConnectOverlay({ section, active, onDone }: ConnectOverlayProps) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [collapsing, setCollapsing] = useState(false);

  useEffect(() => {
    if (!active || !section) {
      setStep(0);
      setExpanded(false);
      setCollapsing(false);
      return;
    }

    const t1 = setTimeout(() => setExpanded(true), 50);
    const lines = LINES[section];
    const timers = lines.map((_, i) =>
      setTimeout(() => setStep(i + 1), 350 + i * 280)
    );
    const collapseAt = 350 + lines.length * 280 + 300;
    const tc = setTimeout(() => setCollapsing(true), collapseAt);
    const td = setTimeout(onDone, collapseAt + 250);

    return () => {
      clearTimeout(t1);
      timers.forEach(clearTimeout);
      clearTimeout(tc);
      clearTimeout(td);
    };
  }, [active, section, onDone]);

  if (!active || !section) return null;

  const lines = LINES[section];

  return (
    <div className="kuru-connect" data-section={section}>
      <div
        className={
          "kuru-connect__box" +
          (expanded ? " kuru-connect__box--open" : "") +
          (collapsing ? " kuru-connect__box--close" : "")
        }
      >
        <div className="kuru-connect__content">
          {lines.slice(0, step).map((line, i) => (
            <div key={i} className="kuru-connect__line">{line}</div>
          ))}
          {step >= lines.length && (
            <div className="kuru-connect__line kuru-connect__line--ok">
              [CONNECTED]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectOverlay;
