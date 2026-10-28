import type { Contact } from "../../../data/portfolio";

/** Kere's presentation config — what the CV shows and in which order. Data lives in src/data/portfolio/. */

export const CV_NAME = "Kiri Wu";

/** X stays in shared contacts for other skins, but a formal CV leaves it out. */
export const CONTACT_IDS: Contact["id"][] = ["mail", "github", "linkedin"];

export type SectionId =
  | "education"
  | "experience"
  | "projects"
  | "honors"
  | "certifications"
  | "skills"
  | "leadership"
  | "community";

/** `category` links a section to an `experienceData` group; the rest have dedicated renderers. */
export const SECTIONS: { id: SectionId; title: string; category?: string }[] = [
  { id: "education", title: "Education" },
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "honors", title: "Honors & Awards", category: "Honors & Awards" },
  { id: "certifications", title: "Certifications", category: "Certifications" },
  { id: "skills", title: "Skills" },
  { id: "leadership", title: "Clubs & Leadership", category: "Clubs & Leadership" },
  { id: "community", title: "Community Involvement", category: "Community Involvement" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sortable start of a "Mon YYYY - Mon YYYY" period (year * 12 + month); falls back to the bare year. */
export function periodStart(period: string | undefined, year: string): number {
  const match = period?.match(/^([A-Z][a-z]{2}) (\d{4})/);
  if (match) return parseInt(match[2], 10) * 12 + MONTHS.indexOf(match[1]);
  return parseInt(year, 10) * 12;
}

/** Data uses "Sep 2025 - Present"; typeset with an en dash like LaTeX's `--`. */
export function formatPeriod(period: string): string {
  return period.replace(" - ", " – ");
}

/** "https://www.linkedin.com/in/x/" → "linkedin.com/in/x", "mailto:a@b" → "a@b". */
export function displayUrl(url: string): string {
  return url.replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
