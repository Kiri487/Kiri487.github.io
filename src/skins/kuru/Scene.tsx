import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, Environment, Html } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { SectionId, Phase } from "./KuruApp";

const HOME_POS = new THREE.Vector3(-1.15, -1.1, -2.35);

const ZOOM_TARGETS: Record<SectionId, THREE.Vector3> = {
  about: new THREE.Vector3(-2.55, -0.55, -0.90),
  projects: new THREE.Vector3(1.05, -0.64, 0.00),
  works: new THREE.Vector3(-0.90, -1.75, -0.50),
  credits: new THREE.Vector3(-1.45, -0.95, -0.65),
};

interface GraffitiHotspotProps {
  texture: THREE.Texture;
  aspect: number;
  glowing?: boolean;
  onClick?: () => void;
}

function GraffitiHotspot({ texture, aspect, glowing, onClick }: GraffitiHotspotProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const emissiveTarget = (hovered || glowing) ? 0.5 : 0;

  const alphaData = useMemo(() => {
    const img = texture.image as HTMLImageElement;
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  }, [texture]);

  const checkAlpha = useCallback((uv: THREE.Vector2) => {
    if (!alphaData) return false;
    const x = Math.floor(uv.x * alphaData.w);
    const y = Math.floor((1 - uv.y) * alphaData.h);
    const idx = (y * alphaData.w + x) * 4 + 3;
    return alphaData.data[idx] > 25;
  }, [alphaData]);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity += (emissiveTarget - matRef.current.emissiveIntensity) * 0.08;
  });

  const onMove = useCallback((e: { uv?: THREE.Vector2 }) => {
    if (e.uv && checkAlpha(e.uv)) {
      if (!hovered) { setHovered(true); document.body.style.cursor = "pointer"; }
    } else {
      if (hovered) { setHovered(false); document.body.style.cursor = ""; }
    }
  }, [checkAlpha, hovered]);

  const onOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "";
  }, []);

  const scale = 0.55;

  return (
    <mesh
      position={[-2.55, -0.55, -0.1]}
      rotation={[0, -3.13, -0.14]}
      receiveShadow
      onPointerMove={onMove}
      onPointerOut={onOut}
      onClick={(e) => {
        e.stopPropagation();
        if (e.uv && checkAlpha(e.uv) && onClick) onClick();
      }}
    >
      <planeGeometry args={[aspect * scale, scale]} />
      <meshStandardMaterial
        ref={matRef}
        map={texture}
        emissiveMap={texture}
        emissive="#ffffff"
        emissiveIntensity={0}
        transparent
        alphaTest={0.05}
        roughness={0.85}
        metalness={0}
      />
    </mesh>
  );
}

interface WallObjectProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  texture?: THREE.Texture;
  color?: string;
  glowing?: boolean;
  onClick?: () => void;
}

function WallObject({ position, rotation, scale: s, texture, color = "#888", glowing, onClick }: WallObjectProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const emissiveTarget = (hovered || glowing) ? 0.5 : 0;

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity += (emissiveTarget - matRef.current.emissiveIntensity) * 0.08;
  });

  const onOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);
  const onOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "";
  }, []);

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      onPointerOver={onOver}
      onPointerOut={onOut}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      <planeGeometry args={[s[0], s[1]]} />
      {texture ? (
        <meshStandardMaterial
          ref={matRef}
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0}
          transparent
          alphaTest={0.05}
          roughness={0.85}
          metalness={0}
        />
      ) : (
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive="#ffffff"
          emissiveIntensity={0}
          roughness={0.85}
          metalness={0}
        />
      )}
    </mesh>
  );
}

function ExitHotspot({ onClick, flickerBases }: { onClick: () => void; flickerBases: React.MutableRefObject<number[]> }) {
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    flickerBases.current[1] = hovered ? 25 : 10;
  });

  return (
    <mesh
      position={[-0.22, -0.24, 0.67]}
      rotation={[0, -3.14, 0]}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <planeGeometry args={[0.32, 0.12]} />
      <meshStandardMaterial transparent opacity={0} />
    </mesh>
  );
}

