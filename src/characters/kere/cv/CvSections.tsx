import type { ComponentType } from "react";
import CvSection from "./CvSection";
import CvEntry from "./CvEntry";
import ProjectLinks from "./ProjectLinks";
import { KIRI_CV, type CvData } from "./data";
import { formatPeriod, skillNames } from "./format";
import { SECTIONS } from "./layout";
import { projectAnchor } from "./projects";

interface BodyProps {
  data: CvData;
  category?: string;
}

function Education({ data }: BodyProps) {
  return data.education.map((e) => (
    <CvEntry
      key={e.school}
      title={e.school}
      date={formatPeriod(e.period)}
      subtitle={e.department}
      location={e.location}
    />
  ));
}

function Experience({ data }: BodyProps) {
  return data.work.map((w) => (
    <CvEntry
      key={w.company}
      title={w.company}
      date={formatPeriod(w.period)}
      subtitle={w.position}
      location={w.location}
    />
  ));
}

function Projects({ data }: BodyProps) {
  return data.projects.map((p) => (
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
          <ProjectLinks links={p.links} project={p.title} />
        </div>
      )}
    </CvEntry>
  ));
}

function Skills({ data }: BodyProps) {
  return (
    <ul className="kere-skills">
      {data.skills.map((cat) => (
        <li key={cat.category}>
          <strong>{cat.category}:</strong> {skillNames(cat.skills)}
        </li>
      ))}
    </ul>
  );
}

function CategoryList({ data, category }: BodyProps) {
  const items = data.lists.find((e) => e.category === category)?.items ?? [];
  return (
    <ul className="kere-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Sections with their own layout; every other section is a plain list of its category. */
const RENDERERS: Record<string, ComponentType<BodyProps>> = {
  education: Education,
  experience: Experience,
  projects: Projects,
  skills: Skills,
};

/** Every CV section in `SECTIONS` order — Kiri's own CV unless `data` says otherwise. */
function CvSections({ data = KIRI_CV }: { data?: CvData }) {
  return SECTIONS.map(({ id, title, category }) => {
    const Body = RENDERERS[id];
    return (
      <CvSection key={id} id={id} title={title}>
        {Body ? <Body data={data} /> : category && <CategoryList data={data} category={category} />}
      </CvSection>
    );
  });
}

export default CvSections;
