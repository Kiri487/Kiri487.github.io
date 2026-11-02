import type { CharacterId } from "../../CharacterAvatar";

export type ChatPartnerId = Exclude<CharacterId, "kara">;

export type ChatLine = { from: CharacterId; text: string } | { system: string };

export interface Conversation {
  /** Shown above the conversation. A date this computer believes in, not a real one. */
  date: string;
  lines: ChatLine[];
}

export interface ChatPartner {
  name: string;
  conversations: Conversation[];
  /** One is added to the history after each nudge. */
  nudgeReplies: string[];
}

export interface ChatArgs {
  partner: ChatPartnerId;
}

const kara = (text: string): ChatLine => ({ from: "kara", text });
const kiri = (text: string): ChatLine => ({ from: "kiri", text });
const kuru = (text: string): ChatLine => ({ from: "kuru", text });
const kere = (text: string): ChatLine => ({ from: "kere", text });
const koro = (text: string): ChatLine => ({ from: "koro", text });
const fileSent = (name: string): ChatLine => ({ system: `[file sent: ${name}]` });

/** Everything the chats say lives here, so changing a conversation never touches the app. */
export const CHAT_PARTNERS: Record<ChatPartnerId, ChatPartner> = {
  kiri: {
    name: "Kiri",
    conversations: [
      {
        date: "Tuesday (uninstalled)",
        lines: [
          kiri("Why is there a 新增資料夾 (3)?"),
          kara("that's its name"),
          kiri("Where are (1) and (2)"),
          kara("safe"),
          kiri("Safe from what?"),
          kara(":3"),
          kiri("Kara"),
          kiri("Safe from WHAT"),
        ],
      },
      {
        date: "Yesterday, probably",
        lines: [
          kara("i put a chicken burger in the recycle bin"),
          kiri("Why"),
          kara("it is a very formal burger"),
          kiri("Wait, can you restore it?"),
          kiri("And does it come back warm?"),
          kara("you understand me"),
        ],
      },
      {
        date: "The 32nd",
        lines: [
          kara("i think the mirror is lagging"),
          kiri("How much?"),
          kara("like 2 seconds"),
          kiri("Wait"),
          kiri("Can you wave at it again?"),
          kara("ok :3"),
          kiri("We need a second mirror"),
        ],
      },
      {
        date: "Wednesday, we think",
        lines: [
          kiri('Why does this computer say "Registered to: Kiri"?'),
          kara("because it is"),
          kiri("So it's mine?"),
          kara("no"),
          kiri("Then why is it registered to me?"),
          kara("someone has to take the blame"),
          kiri("Blame for what?"),
          kara("you'll get a letter"),
          kiri("What kind of letter?"),
          kara("a very formal one"),
          kiri("Wait, is there a burger inside?"),
          kiri("Is it warm?"),
        ],
      },
      {
        date: "Today, so far",
        lines: [
          kiri("Do you think people will like the new page?"),
          kara("i watched them"),
          kara("one of them pressed remove 14 times"),
          kiri("...Is that bad?"),
          kara("they were having a great time"),
          kiri("Okay"),
          kiri("Okay good"),
        ],
      },
    ],
    nudgeReplies: [
      "Kiri wants to know how nudges work.",
      "Kiri was drawing. Kiri's line is ruined now.",
      "Kiri says hi. Kiri also says go away.",
    ],
  },
  kuru: {
    name: "Kuru",
    conversations: [
      {
        date: "Sometime last month",
        lines: [
          kuru("Yo what's this track?"),
          kara("which one"),
          kuru("The one with the weird bass"),
          kara("that's a washing machine"),
          kuru("..."),
          kuru("Got a download?"),
          kara("i can send you the laundry"),
        ],
      },
      {
        date: "The 32nd",
        lines: [
          kara("i found a cool necklace"),
          kuru("Show me"),
          kara("[image unavailable]"),
          kuru("Is that a bike chain?"),
          kara("yes"),
          kuru("lol"),
          kuru("Kinda goes hard tho"),
          kara("IT DOES >:3"),
        ],
      },
      {
        date: "Last Thursday",
        lines: [
          kara("the vending machine in your alley is broken"),
          kuru("Yeah"),
          kara("since when"),
          kuru("...Dunno. Longer than me"),
          kara("then it's your elder"),
          kara("have you been respectful"),
          kuru("I kicked it once"),
          kuru("...Fine. I'll apologize"),
        ],
      },
      {
        date: "Yesterday, probably",
        lines: [
          kara("i painted my keyboard black"),
          kuru("Sick"),
          kara("now i can't see the letters"),
          kuru("lol"),
          kuru("You don't need them"),
          kara("asdf"),
          kara("asdf asdf"),
          kuru("Looks good"),
        ],
      },
      {
        date: "Very late",
        lines: [
          kara("are you up"),
          kuru("Can't sleep?"),
          kara("i've been looking at a door for three hours"),
          kuru("What's behind it?"),
          kara("i don't know. that's the problem"),
          kuru("...Go to sleep. I'll watch it"),
          kara("you can't see it from there"),
          kuru("I'll watch it anyway"),
        ],
      },
    ],
    nudgeReplies: ["Kuru felt that. All good.", "Kuru nudged back. Once.", "Kuru turned the music up."],
  },
  kere: {
    name: "Kere",
    conversations: [
      {
        date: "Before Monday",
        lines: [
          kere("Kara, your clock says 25:61."),
          kara("yes :3"),
          kere("That's not a valid time."),
          kara("it is here"),
          kere("I'm filing a bug report."),
          kara("works on my machine :3"),
          kere("Kara. I'm looking at your machine."),
          kara("then you can see it working"),
          kere("..."),
        ],
      },
      {
        date: "Monday",
        lines: [
          kara("my computer is making a weird noise"),
          kere("What kind of noise?"),
          kara("meow"),
          kere("?_?"),
          kere("Is there a cat near the computer?"),
          kara("yes"),
          kere("..."),
          kere("Kara, that's you."),
          kara("oh"),
          kara("fixed :3"),
        ],
      },
      {
        date: "Monday (again)",
        lines: [
          kara('is "aaaaaaaa" a strong password'),
          kere("No."),
          kara('what about "AAAAAAAA"'),
          kere("Also no."),
          kara("what if i scream it"),
          kere("-_-"),
          kere("That would make it considerably worse."),
          kara("noted"),
          kere("Please use a password manager."),
        ],
      },
      {
        date: "Monday (still)",
        lines: [
          kere("What did you accomplish today?"),
          kara("moved a chair"),
          kere("Anything else?"),
          kara("moved it back"),
          kere("So the room is unchanged."),
          kara("but i have more experience now"),
          kere("..."),
          kere("...Fair point."),
        ],
      },
      {
        date: "Friday, technically",
        lines: [
          kere("Why is there a meeting with The Printer on my calendar."),
          kara("it asked for you"),
          kere("The printer doesn't exist."),
          kara("that's why it has so much free time"),
          kere("..."),
          kere("What's on the agenda."),
          kara("you"),
          kere("×_×"),
          kere("Declined."),
        ],
      },
    ],
    nudgeReplies: [
      "Kere has reviewed your nudge.",
      "Kere asks that future nudges be sent by email.",
      "Kere replied: -_-",
    ],
  },
  koro: {
    name: "Koro",
    conversations: [
      {
        date: "The 31st of February",
        lines: [
          koro("hey loser :P"),
          kara("hello winner :3"),
          koro("i hid a spider in your room hehe"),
          kara("THANK YOU"),
          koro("???"),
          kara("i've been looking for him"),
          koro("...him?"),
          kara("his name is greg"),
          koro("what the hell XD"),
        ],
      },
      {
        date: "Yesterday, probably",
        lines: [
          koro("lol your radio is still called (final) (real). skill issue"),
          kara("because it's the real one"),
          koro("there's literally a shortcut to a shortcut"),
          kara("the second one used to be broken"),
          kara("you fixed it"),
          koro("..."),
          koro("it was annoying me. duh"),
          kara("you don't even use this computer"),
          koro("shut up >:("),
        ],
      },
      {
        date: "Today, after noon",
        lines: [
          koro("you didn't eat today"),
          kara("how do you know"),
          koro("your status has said the same thing since noon"),
          kara("oh"),
          fileSent("eat_something.txt"),
          kara("it just says eat something"),
          koro("yeah. reading is hard for you, i know :P"),
        ],
      },
      {
        date: "While offline",
        lines: [
          kara("you're on my offline list"),
          koro("yeah. because i'm offline. duh"),
          kara("but you're talking to me"),
          koro("no i'm not"),
          kara("ok"),
          kara("goodnight, offline koro"),
          koro("..."),
          koro("night, loser"),
          koro("you didn't see this"),
        ],
      },
      {
        date: "Just now",
        lines: [
          koro("btw your drawing was pretty good"),
          koro("don't get cocky tho"),
          kara(":3"),
          koro("stop making that face"),
          kara(":333333"),
          koro("I CAN SEE YOU DOING IT"),
        ],
      },
    ],
    nudgeReplies: ["Koro nudged you back. Harder.", "Koro says you missed.", "Koro says stop >:("],
  },
};

export function chatTitle(partner: ChatPartnerId): string {
  return `${CHAT_PARTNERS[partner].name} - Conversation`;
}

/**
 * Message times, past the end of the clock like the taskbar's: each conversation is an hour later
 * and each line a minute later, starting from 25:61.
 */
export function chatTime(conversationIndex: number, lineIndex: number): string {
  return `${25 + conversationIndex}:${61 + lineIndex}`;
}

/** Any reply except the previous one, so nudging twice always gets a new answer. */
export function pickNudgeReply(replies: string[], previous: string | null): string {
  const choices = replies.filter((reply) => reply !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
