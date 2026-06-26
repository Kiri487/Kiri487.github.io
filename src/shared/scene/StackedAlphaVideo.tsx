import { useEffect, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { stackedAlphaVertexShader, stackedAlphaFragmentShader } from "./stackedAlphaShader";

const DEFAULT_TINT: [number, number, number] = [1, 1, 1];

export interface StackedAlphaVideoProps {
  src: string;
  aspect: number;
  rotation?: [number, number, number];
  gamma?: number;
  brightness?: number;
  tint?: [number, number, number];
  glitchRef: React.MutableRefObject<{ value: number }>;
  alphaRef: React.MutableRefObject<number>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: () => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

export function StackedAlphaVideo({
  src, aspect, rotation, gamma = 1, brightness = 1, tint = DEFAULT_TINT,
  glitchRef, alphaRef, videoRef,
  onPointerMove, onPointerOut, onClick,
}: StackedAlphaVideoProps) {
  const [material, setMaterial] = useState<THREE.ShaderMaterial | null>(null);
  const [tintR, tintG, tintB] = tint;

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

    v.src = src;

    document.body.appendChild(v);
    videoRef.current = v;

    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.ShaderMaterial({
      vertexShader: stackedAlphaVertexShader,
      fragmentShader: stackedAlphaFragmentShader,
      uniforms: {
        uMap: { value: tex },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uAlpha: { value: 1 },
        uGamma: { value: gamma },
        uBrightness: { value: brightness },
        uTint: { value: new THREE.Vector3(tintR, tintG, tintB) },
      },
      transparent: true,
      depthWrite: false,
    });

    const publishMaterial = window.setTimeout(() => setMaterial(mat), 0);

    v.load();
    v.play().catch((e) => {
      if (e.name !== "AbortError") { /* autoplay blocked or load aborted */ }
    });

    return () => {
      v.pause();
      clearTimeout(publishMaterial);
      document.body.removeChild(v);
      tex.dispose();
      mat.dispose();
      setMaterial(null);
      videoRef.current = null;
    };
  }, [src, gamma, brightness, tintR, tintG, tintB, videoRef]);

  /* eslint-disable react-hooks/immutability -- Shader uniforms are intentionally mutated from the R3F frame loop. */
  useFrame((_, delta) => {
    if (!material) return;
    material.uniforms.uTime.value += delta;
    material.uniforms.uGlitch.value = glitchRef.current.value;
    material.uniforms.uAlpha.value = alphaRef.current;
  });
  /* eslint-enable react-hooks/immutability */

  if (!material) return null;

  return (
    <mesh
      rotation={rotation}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <planeGeometry args={[aspect, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
