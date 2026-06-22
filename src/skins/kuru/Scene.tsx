import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { SectionId, Phase } from "./KuruApp";

const HOME_POS = new THREE.Vector3(-1.15, -1.1, -2.35);
const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches;

const ZOOM_TARGETS: Record<SectionId, THREE.Vector3> = {
  about: new THREE.Vector3(-2.55, -0.7, -0.90),
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
      position={[-2.6, -0.7, -0.08]}
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

interface VideoConfig {
  src: { webm: string; mov: string };
  aspect: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  shadowOffset: [number, number, number];
  shadowSize: [number, number];
  gamma: number;
  brightness: number;
  tint: [number, number, number];
}

const WALL_VIDEOS: VideoConfig[] = [
  {
    src: { webm: "/kuru/video/KuruWallAFK.webm", mov: "/kuru/video/KuruWallAFK_iOS.mov" },
    aspect: 934 / 1440,
    position: [-1.89, -1.32, -0.13],
    rotation: [0, -3.13, 0],
    scale: 1.17,
    shadowOffset: [0.05, -0.53, -0.09],
    shadowSize: [0.49, 0.26],
    gamma: 2.0,
    brightness: 0.08,
    tint: [1.0, 0.92, 0.88],
  },
  {
    src: { webm: "/kuru/video/KuruSitAFK.webm", mov: "/kuru/video/KuruSitAFK_iOS.mov" },
    aspect: 1334 / 1440,
    position: [1.19, -1.54, -0.15],
    rotation: [0, -3.13, 0],
    scale: 0.92,
    shadowOffset: [0.15, -0.35, 0.13],
    shadowSize: [0.41, 0.28],
    gamma: 2.0,
    brightness: 0.08,
    tint: [1.0, 0.92, 0.88],
  },
];

const projectionVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const projectionFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uGlitch;
  uniform float uGamma;
  uniform float uBrightness;
  uniform vec3 uTint;
  uniform float uAlpha;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 uv = vUv;

    float g = uGlitch;

    // Horizontal band displacement — many thin strips
    if (g > 0.0) {
      float bandSeed = floor(uv.y * 40.0) + floor(uTime * 30.0);
      float bandRand = hash(bandSeed);
      if (bandRand > 0.6) {
        float shift = (hash(bandSeed + 1.0) - 0.5) * 0.05 * g;
        uv.x += shift;
      }
    }

    // RGB separation
    float sep = g * 0.018;
    vec4 color;
    if (g > 0.0) {
      color.r = texture2D(uMap, uv + vec2(sep, 0.0)).r;
      color.g = texture2D(uMap, uv).g;
      color.b = texture2D(uMap, uv - vec2(sep, 0.0)).b;
      color.a = texture2D(uMap, uv).a;
    } else {
      color = texture2D(uMap, uv);
    }

    // Dim to match dark scene lighting, preserve contrast, slight warm tint
    color.rgb = pow(color.rgb, vec3(uGamma)) * uBrightness * uTint;

    // Brightness spike during glitch
    color.rgb *= 1.0 + g * 1.0;

    // Scanlines: thin horizontal lines, slowly drifting upward
    float scanline = sin((uv.y * 1400.0) + uTime * 2.5) * 0.5 + 0.5;
    scanline = smoothstep(0.42, 0.58, scanline);
    color.rgb -= scanline * 0.01;

    color.a *= (1.0 - g * 0.3) * uAlpha;
    if (color.a < 0.05) discard;
    gl_FragColor = color;
  }
