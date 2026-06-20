import type { SectionId } from "./KuruApp";
import AboutContent from "./content/AboutContent";
import ProjectsContent from "./content/ProjectsContent";
import WorksContent from "./content/WorksContent";
import ContactContent from "./content/ContactContent";

const CONTENT: Record<SectionId, React.FC> = {
  about: AboutContent,
  projects: ProjectsContent,
  works: WorksContent,
  contact: ContactContent,
};

const TITLES: Record<SectionId, string> = {
  about: "ABOUT",
  projects: "PROJECTS",
  works: "WORKS",
  contact: "CONTACT",
};

interface OverlayProps {
  activeSection: SectionId | null;
  onClose: () => void;
}

function Overlay({ activeSection, onClose }: OverlayProps) {
  if (!activeSection) return null;

  const Content = CONTENT[activeSection];

  return (
    <div className="kuru-overlay kuru-overlay--active">
      <div className="kuru-overlay__backdrop" onClick={onClose} />
      <div className="kuru-overlay__panel">
        <button
          className="kuru-overlay__close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="kuru-overlay__title">{TITLES[activeSection]}</h2>
        <Content />
      </div>
    </div>
  );
}

export default Overlay;
