import type { SectionId } from "./KuruApp";
import AboutContent from "./content/AboutContent";
import ProjectsContent from "./content/ProjectsContent";
import WorksContent from "./content/WorksContent";
import CreditsContent from "./content/CreditsContent";

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
  onClose: () => void;
}

function Overlay({ activeSection, onClose }: OverlayProps) {
  if (!activeSection) return null;

  const Content = CONTENT[activeSection];

  return (
    <div className="kuru-overlay" data-section={activeSection}>
      <div className="kuru-overlay__backdrop" onClick={onClose} />
      <div className="kuru-overlay__frame">
        <div className="kuru-overlay__panel">
          <div className="kuru-overlay__header">
            <h2 className="kuru-overlay__title">{TITLES[activeSection]}</h2>
            <span className="kuru-overlay__barcode">KIRI487</span>
            <span className="kuru-overlay__id">KR-487</span>
            <button
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
