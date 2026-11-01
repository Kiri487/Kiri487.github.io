import type { ExplorerFile, ExplorerSort } from "./types";

const nameCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Name is the tie-breaker, so "Doodle (2)" always comes before "Doodle (10)". */
export function sortFiles(files: ExplorerFile[], { key, descending }: ExplorerSort): ExplorerFile[] {
  const direction = descending ? -1 : 1;
  return [...files].sort((a, b) => {
    const byName = nameCollator.compare(a.name, b.name);
    if (key === "name") return byName * direction;
    const left = key === "type" ? a.typeName : a.date;
    const right = key === "type" ? b.typeName : b.date;
    return left.localeCompare(right) * direction || byName;
  });
}
