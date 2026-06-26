import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { setCursor } from "./cursorManager";
import { WALL_VIDEOS, type VideoConfig } from "./config";
import { StackedAlphaVideo } from "../../../shared/scene/StackedAlphaVideo";

function VideoWallObject({ config, glitchRef, alphaRef, videoRef, interactive, onClick }: {
  config: VideoConfig;
  glitchRef: React.MutableRefObject<{ value: number }>;
  alphaRef: React.MutableRefObject<number>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  interactive: boolean;
  onClick?: () => void;
}) {
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

  return (
    <StackedAlphaVideo
      src={config.src}
      aspect={config.aspect}
      rotation={config.rotation}
      gamma={config.gamma}
      brightness={config.brightness}
      tint={config.tint}
      glitchRef={glitchRef}
      alphaRef={alphaRef}
      videoRef={videoRef}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerOut={interactive ? handlePointerOut : undefined}
      onClick={interactive ? handleClick : undefined}
    />
  );
}

export function VideoWithShadow({ contactShadowTex, onCatClick, playGlitch, forceSwapRef, pauseAmbient }: {
  contactShadowTex: THREE.Texture;
  onCatClick?: () => void;
  playGlitch: () => void;
  forceSwapRef?: React.MutableRefObject<boolean>;
  pauseAmbient?: boolean;
}) {
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
