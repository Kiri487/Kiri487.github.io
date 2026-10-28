import { contacts, experienceData, type Contact } from "../../../data/portfolio";
import { slugify } from "./format";

/** Kere's presentation config — what the CV shows and in which order. Data lives in src/data/portfolio/. */

export const CV_NAME = "Kiri Wu";

/** X stays in shared contacts for other skins, but a formal CV leaves it out. */
const CONTACT_IDS: Contact["id"][] = ["mail", "github", "linkedin"];

export const CV_CONTACTS = CONTACT_IDS.map((id) => contacts.find((c) => c.id === id)).filter((c) => c !== undefined);

export interface CvSectionConfig {
  id: string;
  title: string;
  /** Links the section to an `experienceData` group; sections without it have dedicated renderers. */
  category?: string;
}

const LISTED: CvSectionConfig[] = [
  { id: "education", title: "Education" },
  { id: "experience", title: "Experience" },
  { id: "projects", title: "Projects" },
  { id: "honors", title: "Honors & Awards", category: "Honors & Awards" },
  { id: "certifications", title: "Certifications", category: "Certifications" },
  { id: "skills", title: "Skills" },
  { id: "leadership", title: "Clubs & Leadership", category: "Clubs & Leadership" },
  { id: "community", title: "Community Involvement", category: "Community Involvement" },
];

const listedCategories = new Set(LISTED.flatMap((s) => (s.category ? [s.category] : [])));

if (import.meta.env.DEV) {
  for (const category of listedCategories) {
    if (!experienceData.some((e) => e.category === category)) {
      console.warn(`[kere] CV section "${category}" has no matching category in experienceData.`);
    }
  }
}

/** Listed sections first; any experienceData category added later still shows up, appended at the end. */
export const SECTIONS: CvSectionConfig[] = [
  ...LISTED,
  ...experienceData
    .filter((e) => !listedCategories.has(e.category))
    .map((e) => ({ id: slugify(e.category), title: e.category, category: e.category })),
];
