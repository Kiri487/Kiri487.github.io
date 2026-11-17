/*
 * What XN says, in plain English as Kiri approved it. Her subtitles always run through ROT13, so on screen this is
 * gibberish except for numbers and names, which swap between the K and X cats (kara ↔ xnen, kuru ↔ xheh, and so on).
 */

/** Her first line in a visit. The first ever is always the first one: the player sees "kara" in the gibberish. */
export const OPENERS = [
  "xnen xnen xnen. that's the sound the lights make",
  "xnen backwards is still xnen if you're upside down",
  "somebody wrote xnen on the ceiling. i was the ceiling",
  "i named a wall xnen. now it won't stop being a wall",
  "the carpet spells xnen if you lie down on it",
  "i'm xnen today. yesterday i was a hallway",
  "kara left her shoes here. xnen is wearing them",
  "kere counted the lights once. xnen ate the count",
];

/** Her other lines, by how well she knows the visitor. Each stage also uses the ones before it. */
export const STAGES = [
  [
    "i ate a lightbulb. it tasted like 4:20",
    "my clock is broken. it only knows 4",
    "koro told kara to eat something. i ate the note",
    "the carpet is wet because i told it a secret",
    "don't count the doors. they hate that",
    "the humming is a song. i know all the words. there are no words",
    "this hallway was longer yesterday. i ate some",
    "the yellow is not paint. don't ask what it is",
    "kiri is drawing me again. i can feel the pencil",
    "i've been thinking about a door",
  ],
  [
    "the stone cat is my neighbor. it's always 4:20 at her place",
    "xrer stamped me once. i was rejected. i'm still here",
    "don't follow the lights. they're going somewhere else",
    "i tried to fold a hallway. now there are two",
    "xvev drew a door on my arm. now i keep walking through myself",
    "the walls move when you blink. i move when you look away",
    "the water upstairs is warm today. there is no upstairs",
    "kere asked me for directions once. i gave her a lightbulb",
    "xbeb asked who i talk to in here. i said the lights. now she's mad at the lights",
    "i licked a wall once. it was a thursday",
  ],
  [
    "if you want out... but why would you want out",
    "xheh sat in a hallway for 9 hours. she said it was fine",
    "my neighbor is very quiet. you'll know",
    "i'd walk you there but the carpet needs me",
    "you can stay. the carpet likes you",
    "i saved you a light. it's the broken one",
    "kuru says it's not that deep. it's exactly this deep",
    "kiri made 10 of us. i counted 11",
    "you're starting to hum like the lights. that's a compliment",
    "i wrote your name on the ceiling. i spelled it wrong on purpose",
  ],
];

/** Saying nothing, which she does often. Not ROT13'd (there's nothing to turn), and silent. */
export const MUTTER = "...";

/** ROT13: each letter thirteen places on. Doing it twice gives the original back. */
export function rot13(text: string): string {
  return text.replace(/[a-z]/gi, (letter) => {
    const base = letter <= "Z" ? 65 : 97;
    return String.fromCharCode(((letter.charCodeAt(0) - base + 13) % 26) + base);
  });
}
