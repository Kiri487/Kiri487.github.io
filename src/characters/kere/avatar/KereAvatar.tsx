import { useEffect, useState } from "react";
import { EARS, FACES, FRAME_MS, THINKING_FRAMES, TYPING_FRAMES, type Expression } from "./faces";
import "./avatar.css";

interface KereAvatarProps {
  expression?: Expression;
  /** No ears or glasses, just the dots — the typing indicator inside the chat log. */
  bare?: boolean;
  /** White cat-head silhouette behind the face, for when it floats over other content. */
  backed?: boolean;
}

function KereAvatar({ expression = "normal", bare = false, backed = false }: KereAvatarProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (expression !== "thinking") return;
    const id = window.setInterval(() => setTick((t) => t + 1), FRAME_MS);
    return () => window.clearInterval(id);
  }, [expression]);

  const frames = bare ? TYPING_FRAMES : THINKING_FRAMES;
  const face = expression === "thinking" ? frames[tick % frames.length] : FACES[expression];

  return (
    <span
      className={backed ? "kere-avatar kere-avatar--backed" : "kere-avatar"}
      data-expression={expression}
      aria-hidden="true"
    >
      {!bare && (
        <>
          {EARS}
          {"\n"}
        </>
      )}
      {face}
    </span>
  );
}

export default KereAvatar;
