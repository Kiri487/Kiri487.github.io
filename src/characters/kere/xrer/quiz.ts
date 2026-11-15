import { KIRI_CV } from "../cv/data";
import { FAKE_PROJECTS, MONTHS, startOf, TECH_SWAPS } from "./flaws";
import { pickOne, shuffle, type Rng } from "./random";
import type { Lang } from "./script";
import { seeded } from "./seeded";

/* ============================================================
   Article 10: now and then XR checks the Reviewer instead. One
   question about Kiri's CV, two answers, one of them right.
   Built from the live CV, so it stays answerable as the CV
   changes, and from the round's seed, so a refresh asks the
   same thing. Never about a position or a club role.
   ============================================================ */

export interface Quiz {
  question: Record<Lang, string>;
  /** Both answers, in the order shown. */
  options: [string, string];
  answer: string;
  /** The record field that holds the answer: kept readable all round. */
  field: string;
}

/** "Galaxy Software Services Corporation (GSS)" → "GSS"; "Google Developer Student Clubs (GDSC) NTUT" → "GDSC NTUT". */
function short(name: string): string {
  const m = name.match(/\(([^)]+)\)(.*)$/);
  return m ? `${m[1]}${m[2]}`.trim() : name;
}

/** A plausible wrong date: a month earlier ("Jul 2024" → "Jun 2024"), or a year ("Jul 2024" → "Jul 2023"). */
function nearDate(date: string, rng: Rng): string {
  const [month, year] = date.split(" ");
  if (month === "Jan" || rng() < 0.5) return `${month} ${Number(year) - 1}`;
  return `${MONTHS[MONTHS.indexOf(month) - 1]} ${year}`;
}

const nearYear = (year: string, rng: Rng) => String(Number(year) + (rng() < 0.5 ? -1 : 1));

/** Other places in Taiwan, for the wrong answer to "where". */
const OTHER_PLACES = ["New Taipei, Taiwan", "Taichung, Taiwan", "Hsinchu, Taiwan", "Tainan, Taiwan", "Kaohsiung, Taiwan"];

