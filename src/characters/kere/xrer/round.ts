import { KIRI_CV, type CvData } from "../cv/data";
import { negativeClause, trapClause, TRAP_FLAWS, type Clause } from "./clauses";
import { FLAW_TIERS, makeFlawed, type Flaw, type FlawKind } from "./flaws";
import { between, pickOne, shuffle } from "./random";
import { seeded } from "./seeded";
import { CAT_LETTERS, FAKE_LETTERS, type Lang } from "./script";

export type CatId = "kiri" | "kuru" | "kere" | "koro" | "kara" | "xv" | "xh" | "xr" | "xb" | "xn";

const CATS = Object.keys(CAT_LETTERS) as CatId[];

export type Identity = { type: "cat"; cat: CatId } | { type: "fake"; flaw: Flaw };

export interface Applicant {
  /** "01", "02"… as on the tabs. */
  no: string;
  identity: Identity;
  cv: CvData;
  /** The cover letter, in both languages. */
  letter: Record<Lang, string>;
  /** The section XR points to on the second question: the flaw's for a fake, a random one for a real Kiri. */
  hintSection: string;
}

export interface Round {
  applicants: Applicant[];
  /** Clause 7 is issued once this many files have been stamped. */
  clauseAfter: number;
  clause: Clause;
  /** Record fields that must stay readable this round: what the fakes changed and what clause 7 gets wrong. */
  protect: string[];
  /** Picks which parts of the record rot this round. */
  seed: string;
}

const HINT_SECTIONS = ["education", "experience", "projects", "skills"];

/**
 * 3–5 applicants: 2–3 fakes and 1–2 real Kiris, in random order, with clause 7 after the 2nd or 3rd. Everything
 * follows from `seed`, so the same seed always rebuilds the same round (that's how a refresh resumes one).
 */
export function createRound(seed = Math.random().toString(36).slice(2)): Round {
  const rng = seeded(seed);
  const fakes = between(2, 3, rng);
  const cats = shuffle(CATS, rng).slice(0, between(1, 2, rng));
  const slots = shuffle<"fake" | CatId>([...Array<"fake">(fakes).fill("fake"), ...cats], rng);
  const clauseAfter = pickOne([2, 3].filter((n) => n < slots.length), rng);

  // A trap clause needs a fake still to come once it's issued, carrying the flaw it lets through.
  const fakesLater = slots.map((s, i) => (s === "fake" && i >= clauseAfter ? i : -1)).filter((i) => i >= 0);
  const trapAt = fakesLater.length > 0 && rng() < 0.5 ? pickOne(fakesLater, rng) : -1;
  const trapKind = trapAt >= 0 ? pickOne(TRAP_FLAWS, rng) : undefined;

  const fakeLetters = shuffle(FAKE_LETTERS, rng);
  let fakeIndex = 0;
  const usedKinds: FlawKind[] = [];
  let clause: Clause | undefined;

  const applicants = slots.map((slot, i): Applicant => {
    const no = String(i + 1).padStart(2, "0");
    if (slot !== "fake") {
      return { no, identity: { type: "cat", cat: slot }, cv: KIRI_CV, letter: CAT_LETTERS[slot], hintSection: pickOne(HINT_SECTIONS, rng) };
    }
    // Later fakes get subtler flaws.
    const tier = Math.round((fakeIndex * (FLAW_TIERS.length - 1)) / (fakes - 1));
    // No two fakes in a round share a flaw (two "Being Human"s would give the game away).
    const fresh = FLAW_TIERS[tier].filter((k) => k !== trapKind && !usedKinds.includes(k));
    const kind = i === trapAt && trapKind ? trapKind : pickOne(fresh.length > 0 ? fresh : FLAW_TIERS[tier], rng);
    usedKinds.push(kind);
    const { data: cv, flaw } = makeFlawed(KIRI_CV, kind, rng);
    if (i === trapAt) clause = trapClause(flaw);
    const letter = fakeLetters[fakeIndex % fakeLetters.length];
    fakeIndex += 1;
    return { no, identity: { type: "fake", flaw }, cv, letter, hintSection: flaw.section };
  });

  const finalClause = clause ?? negativeClause(rng);
  const protect = [
    ...applicants.flatMap((a) => (a.identity.type === "fake" && a.identity.flaw.field ? [a.identity.flaw.field] : [])),
    ...(finalClause.protects ?? []),
  ];
  return { applicants, clauseAfter, clause: finalClause, protect, seed };
}

export function isRealKiri(a: Applicant): boolean {
  return a.identity.type === "cat";
}

export function isXr(a: Applicant): boolean {
  return a.identity.type === "cat" && a.identity.cat === "xr";
}
