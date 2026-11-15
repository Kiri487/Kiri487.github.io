import type { ComponentType, ReactNode } from "react";
import CvSection from "./CvSection";
import CvEntry from "./CvEntry";
import ProjectLinks from "./ProjectLinks";
import { KIRI_CV, type CvData } from "./data";
import { formatPeriod, skillNames } from "./format";
import { SECTIONS } from "./layout";
import { projectAnchor } from "./projects";

/**
 * Lets the caller dress up individual fields — XR corrupts and redacts parts of the record. Gets a field id such as
 * "work.1.date", "projects.0.description", "skills.2", "section.projects" or "lists.Clubs & Leadership.2.title",
 * and the text it would show. Names (schools, companies, positions, organisations) and links are never offered.
 */
export type FieldFx = (field: string, text: string) => ReactNode;

const plain: FieldFx = (_, text) => text;

interface BodyProps {
  data: CvData;
  fx: FieldFx;
  category?: string;
}

function Education({ data, fx }: BodyProps) {
  return data.education.map((e, i) => (
    <CvEntry
      key={e.school}
      title={e.school}
      date={fx(`education.${i}.date`, formatPeriod(e.period))}
      subtitle={e.department}
      location={e.location && fx(`education.${i}.location`, e.location)}
    />
  ));
}

function Experience({ data, fx }: BodyProps) {
  return data.work.map((w, i) => (
    <CvEntry
      key={w.company}
      title={w.company}
      date={fx(`work.${i}.date`, formatPeriod(w.period))}
      subtitle={w.position}
      location={w.location && fx(`work.${i}.location`, w.location)}
    />
  ));
}

function Projects({ data, fx }: BodyProps) {
  return data.projects.map((p, i) => (
    <CvEntry
      key={p.title}
      id={projectAnchor(p.title)}
      title={
        <>
          {fx(`projects.${i}.title`, p.title)}
          {p.tags.length > 0 && (
            <span className="kere-entry__stack">
              {" | "}
              {fx(`projects.${i}.tags`, p.tags.map((t) => t.name).join(", "))}
            </span>
          )}
        </>
      }
      date={fx(`projects.${i}.date`, formatPeriod(p.period ?? p.year))}
    >
      <ul className="kere-list kere-entry__body">
        <li>
          <span className="kere-entry__kind">{p.kind} Project.</span>{" "}
          {typeof p.description === "string" ? fx(`projects.${i}.description`, p.description) : p.description}
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

function Skills({ data, fx }: BodyProps) {
  return (
    <ul className="kere-skills">
      {data.skills.map((cat, i) => (
        <li key={cat.category}>
          <strong>{cat.category}:</strong> {fx(`skills.${i}`, skillNames(cat.skills))}
        </li>
      ))}
    </ul>
  );
}

/** "Org - Role (Aug 2022 - Jul 2023)": the organisation stays as it is; the role and the dates can be dressed up. */
const ROLE_ITEM = /^(.+?) - (.+?) \((.+)\)$/;

function CategoryList({ data, fx, category }: BodyProps) {
  const items = data.lists.find((e) => e.category === category)?.items ?? [];
  return (
    <ul className="kere-list">
      {items.map((item, j) => {
        const parts = fx === plain ? null : item.match(ROLE_ITEM);
        if (!parts) return <li key={item}>{item}</li>;
        const [, org, role, dates] = parts;
        return (
          <li key={item}>
            {org} - {fx(`lists.${category}.${j}.title`, role)} ({fx(`lists.${category}.${j}.date`, dates)})
          </li>
        );
      })}
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
function CvSections({ data = KIRI_CV, fx = plain }: { data?: CvData; fx?: FieldFx }) {
  return SECTIONS.map(({ id, title, category }) => {
    const Body = RENDERERS[id];
    return (
      <CvSection key={id} id={id} title={fx(`section.${id}`, title)}>
        {Body ? <Body data={data} fx={fx} /> : category && <CategoryList data={data} fx={fx} category={category} />}
      </CvSection>
    );
  });
}

export default CvSections;
