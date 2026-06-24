import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import useSFX from "./useSFX";

export interface CatDialogueHandle {
  advance: () => void;
}

interface CatDialogueProps {
  dialogue: string[];
  onClose: () => void;
}

const CatDialogue = forwardRef<CatDialogueHandle, CatDialogueProps>(
  ({ dialogue, onClose }, ref) => {
    const [lineIndex, setLineIndex] = useState(0);
    const [displayedChars, setDisplayedChars] = useState(0);
    const [closing, setClosing] = useState(false);
    const typewriterRef = useRef<number>(0);

    const { playBlip } = useSFX();

    const currentLine = dialogue[lineIndex];
    const isTyping = displayedChars < currentLine.length;

    useEffect(() => {
      setDisplayedChars(0);
      const line = dialogue[lineIndex];
      let charIndex = 0;

      const id = window.setInterval(() => {
        charIndex++;
        setDisplayedChars(charIndex);
        if (line[charIndex - 1] !== " ") playBlip();
        if (charIndex >= line.length) {
          clearInterval(id);
        }
      }, 65);

      typewriterRef.current = id;
      return () => clearInterval(id);
    }, [dialogue, lineIndex, playBlip]);

    const advance = useCallback(() => {
      if (closing) return;
      if (isTyping) {
        clearInterval(typewriterRef.current);
        setDisplayedChars(currentLine.length);
      } else if (lineIndex < dialogue.length - 1) {
        setLineIndex(prev => prev + 1);
      } else {
        setClosing(true);
        setTimeout(onClose, 250);
      }
    }, [closing, isTyping, currentLine.length, lineIndex, dialogue.length, onClose]);

    useImperativeHandle(ref, () => ({ advance }), [advance]);

    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (!closing) {
            setClosing(true);
            setTimeout(onClose, 250);
          }
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [advance, closing, onClose]);

    return (
      <div
        className={`kuru-dialogue ${closing ? "kuru-dialogue--closing" : ""}`}
        onClick={advance}
      >
        <div className="kuru-dialogue__name">&gt; KURU</div>
        <div className="kuru-dialogue__text">
          {currentLine.slice(0, displayedChars)}
          {isTyping && <span className="kuru-dialogue__cursor">|</span>}
        </div>
        {!isTyping && !closing && (
          <div className="kuru-dialogue__next">▼</div>
        )}
      </div>
    );
  },
);

export default CatDialogue;
