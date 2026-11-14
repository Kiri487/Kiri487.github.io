import { useEffect, useRef, type KeyboardEvent } from "react";
import type { SectionId, Phase } from "./types";
import AboutContent from "./content/AboutContent";
import ProjectsContent from "./content/ProjectsContent";
import WorksContent from "./content/WorksContent";
import CreditsContent from "./credits";

const CONTENT: Record<SectionId, React.FC> = {
  about: AboutContent,
  projects: ProjectsContent,
  works: WorksContent,
  credits: CreditsContent,
};

const TITLES: Record<SectionId, string> = {
  about: "ABOUT",
  projects: "PROJECTS",
  works: "WORKS",
  credits: "CREDITS",
};

interface OverlayProps {
  activeSection: SectionId | null;
  phase: Phase;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function Overlay({ activeSection, phase, onClose }: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = phase === "open";

  // Once open, the keyboard moves into the panel, Escape closes it, and closing gives the focus back to
  // whatever opened it (one of HotspotKeys' buttons).
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen, onClose]);

  /** Tab goes round inside the panel rather than out to the street behind it. */
  const keepTabInside = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!activeSection || (phase !== "panel" && phase !== "open")) return null;

  const Content = CONTENT[activeSection];

  return (
    <div
      className={
        "kuru-overlay" +
        (phase === "panel" ? " kuru-overlay--line" : "") +
        (phase === "open" ? " kuru-overlay--open" : "")
      }
      data-section={activeSection}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kuru-overlay-title"
      onKeyDown={keepTabInside}
    >
      <div className="kuru-overlay__backdrop" onClick={onClose} />
      <div className="kuru-overlay__frame">
        <div className="kuru-overlay__panel" ref={panelRef}>
          <div className="kuru-overlay__header">
            <h2 className="kuru-overlay__title" id="kuru-overlay-title">{TITLES[activeSection]}</h2>
            <span className="kuru-overlay__barcode">KIRI487</span>
            <span className="kuru-overlay__id">KR-487</span>
            <button
              ref={closeRef}
              type="button"
              className="kuru-overlay__close"
              onClick={onClose}
              aria-label="Close"
            >
              [&times;]
            </button>
          </div>
          <div className="kuru-overlay__body">
            <Content />
          </div>
          <div className="kuru-overlay__footer">
            <span>&gt; SYS.KIRI487</span>
            <span className="kuru-overlay__footer-sep">═══╡ 0x4B495249 ╞═══</span>
            <span>sec:{activeSection}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Overlay;
