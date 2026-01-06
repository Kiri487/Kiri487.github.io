import { useRef, useEffect } from "react";
import p5 from "p5";

interface P5CanvasProps {
  musicEnabled: boolean;
  analyser: AnalyserNode | null;
}

function Lines({ musicEnabled, analyser }: P5CanvasProps) {

  const sketchRef = useRef<HTMLDivElement | null>(null);
  const musicEnabledRef = useRef(musicEnabled);
  
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  useEffect(() => {
    analyserRef.current = analyser;
  }, [analyser]);

  useEffect(() => {
    const sketch = (p: p5) => {
      let t = 0;
      let currentAmp = 10;
      
      const dataArray = new Uint8Array(128); 

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.noFill();
      };

      p.draw = () => {
        p.background(157, 162, 178);
        p.stroke(255, 255, 255, 100);
        p.strokeWeight(2);

        let targetAmp = 10;

        if (musicEnabledRef.current && analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          // map(value, inputMin, inputMax, outputMin, outputMax)
          targetAmp = p.map(average, 0, 150, 10, 100, true);
        } else {
            targetAmp = 10;
        }

        currentAmp = p.lerp(currentAmp, targetAmp, 0.3);

        for (let j = 0; j < p.height; j += 70) {
          p.beginShape();
          for (let i = 0; i < (p.width + 10); i += 10) {
            const y = j + currentAmp * p.noise(i + p.mouseX * 0.001 + t + j);
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
  }, []); 

  return <div ref={sketchRef} />;
};

export default Lines;