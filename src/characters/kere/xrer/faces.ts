/**
 * XR's face: Kere's frame turned negative (drawn white on a black head, see xrer.css). Hair "▓" covers one eye; the
 * other shrinks as the rules stop holding, until it's gone. Every face is 7 characters, like Kere's.
 */
export type XrFace = "normal" | "alert" | "anxious" | "broken";

export const XR_EARS = " /\\_/\\";

export const XR_FACES: Record<XrFace, string> = {
  normal: "[ ▓ ◉ ]",
  alert: "[ ▓ ○ ]",
  anxious: "[ ▓ ◦ ]",
  broken: "[ ▓   ]",
};

/** Checking a file: the pupil focuses in and out. */
export const XR_THINKING_FRAMES = ["[ ▓ ◉ ]", "[ ▓ ◎ ]"];

export const XR_THINKING_MS = 600;
export const XR_FRAME_MS = XR_THINKING_MS / XR_THINKING_FRAMES.length;
