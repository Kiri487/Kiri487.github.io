import type { ProjectLink } from "../../../data/portfolio";

/** "GitHub · View" — used on the CV and in the assistant's project replies. */
function ProjectLinks({ links }: { links: ProjectLink[] }) {
  return (
    <>
      {links.map((l, i) => (
        <span key={l.url}>
          {i > 0 && " · "}
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        </span>
      ))}
    </>
  );
}

export default ProjectLinks;
