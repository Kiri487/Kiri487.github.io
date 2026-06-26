import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { setCursor } from "./cursorManager";

export interface InteractivePlaneProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  texture?: THREE.Texture;
  color?: string;
  cursorOwner: string;
  alphaHitTest?: boolean;
  glowing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function InteractivePlane({
  position, rotation, scale: s, texture, color = "#888",
  cursorOwner, alphaHitTest, glowing, disabled, onClick,
}: InteractivePlaneProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const emissiveTarget = (hovered || glowing) ? 0.5 : 0;

  useEffect(() => {
    return () => { setCursor(cursorOwner, false); };
  }, [cursorOwner]);

  const alphaData = useMemo(() => {
    if (!alphaHitTest || !texture) return null;
    const img = texture.image as HTMLImageElement;
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  }, [alphaHitTest, texture]);

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

  const onPointerMove = useCallback((e: { uv?: THREE.Vector2 }) => {
    const hit = !!(e.uv && checkAlpha(e.uv));
    setHovered(hit);
    setCursor(cursorOwner, hit);
  }, [checkAlpha, cursorOwner]);

  const onPointerOver = useCallback(() => {
    setHovered(true);
    setCursor(cursorOwner, true);
  }, [cursorOwner]);

  const onPointerOut = useCallback(() => {
    setHovered(false);
    setCursor(cursorOwner, false);
  }, [cursorOwner]);

  const handleClick = alphaHitTest
    ? (e: { stopPropagation: () => void; uv?: THREE.Vector2 }) => {
        e.stopPropagation();
        if (e.uv && checkAlpha(e.uv) && onClick) onClick();
      }
    : (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        onClick?.();
      };

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      onPointerMove={disabled ? undefined : (alphaHitTest ? onPointerMove : undefined)}
      onPointerOver={disabled ? undefined : (alphaHitTest ? undefined : onPointerOver)}
      onPointerOut={disabled ? undefined : onPointerOut}
      onClick={disabled ? undefined : handleClick}
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
