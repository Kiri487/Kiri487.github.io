import { Helmet } from 'react-helmet-async';
import { BsPersonFill, BsPeopleFill } from "react-icons/bs";
import { RiArrowRightDoubleLine } from "react-icons/ri";
import { personalProjects, teamProjects, Project } from "../data/projects";

const ProjectCard = ({ project }: { project: Project }) => {
  return (
    <div className="projects-card">
      <div className="card-img-container">
        <img src={project.img} alt={project.title} />
        <div className="year-badge">{project.year}</div>
      </div>
      
      <div className="card-content">
        <div className="card-header">
            <p className="card-title">{project.title}</p>
        </div>
        
        <p className="card-desc">{project.description}</p>
        
        <div className="card-footer">
          <div className="card-tags">
            {project.tags.map((tag, index) => (
              <div className="card-tag" key={index} title={tag.name}>
                <tag.icon />
              </div>
            ))}
          </div>
          
          <div className="card-links">
            {project.links.map((link, index) => (
              <a key={index} href={link.url} className="card-link" target="_blank" rel="noopener noreferrer" aria-label={`${link.label} for ${project.title}`}>
                {link.label} <RiArrowRightDoubleLine />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function Projects() {
  return (
    <div className="projects">
      <Helmet>
        <title>Kiri487 | Projects</title>
      </Helmet>
      <h2 className="title"><BsPersonFill aria-hidden="true"/>Personal</h2>
      <div className="projects-grid">
        {personalProjects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
     </div>

      <h2 className="title"><BsPeopleFill aria-hidden="true"/>Team</h2>
      <div className="projects-grid">
        {teamProjects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>
    </div>
  );
}

export default Projects;