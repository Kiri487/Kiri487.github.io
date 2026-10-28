import type { QuickOption, ScriptedRule } from "./types";

/* ============================================================
   Everything Kere says that isn't generated from portfolio data.
   Edit freely — phrases are lowercase words without punctuation.
   ============================================================ */

/** One is picked at random when the chat first opens. "Kere" looks like a typo of "Kiri", so each says who she is. */
export const GREETINGS = [
  "Hello. I'm Kere, Kiri in work mode. Ask me about education, experience, projects, skills, or contact.",
  "Hello. I'm Kere — not a typo, just Kiri in work mode. Ask me about education, experience, projects, skills, or contact.",
  "Hello. I'm Kere. Yes, with an e. I'm the part of Kiri that reads the documentation. Ask me about education, experience, projects, skills, or contact.",
];

export const GREETING_OPTIONS: QuickOption[] = [
  { label: "Projects", query: "projects" },
  { label: "Skills", query: "skills" },
  { label: "Contact", query: "contact" },
];

export const HELLO_REPLIES = [
  "Hello. What can I help you with?",
  "Hi. What do you need?",
  "Hello. Ready when you are.",
];

export const HELP_INTRO =
  "I can answer questions about the following. You can also ask about a specific project by name, or type \"exit\" to return to Kiri's main page.";

export const HELP_OPTIONS: QuickOption[] = [
  { label: "Education", query: "education" },
  { label: "Experience", query: "experience" },
  { label: "Projects", query: "projects" },
  { label: "Skills", query: "skills" },
  { label: "Contact", query: "contact" },
];

export const FALLBACK_REPLIES = [
  "That's outside my documented scope. Try \"help\".",
  "I didn't catch that. Keywords work best.",
  "No matching entry. Try education, experience, projects, skills, or contact.",
];

/** Checked before anything else, top to bottom. */
export const EASTER_EGGS: ScriptedRule[] = [
  {
    // Before "kiri", so "back to kiri" leaves instead of getting Kere's opinion of Kiri.
    id: "exit",
    phrases: ["exit", "leave", "quit", "log out", "logout", "clock out", "go back", "back to kiri"],
    action: "exit",
    replies: [
      "Clocking out.",
      "Logging off. Please don't break anything while I'm gone.",
      "Understood. Returning you to Kiri.",
    ],
  },
  {
    id: "job",
    phrases: ["like your job", "like your work", "enjoy your job", "love your job", "like working"],
    replies: [
      "I enjoy solving problems. Preferably ones with clearly defined requirements.",
      "Yes. Especially on days when the requirements don't change.",
      "It's fine. The tests pass. Most of them.",
    ],
  },
  {
    id: "overtime",
    phrases: ["overtime", "work late", "stay late", "work on weekends", "work weekends"],
    expression: "annoyed",
    replies: [
      "I'd prefer to discuss the scope first.",
      "Is this an emergency, or a planning issue?",
      "I checked my calendar. It says no.",
    ],
  },
  {
    id: "feature",
    phrases: ["add a feature", "add another feature", "add feature", "new feature", "one more feature", "feature request"],
    expression: "annoyed",
    replies: [
      "Please submit a change request.",
      "Noted. It's in the backlog. Position: 47.",
      "Sure. Which existing feature should we remove?",
    ],
  },
  {
    id: "kiri",
    phrases: ["kiri"],
    replies: [
      "Creative. Ambitious. Occasionally unrealistic about development estimates.",
      "Kiri has ideas. Many ideas. I maintain the backlog.",
      "Kiri started this website. I'm the one keeping the data files up to date.",
    ],
  },
  {
    id: "kuru",
    phrases: ["kuru"],
    expression: "annoyed",
    replies: [
      "\"Always Chill and Cool.\" Has been almost done with the same track since last quarter. I've stopped asking for an ETA.",
      "\"Always Chill and Cool.\" Average reply length: one word. Two, if it's urgent.",
      "\"Always Chill and Cool.\" Skips every standup. Ships at 3 a.m. Writes no documentation. Annoyingly, it works.",
      "\"Always Chill and Cool.\" I sent Kuru a meeting invite. Declined. No message.",
    ],
  },
  {
    id: "deadline",
    phrases: ["deadline", "deadlines", "asap"],
    expression: "overwhelmed",
    replies: [
      "Is that a deadline, or a wish?",
      "Deadlines are fine. Surprise deadlines are not.",
    ],
  },
  {
    id: "bot",
    phrases: ["are you ai", "are you an ai", "are you a bot", "are you a robot", "are you human", "are you real", "chatgpt", "chat gpt"],
    replies: [
      "Rule-based. Every reply here was written by hand.",
      "No AI. Just keyword matching and a lot of if statements. It's honest work.",
    ],
  },
  {
    id: "how",
    phrases: ["how are you", "how are things", "how is it going", "how s it going", "how do you do"],
    replies: [
      "Operational. Thank you for asking.",
      "Busy, but within acceptable limits.",
    ],
  },
  {
    id: "cv",
    phrases: ["cv", "resume", "curriculum vitae"],
    jump: { id: "top", label: "Back to the top" },
    replies: ["You're looking at it."],
  },
  {
    id: "cat",
    phrases: ["cat", "cats", "meow", "nya", "kitty", "neko"],
    replies: [
      "Yes. Cat. It doesn't affect my productivity.",
      "Cats: independent, efficient, and they never schedule meetings. Highly respected.",
      "Cats are excellent at focusing. Until something moves.",
    ],
  },
  {
    id: "laugh",
    phrases: ["lol", "lmao", "haha", "hahaha", "rofl", "xd"],
    replies: [
      "I'll take that as positive feedback.",
      "Glad someone's enjoying this.",
    ],
  },
  {
    id: "bye",
    phrases: ["bye", "goodbye", "see you", "see ya", "good night"],
    replies: [
      "Goodbye. The CV will still be here.",
      "Noted. Closing ticket.",
    ],
  },
  {
    id: "hire",
    phrases: ["hire", "hire you", "hiring", "recruit", "recruiting", "job offer"],
    jump: { id: "top", label: "View contact details" },
    replies: [
      "Reasonable decision. Contact details are at the top.",
      "Noted. Contact details are at the top. Response time is usually reasonable.",
    ],
  },
  {
    id: "meeting",
    phrases: ["meeting", "meetings", "quick call", "quick sync", "hop on a call"],
    expression: "annoyed",
    replies: [
      "Could this have been an email?",
      "Is there an agenda?",
      "I'll attend if there's an agenda. And an end time.",
    ],
  },
  {
    id: "coffee",
    phrases: ["coffee"],
    replies: [
      "Yes.",
      "Already on my second one.",
      "Black. No sugar. Thank you.",
    ],
  },
  {
    id: "thanks",
    phrases: ["thanks", "thank you", "thx", "ty"],
    replies: [
      "You're welcome.",
      "Anytime. Within office hours.",
      "Glad that was useful.",
    ],
  },
  {
    // Last: a bare "kere" is the weakest signal, so "thanks kere" or "can I hire kere" hit their own replies.
    id: "about",
    phrases: ["who are you", "what are you", "kere", "about you", "introduce yourself", "your name"],
    replies: [
      "I'm Kere, another side of Kiri. Kiri is the creative one, Kuru is the chill one, and I'm the one who handles the CV, the deadlines, and the documentation.",
      "Kere. Same person as Kiri, different settings. This is the version that answers emails on time.",
    ],
  },
];

