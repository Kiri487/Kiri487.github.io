import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";

const LINES = [
  "> INIT kuru://street-scene",
  "> LOAD models",
  "> LOAD textures",
];

function LoadingScreen() {
  const { progress, active } = useProgress();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStep(1), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (progress > 0 && step < 2) setStep(2);
    if (progress > 30 && step < 3) setStep(3);
  }, [progress, step]);

  useEffect(() => {
    if (progress >= 100 && !active && !ready) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [progress, active, ready]);

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setFadeOut(true), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);

  useEffect(() => {
    if (fadeOut) {
      const t = setTimeout(() => setHidden(true), 500);
      return () => clearTimeout(t);
    }
  }, [fadeOut]);

  if (hidden) return null;

  return (
    <div className={`kuru-loading${fadeOut ? " kuru-loading--fade" : ""}`}>
      <div className="kuru-loading__box">
        <div className="kuru-loading__content">
          {LINES.slice(0, step).map((line, i) => (
            <div key={i} className="kuru-loading__line">
              {line}
              {i >= 1 && i <= 2 && (
                <span className="kuru-loading__status">
                  {i === 1 && progress >= 100 ? " ··· OK" : ""}
                  {i === 2 && progress >= 100
                    ? " ··· OK"
                    : i === 2 && step >= 3
                      ? ` ··· ${Math.round(progress)}%`
                      : ""}
                </span>
              )}
            </div>
          ))}
          {ready && (
            <div className="kuru-loading__line kuru-loading__line--ready">
              [READY]
            </div>
          )}
        </div>
        <div className="kuru-loading__bar-track">
          <div
            className="kuru-loading__bar-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
