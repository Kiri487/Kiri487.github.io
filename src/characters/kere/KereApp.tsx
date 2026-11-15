import { lazy, Suspense, useState } from "react";
import { useSkin } from "../../SkinContext";
import CvHeader from "./cv/CvHeader";
import CvSections from "./cv/CvSections";
import KereAssistant from "./assistant/KereAssistant";
import { loadXrMode } from "./xrer/load";
import "./style.css";

/** XR's review is a hidden easter egg, so its code only loads once someone finds it. */
const XrMode = lazy(loadXrMode);

/** "back": returned from XR's review, so Kere opens with a welcome back. */
type Mode = "kere" | "xr" | "back";

function KereApp() {
  const { setSkin } = useSkin();
  const [mode, setMode] = useState<Mode>("kere");

  const enterXr = () => {
    window.scrollTo(0, 0);
    setMode("xr");
  };

  const leaveXr = (to: "kere" | "kiri") => {
    if (to === "kiri") {
      setSkin("kiri");
      return;
    }
    window.scrollTo(0, 0);
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
          <XrMode onLeave={leaveXr} />
        </Suspense>
      ) : (
        <>
          <main className="kere">
            <CvHeader />
            <CvSections />
          </main>
          <KereAssistant key={mode} welcomeBack={mode === "back"} onEnterXr={enterXr} />
        </>
      )}
    </>
  );
}

export default KereApp;