/** A club entry: "Google Developer Student Clubs (GDSC) NTUT - Lead (Aug 2022 - Jul 2023)". Only the org and dates. */
const CLUB_ITEM = /^(.+?) - .+? \(([A-Z][a-z]{2} \d{4})/;
/** An event entry with its year right after the name: "Students' Information Technology Conference (SITCON) 2022 - Staff". */
const EVENT_ITEM = /^(.+?) (\d{4}) - /;

type Draft = Omit<Quiz, "options"> & { wrong: string };

function timeQuestion(rng: Rng): Draft {
  const cv = KIRI_CV;
  const workStart = (): Draft => {
    const i = Math.floor(rng() * cv.work.length);
    const name = short(cv.work[i].company);
    const answer = startOf(cv.work[i].period);
    return {
      question: { zh: `Kiri 在 ${name} 的經歷始於何時？`, en: `When did Kiri start at ${name}?` },
      answer,
      wrong: nearDate(answer, rng),
      field: `work.${i}.date`,
    };
  };
  const drafts: (() => Draft | undefined)[] = [
    workStart,
    () => {
      const i = Math.floor(rng() * cv.education.length);
      const name = short(cv.education[i].school);
      const answer = startOf(cv.education[i].period);
      return {
        question: { zh: `Kiri 何時進入 ${name}？`, en: `When did Kiri enter ${name}?` },
        answer,
        wrong: nearDate(answer, rng),
        field: `education.${i}.date`,
      };
    },
    () => {
      const i = Math.floor(rng() * cv.projects.length);
      const { title, year } = cv.projects[i];
      return {
        question: { zh: `${title} 是哪一年的專案？`, en: `Which year is ${title} from?` },
        answer: year,
        wrong: nearYear(year, rng),
        field: `projects.${i}.date`,
      };
    },
    () => {
      const category = "Clubs & Leadership";
      const clubs = cv.lists.find((l) => l.category === category)?.items ?? [];
      const found = clubs.flatMap((item, j) => {
        const m = item.match(CLUB_ITEM);
        return m ? [{ name: short(m[1]), start: m[2], j }] : [];
      });
      if (found.length === 0) return undefined;
      const { name, start: answer, j } = pickOne(found, rng);
      return {
        question: { zh: `Kiri 何時加入 ${name}？`, en: `When did Kiri join ${name}?` },
        answer,
        wrong: nearDate(answer, rng),
        field: `lists.${category}.${j}.date`,
      };
    },
    () => {
      // Only events Kiri lists once: GiCS has three years, so "which year" would have three right answers.
      const events = cv.lists.flatMap((l) =>
        l.items.flatMap((item) => {
          const m = item.match(EVENT_ITEM);
          return m ? [{ org: m[1], year: m[2] }] : [];
        }),
      );
      const once = events.filter((e) => events.filter((o) => o.org === e.org).length === 1);
      if (once.length === 0) return undefined;
      const { org, year } = pickOne(once, rng);
      const name = short(org);
      return {
        question: { zh: `Kiri 哪一年參加 ${name}？`, en: `In which year did Kiri take part in ${name}?` },
        answer: year,
        wrong: nearYear(year, rng),
        // Honours and community entries never rot, so there's nothing to keep clear.
        field: "",
      };
    },
  ];
  return pickOne(drafts, rng)() ?? workStart();
}

function placeQuestion(rng: Rng): Draft | undefined {
  const entries = [
    ...KIRI_CV.education.map((e, i) => ({ name: e.school, location: e.location, field: `education.${i}.location` })),
    ...KIRI_CV.work.map((w, i) => ({ name: w.company, location: w.location, field: `work.${i}.location` })),
  ].flatMap((e) => (e.location ? [{ ...e, location: e.location }] : []));
  if (entries.length === 0) return undefined;
  const e = pickOne(entries, rng);
  const name = short(e.name);
  return {
    question: { zh: `Kiri 的 CV 上，${name} 列的地點是？`, en: `Which location does Kiri's CV give for ${name}?` },
    answer: e.location,
    wrong: pickOne(OTHER_PLACES.filter((p) => p !== e.location), rng),
    field: e.field,
  };
}

/** The wrong answer is one of the fake Kiris' projects: anyone who has read their CVs may know it. */
function projectQuestion(rng: Rng): Draft {
  const i = Math.floor(rng() * KIRI_CV.projects.length);
  return {
    question: { zh: "以下哪一個是 Kiri 的專案？", en: "Which of these is one of Kiri's projects?" },
    answer: KIRI_CV.projects[i].title,
    wrong: pickOne(FAKE_PROJECTS, rng).title,
    field: `projects.${i}.title`,
  };
}

function techQuestion(rng: Rng): Draft | undefined {
  const spots = KIRI_CV.projects.flatMap((p, i) =>
    p.tags.flatMap((t) => {
      const to = TECH_SWAPS[t.name];
      return to && !p.tags.some((o) => o.name === to) ? [{ i, title: p.title, answer: t.name, wrong: to }] : [];
    }),
  );
  if (spots.length === 0) return undefined;
  const s = pickOne(spots, rng);
  return {
    question: { zh: `${s.title} 使用了哪項技術？`, en: `Which technology does ${s.title} use?` },
    answer: s.answer,
    wrong: s.wrong,
    field: `projects.${s.i}.tags`,
  };
}

/** This round's question, the same every time for the same seed. */
export function buildQuiz(seed: string): Quiz {
  const rng = seeded(`${seed}:quiz`);
  const kinds = [timeQuestion, placeQuestion, projectQuestion, techQuestion];
  const draft = pickOne(kinds, rng)(rng) ?? timeQuestion(rng);
  const [a, b] = shuffle([draft.answer, draft.wrong], rng);
  return { question: draft.question, options: [a, b], answer: draft.answer, field: draft.field };
}
