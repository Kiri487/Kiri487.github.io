import { personalProjects, teamProjects } from "../../../data/projects";

const allProjects = [...personalProjects, ...teamProjects];

function ProjectsContent() {
  return (
    <div className="kuru-poster-grid">
      {allProjects.map((p) => (
        <article key={p.title} className="kuru-poster">
          <img
            className="kuru-poster__img"
            src={p.img}
            alt={p.title}
            loading="lazy"
          />
          <div className="kuru-poster__body">
            <span className="kuru-poster__year">{p.year}</span>
            <h3 className="kuru-poster__title">{p.title}</h3>
            <p className="kuru-poster__desc">{p.description}</p>
            <div className="kuru-poster__tags">
              {p.tags.map((t) => (
                <span key={t.tech} className="kuru-poster__tag">
                  {t.name}
                </span>
              ))}
            </div>
            {p.links.length > 0 && (
              <div className="kuru-poster__links">
                {p.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    className="kuru-poster__link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export default ProjectsContent;
