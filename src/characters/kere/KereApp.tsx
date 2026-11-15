import { lazy, Suspense, useState } from "react";
import { useSkin } from "../../SkinContext";
import CvHeader from "./cv/CvHeader";
import CvSections from "./cv/CvSections";
import KereAssistant from "./assistant/KereAssistant";
import type { Lang, WelcomeNote } from "./assistant/types";
import { loadXrMode } from "./xrer/load";
import { hasXrSession } from "./xrer/session";
import "./style.css";

/** XR's review is a hidden easter egg, so its code only loads once someone finds it. */
const XrMode = lazy(loadXrMode);

/** "back": returned from XR's review, so Kere opens with a welcome back. */
type Mode = "kere" | "xr" | "back";

function KereApp() {
  const { setSkin } = useSkin();
  // A review left mid-way by a refresh goes straight back to XR.
  const [mode, setMode] = useState<Mode>(() => (hasXrSession() ? "xr" : "kere"));
  /** The language XR's review ran in, for Kere's welcome back. */
  const [backLang, setBackLang] = useState<Lang>("en");
  /** What from the review, if anything, colours that welcome back. */
  const [backNote, setBackNote] = useState<WelcomeNote | undefined>(undefined);

  /** The language Kere was asked in, when the handover came from her. */
  const [triggerLang, setTriggerLang] = useState<Lang | undefined>(undefined);

  const enterXr = (lang: Lang) => {
    window.scrollTo(0, 0);
    setTriggerLang(lang);
    setMode("xr");
  };

  const leaveXr = (to: "kere" | "kiri", lang: Lang, note?: WelcomeNote) => {
    if (to === "kiri") {
      setSkin("kiri");
      return;
    }
    window.scrollTo(0, 0);
    setBackLang(lang);
    setBackNote(note);
    setMode("back");
  };

  return (
    <>
      <title>Kiri Wu | CV</title>
      {/* Chinese chat text. Google splits the font into unicode-range slices, so English-only visitors download no
          font files at all, and Chinese ones only the slices their characters need. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700&display=swap"
        precedence="default"
      />
      {mode === "xr" ? (
        <Suspense fallback={null}>
          <XrMode onLeave={leaveXr} triggerLang={triggerLang} />
        </Suspense>
      ) : (
        <>
          <main className="kere">
            <CvHeader />
            <CvSections />
          </main>
          <KereAssistant
            key={mode}
            welcomeBack={mode === "back" ? backLang : undefined}
            welcomeNote={mode === "back" ? backNote : undefined}
            onEnterXr={enterXr}
          />
        </>
      )}
    </>
  );
}

export default KereApp;
