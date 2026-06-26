import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { isDialogueChoice, type DialogueEntry, type DialogueChoice } from "./types";

export interface CharacterDialogueHandle {
  advance: () => void;
}

interface CharacterDialogueProps {
  dialogue: DialogueEntry;
  characterName: string;
  className?: string;
  playBlip?: () => void;
  onClose: () => void;
  onChoiceScore?: (choiceId: string, delta: number) => void;
}

type DialoguePhase = "lines" | "choosing" | "response";

const CharacterDialogue = forwardRef<CharacterDialogueHandle, CharacterDialogueProps>(
  ({ dialogue, characterName, className = "character-dialogue", playBlip, onClose, onChoiceScore }, ref) => {
    const isChoice = isDialogueChoice(dialogue);

    const [phase, setPhase] = useState<DialoguePhase>("lines");
    const [lineIndex, setLineIndex] = useState(0);
    const [displayedChars, setDisplayedChars] = useState(0);
    const [closing, setClosing] = useState(false);
    const [selectedChoice, setSelectedChoice] = useState(0);
    const [confirmedChoice, setConfirmedChoice] = useState<number | null>(null);
    const [chosenResponse, setChosenResponse] = useState<string[] | null>(null);
    const typewriterRef = useRef<number>(0);

    const currentLines =
      phase === "response" && chosenResponse
        ? chosenResponse
        : isChoice
          ? (dialogue as DialogueChoice).setup
          : (dialogue as string[]);

    const currentLine = currentLines[lineIndex];
    const isTyping = phase !== "choosing" && displayedChars < currentLine.length;

    useEffect(() => {
      if (phase === "choosing") return;
      setDisplayedChars(0);
      const line = currentLines[lineIndex];
      let charIndex = 0;

      const id = window.setInterval(() => {
        charIndex++;
        setDisplayedChars(charIndex);
        if (line[charIndex - 1] !== " ") playBlip?.();
        if (charIndex >= line.length) clearInterval(id);
      }, 65);

      typewriterRef.current = id;
      return () => clearInterval(id);
    }, [currentLines, lineIndex, phase, playBlip]);

    const close = useCallback(() => {
      if (closing) return;
      setClosing(true);
      setTimeout(onClose, 250);
    }, [closing, onClose]);

    const confirmChoice = useCallback((idx: number) => {
      if (closing || confirmedChoice !== null) return;
      setConfirmedChoice(idx);
      const choice = (dialogue as DialogueChoice).choices[idx];
      onChoiceScore?.((dialogue as DialogueChoice).id, choice.score);
      setTimeout(() => {
        setChosenResponse(choice.response);
        setPhase("response");
        setLineIndex(0);
        setConfirmedChoice(null);
      }, 400);
    }, [closing, confirmedChoice, dialogue, onChoiceScore]);

    const advance = useCallback(() => {
      if (closing || phase === "choosing") return;

      if (isTyping) {
        clearInterval(typewriterRef.current);
        setDisplayedChars(currentLine.length);
      } else if (lineIndex < currentLines.length - 1) {
        setLineIndex(prev => prev + 1);
      } else if (phase === "lines" && isChoice) {
        setPhase("choosing");
      } else {
        close();
      }
    }, [closing, phase, isTyping, currentLine.length, lineIndex, currentLines.length, isChoice, close]);

    useImperativeHandle(ref, () => ({ advance }), [advance]);

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
          return;
        }

        if (phase === "choosing") {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedChoice(prev => (prev === 0 ? 1 : 0));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            confirmChoice(selectedChoice);
          }
        } else {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            advance();
          }
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [advance, close, phase, selectedChoice, confirmChoice]);

    return (
      <div
        className={`${className} ${closing ? `${className}--closing` : ""} ${phase === "choosing" ? `${className}--choosing` : ""}`}
        onClick={phase === "choosing" ? undefined : advance}
      >
        <div className={`${className}__name`}>{characterName}</div>

        {phase === "choosing" ? (
          <>
            <div className={`${className}__text`}>{currentLine}</div>
            <div className={`${className}__choices`}>
              {(dialogue as DialogueChoice).choices.map((opt, i) => (
                <button
                  key={i}
                  className={`${className}__choice ${selectedChoice === i ? `${className}__choice--active` : ""} ${confirmedChoice !== null ? (confirmedChoice === i ? `${className}__choice--confirmed` : `${className}__choice--dismissed`) : ""}`}
                  onClick={(e) => { e.stopPropagation(); confirmChoice(i); }}
                  onMouseEnter={() => confirmedChoice === null ? setSelectedChoice(i) : undefined}
                >
                  <span className={`${className}__choice-marker`} style={selectedChoice === i ? undefined : { visibility: "hidden" }}>&#9656;</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={`${className}__text`}>
              {currentLine.slice(0, displayedChars)}
              {isTyping && <span className={`${className}__cursor`}>|</span>}
            </div>
            {!isTyping && !closing && (
              <div className={`${className}__next`}>{"▼"}</div>
            )}
          </>
        )}
      </div>
    );
  },
);

export default CharacterDialogue;
