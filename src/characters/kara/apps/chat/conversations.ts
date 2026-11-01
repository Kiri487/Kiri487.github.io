import type { CharacterId } from "../../CharacterAvatar";

export type ChatPartnerId = Exclude<CharacterId, "kara">;

export interface ChatMessage {
  from: CharacterId;
  /** Free text, so it can be a time that doesn't exist, like the taskbar clock. */
  time: string;
  text: string;
}

export interface ChatPartner {
  name: string;
  messages: ChatMessage[];
  /** Added to the history after a nudge, when the character has something to say about it. */
  nudgeReply?: string;
}

export interface ChatArgs {
  partner: ChatPartnerId;
}

/** Everything the chats say lives here, so changing a conversation never touches the app. */
export const CHAT_PARTNERS: Record<ChatPartnerId, ChatPartner> = {
  kiri: { name: "Kiri", messages: [] },
  kuru: { name: "Kuru", messages: [] },
  kere: { name: "Kere", messages: [] },
  koro: { name: "Koro", messages: [] },
};

export function chatTitle(partner: ChatPartnerId): string {
  return `${CHAT_PARTNERS[partner].name} - Conversation`;
}
