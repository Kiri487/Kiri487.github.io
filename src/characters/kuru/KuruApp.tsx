import { Suspense, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useSkin } from "../../SkinContext";
import KuruScene from "./scene/KuruScene";
import Overlay from "./Overlay";
import ConnectOverlay from "./ConnectOverlay";
import CharacterDialogue, { type CharacterDialogueHandle } from "../../shared/dialogue/CharacterDialogue";
import type { DialogueEntry } from "./dialogue/catDialogues";
import BgmPlayer from "./audio/BgmPlayer";
import LoadingScreen from "./LoadingScreen";
import HotspotKeys from "./HotspotKeys";
import KuruErrorBoundary from "./KuruErrorBoundary";
import useKuruMemory from "./dialogue/useKuruMemory";
import useSFX from "./audio/useSFX";
import "./style.css";

import type { SectionId, Phase, HotspotId } from "./types";

function KuruStreet() {
  const { setSkin } = useSkin();
  const { recordClick, pickDialogue, applyScore } = useKuruMemory();
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeDialogue, setActiveDialogue] = useState<DialogueEntry | null>(null);
  const [dialogueKey, setDialogueKey] = useState(0);
  const [focusedHotspot, setFocusedHotspot] = useState<HotspotId | null>(null);
  const { playBlip } = useSFX();
  const dialogueRef = useRef<CharacterDialogueHandle>(null);
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
      setDialogueKey((key) => key + 1);
      setActiveDialogue(rapidResult.dialogue);
      return;
    }

    if (activeDialogue) {
      dialogueRef.current?.advance();
      return;
    }

    setDialogueKey((key) => key + 1);
    setActiveDialogue(pickDialogue());
  }, [phase, activeDialogue, recordClick, pickDialogue]);

  const handleHotspotKey = useCallback((id: HotspotId) => {
    if (id === "exit") handleExit();
    else if (id === "cat") handleDialogueAdvance();
    else handleSectionClick(id);
  }, [handleExit, handleDialogueAdvance, handleSectionClick]);

  return (
    <div className="kuru">
      <title>Kuru's Hideout</title>
      <Canvas
        camera={{ position: [-1.15, -1.1, -2.35], fov: 50, rotation: [0.01, -3.12, 0] }}
        className="kuru-canvas"
        flat
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <KuruScene
            onSectionClick={handleSectionClick}
            onExit={handleExit}
            zoomTarget={activeSection}
            phase={phase}
            onZoomDone={handleZoomDone}
            onCatClick={handleDialogueAdvance}
            forceSwapRef={forceSwapRef}
            pauseAmbient={activeDialogue !== null}
            focused={focusedHotspot}
          />
        </Suspense>
      </Canvas>
      <HotspotKeys onFocusChange={setFocusedHotspot} onActivate={handleHotspotKey} />
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
        <CharacterDialogue
          key={dialogueKey}
          ref={dialogueRef}
          dialogue={activeDialogue}
          characterName="> KURU"
          className="kuru-dialogue"
          playBlip={playBlip}
          onClose={handleDialogueClose}
          onChoiceScore={applyScore}
        />
      )}
      <BgmPlayer />
      <LoadingScreen />
    </div>
  );
}

function KuruApp() {
  return (
    <KuruErrorBoundary>
      <KuruStreet />
    </KuruErrorBoundary>
  );
}

export default KuruApp;
