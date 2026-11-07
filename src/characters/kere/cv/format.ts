import type { Skill } from "../../../data/portfolio";

/** Formatting helpers shared by the CV and the assistant. */

const NO_BREAK_SPACE = String.fromCharCode(160);

/**
 * Data uses "Sep 2025 - Present"; typeset with an en dash like LaTeX's `--`.
 * Month and year are joined by a no-break space, so a wrapping line never leaves "Jun" and "2026" apart.
 */
export function formatPeriod(period: string): string {
  return period.replace(" - ", " – ").replace(/\b([A-Z][a-z]{2}) (\d{4})\b/g, `$1${NO_BREAK_SPACE}$2`);
}

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x", "mailto:a@b" → "a@b". */
export function displayUrl(url: string): string {
  return url.replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** "Honors & Awards" → "honors-awards", for DOM ids. */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** "C++, C#, Python" — one skill category as a text line, no icons. */
export function skillNames(skills: Skill[]): string {
  return skills.map((s) => s.name).join(", ");
}
