import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useSkin } from "../../SkinContext";
import Scene from "./Scene";
import Overlay from "./Overlay";
import ConnectOverlay from "./ConnectOverlay";
import CatDialogue, { type CatDialogueHandle } from "./CatDialogue";
import type { DialogueEntry } from "./data/catDialogues";
import BgmPlayer from "./BgmPlayer";
import LoadingScreen from "./LoadingScreen";
import useKuruMemory from "./useKuruMemory";
import "./style.css";

export type SectionId = "about" | "projects" | "works" | "credits";
export type Phase = "idle" | "zooming" | "connecting" | "panel" | "open";

function KuruApp() {
  const { setSkin } = useSkin();
  const { recordClick, pickDialogue, applyScore } = useKuruMemory();
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeDialogue, setActiveDialogue] = useState<DialogueEntry | null>(null);
  const dialogueRef = useRef<CatDialogueHandle>(null);
  const dialogueKeyRef = useRef(0);
  const pendingForceSwap = useRef(false);
  const forceSwapRef = useRef(false);

  const handleSectionClick = useCallback((section: SectionId) => {
    if (phase !== "idle" || activeDialogue) return;
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
  }, []);

  const handleDialogueClose = useCallback(() => {
    setActiveDialogue(null);
    if (pendingForceSwap.current) {
      pendingForceSwap.current = false;
      forceSwapRef.current = true;
    }
  }, []);

  const handleExit = useCallback(() => {
    if (activeDialogue) return;
    setSkin("kiri");
  }, [activeDialogue, setSkin]);

  const handleDialogueAdvance = useCallback(() => {
    if (phase !== "idle") return;

    const rapidResult = recordClick();

    if (rapidResult) {
      if (rapidResult.forceSwap) {
        pendingForceSwap.current = true;
      }
      dialogueKeyRef.current++;
      setActiveDialogue(rapidResult.dialogue);
      return;
    }

    if (activeDialogue) {
      dialogueRef.current?.advance();
      return;
    }

    dialogueKeyRef.current++;
    setActiveDialogue(pickDialogue());
  }, [phase, activeDialogue, recordClick, pickDialogue]);

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
            forceSwapRef={forceSwapRef}
            pauseAmbient={activeDialogue !== null}
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
          key={dialogueKeyRef.current}
          ref={dialogueRef}
          dialogue={activeDialogue}
          onClose={handleDialogueClose}
          onChoiceScore={applyScore}
        />
      )}
      <BgmPlayer />
      <LoadingScreen />
    </div>
  );
}

export default KuruApp;
