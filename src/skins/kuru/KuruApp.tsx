import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useSkin } from "../../SkinContext";
import Scene from "./Scene";
import Overlay from "./Overlay";
import ConnectOverlay from "./ConnectOverlay";
import CatDialogue, { type CatDialogueHandle } from "./CatDialogue";
import BgmPlayer from "./BgmPlayer";
import LoadingScreen from "./LoadingScreen";
import { CAT_DIALOGUES } from "./data/catDialogues";
import "./style.css";

export type SectionId = "about" | "projects" | "works" | "credits";
export type Phase = "idle" | "zooming" | "connecting" | "panel" | "open";

function KuruApp() {
  const { setSkin } = useSkin();
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeDialogue, setActiveDialogue] = useState<string[] | null>(null);
  const pendingRef = useRef<SectionId | null>(null);
  const lastDialogueRef = useRef(-1);
  const dialogueRef = useRef<CatDialogueHandle>(null);

  const handleSectionClick = useCallback((section: SectionId) => {
    if (phase !== "idle" || activeDialogue) return;
    pendingRef.current = section;
    setActiveSection(section);
    setPhase("zooming");
  }, [phase, activeDialogue]);

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

  const handleDialogueClose = useCallback(() => {
    setActiveDialogue(null);
  }, []);

  const handleExit = useCallback(() => {
    if (activeDialogue) return;
    setSkin("kiri");
  }, [activeDialogue, setSkin]);

  const handleDialogueAdvance = useCallback(() => {
    if (phase !== "idle") return;
    if (activeDialogue) {
      dialogueRef.current?.advance();
      return;
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * CAT_DIALOGUES.length);
    } while (idx === lastDialogueRef.current && CAT_DIALOGUES.length > 1);
    lastDialogueRef.current = idx;
    setActiveDialogue(CAT_DIALOGUES[idx]);
  }, [phase, activeDialogue]);

  return (
    <div className="kuru">
      <Canvas
        camera={{ position: [-1.15, -1.1, -2.35], fov: 50, rotation: [0.01, -3.12, 0] }}
        className="kuru-canvas"
        flat
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene
            onSectionClick={handleSectionClick}
            onExit={handleExit}
            zoomTarget={activeSection}
            phase={phase}
            onZoomDone={handleZoomDone}
            onCatClick={handleDialogueAdvance}
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
      {activeDialogue && (
        <CatDialogue
          ref={dialogueRef}
          dialogue={activeDialogue}
          onClose={handleDialogueClose}
        />
      )}
      <BgmPlayer />
      <LoadingScreen />
    </div>
  );
}

export default KuruApp;
