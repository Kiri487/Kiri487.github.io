export interface DialogueChoiceOption {
  label: string;
  response: string[];
  score: number;
}

export interface DialogueChoice {
  id: string;
  setup: string[];
  choices: [DialogueChoiceOption, DialogueChoiceOption];
}

export type DialogueEntry = string[] | DialogueChoice;

export function isDialogueChoice(entry: DialogueEntry): entry is DialogueChoice {
  return "setup" in entry;
}
