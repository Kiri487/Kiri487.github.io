import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useThree, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { SectionId, Phase } from "./types";
import useSFX from "./useSFX";
import KuruPostProcessing from "./scene/KuruPostProcessing";
import CameraZoom from "./scene/KuruCamera";
import { WALL_VIDEOS, type VideoConfig } from "./scene/config";
import { projectionVertexShader, projectionFragmentShader } from "./scene/shaders";

let _cursorOwner: string | null = null;
function setCursor(owner: string, hover: boolean) {
  if (hover) {
    _cursorOwner = owner;
    document.body.style.cursor = "pointer";
  } else if (_cursorOwner === owner) {
    _cursorOwner = null;
    document.body.style.cursor = "";
  }
}

interface GraffitiHotspotProps {
  texture: THREE.Texture;
  aspect: number;
  glowing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function GraffitiHotspot({ texture, aspect, glowing, disabled, onClick }: GraffitiHotspotProps) {
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
    const hit = !!(e.uv && checkAlpha(e.uv));
    setHovered(hit);
    setCursor("graffiti", hit);
  }, [checkAlpha]);

  const onOut = useCallback(() => {
    setHovered(false);
    setCursor("graffiti", false);
  }, []);

  const scale = 0.55;

  return (
    <mesh
      position={[-2.6, -0.6, -0.08]}
      rotation={[0, -3.13, -0.14]}
      receiveShadow
      onPointerMove={disabled ? undefined : onMove}
      onPointerOut={disabled ? undefined : onOut}
      onClick={disabled ? undefined : (e) => {
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
  disabled?: boolean;
  onClick?: () => void;
}

function WallObject({ position, rotation, scale: s, texture, color = "#888", glowing, disabled, onClick }: WallObjectProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const emissiveTarget = (hovered || glowing) ? 0.5 : 0;

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity += (emissiveTarget - matRef.current.emissiveIntensity) * 0.08;
  });

  const onOver = useCallback(() => {
    setHovered(true);
    setCursor("wall", true);
  }, []);
  const onOut = useCallback(() => {
    setHovered(false);
    setCursor("wall", false);
  }, []);

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      onPointerOver={disabled ? undefined : onOver}
      onPointerOut={disabled ? undefined : onOut}
      onClick={disabled ? undefined : (e) => { e.stopPropagation(); onClick?.(); }}
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

function ExitHotspot({ onClick, flickerBases, disabled }: { onClick: () => void; flickerBases: number[]; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    flickerBases[1] = hovered ? 25 : 10;
  });

  return (
    <mesh
      position={[-0.13, -0.16, 0.99]}
      rotation={[0, -3.14, 0]}
      onPointerOver={disabled ? undefined : () => { setHovered(true); setCursor("exit", true); }}
      onPointerOut={disabled ? undefined : () => { setHovered(false); setCursor("exit", false); }}
      onClick={disabled ? undefined : (e) => { e.stopPropagation(); onClick(); }}
    >
      <planeGeometry args={[0.32, 0.12]} />
      <meshStandardMaterial transparent opacity={0} />
    </mesh>
  );
}

