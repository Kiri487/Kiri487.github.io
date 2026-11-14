import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { SectionId, Phase, HotspotId } from "../types";
import useSFX from "../audio/useSFX";
import KuruPostProcessing from "./KuruPostProcessing";
import KuruCamera from "./KuruCamera";
import KuruLighting from "./KuruLighting";
import { GraffitiHotspot, WallObject, ExitHotspot } from "./KuruHotspots";
import { VideoWithShadow } from "./KuruCharacter";
import { HOTSPOT_POSITIONS, WALL_VIDEOS } from "./config";

const texSize = (tex: THREE.Texture) => tex.image as { width: number; height: number } | undefined;

interface SceneProps {
  onSectionClick: (section: SectionId) => void;
  onExit: () => void;
  zoomTarget: SectionId | null;
  phase: Phase;
  onZoomDone: () => void;
  onCatClick?: () => void;
  forceSwapRef?: React.MutableRefObject<boolean>;
  pauseAmbient?: boolean;
  /** What the keyboard is on, which lights up as if pointed at. */
  focused?: HotspotId | null;
}

const STREET_MODEL = "/kuru/models/dirty_street.glb";
/** The model is Draco-compressed. Its decoder is served from the site (copied from three's own), not Google's CDN. */
const DRACO_DECODER = "/kuru/draco/";

function KuruScene({ onSectionClick, onExit, zoomTarget, phase, onZoomDone, onCatClick, forceSwapRef, pauseAmbient, focused = null }: SceneProps) {
  const [exitHovered, setExitHovered] = useState(false);
  /** Which of Kuru's videos is showing, so the camera knows where she is. */
  const catIndexRef = useRef(0);
  const { playGlitch } = useSFX();
  const { scene } = useGLTF(STREET_MODEL, DRACO_DECODER);
  const graffitiTex = useTexture("/kuru/textures/kiri487_graffiti.webp");
  const worksTex = useTexture("/kuru/textures/works_sticker.webp");
  const creditsTex = useTexture("/kuru/textures/cited_sticker.webp");
  const posterTex = useTexture("/kuru/textures/projects_poster.webp");
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js renderer configuration is intentionally imperative.
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  const worksImg = texSize(worksTex);
  const worksAspect = worksImg ? worksImg.width / worksImg.height : 1.5;
  const worksScale = 0.17;

  const creditsImg = texSize(creditsTex);
  const creditsAspect = creditsImg ? creditsImg.width / creditsImg.height : 0.6;
  const creditsScale = 1.06;

  const posterImg = texSize(posterTex);
  const posterAspect = posterImg ? posterImg.width / posterImg.height : 1.20;
  const posterScale = 0.90;

  const contactShadowTex = useMemo(() => {
    const s = 128;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(6, 14, 10, 0.33)");
    g.addColorStop(0.45, "rgba(6, 14, 10, 0.14)");
    g.addColorStop(1, "rgba(6, 14, 10, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }, []);

  useEffect(() => {
    return () => { contactShadowTex.dispose(); };
  }, [contactShadowTex]);

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat?.emissiveMap || (mat?.emissive && mat.emissive.getHex() !== 0)) {
          mat.emissiveIntensity = 2;
        }
      }
    });
  }, [scene]);

  const focusPoint = useCallback((id: HotspotId): [number, number, number] => (
    id === "cat" ? WALL_VIDEOS[catIndexRef.current].position : HOTSPOT_POSITIONS[id]
  ), []);

  const glowing = (section: SectionId) => (zoomTarget === section && phase !== "idle") || focused === section;

  const graffitiImg = texSize(graffitiTex);
  const aspect = graffitiImg ? graffitiImg.width / graffitiImg.height : 1.5;

  return (
    <>
      <KuruCamera target={zoomTarget} phase={phase} onDone={onZoomDone} focused={focused} focusPoint={focusPoint} />

      <Environment preset="night" environmentIntensity={0.25} />
      <ambientLight intensity={0.12} />

      <KuruLighting exitHovered={exitHovered || focused === "exit"} />

      <primitive object={scene} />

      <ExitHotspot onClick={onExit} onHoverChange={setExitHovered} disabled={pauseAmbient} />

      <GraffitiHotspot
        texture={graffitiTex}
        aspect={aspect}
        glowing={glowing("about")}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("about")}
      />

      <WallObject
        position={HOTSPOT_POSITIONS.projects}
        rotation={[0, -3.14, 0]}
        scale={[posterAspect * posterScale, posterScale]}
        texture={posterTex}
        cursorOwner="projects"
        glowing={glowing("projects")}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("projects")}
      />

      <WallObject
        position={HOTSPOT_POSITIONS.works}
        rotation={[-0.06, -3.49, 0.01]}
        scale={[worksAspect * worksScale, worksScale]}
        texture={worksTex}
        cursorOwner="works"
        glowing={glowing("works")}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("works")}
      />

      <WallObject
        position={HOTSPOT_POSITIONS.credits}
        rotation={[0, -3.14, 0]}
        scale={[creditsAspect * creditsScale, creditsScale]}
        texture={creditsTex}
        cursorOwner="credits"
        glowing={glowing("credits")}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("credits")}
      />

      <VideoWithShadow
        contactShadowTex={contactShadowTex}
        onCatClick={onCatClick}
        playGlitch={playGlitch}
        forceSwapRef={forceSwapRef}
        pauseAmbient={pauseAmbient}
        focused={focused === "cat"}
        visibleIndexRef={catIndexRef}
      />

      <KuruPostProcessing />
    </>
  );
}

useGLTF.preload(STREET_MODEL, DRACO_DECODER);

export default KuruScene;
