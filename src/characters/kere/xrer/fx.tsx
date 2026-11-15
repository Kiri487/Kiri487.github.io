import type { ReactNode } from "react";
import { visuallyHidden } from "../../../shared/visuallyHidden";
import { COPY, type Lang } from "./script";
import { seeded } from "./seeded";

/* ============================================================
   Text corruption, for XR's lines and the documents on her desk.
   Three effects, each drawn for the eye and spelled out plainly
   for screen readers:
     {text}   corrupted (Zalgo marks piled on)
     ~~text~~ struck through, as if corrected
     ███      redacted
   ============================================================ */

/** How hard to corrupt: marks per character. */
export type Strength = 1 | 2 | 3 | 4;

const ABOVE = [0x300, 0x301, 0x302, 0x303, 0x306, 0x308, 0x30a, 0x30b, 0x30c, 0x312, 0x313, 0x315, 0x31b, 0x33d, 0x346, 0x34a, 0x350, 0x357, 0x35b];
const BELOW = [0x316, 0x317, 0x31c, 0x320, 0x323, 0x324, 0x326, 0x327, 0x328, 0x32d, 0x330, 0x333, 0x339, 0x347, 0x34e, 0x353, 0x359];
const THROUGH = [0x334, 0x335, 0x336, 0x337, 0x338];

function marks(rand: () => number, count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const pool = i === 0 && rand() < 0.3 ? THROUGH : rand() < 0.55 ? ABOVE : BELOW;
    out += String.fromCharCode(pool[Math.floor(rand() * pool.length)]);
  }
  return out;
}

const NO_BREAK_SPACE = String.fromCharCode(160);

/**
 * Corrupted text. Latin letters and digits take the marks directly; anything else (Chinese, "…", "。") turns to
 * empty boxes in Chrome when combined with them, so those characters stay clean and the marks float over them on a
 * blank carrier instead.
 */
interface CorruptProps {
  text: string;
  strength: Strength;
  /** The round's seed: the same words come out differently each round, but hold still within one. */
  seed?: string;
}

export function Corrupt({ text, strength, seed = "" }: CorruptProps) {
  const rand = seeded(`${seed}|${text}#${strength}`);
  const chars = [...text].map((ch, i) => {
    if (ch === " ") return ch;
    const count = Math.max(1, Math.round(strength * (0.5 + rand())));
    if (/[A-Za-z0-9]/.test(ch)) return ch + marks(rand, count);
    return (
      <span key={i} className="xr-z">
        {ch}
        <span className="xr-z__marks">{NO_BREAK_SPACE + marks(rand, count)}</span>
      </span>
    );
  });
  return (
    <>
      <span aria-hidden="true">{chars}</span>
      <span style={visuallyHidden}>{text}</span>
    </>
  );
}

/** Blacked out: a bar as long as the text it hides. Screen readers hear that something was redacted. */
export function Redact({ length, lang = "zh" }: { length: number; lang?: Lang }) {
  return (
    <>
      <span className="xr-redact" aria-hidden="true">
        {"█".repeat(Math.max(2, Math.min(length, 14)))}
      </span>
      <span style={visuallyHidden}>{COPY[lang].REDACTED}</span>
    </>
  );
}

/** "Corrected" to the very same text: someone has been at it, and nothing changed. */
export function Struck({ text }: { text: string }) {
  return (
    <>
      <s aria-hidden="true">{text}</s> {text}
    </>
  );
}

const TOKEN = /(~~.+?~~|\{.+?\}|█+)/g;

/** A line of XR's, with the markup above turned into effects. */
export function Fx({ text, strength, seed, lang = "zh" }: CorruptProps & { lang?: Lang }): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("~~") && part.endsWith("~~")) {
      // A real correction: the struck word is gone, so screen readers skip it.
      return (
        <s key={i} aria-hidden="true">
          {part.slice(2, -2)}
        </s>
      );
    }
    if (part.startsWith("{") && part.endsWith("}")) return <Corrupt key={i} text={part.slice(1, -1)} strength={strength} seed={seed} />;
    if (/^█+$/.test(part)) return <Redact key={i} length={part.length} lang={lang} />;
    return part;
  });
}
