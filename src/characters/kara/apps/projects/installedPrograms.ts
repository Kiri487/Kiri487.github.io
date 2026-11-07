import { periodStart, personalProjects, teamProjects, type Project } from "../../../../data/portfolio";

export type ProgramSort = "date" | "name" | "type";

export interface InstalledProgram {
  project: Project;
  kind: "Personal" | "Team";
  /** From periodStart. Only used for sorting. */
  startedAt: number;
}

function toProgram(kind: InstalledProgram["kind"]) {
  return (project: Project): InstalledProgram => ({ project, kind, startedAt: periodStart(project) });
}

const PROGRAMS: InstalledProgram[] = [...personalProjects.map(toProgram("Personal")), ...teamProjects.map(toProgram("Team"))];

const byNewest = (a: InstalledProgram, b: InstalledProgram) => b.startedAt - a.startedAt;
const byName = (a: InstalledProgram, b: InstalledProgram) => a.project.title.localeCompare(b.project.title);

export function sortPrograms(sort: ProgramSort): InstalledProgram[] {
  const programs = [...PROGRAMS];
  if (sort === "name") return programs.sort(byName);
  if (sort === "type") return programs.sort((a, b) => a.kind.localeCompare(b.kind) || byNewest(a, b));
  return programs.sort((a, b) => byNewest(a, b) || byName(a, b));
}
