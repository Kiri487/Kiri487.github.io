import { useMemo, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

function Scene() {
  const { scene } = useGLTF("/models/dirty_street.glb");
  const gl = useThree((s) => s.gl);
  gl.toneMappingExposure = 1.0;

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

  return (
    <>
      <Environment preset="night" environmentIntensity={0.25} />
      <ambientLight intensity={0.12} />

      {/* Wall lamp — spotlight with shadow */}
      <primitive object={lampTarget} />
      <spotLight
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

      {/* EXIT sign — spotlight with shadow */}
      <primitive object={exitTarget} />
      <spotLight
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

      {/* BAR neon — pointLight */}
      <pointLight position={[-1.15, -0.35, 0.25]} intensity={1.5} color="#ff4466" distance={4} decay={2} />

      {/* fill */}
      <directionalLight position={[0, 4, 0]} intensity={0.06} color="#99aabb" />

      <primitive object={scene} />

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

useGLTF.preload("/models/dirty_street.glb");

export default Scene;
