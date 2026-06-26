import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { SectionId, Phase } from "../types";
import useSFX from "../useSFX";
import KuruPostProcessing from "./KuruPostProcessing";
import CameraZoom from "./KuruCamera";
import KuruLighting from "./KuruLighting";
import { GraffitiHotspot, WallObject, ExitHotspot } from "./KuruHotspots";
import { VideoWithShadow } from "./KuruCharacter";

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
}

function Scene({ onSectionClick, onExit, zoomTarget, phase, onZoomDone, onCatClick, forceSwapRef, pauseAmbient }: SceneProps) {
  const [exitHovered, setExitHovered] = useState(false);
  const { playGlitch } = useSFX();
  const { scene } = useGLTF("/kuru/models/dirty_street.glb", true);
  const graffitiTex = useTexture("/kuru/textures/kiri487_graffiti.webp");
  const worksTex = useTexture("/kuru/textures/works_sticker.webp");
  const creditsTex = useTexture("/kuru/textures/cited_sticker.webp");
  const posterTex = useTexture("/kuru/textures/projects_poster.webp");
  const gl = useThree((s) => s.gl);

  useEffect(() => {
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

  const graffitiImg = texSize(graffitiTex);
  const aspect = graffitiImg ? graffitiImg.width / graffitiImg.height : 1.5;

  return (
    <>
      <CameraZoom target={zoomTarget} phase={phase} onDone={onZoomDone} />

      <Environment preset="night" environmentIntensity={0.25} />
      <ambientLight intensity={0.12} />

      <KuruLighting exitHovered={exitHovered} />

      <primitive object={scene} />

      <ExitHotspot onClick={onExit} onHoverChange={setExitHovered} disabled={pauseAmbient} />

      <GraffitiHotspot
        texture={graffitiTex}
        aspect={aspect}
        glowing={zoomTarget === "about" && phase !== "idle"}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("about")}
      />

      <WallObject
        position={[1.10, -0.67, 1.01]}
        rotation={[0, -3.14, 0]}
        scale={[posterAspect * posterScale, posterScale]}
        texture={posterTex}
        glowing={zoomTarget === "projects" && phase !== "idle"}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("projects")}
      />

      <WallObject
        position={[-0.94, -1.82, 0.12]}
        rotation={[-0.06, -3.49, 0.01]}
        scale={[worksAspect * worksScale, worksScale]}
        texture={worksTex}
        glowing={zoomTarget === "works" && phase !== "idle"}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("works")}
      />

      <WallObject
        position={[-1.47, -0.96, 0.53]}
        rotation={[0, -3.14, 0]}
        scale={[creditsAspect * creditsScale, creditsScale]}
        texture={creditsTex}
        glowing={zoomTarget === "credits" && phase !== "idle"}
        disabled={pauseAmbient}
        onClick={() => onSectionClick("credits")}
      />

      <VideoWithShadow contactShadowTex={contactShadowTex} onCatClick={onCatClick} playGlitch={playGlitch} forceSwapRef={forceSwapRef} pauseAmbient={pauseAmbient} />

      <KuruPostProcessing />
    </>
  );
}

useGLTF.preload("/kuru/models/dirty_street.glb", true);

export default Scene;
