export type FamiliarityTier = "hostile" | "neutral" | "warming" | "trusting";
export type TimePeriod = "night" | "morning" | "afternoon" | "evening";

export interface ContextDialogue {
  lines: string[];
  minScore: number;
}

// Familiarity tier dialogues — pool selection based on hidden score
export const TIER_DIALOGUES: Record<FamiliarityTier, string[][]> = {
  // 0-4: hostile / dismissive
  hostile: [
    ["...What."],
    ["You again?"],
    ["Don't touch me."],
    ["I didn't say you could talk to me."],
    ["Tch."],
    ["Nice kicks.", "...Just the kicks though."],
    ["You listen to hip-hop?", "Forget it. You probably don't."],
    ["...", "......Still here?", "You're persistent. I'll give you that."],
    ["This alley is my turf.", "You're just visiting."],
    ["You got taste?", "Show me your playlist.", "...On second thought, don't."],
    ["Don't stare.", "...I said don't stare."],
    ["The beat in my head right now?", "Fire.", "No, I won't hum it for you."],
    ["Yo.", "...That's all you get."],
    ["Get lost."],
    ["I don't do small talk."],
    ["You're blocking my light."],
    ["Did I ask?", "No. I didn't."],
  ],

  // 5-12: not chasing you away, won't admit anything
  neutral: [
    ["...Oh.", "It's you."],
    ["I'm not gonna tell you to leave.", "Don't overthink it."],
    ["You keep showing up.", "At least you're quiet about it."],
    ["Back again?", "...Guess you got nowhere better to be."],
    ["You walked all the way here again?", "Weird hobby."],
    ["Don't think this means we're friends.", "We're not."],
    ["You don't talk much.", "...That's the only reason I tolerate you."],
    ["You're still coming to this alley.", "Most people don't come back twice."],
    ["...Fine. Stay.", "Just don't be loud."],
    ["I see you.", "...That's all. I see you."],
    ["You have a habit of showing up at the worst times.", "...This isn't one of them."],
    ["I was in the middle of something.", "...No, I forgot what it was.", "Whatever."],
    ["You always stand in the same spot.", "...I'm not complaining. Just noticing."],
    ["Other people walk past this alley.", "You walk in.", "...Weird."],
  ],

  // 13-25: used to your presence, guard slipping
  warming: [
    ["Took you a while.", "...Not that I was counting."],
    ["Sit wherever.", "...Not too close."],
    ["You ever just listen to the alley?", "The hum, the drip...", "It's got rhythm."],
    ["Your taste is still trash.", "But at least you own it."],
    ["I almost said something just now.", "...Forget it."],
    ["Sometimes this alley gets too quiet.", "...Doesn't bother me though."],
    ["...It's easier to think when someone else is around.", "Shut up. I didn't say it was you."],
    ["I wasn't looking at the entrance.", "I just happened to be facing that way."],
    ["You changed something.", "...Your vibe. It's different today.", "Forget I said that."],
    ["I found a good beat yesterday.", "...No, I'm not sharing."],
    ["I had this beat stuck in my head all day.", "Almost played it for you.", "...Almost."],
    ["You ever wonder what I do when you're not here?", "...Same thing.", "Just quieter."],
    ["Don't come tomorrow.", "...I'm kidding.", "...Maybe."],
    ["I saved a spot.", "Not for you.", "It's just... empty."],
  ],

  // 26+: real trust, still tough
  trusting: [
    ["I write lyrics sometimes.", "They're bad.", "...Don't ask to see them."],
    ["There's a crack in that wall.", "I've been watching it grow for a while.", "...Dunno why I'm telling you this."],
    ["You know what I can't figure out?", "Why you keep coming back.", "...Don't answer. I don't wanna know."],
    ["Hey.", "...Thanks for sticking around.", "Tell anyone and you're done."],
    ["I don't need anyone.", "That hasn't changed.", "...I just got used to the noise you bring. That's all."],
    ["If you stop coming...", "...I won't care.", "...But the alley might get too quiet again."],
    ["Sometimes I think about what's past this alley.", "...Then I stop.", "It's better here."],
    ["You're the only one who doesn't try to change this place.", "...That matters."],
    ["I caught myself waiting earlier.", "...For no one.", "Just waiting."],
    ["If this alley ever disappears...", "...Nah.", "It won't."],
    ["I used to think being alone was the point.", "...I was right.", "Mostly."],
    ["There's a sound the alley makes right before dawn.", "I've never told anyone about it.", "...Now you know."],
    ["I made something.", "...It's not finished.", "Maybe next time."],
    ["Some nights I replay the same bar over and over.", "Forty, fifty times.", "...Tonight's one of those nights."],
  ],
};

// Time-of-day dialogues with minimum familiarity score
export const TIME_DIALOGUES: Record<TimePeriod, ContextDialogue[]> = {
  // 0:00-5:59
  night: [
    { lines: ["It's late.", "...Even for me."], minScore: 0 },
    { lines: ["Can't sleep?", "...Me neither."], minScore: 5 },
    { lines: ["The alley hits different at this hour.", "Quieter.", "I like it."], minScore: 13 },
  ],

  // 6:00-11:59
  morning: [
    { lines: ["Morning already?", "Tch."], minScore: 0 },
    { lines: ["You're here early.", "...Couldn't wait?", "Don't answer that."], minScore: 5 },
    { lines: ["Mornings are too bright.", "The light hits the walls wrong."], minScore: 13 },
  ],

  // 12:00-17:59
  afternoon: [
    { lines: ["Shouldn't you be doing something?", "...Not that I care."], minScore: 0 },
    { lines: ["Afternoon.", "The most boring part of the day."], minScore: 5 },
    { lines: ["The shadows are short right now.", "I prefer them long."], minScore: 13 },
  ],

  // 18:00-23:59
  evening: [
    { lines: ["The good hours.", "This is when the alley wakes up."], minScore: 0 },
    { lines: ["The city gets loud at night.", "But not here.", "Here's just right."], minScore: 5 },
    { lines: ["This is my favorite time.", "The neon, the hum...", "Perfect."], minScore: 13 },
  ],
};

// Rapid-click easter egg — 1.2s window, resets after 20th triggers glitch swap
export const RAPID_CLICK_THRESHOLDS = [5, 10, 15, 20] as const;

export const RAPID_CLICK_DIALOGUES: Record<number, string[]> = {
  5: ["...You're doing that on purpose."],
  10: ["I said stop.", "What part of that was unclear?"],
  15: ["Okay. Fine. You wanna play?", "Let's play."],
  20: ["...", "That's it. I'm moving.", "Don't follow me."],
};
