import { personalProjects, teamProjects } from "../../../data/projects";

const allProjects = [...personalProjects, ...teamProjects];

function ProjectsContent() {
  return (
    <div className="kuru-term">
      <div className="kuru-term__section">
        <div className="kuru-term__head">
          <span className="kuru-term__prompt">&gt; ls -la /projects/</span>
          <span className="kuru-term__line" />
          <span className="kuru-term__meta">[{allProjects.length} entries]</span>
        </div>
        <div className="kuru-file-list">
          {allProjects.map((p, i) => (
            <div key={p.title} className="kuru-file">
              <span className="kuru-file__idx">
                #{String(i + 1).padStart(2, "0")}
              </span>
              <img
                className="kuru-file__thumb"
                src={p.img}
                alt={p.title}
                loading="lazy"
              />
              <div className="kuru-file__info">
                <div className="kuru-file__row1">
                  <span className="kuru-file__title">{p.title}</span>
                  <span className="kuru-file__year">[{p.year}]</span>
                </div>
                <p className="kuru-file__desc">{p.description}</p>
                <div className="kuru-file__row2">
                  <span className="kuru-file__tags">
                    {p.tags.map((t, j) => (
                      <span key={t.tech}>
                        {j > 0 && " ∙ "}
                        {t.name}
                      </span>
                    ))}
                  </span>
                  {p.links.length > 0 && (
                    <span className="kuru-file__links">
                      {p.links.map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          → {l.label}
                        </a>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProjectsContent;
