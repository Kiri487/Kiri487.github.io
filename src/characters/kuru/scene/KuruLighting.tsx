import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function KuruLighting({ exitHovered }: { exitHovered: boolean }) {
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
    f.bases[1] = exitHovered ? 25 : 10;
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
    </>
  );
}

export default KuruLighting;
