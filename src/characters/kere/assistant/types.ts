import type { ReactNode } from "react";
import type { Expression } from "../avatar/faces";

export type { Expression };

/** Kere answers in the language of each message: Chinese if it contains any Chinese character, else English. */
export type Lang = "en" | "zh";

/**
 * What happened in XR's review that Kere's welcome back reflects: "impostor", someone used her name in there.
 */
export type WelcomeNote = "impostor";

/** The same copy in both languages. */
export type Localized<T> = Record<Lang, T>;

/** A ▸ quick option: shown as `label`, sent as if the visitor typed `query`. */
export interface QuickOption {
  label: string;
  query: string;
  /** Instead of sending anything, start the chat over in this language. */
  switchTo?: Lang;
}

/** A bulleted list inside a reply, drawn like the CV's own lists. */
export interface ReplyList {
  list: ReactNode[];
}

export type ReplyLine = ReactNode | ReplyList;

export function isReplyList(line: ReplyLine): line is ReplyList {
  return typeof line === "object" && line !== null && "list" in line;
}

export interface Reply {
  lines: ReplyLine[];
  expression?: Expression;
  /** Element id on the CV page to scroll to, with the link text. */
  jump?: { id: string; label: string };
  options?: QuickOption[];
  /** Language the reply is written in; `respond` fills it in. Chinese replies are marked up as zh-Hant. */
  lang?: Lang;
  /**
   * Side effect after the reply is shown — "exit" sends the visitor back to Kiri; "xr" hands them over to XR's review;
   * "sfx-*" toggles sound effects.
   */
  action?: "exit" | "xr" | "sfx-on" | "sfx-off";
}

/** Hand-written reply: one of `replies` is picked at random each time it fires. */
export interface ScriptedRule {
  id: string;
  /** English phrases match whole words; Chinese ones match anywhere in the message (see `matches`). */
  phrases: string[];
  replies: string[];
  /** Chinese replies. A rule without them answers a Chinese message in English. */
  repliesZh?: string[];
  expression?: Expression;
  jump?: Reply["jump"];
  /** Link text for `jump` in Chinese replies. */
  jumpLabelZh?: string;
  action?: "exit" | "xr";
}
