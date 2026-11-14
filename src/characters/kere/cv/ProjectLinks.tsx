import type { ProjectLink } from "../../../data/portfolio";
import type { Lang } from "../assistant/types";

/**
 * "GitHub · View" — used on the CV and in the assistant's project replies. Each link is named after its project
 * too, or a screen reader's list of links is a column of "GitHub" with nothing to tell them apart.
 */
function ProjectLinks({ links, project, lang = "en" }: { links: ProjectLink[]; project: string; lang?: Lang }) {
  return (
    <>
      {links.map((l, i) => (
        <span key={l.url}>
          {i > 0 && " · "}
          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={lang === "zh" ? `${project} 的 ${l.label}` : `${l.label} for ${project}`}>
            {l.label}
          </a>
        </span>
      ))}
    </>
  );
}

export default ProjectLinks;
