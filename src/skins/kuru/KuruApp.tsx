import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";
import Overlay from "./Overlay";
import "./style.css";

export type SectionId = "about" | "projects" | "works" | "credits";

function KuruApp() {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  return (
    <div className="kuru">
      <Canvas
        camera={{ position: [-1.15, -1.1, -2.35], fov: 50, rotation: [0.01, -3.12, 0] }}
        className="kuru-canvas"
        flat
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene onSectionClick={setActiveSection} />
        </Suspense>
      </Canvas>
      <Overlay activeSection={activeSection} onClose={() => setActiveSection(null)} />
    </div>
  );
}

export default KuruApp;