const PAN_CALIBRATE = false;
const PAN_LEFT_X = 0.45;
const PAN_RIGHT_X = -1.35;

function CameraZoom({ target, phase, onDone }: {
  target: SectionId | null;
  phase: Phase;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const doneRef = useRef(false);
  const mouseX = useRef(0);
  const [panLeft, setPanLeft] = useState(PAN_LEFT_X);
  const [panRight, setPanRight] = useState(PAN_RIGHT_X);
  const panX = useRef(HOME_POS.x);

  useEffect(() => {
    doneRef.current = false;
  }, [target, phase]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.current = (e.clientX / window.innerWidth) * 2 - 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    if (!PAN_CALIBRATE) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "[") setPanLeft(panX.current);
      if (e.key === "]") setPanRight(panX.current);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useFrame((_, delta) => {
    if (phase === "idle") {
      const mx = mouseX.current;
      const edge = 0.15;
      const speed = PAN_CALIBRATE ? 2.0 : 1.2;
      if (mx < -1 + edge) {
        const strength = ((-1 + edge) - mx) / edge;
        panX.current += speed * strength * delta;
      } else if (mx > 1 - edge) {
        const strength = (mx - (1 - edge)) / edge;
        panX.current -= speed * strength * delta;
      }
      if (!PAN_CALIBRATE) {
        const lo = Math.min(panLeft, panRight);
        const hi = Math.max(panLeft, panRight);
        panX.current = Math.max(lo, Math.min(hi, panX.current));
      }
      camera.position.x += (panX.current - camera.position.x) * 0.08;
      camera.position.y += (HOME_POS.y - camera.position.y) * 0.04;
      camera.position.z += (HOME_POS.z - camera.position.z) * 0.04;
      return;
    }
    if (phase === "zooming" && target) {
      const dest = ZOOM_TARGETS[target];
      camera.position.lerp(dest, 0.06);
      if (!doneRef.current && camera.position.distanceTo(dest) < 0.05) {
        doneRef.current = true;
        onDone();
      }
    }
  });

  return PAN_CALIBRATE ? (
    <Html position={[0, 0.5, 2]} center style={{ pointerEvents: "none" }}>
      <pre
        style={{
          color: "#0f0",
          background: "rgba(0,0,0,0.8)",
          padding: "8px 14px",
          fontSize: "11px",
          fontFamily: "Courier New, monospace",
          whiteSpace: "pre",
          userSelect: "all",
          pointerEvents: "auto",
        }}
      >
{`PAN CALIBRATION
cam X:   ${panX.current.toFixed(2)}
left:    ${panLeft.toFixed(2)}
right:   ${panRight.toFixed(2)}
─────────────────
Move mouse to edges to pan
[ = set left bound here
] = set right bound here`}
      </pre>
    </Html>
  ) : null;
}

interface SceneProps {
  onSectionClick: (section: SectionId) => void;
  onExit: () => void;
  zoomTarget: SectionId | null;
  phase: Phase;
  onZoomDone: () => void;
}

function Scene({ onSectionClick, onExit, zoomTarget, phase, onZoomDone }: SceneProps) {
  const { scene } = useGLTF("/models/dirty_street.glb", true);
  const graffitiTex = useTexture("/textures/kiri487_graffiti.webp");
  const worksTex = useTexture("/textures/works_sticker.webp");
  const creditsTex = useTexture("/textures/cited_sticker.webp");
  const posterTex = useTexture("/textures/projects_poster.webp");
  const gl = useThree((s) => s.gl);
  gl.toneMappingExposure = 1.0;

  const worksAspect = worksTex.image ? worksTex.image.width / worksTex.image.height : 1.5;
  const worksScale = 0.17;

  const creditsAspect = creditsTex.image ? creditsTex.image.width / creditsTex.image.height : 0.6;
  const creditsScale = 1.06;

  const posterAspect = posterTex.image ? posterTex.image.width / posterTex.image.height : 1.20;
  const posterScale = 0.90;

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

  const aspect = graffitiTex.image ? graffitiTex.image.width / graffitiTex.image.height : 1.5;

  const lampTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(1.15, -1.85, 1.0);
    return obj;
  }, []);

  const exitTarget = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(-0.15, -1.9, 1.1);
    return obj;
  }, []);

  const exitLightRef = useRef<THREE.SpotLight>(null);
  const lampRef = useRef<THREE.SpotLight>(null);
  const redRef = useRef<THREE.PointLight>(null);

  const flickerState = useRef({
    bases: [4, 10, 1.5],
    dims: [1, 1, 1],
    next: 6 + Math.random() * 10,
    active: -1,
    burst: 0,
    until: 0,
  });

  useFrame((_, delta) => {
    const lights = [lampRef.current, exitLightRef.current, redRef.current];
    const f = flickerState.current;
    if (f.until > 0) {
      f.until -= delta;
      if (f.until <= 0) {
        f.dims[f.active] = 1;
        if (f.burst > 0) {
          f.burst--;
          f.dims[f.active] = 0.1 + Math.random() * 0.2;
          f.until = 0.06 + Math.random() * 0.06;
        } else {
          f.active = -1;
          f.next = 6 + Math.random() * 12;
        }
      }
    } else if (f.active === -1) {
      f.next -= delta;
      if (f.next <= 0) {
        f.active = Math.floor(Math.random() * 3);
        f.burst = 1 + Math.floor(Math.random() * 3);
        f.dims[f.active] = 0.15 + Math.random() * 0.2;
        f.until = 0.06 + Math.random() * 0.08;
      }
    }
    for (let i = 0; i < 3; i++) {
      if (!lights[i]) continue;
      lights[i]!.intensity += (f.bases[i] * f.dims[i] - lights[i]!.intensity) * 0.3;
    }
  });

  return (
    <>
      <CameraZoom target={zoomTarget} phase={phase} onDone={onZoomDone} />

      <Environment preset="night" environmentIntensity={0.25} />
      <ambientLight intensity={0.12} />

      <primitive object={lampTarget} />
      <spotLight
        ref={lampRef}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.001}
        position={[1.15, -0.05, 0.9]}
        target={lampTarget}
        angle={1.0}
        penumbra={0.6}
        intensity={4}
        color="#ffcc88"
        distance={5}
        decay={2}
      />

      <primitive object={exitTarget} />
      <spotLight
        ref={exitLightRef}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.001}
        position={[-0.15, -0.10, 1.0]}
        target={exitTarget}
        angle={1.0}
        penumbra={0.8}
        intensity={10}
        color="#33ff66"
        distance={4}
        decay={2}
      />

      <pointLight ref={redRef} position={[-1.15, -0.35, 0.25]} intensity={1.5} color="#ff4466" distance={4} decay={2} />
      <directionalLight position={[0, 4, 0]} intensity={0.06} color="#99aabb" />

      <primitive object={scene} />

      <ExitHotspot onClick={onExit} flickerBases={{ current: flickerState.current.bases }} />

      <GraffitiHotspot
        texture={graffitiTex}
        aspect={aspect}
        glowing={zoomTarget === "about" && phase !== "idle"}
        onClick={() => onSectionClick("about")}
      />

      <WallObject
        position={[1.10, -0.67, 1.01]}
        rotation={[0, -3.14, 0]}
        scale={[posterAspect * posterScale, posterScale]}
        texture={posterTex}
        glowing={zoomTarget === "projects" && phase !== "idle"}
        onClick={() => onSectionClick("projects")}
      />

      <WallObject
        position={[-0.94, -1.82, 0.12]}
        rotation={[-0.06, -3.49, 0.01]}
        scale={[worksAspect * worksScale, worksScale]}
        texture={worksTex}
        glowing={zoomTarget === "works" && phase !== "idle"}
        onClick={() => onSectionClick("works")}
      />

      <WallObject
        position={[-1.47, -0.96, 0.53]}
        rotation={[0, -3.14, 0]}
        scale={[creditsAspect * creditsScale, creditsScale]}
        texture={creditsTex}
        glowing={zoomTarget === "credits" && phase !== "idle"}
        onClick={() => onSectionClick("credits")}
      />

      <EffectComposer>
        <Bloom
          intensity={1.0}
          luminanceThreshold={0.7}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

useGLTF.preload("/models/dirty_street.glb", true);

export default Scene;
