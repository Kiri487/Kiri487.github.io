import { forwardRef } from "react";
import CharacterDialogue, { type CharacterDialogueHandle } from "../../shared/dialogue/CharacterDialogue";
import type { DialogueEntry } from "./dialogue/catDialogues";
import useSFX from "./audio/useSFX";

export type CatDialogueHandle = CharacterDialogueHandle;

interface CatDialogueProps {
  dialogue: DialogueEntry;
  onClose: () => void;
  onChoiceScore?: (choiceId: string, delta: number) => void;
}

const CatDialogue = forwardRef<CatDialogueHandle, CatDialogueProps>(
  ({ dialogue, onClose, onChoiceScore }, ref) => {
    const { playBlip } = useSFX();
    return (
      <CharacterDialogue
        ref={ref}
        dialogue={dialogue}
        characterName="> KURU"
        className="kuru-dialogue"
        playBlip={playBlip}
        onClose={onClose}
        onChoiceScore={onChoiceScore}
      />
    );
  },
);

export default CatDialogue;
