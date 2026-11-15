import { educationData, experienceData, skillsData, workData } from "../../../data/portfolio";
import type { Education, Experience, Skill, Work } from "../../../data/portfolio";
import { allProjects, type CvProject } from "./projects";

/** Everything a CV shows. The page shows Kiri's own; XR's applicants bring altered copies. */
export interface CvData {
  education: Education[];
  work: Work[];
  projects: CvProject[];
  skills: { category: string; skills: Skill[] }[];
  /** Honors, certifications, clubs and community, each a list under its category. */
  lists: Experience[];
}

export const KIRI_CV: CvData = {
  education: educationData,
  work: workData,
  projects: allProjects,
  skills: skillsData,
  lists: experienceData,
};
