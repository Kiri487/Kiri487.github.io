import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import muteSprite from "../../assets/pet/kara-mute.webp";
import talkSprite from "../../assets/pet/kara-talk.webp";
import "./karaScoreboard.css";

/** How long her mouth stays open after she's let go of, so even a quick tap shows it. */
const MOUTH_OPEN_MS = 150;

/** Three red digits, the way the counters always looked. */
export function Counter({ value, label }: { value: number; label: string }) {
  const text =
    value < 0 ? `-${String(Math.min(-value, 99)).padStart(2, "0")}` : String(Math.min(value, 999)).padStart(3, "0");
  return (
    <span className="kara-scoreboard__counter" role="timer" aria-label={`${label}: ${value}`}>
      {text}
    </span>
  );
}

/**
 * The red counters on either side, and Kara peeking out of the middle: cut off at the scoreboard's lower edge,
 * ears wherever they end up. Pressing her does whatever `onPress` says, usually starting over.
 */
export function KaraScoreboard({
  seatRef,
  seatId,
  karaIsHere,
  talking,
  left,
  right,
  onPress,
  pressLabel,
}: {
  /** These four come straight from useKaraVoice. */
  seatRef: RefObject<HTMLImageElement | null>;
  seatId: string;
  karaIsHere: boolean;
  talking: boolean;
  left: ReactNode;
  right: ReactNode;
  onPress: () => void;
  pressLabel: string;
}) {
  const [pressed, setPressed] = useState(false);
  const mouthRef = useRef<{ timer: number | undefined }>({ timer: undefined });

  useEffect(() => {
    const mouth = mouthRef.current;
    return () => window.clearTimeout(mouth.timer);
  }, []);

  const press = () => {
    window.clearTimeout(mouthRef.current.timer);
    setPressed(true);
  };

  const release = () => {
    window.clearTimeout(mouthRef.current.timer);
    mouthRef.current.timer = window.setTimeout(() => setPressed(false), MOUTH_OPEN_MS);
  };

  return (
    <div className="kara-scoreboard">
      {left}
      <div className="kara-scoreboard__middle">
        <button
          type="button"
          className="kara-scoreboard__kara"
          aria-label={pressLabel}
          onClick={onPress}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          {/* Her seat: the desktop pet flies here and takes it while the game is open. Empty until she arrives.
              Mouth open while she's pressed and while she talks, the same as the pet. */}
          <img
            ref={seatRef}
            className={`kara-scoreboard__kara-image${karaIsHere ? "" : " kara-scoreboard__kara-image--empty"}`}
            data-pet-seat={seatId}
            src={pressed || talking ? talkSprite : muteSprite}
            alt=""
            draggable={false}
          />
        </button>
      </div>
      {right}
    </div>
  );
}
