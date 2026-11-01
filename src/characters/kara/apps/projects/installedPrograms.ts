import { personalProjects, teamProjects, type Project } from "../../../../data/portfolio";

export type ProgramSort = "date" | "name" | "type";

export interface InstalledProgram {
  project: Project;
  kind: "Personal" | "Team";
  /** Months since year 0, from the start of the project's period. Only used for sorting. */
  startedAt: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOf({ period, year }: Project): number {
  if (!period) return Number(year) * 12;
  const [month, startYear] = period.split(" - ")[0].split(" ");
  return Number(startYear) * 12 + MONTHS.indexOf(month);
}

function toProgram(kind: InstalledProgram["kind"]) {
  return (project: Project): InstalledProgram => ({ project, kind, startedAt: startOf(project) });
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
