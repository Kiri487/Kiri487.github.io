import { useRef, useEffect } from "react";
import p5 from "p5";

function Lines({ musicEnabled }: { musicEnabled: boolean }) {

  const sketchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sketch = (p: p5) => {
      let t = 0;

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.noFill();
      };

      p.draw = () => {
        p.background(158, 163, 179);
        p.stroke(255, 255, 255, 100);
        p.strokeWeight(2);

        for (let j = 0; j < p.height; j += 50) {
          p.beginShape();
          for (let i = 0; i < (p.width + 10); i += 10) {
            const amplitude = musicEnabled ? 50 : 10;
            const y = j + amplitude * p.noise(i + p.mouseX * 0.001 + t + j);
            p.vertex(i, y);
          }
          p.endShape();
        }

        t += 0.01;
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    if (sketchRef.current) {
      const p5Instance = new p5(sketch, sketchRef.current);
      return () => p5Instance.remove();
    }
  }, [musicEnabled]);

  return <div ref={sketchRef} style={{ position: "absolute", top: 0, left: 0, zIndex: -1, width: "100%", height: "100%", overflow: "hidden"}} />;
};

export default Lines;