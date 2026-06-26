import { useRef, useState, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { setCursor } from "./cursorManager";

interface GraffitiHotspotProps {
  texture: THREE.Texture;
  aspect: number;
  glowing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function GraffitiHotspot({ texture, aspect, glowing, disabled, onClick }: GraffitiHotspotProps) {
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

export function WallObject({ position, rotation, scale: s, texture, color = "#888", glowing, disabled, onClick }: WallObjectProps) {
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

export function ExitHotspot({ onClick, onHoverChange, disabled }: {
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <mesh
      position={[-0.13, -0.16, 0.99]}
      rotation={[0, -3.14, 0]}
      onPointerOver={disabled ? undefined : () => { onHoverChange(true); setCursor("exit", true); }}
      onPointerOut={disabled ? undefined : () => { onHoverChange(false); setCursor("exit", false); }}
      onClick={disabled ? undefined : (e) => { e.stopPropagation(); onClick(); }}
    >
      <planeGeometry args={[0.32, 0.12]} />
      <meshStandardMaterial transparent opacity={0} />
    </mesh>
  );
}