function VideoWallObject({ config, glitchRef, alphaRef, videoRef, interactive, onClick }: {
  config: VideoConfig;
  glitchRef: React.MutableRefObject<{ value: number }>;
  alphaRef: React.MutableRefObject<number>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  interactive: boolean;
  onClick?: () => void;
}) {
  const [material, setMaterial] = useState<THREE.ShaderMaterial | null>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const hoveringCharacterRef = useRef(false);

  useEffect(() => {
    if (!interactive && hoveringCharacterRef.current) {
      hoveringCharacterRef.current = false;
      setCursor("video", false);
    }
    return () => {
      if (hoveringCharacterRef.current) {
        hoveringCharacterRef.current = false;
        setCursor("video", false);
      }
    };
  }, [interactive]);

  useEffect(() => {
    const v = document.createElement("video");
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("autoplay", "");
    v.setAttribute("loop", "");
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.style.position = "fixed";
    v.style.left = "-9999px";
    v.style.width = "1px";
    v.style.height = "1px";
    v.style.opacity = "0";
    v.style.pointerEvents = "none";

    v.src = config.src;

    document.body.appendChild(v);
    videoRef.current = v;

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.ShaderMaterial({
      vertexShader: projectionVertexShader,
      fragmentShader: projectionFragmentShader,
      uniforms: {
        uMap: { value: tex },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uAlpha: { value: 1 },
        uGamma: { value: config.gamma },
        uBrightness: { value: config.brightness },
        uTint: { value: new THREE.Vector3(...config.tint) },
      },
      transparent: true,
      depthWrite: false,
    });

    setMaterial(mat);

    v.load();
    v.play().catch((e) => {
      if (e.name !== "AbortError") { /* autoplay blocked or load aborted */ }
    });

    return () => {
      v.pause();
      document.body.removeChild(v);
      tex.dispose();
      mat.dispose();
      setMaterial(null);
      videoRef.current = null;
    };
  }, [config, videoRef]);

  const checkVideoAlpha = useCallback(
    (uv?: THREE.Vector2) => {
      const video = videoRef.current;
      if (
        !uv || !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth <= 0 || video.videoHeight <= 0
      ) {
        return false;
      }

      if (!hitCanvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        hitCanvasRef.current = canvas;
        hitContextRef.current = canvas.getContext("2d", { willReadFrequently: true });
      }

      const ctx = hitContextRef.current;
      if (!ctx) return false;

      const width = video.videoWidth;
      const height = video.videoHeight;
      const halfHeight = Math.floor(height / 2);

      const sourceX = THREE.MathUtils.clamp(Math.floor(uv.x * width), 0, width - 1);
      const sourceY = THREE.MathUtils.clamp(
        halfHeight + Math.floor((1 - uv.y) * halfHeight),
        halfHeight, height - 1,
      );

      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.drawImage(video, sourceX, sourceY, 1, 1, 0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        return pixel[0] > 64;
      } catch {
        return false;
      }
    },
    [videoRef],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      const hitCharacter = checkVideoAlpha(e.uv);
      if (hitCharacter) e.stopPropagation();
      if (hoveringCharacterRef.current !== hitCharacter) {
        hoveringCharacterRef.current = hitCharacter;
        setCursor("video", hitCharacter);
      }
    },
    [interactive, checkVideoAlpha],
  );

  const handlePointerOut = useCallback(() => {
    if (!hoveringCharacterRef.current) return;
    hoveringCharacterRef.current = false;
    setCursor("video", false);
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!interactive || !checkVideoAlpha(e.uv)) return;
      e.stopPropagation();
      onClick?.();
    },
    [interactive, checkVideoAlpha, onClick],
  );

  useFrame((_, delta) => {
    if (!material) return;
    material.uniforms.uTime.value += delta;
    material.uniforms.uGlitch.value = glitchRef.current.value;
    material.uniforms.uAlpha.value = alphaRef.current;
  });

  if (!material) return null;

  return (
    <mesh
      rotation={config.rotation}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerOut={interactive ? handlePointerOut : undefined}
      onClick={interactive ? handleClick : undefined}
    >
      <planeGeometry args={[config.aspect, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function VideoWithShadow({ contactShadowTex, onCatClick, playGlitch, forceSwapRef, pauseAmbient }: { contactShadowTex: THREE.Texture; onCatClick?: () => void; playGlitch: () => void; forceSwapRef?: React.MutableRefObject<boolean>; pauseAmbient?: boolean }) {
  const videoRefs = useMemo(
    () => WALL_VIDEOS.map(() => ({ current: null as HTMLVideoElement | null })),
    [],
  );
  const visibleIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRefs = useRef<(THREE.Group | null)[]>([]);
  const alphaRefs = useRef(WALL_VIDEOS.map((_, i) => ({ current: i === 0 ? 1 : 0 })));

  const glitchState = useRef({
    value: 0,
    phase: "idle" as "idle" | "ramp-up" | "crossfade" | "ramp-down",
    elapsed: 0,
    duration: 0,
    swapAtPeak: false,
    nextGlitch: 6 + Math.random() * 6,
    swapCooldown: 0,
    prevIndex: 0,
    nextIndex: 0,
  });

  useFrame((_, delta) => {
    const gs = glitchState.current;

    if (forceSwapRef?.current && gs.phase === "idle") {
      forceSwapRef.current = false;
      gs.phase = "ramp-up";
      gs.elapsed = 0;
      gs.swapAtPeak = true;
      gs.duration = 0.7 + Math.random() * 0.2;
      gs.nextGlitch = 6 + Math.random() * 6;
    }

    if (gs.phase === "idle" && !pauseAmbient) {
      gs.nextGlitch -= delta;
      if (gs.swapCooldown > 0) gs.swapCooldown -= delta;
      if (gs.nextGlitch <= 0) {
        gs.phase = "ramp-up";
        gs.elapsed = 0;
        gs.swapAtPeak = gs.swapCooldown <= 0 && Math.random() < 0.35;
        gs.duration = gs.swapAtPeak ? 0.7 + Math.random() * 0.2 : 0.15 + Math.random() * 0.1;
        gs.nextGlitch = 6 + Math.random() * 6;
      }
    } else if (gs.phase === "ramp-up") {
      gs.elapsed += delta;
      const half = gs.duration / 2;
      const intensity = gs.swapAtPeak ? 0.8 + Math.random() * 0.2 : 0.4 + Math.random() * 0.4;
      gs.value = Math.min(1, gs.elapsed / half) * intensity;
      if (gs.elapsed >= half) {
        if (gs.swapAtPeak) {
          gs.prevIndex = visibleIndexRef.current;
          gs.nextIndex = (visibleIndexRef.current + 1) % WALL_VIDEOS.length;
          const nextVideo = videoRefs[gs.nextIndex].current;
          if (nextVideo) nextVideo.currentTime = 0;
          gs.phase = "crossfade";
          gs.elapsed = 0;
          gs.swapCooldown = 15 + Math.random() * 10;
          playGlitch();
        } else {
          gs.phase = "ramp-down";
          gs.elapsed = 0;
        }
      }
    } else if (gs.phase === "crossfade") {
      gs.elapsed += delta;
      gs.value = 0.7 + Math.random() * 0.3;
      const CROSSFADE_DUR = 0.05;
      const t = Math.min(1, gs.elapsed / CROSSFADE_DUR);
      const noisy = Math.min(1, Math.max(0, t + (Math.random() - 0.5) * 0.15));
      alphaRefs.current[gs.prevIndex].current = 1 - noisy;
      alphaRefs.current[gs.nextIndex].current = noisy;
      if (gs.elapsed >= CROSSFADE_DUR) {
        alphaRefs.current[gs.prevIndex].current = 0;
        alphaRefs.current[gs.nextIndex].current = 1;
        visibleIndexRef.current = gs.nextIndex;
        setActiveIndex(gs.nextIndex);
        gs.phase = "ramp-down";
        gs.elapsed = 0;
      }
    } else if (gs.phase === "ramp-down") {
      gs.elapsed += delta;
      const half = gs.duration / 2;
      const fadeIntensity = gs.swapAtPeak ? 0.5 + Math.random() * 0.3 : 0.3 + Math.random() * 0.2;
      gs.value = Math.max(0, 1 - gs.elapsed / half) * fadeIntensity;
      if (gs.elapsed >= half) {
        gs.value = 0;
        gs.phase = "idle";
      }
    }

    const inCrossfade = gs.phase === "crossfade";
    for (let i = 0; i < containerRefs.current.length; i++) {
      const c = containerRefs.current[i];
      if (!c) continue;
      if (inCrossfade) {
        c.visible = i === gs.prevIndex || i === gs.nextIndex;
      } else {
        c.visible = i === visibleIndexRef.current;
        alphaRefs.current[i].current = i === visibleIndexRef.current ? 1 : 0;
      }
    }
  });

  return (
    <>
      {WALL_VIDEOS.map((cfg, i) => {
        const shadowPos: [number, number, number] = [
          cfg.position[0] + cfg.shadowOffset[0],
          cfg.position[1] + cfg.shadowOffset[1],
          cfg.position[2] + cfg.shadowOffset[2],
        ];
        return (
          <group key={cfg.src} ref={el => { containerRefs.current[i] = el; }}>
            <group position={cfg.position} scale={cfg.scale}>
              <VideoWallObject
                config={cfg}
                glitchRef={glitchState}
                alphaRef={alphaRefs.current[i]}
                videoRef={videoRefs[i]}
                interactive={activeIndex === i}
                onClick={activeIndex === i ? onCatClick : undefined}
              />
            </group>
            <mesh position={shadowPos} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={cfg.shadowSize} />
              <meshBasicMaterial map={contactShadowTex} transparent opacity={0.9} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

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
        position={[1.11, -0.05, 0.88]}
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

      <ExitHotspot onClick={onExit} flickerBases={flickerState.current.bases} disabled={pauseAmbient} />

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
