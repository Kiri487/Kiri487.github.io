import { educationData, skillsData, workData } from "../../../data/portfolio";
import ContactLink from "../cv/ContactLink";
import ProjectLinks from "../cv/ProjectLinks";
import { formatPeriod, skillNames } from "../cv/format";
import { CV_CONTACTS, SECTIONS } from "../cv/layout";
import { allProjects, projectAnchor, type CvProject } from "../cv/projects";
import {
  CHINESE_INTRO,
  CHINESE_PHRASES,
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
import type { Lang, Reply } from "./types";

const CHINESE = /[㐀-鿿]/;

/** Chinese if the message contains any Chinese character — so "我想看 projects" gets a Chinese reply. */
export function detectLang(text: string): Lang {
  return CHINESE.test(text) ? "zh" : "en";
}

/**
 * Lowercase, punctuation → spaces, padded so English phrases match on whole words only.
 * Runs of Chinese are spaced off from Latin text, so "看projects" still contains the word "projects".
 */
export function normalize(text: string): string {
  const spaced = text
    .toLowerCase()
    .replace(/[^a-z0-9㐀-鿿]+/g, " ")
    .replace(/[㐀-鿿]+/g, " $& ");
  return ` ${spaced.replace(/ +/g, " ").trim()} `;
}

/** English phrases match whole words. Chinese has no spaces between words, so those match anywhere, spaces ignored. */
function matches(normalized: string, phrases: readonly string[]): boolean {
  const compact = normalized.replace(/ /g, "");
  return phrases.some((p) =>
    CHINESE.test(p) ? compact.includes(normalize(p).replace(/ /g, "")) : normalized.includes(normalize(p)),
  );
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

/** Section titles stay English in both languages — that's what the visitor will see on the CV. */
function sectionJump(id: string, lang: Lang): Reply["jump"] {
  const title = SECTIONS.find((s) => s.id === id)?.title ?? id;
  return { id, label: lang === "zh" ? `查看 ${title}` : `View ${title}` };
}

/* ---- replies generated from portfolio data (the data itself stays English) ---- */

function educationReply(lang: Lang): Reply {
  return {
    lines: [
      lang === "zh" ? "學歷，從最新的開始：" : "Education, most recent first:",
      ...educationData.map((e) => `${e.school}: ${e.department} (${formatPeriod(e.period)})`),
    ],
    jump: sectionJump("education", lang),
  };
}

function experienceReply(lang: Lang): Reply {
  const current = workData.filter((w) => w.period.includes("Present"));
  const previous = workData.filter((w) => !w.period.includes("Present"));
  if (lang === "zh") {
    return {
      lines: [
        ...current.map((w) => `目前在 ${w.company} 擔任 ${w.position}（${formatPeriod(w.period)}）。`),
        ...previous.map((w) => `之前在 ${w.company} 擔任 ${w.position}（${formatPeriod(w.period)}）。`),
      ],
      jump: sectionJump("experience", lang),
    };
  }
  return {
    lines: [
      ...current.map((w) => `Currently: ${w.position} at ${w.company} (${formatPeriod(w.period)}).`),
      ...previous.map((w) => `Previously: ${w.position} at ${w.company} (${formatPeriod(w.period)}).`),
    ],
    jump: sectionJump("experience", lang),
  };
}

function projectsReply(lang: Lang): Reply {
  const recent = allProjects.slice(0, 3);
  const zh = lang === "zh";
  return {
    lines: [
      zh ? `目前總共有 ${allProjects.length} 個專案，最近的是這幾個：` : `${allProjects.length} projects on file. Most recent:`,
      ...recent.map((p) => `${p.title} (${formatPeriod(p.period ?? p.year)})`),
      zh ? "想知道哪一個，可以直接打名稱問我。" : "Ask me about any of them by name.",
    ],
    jump: sectionJump("projects", lang),
  };
}

const PROJECT_KIND_ZH: Record<CvProject["kind"], string> = { Personal: "個人", Team: "團隊" };

function projectReply(p: CvProject, lang: Lang): Reply {
  const period = formatPeriod(p.period ?? p.year);
  return {
    lines: [
      lang === "zh" ? `${p.title}：${PROJECT_KIND_ZH[p.kind]}專案，${period}。` : `${p.title}. ${p.kind} project, ${period}.`,
      p.description,
      ...(p.links.length > 0 ? [<ProjectLinks links={p.links} />] : []),
    ],
    jump: { id: projectAnchor(p.title), label: lang === "zh" ? "到 CV 上看" : "View on the CV" },
  };
}

function skillsReply(lang: Lang): Reply {
  return {
    lines: skillsData.map((c) => `${c.category}: ${skillNames(c.skills)}`),
    jump: sectionJump("skills", lang),
  };
}

function contactReply(lang: Lang): Reply {
  return {
    lines: [
      lang === "zh" ? "工作上可以用這些方式聯絡：" : "Professional channels:",
      ...CV_CONTACTS.map((c) => (
        <>
          {c.label}: <ContactLink contact={c} />
        </>
      )),
    ],
  };
}

/** Sound commands. Already-set states get a plain statement — Kere never sounds impatient with the visitor. */
function sfxReply(text: string, memory: ReplyMemory, sfxEnabled: boolean, lang: Lang): Reply | undefined {
  const replies = SFX_REPLIES[lang];
  if (matches(text, SFX_PHRASES.on)) {
    return sfxEnabled
      ? { lines: [pick(memory, `sfx-already-on-${lang}`, replies.alreadyOn)] }
      : { lines: [pick(memory, `sfx-on-${lang}`, replies.on)], action: "sfx-on" };
  }
  if (matches(text, SFX_PHRASES.shutUp)) {
    return sfxEnabled
      ? { lines: [pick(memory, `sfx-shut-up-${lang}`, replies.shutUp)], expression: "overwhelmed", action: "sfx-off" }
      : { lines: [pick(memory, `sfx-already-off-${lang}`, replies.alreadyOff)], expression: "overwhelmed" };
  }
  if (matches(text, SFX_PHRASES.off)) {
    return sfxEnabled
      ? { lines: [pick(memory, `sfx-off-${lang}`, replies.off)], action: "sfx-off" }
      : { lines: [pick(memory, `sfx-already-off-${lang}`, replies.alreadyOff)] };
  }
  if (matches(text, SFX_PHRASES.status)) {
    return { lines: [pick(memory, `sfx-status-${lang}`, sfxEnabled ? replies.statusOn : replies.statusOff)] };
  }
  return undefined;
}

function findProject(normalized: string): CvProject | undefined {
  return allProjects.find((p) => matches(normalized, [p.title, ...(PROJECT_ALIASES[p.title] ?? [])]));
}

/** Sound commands → "中文" → easter eggs → project names → topics → fallback. */
export function respond(input: string, memory: ReplyMemory, sfxEnabled: boolean): Reply {
  const text = normalize(input);
  const lang = detectLang(input);
  const reply = sfxReply(text, memory, sfxEnabled, lang) ?? match(text, memory, lang);
  if (reply) {
    memory.missStreak = 0;
    return { ...reply, lang: reply.lang ?? lang };
  }

  memory.missStreak += 1;
  if (memory.missStreak >= CONFUSED_STREAK) {
    return {
      lines: [pick(memory, `confused-streak-${lang}`, CONFUSED_STREAK_REPLIES[lang])],
      expression: "overwhelmed",
      options: HELP_OPTIONS[lang],
      lang,
    };
  }
  return {
    lines: [pick(memory, `fallback-${lang}`, FALLBACK_REPLIES[lang])],
    expression: "confused",
    options: HELP_OPTIONS[lang],
    lang,
  };
}

function match(text: string, memory: ReplyMemory, lang: Lang): Reply | undefined {
  if (matches(text, CHINESE_PHRASES)) return { lines: [CHINESE_INTRO], options: HELP_OPTIONS.zh, lang: "zh" };

  const egg = EASTER_EGGS.find((rule) => matches(text, rule.phrases));
  if (egg) {
    // An egg without Chinese lines answers in English, even to a Chinese message.
    const zh = lang === "zh" ? egg.repliesZh : undefined;
    return {
      lines: [zh ? pick(memory, `${egg.id}-zh`, zh) : pick(memory, egg.id, egg.replies)],
      expression: egg.expression,
      jump: zh && egg.jump && egg.jumpLabelZh ? { ...egg.jump, label: egg.jumpLabelZh } : egg.jump,
      action: egg.action,
      lang: zh ? "zh" : "en",
    };
  }

  const project = findProject(text);
  if (project) return projectReply(project, lang);

  if (matches(text, TOPIC_PHRASES.help)) return { lines: [HELP_INTRO[lang]], options: HELP_OPTIONS[lang] };
  if (matches(text, TOPIC_PHRASES.education)) return educationReply(lang);
  if (matches(text, TOPIC_PHRASES.experience)) return experienceReply(lang);
  if (matches(text, TOPIC_PHRASES.projects)) return projectsReply(lang);
  if (matches(text, TOPIC_PHRASES.skills)) return skillsReply(lang);
  if (matches(text, TOPIC_PHRASES.contact)) return contactReply(lang);
  if (matches(text, TOPIC_PHRASES.hello)) {
    return {
      lines: [pick(memory, `hello-${lang}`, [...HELLO_REPLIES[lang], ...TIME_REPLIES[lang][currentPeriod()]])],
    };
  }

  return undefined;
}
