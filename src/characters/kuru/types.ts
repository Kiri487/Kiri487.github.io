export type SectionId = "about" | "projects" | "works" | "credits";
export type Phase = "idle" | "zooming" | "connecting" | "panel" | "open";
/** Everything on the street that can be clicked, or reached with the keyboard. */
export type HotspotId = SectionId | "exit" | "cat";
