import { useEffect, useState } from "react";
import { EARS, FACES, FRAME_MS, THINKING_FRAMES, TYPING_FRAMES } from "./faces";
import type { Expression } from "./types";

interface KereAvatarProps {
  expression?: Expression;
  /** No ears or glasses, just the dots — the typing indicator inside the chat log. */
  bare?: boolean;
}

function KereAvatar({ expression = "normal", bare = false }: KereAvatarProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (expression !== "thinking") return;
    const id = window.setInterval(() => setTick((t) => t + 1), FRAME_MS);
    return () => window.clearInterval(id);
  }, [expression]);

  const frames = bare ? TYPING_FRAMES : THINKING_FRAMES;
  const face = expression === "thinking" ? frames[tick % frames.length] : FACES[expression];

  return (
    <span className="kere-avatar" data-expression={expression} aria-hidden="true">
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
