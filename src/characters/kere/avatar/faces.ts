export type Expression = "normal" | "thinking" | "confused" | "annoyed" | "overwhelmed";

/** Kere's face: cat ears over glasses. Two lines, rendered in monospace so they stay aligned. */
export const EARS = " /\\_/\\";

/** Every face is exactly 7 characters wide, so switching never shifts the layout. */
export const FACES: Record<Exclude<Expression, "thinking">, string> = {
  normal: "[ •_• ]",
  confused: "[ ?_? ]",
  annoyed: "[ -_- ]",
  overwhelmed: "[ ×_× ]",
};

/** While thinking, dots fill in one by one like a typing indicator — same glyph, so sizes match. */
export const THINKING_FRAMES = ["[ •   ]", "[ ••  ]", "[ ••• ]"];

/** Same animation without the glasses, for the typing row in the chat log. Padded so text never shifts. */
export const TYPING_FRAMES = ["•  ", "•• ", "•••"];

/** Kere replies after exactly one pass of the dots. */
export const THINKING_MS = 600;
export const FRAME_MS = THINKING_MS / THINKING_FRAMES.length;
