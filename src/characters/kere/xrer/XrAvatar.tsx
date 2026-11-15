import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../../shared/motion";
import { XR_EARS, XR_FACES, XR_FRAME_MS, XR_THINKING_FRAMES, type XrFace } from "./faces";

interface XrAvatarProps {
  face: XrFace;
  /** Checking a file. Only shows while his eye is still steady; once he's rattled, the face stays as it is. */
  thinking?: boolean;
}

function XrAvatar({ face, thinking = false }: XrAvatarProps) {
  const [tick, setTick] = useState(0);
  const animate = thinking && face === "normal";

  useEffect(() => {
    if (!animate || prefersReducedMotion()) return;
    const id = window.setInterval(() => setTick((t) => t + 1), XR_FRAME_MS);
    return () => window.clearInterval(id);
  }, [animate]);

  const text = animate ? XR_THINKING_FRAMES[tick % XR_THINKING_FRAMES.length] : XR_FACES[face];

  return (
    <span className="kere-avatar xr-avatar" data-face={face} aria-hidden="true">
      {XR_EARS}
      {"\n"}
      {text}
    </span>
  );
}

export default XrAvatar;
