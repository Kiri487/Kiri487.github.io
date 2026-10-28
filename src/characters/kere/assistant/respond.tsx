import { contacts, educationData, skillsData, workData } from "../../../data/portfolio";
import { CONTACT_IDS, SECTIONS, displayUrl, formatPeriod, type SectionId } from "../cv/layout";
import { allProjects, projectAnchor, type CvProject } from "../cv/projects";
import {
  EASTER_EGGS,
  FALLBACK_REPLIES,
  HELLO_REPLIES,
  HELP_INTRO,
  HELP_OPTIONS,
  PROJECT_ALIASES,
  TOPIC_PHRASES,
} from "./script";
import type { Reply } from "./types";

/** Lowercase, punctuation → spaces, padded so phrases match on whole words only. */
export function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function matches(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

/** Remembers the last variant per rule so the same line never fires twice in a row. */
export type ReplyMemory = Map<string, number>;

function pick(memory: ReplyMemory, key: string, options: readonly string[]): string {
  if (options.length === 1) return options[0];
  const last = memory.get(key);
  let i = Math.floor(Math.random() * options.length);
  if (i === last) i = (i + 1) % options.length;
  memory.set(key, i);
  return options[i];
}

function sectionJump(id: SectionId): Reply["jump"] {
  const title = SECTIONS.find((s) => s.id === id)?.title ?? id;
  return { id, label: `View ${title}` };
}

function externalLink(url: string, label: string) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

/* ---- replies generated from portfolio data ---- */

function educationReply(): Reply {
  return {
    lines: [
      "Education, most recent first:",
      ...educationData.map((e) => `${e.school}: ${e.department} (${formatPeriod(e.period)})`),
    ],
    jump: sectionJump("education"),
  };
}

function experienceReply(): Reply {
  const current = workData.filter((w) => w.period.includes("Present"));
  const previous = workData.filter((w) => !w.period.includes("Present"));
  return {
    lines: [
      ...current.map((w) => `Currently: ${w.position} at ${w.company} (${formatPeriod(w.period)}).`),
      ...previous.map((w) => `Previously: ${w.position} at ${w.company} (${formatPeriod(w.period)}).`),
    ],
    jump: sectionJump("experience"),
  };
}

function projectsReply(): Reply {
  const recent = allProjects.slice(0, 3);
  return {
    lines: [
      `${allProjects.length} projects on file. Most recent:`,
      ...recent.map((p) => `${p.title} (${formatPeriod(p.period ?? p.year)})`),
      "Ask me about any of them by name.",
    ],
    jump: sectionJump("projects"),
  };
}

function projectReply(p: CvProject): Reply {
  return {
    lines: [
      `${p.title}. ${p.kind} project, ${formatPeriod(p.period ?? p.year)}.`,
      p.description,
      ...(p.links.length > 0
        ? [
            <>
              {p.links.map((l, i) => (
                <span key={l.url}>
                  {i > 0 && " · "}
                  {externalLink(l.url, l.label)}
                </span>
              ))}
            </>,
          ]
        : []),
    ],
    jump: { id: projectAnchor(p.title), label: "View on the CV" },
  };
}

function skillsReply(): Reply {
  return {
    lines: skillsData.map((c) => `${c.category}: ${c.skills.map((s) => s.name).join(", ")}`),
    jump: sectionJump("skills"),
  };
}

function contactReply(): Reply {
  const shown = CONTACT_IDS.map((id) => contacts.find((c) => c.id === id)).filter((c) => c !== undefined);
  return {
    lines: [
      "Professional channels:",
      ...shown.map((c) => (
        <>
          {c.label}:{" "}
          {c.id === "mail" ? <a href={c.url}>{displayUrl(c.url)}</a> : externalLink(c.url, displayUrl(c.url))}
        </>
      )),
    ],
  };
}

function findProject(normalized: string): CvProject | undefined {
  return allProjects.find((p) => matches(normalized, [p.title, ...(PROJECT_ALIASES[p.title] ?? [])]));
}

/** Easter eggs → project names → topics → fallback. */
export function respond(input: string, memory: ReplyMemory): Reply {
  const text = normalize(input);

  const egg = EASTER_EGGS.find((rule) => matches(text, rule.phrases));
  if (egg) {
    return {
      lines: [pick(memory, egg.id, egg.replies)],
      expression: egg.expression,
      jump: egg.jump,
      action: egg.action,
    };
  }

  const project = findProject(text);
  if (project) return projectReply(project);

  if (matches(text, TOPIC_PHRASES.help)) return { lines: [HELP_INTRO], options: HELP_OPTIONS };
  if (matches(text, TOPIC_PHRASES.education)) return educationReply();
  if (matches(text, TOPIC_PHRASES.experience)) return experienceReply();
  if (matches(text, TOPIC_PHRASES.projects)) return projectsReply();
  if (matches(text, TOPIC_PHRASES.skills)) return skillsReply();
  if (matches(text, TOPIC_PHRASES.contact)) return contactReply();
  if (matches(text, TOPIC_PHRASES.hello)) return { lines: [pick(memory, "hello", HELLO_REPLIES)] };

  return { lines: [pick(memory, "fallback", FALLBACK_REPLIES)], expression: "confused", options: HELP_OPTIONS };
}
