import CvHeader from "./cv/CvHeader";
import CvSections from "./cv/CvSections";
import KereAssistant from "./assistant/KereAssistant";
import "./style.css";

function KereApp() {
  return (
    <>
      <main className="kere">
        <CvHeader />
        <CvSections />
      </main>
      <KereAssistant />
    </>
  );
}

export default KereApp;
