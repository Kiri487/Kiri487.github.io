import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ComputerIcon, FolderIcon, TerminalIcon } from "../../icons";
import MessageBox from "../common/MessageBox";
import { sortPrograms, type InstalledProgram, type ProgramSort } from "./installedPrograms";
import "./projects.css";

const WINDOW_NAME = "Add or Remove Programs";

const REMOVE_REFUSALS: ((title: string) => string)[] = [
  () => "This program is load-bearing.",
  () => "Uninstalling this would also uninstall Tuesday.",
  (title) => `${title} does not consent.`,
  () => "Removed successfully. It came back.",
];

/** Links inside shared descriptions are plain anchors, which would navigate away from the whole desktop. */
function openLinksInNewTab(event: MouseEvent<HTMLDivElement>) {
  const link = (event.target as Element).closest("a");
  if (!link) return;
  event.preventDefault();
  window.open(link.href, "_blank", "noopener,noreferrer");
}

function ProgramRow({
  program,
  expanded,
  onToggle,
  onRemove,
}: {
  program: InstalledProgram;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { project, kind } = program;

  return (
    <div className={`kara-program${expanded ? " kara-program--expanded" : ""}`}>
      <button type="button" className="kara-program__head" aria-expanded={expanded} onClick={onToggle}>
        <img className="kara-program__icon" src={project.img} alt="" draggable={false} />
        <span className="kara-program__name">{project.title}</span>
        <span className="kara-program__kind">{kind}</span>
      </button>

      {expanded && (
        <div className="kara-program__details">
          <img className="kara-program__image" src={project.img} alt="" draggable={false} />
          <div className="kara-program__info">
            <div className="kara-program__description" onClick={openLinksInNewTab}>
              {project.description}
            </div>
            <dl className="kara-program__facts">
              <dt>Last Used On</dt>
              <dd>{project.period ?? project.year}</dd>
              <dt>Requires</dt>
              <dd>{project.tags.map((tag) => tag.name).join(", ")}</dd>
            </dl>
            <div className="kara-program__actions">
              {project.links.map((link) => (
                <a key={link.url} className="kara-program__button" href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
              <button type="button" className="kara-program__button" onClick={onRemove}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsApp() {
  const [sort, setSort] = useState<ProgramSort>("date");
  const programs = useMemo(() => sortPrograms(sort), [sort]);
  // Open the newest one, so the first thing a visitor sees shows what a row holds.
  const [expandedTitle, setExpandedTitle] = useState<string | null>(() => sortPrograms("date")[0].project.title);
  const [message, setMessage] = useState<string | null>(null);
  const lastRefusalRef = useRef<number | null>(null);

  // Never the same line twice in a row, so pressing Remove again always gets a new answer.
  const refuseRemoval = (title: string) => {
    const choices = REMOVE_REFUSALS.map((_, index) => index).filter((index) => index !== lastRefusalRef.current);
    const pick = choices[Math.floor(Math.random() * choices.length)];
    lastRefusalRef.current = pick;
    setMessage(REMOVE_REFUSALS[pick](title));
  };

  return (
    <div className="kara-programs">
      <nav className="kara-programs__rail">
        <button type="button" className="kara-programs__rail-item kara-programs__rail-item--current">
          <TerminalIcon size={32} />
          Change or Remove Programs
        </button>
        <button
          type="button"
          className="kara-programs__rail-item"
          onClick={() => setMessage("Kara does not accept new programs. There is barely room for these.")}
        >
          <FolderIcon size={32} />
          Add New Programs
        </button>
        <button
          type="button"
          className="kara-programs__rail-item"
          onClick={() => setMessage("Kara has no removable components. We looked.")}
        >
          <ComputerIcon size={32} />
          Add/Remove Kara Components
        </button>
      </nav>

      <div className="kara-programs__main">
        <div className="kara-programs__toolbar">
          <span>Currently installed programs:</span>
          <label className="kara-programs__sort">
            Sort by:
            <select value={sort} onChange={(event) => setSort(event.target.value as ProgramSort)}>
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </label>
        </div>
        <div className="kara-programs__list">
          {programs.map((program) => {
            const { title } = program.project;
            return (
              <ProgramRow
                key={title}
                program={program}
                expanded={expandedTitle === title}
                onToggle={() => setExpandedTitle(expandedTitle === title ? null : title)}
                onRemove={() => refuseRemoval(title)}
              />
            );
          })}
        </div>
      </div>

      {message && <MessageBox title={WINDOW_NAME} message={message} onClose={() => setMessage(null)} />}
    </div>
  );
}

export default ProjectsApp;
