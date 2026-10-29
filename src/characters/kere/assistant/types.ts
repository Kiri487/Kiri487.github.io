import type { ReactNode } from "react";
import type { Expression } from "../avatar/faces";

export type { Expression };

/** A ▸ quick option: shown as `label`, sent as if the visitor typed `query`. */
export interface QuickOption {
  label: string;
  query: string;
}

export interface Reply {
  lines: ReactNode[];
  expression?: Expression;
  /** Element id on the CV page to scroll to, with the link text. */
  jump?: { id: string; label: string };
  options?: QuickOption[];
  /** Side effect after the reply is shown — "exit" sends the visitor back to Kiri; "sfx-*" toggles sound effects. */
  action?: "exit" | "sfx-on" | "sfx-off";
}

/** Hand-written reply: one of `replies` is picked at random each time it fires. */
export interface ScriptedRule {
  id: string;
  /** Normalized phrases matched on whole words (see `normalize`). */
  phrases: string[];
  replies: string[];
  expression?: Expression;
  jump?: Reply["jump"];
  action?: "exit";
}
