import { educationData, skillsData, workData } from "../../../data/portfolio";
import ContactLink from "../cv/ContactLink";
import ProjectLinks from "../cv/ProjectLinks";
import { formatPeriod, skillNames } from "../cv/format";
import { CV_CONTACTS, SECTIONS } from "../cv/layout";
import { allProjects, projectAnchor, type CvProject } from "../cv/projects";
import {
  CONFUSED_STREAK,
  CONFUSED_STREAK_REPLIES,
  EASTER_EGGS,
  FALLBACK_REPLIES,
  HELLO_REPLIES,
  HELP_INTRO,
  HELP_OPTIONS,
  PROJECT_ALIASES,
  SFX_PHRASES,
  SFX_REPLIES,
  TIME_REPLIES,
  TOPIC_PHRASES,
  type TimePeriod,
} from "./script";
import type { Reply } from "./types";

/** Lowercase, punctuation → spaces, padded so phrases match on whole words only. */
export function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function matches(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

/** Per-conversation state; cleared on reload. */
export interface ReplyMemory {
  /** Last variant picked per rule, so the same line never fires twice in a row. */
  lastPick: Map<string, number>;
  /** Unmatched inputs in a row. */
  missStreak: number;
}

export function createReplyMemory(): ReplyMemory {
  return { lastPick: new Map(), missStreak: 0 };
}

export function pick(memory: ReplyMemory, key: string, options: readonly string[]): string {
  if (options.length === 1) return options[0];
  const last = memory.lastPick.get(key);
  let i = Math.floor(Math.random() * options.length);
  if (i === last) i = (i + 1) % options.length;
  memory.lastPick.set(key, i);
  return options[i];
}

/** Period of the visitor's own local time. */
export function currentPeriod(date = new Date()): TimePeriod {
  const hour = date.getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function sectionJump(id: string): Reply["jump"] {
  const title = SECTIONS.find((s) => s.id === id)?.title ?? id;
  return { id, label: `View ${title}` };
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
      ...(p.links.length > 0 ? [<ProjectLinks links={p.links} />] : []),
    ],
    jump: { id: projectAnchor(p.title), label: "View on the CV" },
  };
}

function skillsReply(): Reply {
  return {
    lines: skillsData.map((c) => `${c.category}: ${skillNames(c.skills)}`),
    jump: sectionJump("skills"),
  };
}

function contactReply(): Reply {
  return {
    lines: [
      "Professional channels:",
      ...CV_CONTACTS.map((c) => (
        <>
          {c.label}: <ContactLink contact={c} />
        </>
      )),
    ],
  };
}

/** Sound commands. Already-set states get a plain statement — Kere never sounds impatient with the visitor. */
function sfxReply(text: string, memory: ReplyMemory, sfxEnabled: boolean): Reply | undefined {
  if (matches(text, SFX_PHRASES.on)) {
    return sfxEnabled
      ? { lines: [pick(memory, "sfx-already-on", SFX_REPLIES.alreadyOn)] }
      : { lines: [pick(memory, "sfx-on", SFX_REPLIES.on)], action: "sfx-on" };
  }
  if (matches(text, SFX_PHRASES.shutUp)) {
    return sfxEnabled
      ? { lines: [pick(memory, "sfx-shut-up", SFX_REPLIES.shutUp)], expression: "overwhelmed", action: "sfx-off" }
      : { lines: [pick(memory, "sfx-already-off", SFX_REPLIES.alreadyOff)], expression: "overwhelmed" };
  }
  if (matches(text, SFX_PHRASES.off)) {
    return sfxEnabled
      ? { lines: [pick(memory, "sfx-off", SFX_REPLIES.off)], action: "sfx-off" }
      : { lines: [pick(memory, "sfx-already-off", SFX_REPLIES.alreadyOff)] };
  }
  if (matches(text, SFX_PHRASES.status)) {
    return { lines: [pick(memory, "sfx-status", sfxEnabled ? SFX_REPLIES.statusOn : SFX_REPLIES.statusOff)] };
  }
  return undefined;
}

function findProject(normalized: string): CvProject | undefined {
  return allProjects.find((p) => matches(normalized, [p.title, ...(PROJECT_ALIASES[p.title] ?? [])]));
}

/** Sound commands → easter eggs → project names → topics → fallback. */
export function respond(input: string, memory: ReplyMemory, sfxEnabled: boolean): Reply {
  const text = normalize(input);
  const reply = sfxReply(text, memory, sfxEnabled) ?? match(text, memory);
  if (reply) {
    memory.missStreak = 0;
    return reply;
  }

  memory.missStreak += 1;
  if (memory.missStreak >= CONFUSED_STREAK) {
    return {
      lines: [pick(memory, "confused-streak", CONFUSED_STREAK_REPLIES)],
      expression: "overwhelmed",
      options: HELP_OPTIONS,
    };
  }
  return { lines: [pick(memory, "fallback", FALLBACK_REPLIES)], expression: "confused", options: HELP_OPTIONS };
}

function match(text: string, memory: ReplyMemory): Reply | undefined {
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
  if (matches(text, TOPIC_PHRASES.hello)) {
    return { lines: [pick(memory, "hello", [...HELLO_REPLIES, ...TIME_REPLIES[currentPeriod()]])] };
  }

  return undefined;
}
