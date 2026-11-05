import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePetInSeat } from "../../os/petGame";
import { playTalkSfx } from "../../os/petSfx";

/** As long as the pet's, for the same reason. */
const BALLOON_MS = 4200;
/** A moment after landing in her seat, to look around first. */
const HELLO_DELAY_MS = 300;
/** Room to keep from the screen's sides, and half the balloon's widest. Matches karaScoreboard.css. */
const BALLOON_EDGE = 8;
const BALLOON_HALF_WIDTH = 100;

export interface KaraVoice {
  /** Says it now, or clears what she's saying. Only while she's actually here: an empty seat has no one to talk. */
  say: (line: string | null) => void;
  /** After a game's own sound has finished. Saying anything else first means she never says this. */
  sayLater: (line: string, delay: number) => void;
  talking: boolean;
  karaIsHere: boolean;
  seatId: string;
  seatRef: RefObject<HTMLImageElement | null>;
  /** Her balloon, to render anywhere: it's put on the desktop's root, over her head, whatever renders it. */
  balloon: ReactNode;
}

/**
 * Kara's voice in a game: her balloon over the scoreboard, her talk sound, and a hello the first time she sits
 * down in this window. Pass the result to KaraScoreboard.
 */
export function useKaraVoice(hello: string): KaraVoice {
  const seatId = useId();
  const karaIsHere = usePetInSeat(seatId);
  const [line, setLine] = useState<string | null>(null);
  const [host] = useState(() => document.querySelector<HTMLElement>(".kara-os"));
  const seatRef = useRef<HTMLImageElement>(null);
  const balloonRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<{ timer: number | undefined }>({ timer: undefined });

  useEffect(() => {
    const timers = timerRef.current;
    return () => window.clearTimeout(timers.timer);
  }, []);

  const say = (next: string | null) => {
    window.clearTimeout(timerRef.current.timer);
    if (!next || !karaIsHere) {
      setLine(null);
      return;
    }
    // She sounds like the pet, because it's her.
    playTalkSfx();
    setLine(next);
    timerRef.current.timer = window.setTimeout(() => setLine(null), BALLOON_MS);
  };

  const sayRef = useRef(say);
  useEffect(() => {
    sayRef.current = say;
  });

  const sayLater = (next: string, delay: number) => {
    window.clearTimeout(timerRef.current.timer);
    timerRef.current.timer = window.setTimeout(() => sayRef.current(next), delay);
  };

  // Hello, once she has flown in and sat down. Only the first time: coming back after a minimize isn't news.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (!karaIsHere || greetedRef.current) return;
    const timer = window.setTimeout(() => {
      greetedRef.current = true;
      sayRef.current(hello);
    }, HELLO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [karaIsHere, hello]);

  // The balloon lives outside the window, so it's kept over her head every frame: windows are dragged without
  // re-rendering anything. Placed before the first paint, so it never shows up somewhere else first.
  useLayoutEffect(() => {
    if (line === null) return;
    let frame = 0;
    const place = () => {
      const seat = seatRef.current?.getBoundingClientRect();
      const element = balloonRef.current;
      // A minimized window has nowhere for it to point.
      if (element) element.style.visibility = seat && seat.width > 0 ? "" : "hidden";
      if (seat && element) {
        const x = Math.min(
          Math.max(seat.left + seat.width / 2, BALLOON_EDGE + BALLOON_HALF_WIDTH),
          window.innerWidth - BALLOON_EDGE - BALLOON_HALF_WIDTH,
        );
        // Her sprite has room above her ears, so the tail points a little below its top edge.
        element.style.left = `${x}px`;
        element.style.top = `${seat.top + seat.height * 0.12}px`;
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [line]);

  // Gone with her, if she leaves mid-sentence.
  const balloon =
    line !== null && karaIsHere && host
      ? createPortal(
          <span ref={balloonRef} className="kara-scoreboard__balloon" role="status">
            {line}
          </span>,
          host,
        )
      : null;

  return { say, sayLater, talking: line !== null && karaIsHere, karaIsHere, seatId, seatRef, balloon };
}

