import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface HotspotProps {
  position: [number, number, number];
  label: string;
  onClick: () => void;
  dimmed: boolean;
}

function Hotspot({ position, label, onClick, dimmed }: HotspotProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 2 + position[0]) * 0.03;
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        onClick={(e) => {
          e.stopPropagation();
          if (!dimmed) onClick();
        }}
        onPointerEnter={() => {
          setHovered(true);
          document.body.style.cursor = dimmed ? "default" : "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <circleGeometry args={[0.18, 32]} />
        <meshBasicMaterial
          color={hovered && !dimmed ? "#e8a838" : "#f5f0e8"}
          transparent
          opacity={dimmed ? 0.2 : hovered ? 1 : 0.7}
        />
      </mesh>

      {hovered && !dimmed && (
        <Html position={[position[0], position[1] + 0.35, position[2]]} center>
          <div className="kuru-hotspot-label">{label}</div>
        </Html>
      )}
    </group>
  );
}

export default Hotspot;