`;

function VideoWallObject({ config, glitchRef, alphaRef, videoRef }: {
  config: VideoConfig;
  glitchRef: React.MutableRefObject<{ value: number }>;
  alphaRef: React.MutableRefObject<number>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}) {
  const [material, setMaterial] = useState<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.style.display = "none";

    const mov = document.createElement("source");
    mov.src = config.src.mov;
    mov.type = "video/quicktime";
    v.appendChild(mov);

    const webm = document.createElement("source");
    webm.src = config.src.webm;
    webm.type = "video/webm";
    v.appendChild(webm);

    document.body.appendChild(v);
    videoRef.current = v;

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;

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
      if (e.name !== "AbortError") console.warn("Video play failed:", e);
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

  useFrame((_, delta) => {
    if (!material) return;
    material.uniforms.uTime.value += delta;
    material.uniforms.uGlitch.value = glitchRef.current.value;
    material.uniforms.uAlpha.value = alphaRef.current;
  });

  if (!material) return null;

  return (
    <mesh position={[0, 0, 0]} rotation={config.rotation}>
      <planeGeometry args={[config.aspect * config.scale, config.scale]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// Calibrated safe scene boundaries.
// +X is visually left and -X is visually right because the camera faces roughly +Z.
const LEFT_BOUNDARY_POINT = new THREE.Vector3(3.68, HOME_POS.y, 1.0);
const RIGHT_BOUNDARY_POINT = new THREE.Vector3(-3.4, HOME_POS.y, -0.02);

// Keep the calibrated boundary slightly inside the viewport to avoid a 1px seam.
const SAFE_NDC_X = 0.98;
const CAMERA_X_SEARCH_MIN = -20;
const CAMERA_X_SEARCH_MAX = 20;
const CAMERA_X_SEARCH_STEPS = 60;

/**
 * Find the camera world-X that projects `point` to `targetNdcX`.
 *
 * NDC X:
 * -1 = viewport left edge
 *  1 = viewport right edge
 *
 * A cloned camera is used so the live camera never moves during calculation.
 */
function findCameraXForProjectedX(
  sourceCamera: THREE.PerspectiveCamera,
  aspect: number,
  point: THREE.Vector3,
  targetNdcX: number,
) {
  const testCamera = sourceCamera.clone() as THREE.PerspectiveCamera;
  const projected = new THREE.Vector3();

  testCamera.position.set(HOME_POS.x, HOME_POS.y, HOME_POS.z);
  testCamera.aspect = aspect;
  testCamera.updateProjectionMatrix();

  const evaluate = (cameraX: number) => {
    testCamera.position.x = cameraX;
    testCamera.updateMatrixWorld(true);
    projected.copy(point).project(testCamera);
    return projected.x - targetNdcX;
  };

  let low = CAMERA_X_SEARCH_MIN;
  let high = CAMERA_X_SEARCH_MAX;
  let lowValue = evaluate(low);
  let highValue = evaluate(high);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
    throw new Error("Could not project a scene boundary point.");
  }

  if (Math.abs(lowValue) < 1e-7) return low;
  if (Math.abs(highValue) < 1e-7) return high;

  if (lowValue * highValue > 0) {
    console.warn("Could not bracket camera pan boundary", {
      point: point.toArray(),
      targetNdcX,
      lowValue,
      highValue,
    });
    return HOME_POS.x;
  }

  for (let i = 0; i < CAMERA_X_SEARCH_STEPS; i++) {
    const mid = (low + high) / 2;
    const midValue = evaluate(mid);

    if (Math.abs(midValue) < 1e-7) return mid;

    if (lowValue * midValue <= 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return (low + high) / 2;
}

function CameraZoom({ target, phase, onDone }: {
  target: SectionId | null;
  phase: Phase;
  onDone: () => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  const doneRef = useRef(false);
  const mouseX = useRef(0);
  const panX = useRef(HOME_POS.x);
  const touchRef = useRef({ startX: 0, lastX: 0, active: false });
  const velocityX = useRef(0);
  const boundsRef = useRef({ lo: HOME_POS.x, hi: HOME_POS.x });

  useEffect(() => {
    doneRef.current = false;
  }, [target, phase]);

  // Recalculate the camera's legal X range whenever the actual Canvas size changes.
  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return;

    const aspect = size.width / size.height;

    // Visual right end: right boundary reaches the viewport's right edge.
    const lo = findCameraXForProjectedX(
      camera,
      aspect,
      RIGHT_BOUNDARY_POINT,
      SAFE_NDC_X,
    );

    // Visual left end: left boundary reaches the viewport's left edge.
    const hi = findCameraXForProjectedX(
      camera,
      aspect,
      LEFT_BOUNDARY_POINT,
      -SAFE_NDC_X,
    );

    if (lo <= hi) {
      boundsRef.current = { lo, hi };
    } else {
      // The viewport is wider than the calibrated safe scene.
      // No X position can keep both sides inside at the same time.
      const center = (lo + hi) / 2;
      boundsRef.current = { lo: center, hi: center };
      console.warn("Viewport is wider than the calibrated safe scene", {
        aspect,
        calculatedLo: lo,
        calculatedHi: hi,
      });
    }

    panX.current = THREE.MathUtils.clamp(
      panX.current,
      boundsRef.current.lo,
      boundsRef.current.hi,
    );

    console.debug("Dynamic camera pan bounds", {
      aspect,
      ...boundsRef.current,
    });
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      mouseX.current = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchRef.current = {
        startX: t.clientX,
        lastX: t.clientX,
        active: true,
      };
      velocityX.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchRef.current.active) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - touchRef.current.lastX;
      const sensitivity = 2.0 / Math.max(size.width, 1);

      velocityX.current = dx * sensitivity;
      panX.current += dx * sensitivity;
      panX.current = THREE.MathUtils.clamp(
        panX.current,
        boundsRef.current.lo,
        boundsRef.current.hi,
      );
      touchRef.current.lastX = t.clientX;
    };

    const onTouchEnd = () => {
      touchRef.current.active = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, size.width]);

  useFrame((_, delta) => {
    if (phase === "idle") {
      if (!IS_MOBILE) {
        const mx = mouseX.current;
        const edge = 0.15;
        const speed = 1.2;

        if (mx < -1 + edge) {
          const strength = ((-1 + edge) - mx) / edge;
          panX.current += speed * strength * delta;
        } else if (mx > 1 - edge) {
          const strength = (mx - (1 - edge)) / edge;
          panX.current -= speed * strength * delta;
        }
      }

      if (!touchRef.current.active && Math.abs(velocityX.current) > 0.0001) {
        panX.current += velocityX.current;
        velocityX.current *= 0.92;
      }

      panX.current = THREE.MathUtils.clamp(
        panX.current,
        boundsRef.current.lo,
        boundsRef.current.hi,
      );

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

  return null;
}

function VideoWithShadow({ contactShadowTex }: { contactShadowTex: THREE.Texture }) {
  const videoElRefs = useRef<(HTMLVideoElement | null)[]>(WALL_VIDEOS.map(() => null));
  const videoRefCallbacks = useMemo(
    () => WALL_VIDEOS.map(() => ({ current: null as HTMLVideoElement | null })),
    [],
  );
  const visibleIndexRef = useRef(0);
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

    for (let i = 0; i < videoRefCallbacks.length; i++) {
      videoElRefs.current[i] = videoRefCallbacks[i].current;
    }

    if (gs.phase === "idle") {
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
          const nextVideo = videoElRefs.current[gs.nextIndex];
          if (nextVideo) nextVideo.currentTime = 0;
          gs.phase = "crossfade";
          gs.elapsed = 0;
          gs.swapCooldown = 15 + Math.random() * 10;
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
          <group key={i} ref={el => { containerRefs.current[i] = el; }}>
            <group position={cfg.position} scale={cfg.scale}>
              <VideoWallObject
                config={cfg}
                glitchRef={glitchState}
                alphaRef={alphaRefs.current[i]}
                videoRef={videoRefCallbacks[i]}
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
}

function Scene({ onSectionClick, onExit, zoomTarget, phase, onZoomDone }: SceneProps) {
  const { scene } = useGLTF("/kuru/models/dirty_street.glb", true);
  const graffitiTex = useTexture("/kuru/textures/kiri487_graffiti.webp");
  const worksTex = useTexture("/kuru/textures/works_sticker.webp");
  const creditsTex = useTexture("/kuru/textures/cited_sticker.webp");
  const posterTex = useTexture("/kuru/textures/projects_poster.webp");
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  const worksAspect = texSize(worksTex) ? texSize(worksTex)!.width / texSize(worksTex)!.height : 1.5;
  const worksScale = 0.17;

  const creditsAspect = texSize(creditsTex) ? texSize(creditsTex)!.width / texSize(creditsTex)!.height : 0.6;
  const creditsScale = 1.06;

  const posterAspect = texSize(posterTex) ? texSize(posterTex)!.width / texSize(posterTex)!.height : 1.20;
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

  const aspect = texSize(graffitiTex) ? texSize(graffitiTex)!.width / texSize(graffitiTex)!.height : 1.5;

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

      <VideoWithShadow contactShadowTex={contactShadowTex} />

      {IS_MOBILE ? (
        <EffectComposer>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      ) : (
        <EffectComposer>
          <Bloom
            intensity={1.0}
            luminanceThreshold={0.7}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}

useGLTF.preload("/kuru/models/dirty_street.glb", true);

export default Scene;
