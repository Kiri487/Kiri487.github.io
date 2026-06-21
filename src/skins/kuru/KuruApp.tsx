import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useSkin } from "../../SkinContext";
import Scene from "./Scene";
import Overlay from "./Overlay";
import ConnectOverlay from "./ConnectOverlay";
import "./style.css";

export type SectionId = "about" | "projects" | "works" | "credits";
export type Phase = "idle" | "zooming" | "connecting" | "panel" | "open";

function KuruApp() {
  const { setSkin } = useSkin();
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const pendingRef = useRef<SectionId | null>(null);

  const handleSectionClick = useCallback((section: SectionId) => {
    if (phase !== "idle") return;
    pendingRef.current = section;
    setActiveSection(section);
    setPhase("zooming");
  }, [phase]);

  const handleZoomDone = useCallback(() => {
    setPhase("connecting");
  }, []);

  const handleConnectDone = useCallback(() => {
    setPhase("panel");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("open"));
    });
  }, []);

  const handleClose = useCallback(() => {
    setPhase("idle");
    setActiveSection(null);
    pendingRef.current = null;
  }, []);

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
          <Scene
            onSectionClick={handleSectionClick}
            onExit={() => setSkin("kiri")}
            zoomTarget={activeSection}
            phase={phase}
            onZoomDone={handleZoomDone}
          />
        </Suspense>
      </Canvas>
      <ConnectOverlay
        section={activeSection}
        active={phase === "connecting"}
        onDone={handleConnectDone}
      />
      <Overlay
        activeSection={activeSection}
        phase={phase}
        onClose={handleClose}
      />
    </div>
  );
}

export default KuruApp;
