import { readNumber, writeString } from "../../../shared/storage";
import { MUTTER, OPENERS, PARTY_LINES, STAGES } from "./lines";

/*
 * What XN says next, each time the visitor presses E by her. Her first line in a visit is an opener (the very first
 * time ever, always the first opener). After that, often she just mutters "..."; otherwise she says one of her lines,
 * shuffled, all of them once before any comes again.
 *
 * She gets to know the visitor across visits: every time she turns up and says something to them is a meeting. The
 * third meeting on she has more to say, and more again from the sixth.
 */

/** Meetings so far, kept between visits. */
const MEETINGS_KEY = "kara-xnen-meetings";
/** How often a press only gets "...". */
const MUTTER_CHANCE = 0.4;
/** Meetings it takes to reach each stage after the first. */
const STAGE_AT = [3, 6];

export function forgetMeetings() {
  writeString(MEETINGS_KEY, "0");
}

export function meetingsSoFar(): number {
  return readNumber(MEETINGS_KEY, 0, { min: 0 });
}

/** A copy in a random order (Fisher–Yates). */
function shuffled(lines: readonly string[]): string[] {
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class Talk {
  private meetings = meetingsSoFar();
  /** She's said her opener this visit. */
  private opened = false;
  /** She's said something (not just "...") since she last turned up. */
  private spoken = false;
  /** Her lines still to come before any repeats, and the stage they were dealt for. */
  private bag: string[] = [];
  private bagStage = -1;
  /** The same for her lines at a party. */
  private partyBag: string[] = [];

  /** She's turned up somewhere new: the next thing she says starts a new meeting. */
  newMeeting() {
    this.spoken = false;
  }

  /** Her next line, in plain English (or "..."); `party` while she's at a burger room's party. */
  next(party = false): string {
    if (!this.opened) {
      this.opened = true;
      const first = this.meetings === 0;
      this.meet();
      return first ? OPENERS[0] : OPENERS[Math.floor(Math.random() * OPENERS.length)];
    }
    if (Math.random() < MUTTER_CHANCE) return MUTTER;
    this.meet();
    if (party) {
      if (!this.partyBag.length) this.partyBag = shuffled(PARTY_LINES);
      return this.partyBag.pop() ?? MUTTER;
    }
    const stage = STAGE_AT.filter((at) => this.meetings >= at).length;
    if (!this.bag.length || this.bagStage !== stage) {
      this.bag = shuffled(STAGES.slice(0, stage + 1).flat());
      this.bagStage = stage;
    }
    return this.bag.pop() ?? MUTTER;
  }

  /** She's saying something: the first time since she turned up, that's one more meeting. */
  private meet() {
    if (this.spoken) return;
    this.spoken = true;
    this.meetings += 1;
    writeString(MEETINGS_KEY, String(this.meetings));
  }
}