/** Topic keywords, checked after easter eggs and project names. First match wins, so greetings go last. */
export const TOPIC_PHRASES = {
  help: ["help", "what can you do", "what can i ask", "commands", "menu", "options"],
  education: ["education", "university", "school", "degree", "study", "studies", "master", "masters", "bachelor", "ntu", "ntut"],
  experience: ["experience", "work", "job", "jobs", "internship", "internships", "intern", "career", "employment", "trendai", "gss"],
  projects: ["projects", "project", "portfolio", "works", "side projects"],
  skills: ["skills", "skill", "tech stack", "stack", "languages", "programming", "tools", "technologies", "tech"],
  contact: ["contact", "email", "e mail", "mail", "github", "git hub", "linkedin", "linked in", "reach you", "social"],
  hello: ["hello", "hi", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening"],
} as const;

/** Extra names visitors might use for a project; the full title always works too. */
export const PROJECT_ALIASES: Record<string, string[]> = {
  "Mystic Shop LUIS": ["mystic shop", "luis"],
  "AI Vtuber - Kassus": ["kassus", "vtuber", "ai vtuber"],
  "Computer Animation Projects": ["computer animation"],
  "Computer Typography and Character Encoding Projects": ["typography", "character encoding"],
  "Data Visualization Projects": ["data visualization", "data vis", "dataviz"],
  "Simple PowerPoint": ["powerpoint", "simple ppt"],
  "Mikiri Mura": ["mikiri"],
  "RESTort": ["restort"],
  "Gravity Drift": ["gravity drift"],
  "RANsomCheck": ["ransomcheck", "ransomware"],
  "Reddit Sentiment Analysis": ["reddit", "sentiment analysis"],
  "Elecookies-Frontend": ["elecookies"],
  "BOXBOB": ["boxbob", "sokoban"],
};
