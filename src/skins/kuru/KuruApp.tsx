import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";
import "./style.css";

export type SectionId = "about" | "projects" | "works" | "contact";

function KuruApp() {
  return (
    <div className="kuru">
      <Canvas
        camera={{ position: [-1.15, -1.1, -2.35], fov: 50, rotation: [0.01, -3.12, 0] }}
        className="kuru-canvas"
        flat
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default KuruApp;
