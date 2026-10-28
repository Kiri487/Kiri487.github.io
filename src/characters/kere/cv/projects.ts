import { personalProjects, teamProjects } from "../../../data/portfolio";
import { periodStart, slugify } from "./format";

/** Personal + team projects merged, newest first — shared by the CV and the assistant. */
export const allProjects = [
  ...personalProjects.map((p) => ({ ...p, kind: "Personal" as const })),
  ...teamProjects.map((p) => ({ ...p, kind: "Team" as const })),
].sort((a, b) => periodStart(b.period, b.year) - periodStart(a.period, a.year));

export type CvProject = (typeof allProjects)[number];

/** DOM id of a project's CV entry, so the assistant can scroll to it. */
export function projectAnchor(title: string): string {
  return "project-" + slugify(title);
}
