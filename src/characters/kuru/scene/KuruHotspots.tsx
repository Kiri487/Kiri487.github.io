import { useEffect } from "react";
import * as THREE from "three";
import { InteractivePlane } from "../../../shared/scene/InteractivePlane";
import { setCursor } from "../../../shared/scene/cursorManager";

interface GraffitiHotspotProps {
  texture: THREE.Texture;
  aspect: number;
  glowing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function GraffitiHotspot({ texture, aspect, glowing, disabled, onClick }: GraffitiHotspotProps) {
  const scale = 0.55;
  return (
    <InteractivePlane
      position={[-2.6, -0.6, -0.08]}
      rotation={[0, -3.13, -0.14]}
      scale={[aspect * scale, scale]}
      texture={texture}
      cursorOwner="graffiti"
      alphaHitTest
      glowing={glowing}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

interface WallObjectProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  texture?: THREE.Texture;
  color?: string;
  cursorOwner: string;
  glowing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function WallObject({ position, rotation, scale, texture, color, cursorOwner, glowing, disabled, onClick }: WallObjectProps) {
  return (
    <InteractivePlane
      position={position}
      rotation={rotation}
      scale={scale}
      texture={texture}
      color={color}
      cursorOwner={cursorOwner}
      glowing={glowing}
      disabled={disabled}
      onClick={onClick}
    />
  );
}

export function ExitHotspot({ onClick, onHoverChange, disabled }: {
  onClick: () => void;
  onHoverChange: (hovered: boolean) => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    return () => { setCursor("exit", false); };
  }, []);

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
