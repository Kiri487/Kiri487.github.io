import type { ComponentType } from "react";
import { educationData, workData, experienceData, skillsData } from "../../../data/portfolio";
import CvSection from "./CvSection";
import CvEntry from "./CvEntry";
import ProjectLinks from "./ProjectLinks";
import { formatPeriod, skillNames } from "./format";
import { SECTIONS } from "./layout";
import { allProjects, projectAnchor } from "./projects";

function Education() {
  return educationData.map((e) => (
    <CvEntry
      key={e.school}
      title={e.school}
      date={formatPeriod(e.period)}
      subtitle={e.department}
      location={e.location}
    />
  ));
}

function Experience() {
  return workData.map((w) => (
    <CvEntry
      key={w.company}
      title={w.company}
      date={formatPeriod(w.period)}
      subtitle={w.position}
      location={w.location}
    />
  ));
}

function Projects() {
  return allProjects.map((p) => (
    <CvEntry
      key={p.title}
      id={projectAnchor(p.title)}
      title={
        <>
          {p.title}
          {p.tags.length > 0 && (
            <span className="kere-entry__stack"> | {p.tags.map((t) => t.name).join(", ")}</span>
          )}
        </>
      }
      date={formatPeriod(p.period ?? p.year)}
    >
      <ul className="kere-list kere-entry__body">
        <li>
          <span className="kere-entry__kind">{p.kind} Project.</span> {p.description}
        </li>
      </ul>
      {p.links.length > 0 && (
        <div className="kere-entry__links">
          <ProjectLinks links={p.links} />
        </div>
      )}
    </CvEntry>
  ));
}

function Skills() {
  return (
    <ul className="kere-skills">
      {skillsData.map((cat) => (
        <li key={cat.category}>
          <strong>{cat.category}:</strong> {skillNames(cat.skills)}
        </li>
      ))}
    </ul>
  );
}

function CategoryList({ category }: { category: string }) {
  const items = experienceData.find((e) => e.category === category)?.items ?? [];
  return (
    <ul className="kere-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Sections with their own layout; every other section is a plain list of its `experienceData` category. */
const RENDERERS: Record<string, ComponentType> = {
  education: Education,
  experience: Experience,
  projects: Projects,
  skills: Skills,
};

/** Every CV section in `SECTIONS` order. */
function CvSections() {
  return SECTIONS.map(({ id, title, category }) => {
    const Body = RENDERERS[id];
    return (
      <CvSection key={id} id={id} title={title}>
        {Body ? <Body /> : category && <CategoryList category={category} />}
      </CvSection>
    );
  });
}

export default CvSections;
