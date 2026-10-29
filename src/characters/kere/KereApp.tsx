import CvHeader from "./cv/CvHeader";
import CvSections from "./cv/CvSections";
import KereAssistant from "./assistant/KereAssistant";
import "./style.css";

function KereApp() {
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
      <main className="kere">
        <CvHeader />
        <CvSections />
      </main>
      <KereAssistant />
    </>
  );
}

export default KereApp;
