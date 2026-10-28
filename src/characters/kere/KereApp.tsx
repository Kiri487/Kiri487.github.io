import type { ReactNode } from "react";
import {
  educationData,
  workData,
  experienceData,
  skillsData,
  personalProjects,
  teamProjects,
} from "../../data/portfolio";
import CvHeader from "./cv/CvHeader";
import CvSection from "./cv/CvSection";
import CvEntry from "./cv/CvEntry";
import { SECTIONS, formatPeriod, periodStart, type SectionId } from "./cv/layout";
import "./style.css";

const allProjects = [
  ...personalProjects.map((p) => ({ ...p, kind: "Personal" as const })),
  ...teamProjects.map((p) => ({ ...p, kind: "Team" as const })),
].sort((a, b) => periodStart(b.period, b.year) - periodStart(a.period, a.year));

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
          {p.links.map((l, i) => (
            <span key={l.url}>
              {i > 0 && " · "}
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </span>
          ))}
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
          <strong>{cat.category}:</strong> {cat.skills.map((s) => s.name).join(", ")}
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

const RENDERERS: Partial<Record<SectionId, () => ReactNode>> = {
  education: Education,
  experience: Experience,
  projects: Projects,
  skills: Skills,
};

function KereApp() {
  return (
    <main className="kere">
      <CvHeader />
      {SECTIONS.map(({ id, title, category }) => {
        const Body = RENDERERS[id];
        return (
          <CvSection key={id} id={id} title={title}>
            {Body ? <Body /> : category && <CategoryList category={category} />}
          </CvSection>
        );
      })}
    </main>
  );
}

export default KereApp;
