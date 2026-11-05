import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import muteSprite from "../../assets/pet/kara-mute.webp";
import talkSprite from "../../assets/pet/kara-talk.webp";
import { FlagIcon, ForkIcon } from "../../icons";
import ContextMenu, { type ContextMenuItem } from "../../os/ContextMenu";
import { createPortal } from "react-dom";
import { useWindow } from "../../os/context";
import { isTouchPointer } from "../../os/openGesture";
import { usePetInGame } from "../../os/petGame";
import { playTalkSfx } from "../../os/petSfx";
import { useIsPhone } from "../../os/useIsPhone";
import MessageBox from "../common/MessageBox";
import { pickDifferent } from "../common/pickDifferent";
import "../common/menuBar.css";
import {
  DIFFICULTIES,
  DIFFICULTY_IDS,
  defaultBestTimes,
  loadBestTimes,
  loadSoundOn,
  saveBestTimes,
  saveSoundOn,
  type Board,
  type DifficultyId,
} from "./difficulties";
import { BestTimesDialog, CustomDialog, RecordDialog } from "./dialogs";
// Named apart from the Board type, which is a board's size.
import BoardView, { type Mode } from "./Board";
import { chord, elapsedSeconds, flagCount, newGame, reveal, toggleFlag, type Game } from "./game";
import { playBiteSfx, playChordSfx, playDigSfx, playFlagSfx, playWinSfx } from "./sweeperSfx";
import "./burgerSweeper.css";

/** A cell's size when a window opens or changes board: the window is made to fit it. Resized by hand, the board
 * grows or shrinks with the window. Matches burgerSweeper.css. */
const CELL = 24;
/** The board's sunken border and the padding around it, both sides together. Matches burgerSweeper.css. */
const BOARD_CHROME = 22;
/** As long as the pet's, for the same reason. */
const BALLOON_MS = 4200;
const TICK_MS = 250;
/** How long her mouth stays open after she's let go of, so even a quick tap shows it. */
const MOUTH_OPEN_MS = 150;

const LOST_LINE = "you found a burger!!";
const WON_LINE = "you didn't eat a single one. wow.";
/** Between the game's sound and her saying something about it, so the two don't land on top of each other. */
const BITE_TO_TALK_MS = 300;
/** The four notes take about this long. */
const FANFARE_TO_TALK_MS = 500;
/** When she's just arrived in the game. */
const HELLO_LINE = "the burgers are hiding again";
/** Starting over after a game that had begun. A fresh board restarted says nothing: nothing happened yet. */
const RESTART_LINES = ["new burgers. same burgers.", "i hid them better this time", "again!!", "this time i'm eating them"];
/** A moment after landing in her seat, to look around first. */
const HELLO_DELAY_MS = 300;
/** Room to keep from the screen's sides, and half the balloon's widest. Matches burgerSweeper.css. */
const BALLOON_EDGE = 8;
const BALLOON_HALF_WIDTH = 100;

type Dialog =
  | { kind: "message"; text: string; info?: boolean }
  | { kind: "custom" }
  | { kind: "bestTimes" }
  | { kind: "record"; difficulty: DifficultyId; seconds: number };

/** Outside the component, where the lint knows it's only ever called from event handlers, never while rendering. */
function currentTime(): number {
  return Date.now();
}

/** A phone stands a wide board on its end, so All You Can Eat fits a portrait screen. */
function startGame({ rows, cols, burgers }: Board, isPhone: boolean): Game {
  return isPhone && cols > rows ? newGame(cols, rows, burgers) : newGame(rows, cols, burgers);
}

/** Three red digits, the way the counters always looked. */
function Counter({ value, label }: { value: number; label: string }) {
  const text = value < 0 ? `-${String(Math.min(-value, 99)).padStart(2, "0")}` : String(Math.min(value, 999)).padStart(3, "0");
  return (
    <span className="kara-sweeper__counter" role="timer" aria-label={`${label}: ${value}`}>
      {text}
    </span>
  );
}

/**
 * The clock, ticking on its own: only these three digits redraw every tick, not the whole board with them.
 * A finished game shows its final time.
 */
function Timer({ startedAt, endedAt }: { startedAt: number | null; endedAt: number | null }) {
  const [now, setNow] = useState(0);
  const running = startedAt !== null && endedAt === null;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(currentTime()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  // Never earlier than the start: the last tick can be from before this game began.
  const seconds = elapsedSeconds({ startedAt, endedAt }, Math.max(now, startedAt ?? 0));
  return <Counter value={seconds} label="Seconds" />;
}

function BurgerSweeperApp() {
  const { close, resizeBy } = useWindow();
  const isPhone = useIsPhone();
  const [touch] = useState(isTouchPointer);
  const [difficulty, setDifficulty] = useState<DifficultyId | "custom">("snack");
  const [customBoard, setCustomBoard] = useState<Board>(DIFFICULTIES.snack);
  const [game, setGame] = useState(() => startGame(DIFFICULTIES.snack, isPhone));
  const [mode, setMode] = useState<Mode>("dig");
  const [balloon, setBalloon] = useState<string | null>(null);
  const [balloonHost] = useState(() => document.querySelector<HTMLElement>(".kara-os"));
  const seatRef = useRef<HTMLImageElement>(null);
  const balloonElementRef = useRef<HTMLSpanElement>(null);
  const [pressed, setPressed] = useState(false);
  const karaIsHere = usePetInGame();
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [best, setBest] = useState(loadBestTimes);
  // The game's own sounds. Kara talking is hers, not the game's, so it carries on either way.
  const [soundOn, setSoundOn] = useState(loadSoundOn);

  const areaRef = useRef<HTMLDivElement>(null);
  const balloonRef = useRef<{ timer: number | undefined }>({ timer: undefined });
  const mouthRef = useRef<{ timer: number | undefined }>({ timer: undefined });

  useEffect(() => {
    const balloonTimer = balloonRef.current;
    const mouth = mouthRef.current;
    return () => {
      window.clearTimeout(balloonTimer.timer);
      window.clearTimeout(mouth.timer);
    };
  }, []);

  // A new size of board gets a window that fits it, at full size where the screen allows.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || isPhone) return;
    const dWidth = game.cols * CELL + BOARD_CHROME - area.clientWidth;
    const dHeight = game.rows * CELL + BOARD_CHROME - area.clientHeight;
    if (Math.abs(dWidth) > 1 || Math.abs(dHeight) > 1) resizeBy(dWidth, dHeight);
    // Only when the board changes size: a window resized by hand afterwards stays the way it was made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.rows, game.cols]);

  /** Only while she's actually here: an empty seat has no one to say anything. Sounds like the pet, because it's her. */
  const say = (line: string | null) => {
    window.clearTimeout(balloonRef.current.timer);
    if (!line || !karaIsHere) {
      setBalloon(null);
      return;
    }
    playTalkSfx();
    setBalloon(line);
    balloonRef.current.timer = window.setTimeout(() => setBalloon(null), BALLOON_MS);
  };

  // The balloon lives outside the window, so it's kept over her head every frame: windows are dragged without
  // re-rendering anything. Placed before the first paint, so it never shows up somewhere else first.
  useLayoutEffect(() => {
    if (balloon === null) return;
    let frame = 0;
    const place = () => {
      const seat = seatRef.current?.getBoundingClientRect();
      const element = balloonElementRef.current;
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
  }, [balloon]);

  const sayRef = useRef(say);
  useEffect(() => {
    sayRef.current = say;
  });

  // Hello, once she has flown in and sat down. Only the first time: coming back after a minimize isn't news.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (!karaIsHere || greetedRef.current) return;
    const timer = window.setTimeout(() => {
      greetedRef.current = true;
      sayRef.current(HELLO_LINE);
    }, HELLO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [karaIsHere]);

  const restart = (board: Board = difficulty === "custom" ? customBoard : DIFFICULTIES[difficulty]) => {
    setGame(startGame(board, isPhone));
    say(game.status === "ready" ? null : pickDifferent(RESTART_LINES, null));
  };

  const chooseDifficulty = (id: DifficultyId) => {
    setDifficulty(id);
    restart(DIFFICULTIES[id]);
  };

  /** After the game's own sound has finished. Starting over before then means she never says it. */
  const sayLater = (line: string, delay: number) => {
    window.clearTimeout(balloonRef.current.timer);
    balloonRef.current.timer = window.setTimeout(() => sayRef.current(line), delay);
  };

  /** `sound` is what the move sounds like, unless it ended the game: that has a sound of its own. */
  const apply = (next: Game, sound: () => void) => {
    if (next === game) return;
    setGame(next);
    if (next.status === game.status || next.status === "playing") {
      if (soundOn) sound();
      return;
    }
    if (next.status === "lost") {
      if (soundOn) playBiteSfx();
      sayLater(LOST_LINE, BITE_TO_TALK_MS);
    }
    if (next.status === "won") {
      if (soundOn) playWinSfx();
      sayLater(WON_LINE, FANFARE_TO_TALK_MS);
      // A finished game has its own end time.
      const seconds = elapsedSeconds(next, next.endedAt ?? 0);
      if (difficulty !== "custom" && seconds < best[difficulty].seconds) {
        setDialog({ kind: "record", difficulty, seconds });
      }
    }
  };

  const dig = (index: number) => {
    const time = currentTime();
    if (game.cells[index].open) apply(chord(game, index, time), playChordSfx);
    else apply(reveal(game, index, time), playDigSfx);
  };

  const flag = (index: number) => {
    const placed = !game.cells[index].flagged;
    apply(toggleFlag(game, index), () => playFlagSfx(placed));
  };

  // The board only redraws when the game does, so it's handed callbacks that never change, which call whatever
  // dig and flag are now.
  const movesRef = useRef({ dig, flag });
  useEffect(() => {
    movesRef.current = { dig, flag };
  });
  const onDig = useCallback((index: number) => movesRef.current.dig(index), []);
  const onFlag = useCallback((index: number) => movesRef.current.flag(index), []);

  const pressKara = () => {
    window.clearTimeout(mouthRef.current.timer);
    setPressed(true);
  };

  const releaseKara = () => {
    window.clearTimeout(mouthRef.current.timer);
    mouthRef.current.timer = window.setTimeout(() => setPressed(false), MOUTH_OPEN_MS);
  };

  const openMenu = (button: HTMLElement, items: ContextMenuItem[]) => {
    const { left, bottom } = button.getBoundingClientRect();
    setMenu({ x: left, y: bottom, items });
  };

  const gameMenu = (): ContextMenuItem[] => [
    { label: "New", bold: true, onSelect: () => restart() },
    "separator",
    ...DIFFICULTY_IDS.map((id) => ({
      label: DIFFICULTIES[id].label,
      checked: difficulty === id,
      onSelect: () => chooseDifficulty(id),
    })),
    { label: "Custom...", checked: difficulty === "custom", onSelect: () => setDialog({ kind: "custom" }) },
    "separator",
    { label: "Best Times...", onSelect: () => setDialog({ kind: "bestTimes" }) },
    "separator",
    {
      label: "Sound",
      toggled: soundOn,
      onSelect: () => {
        setSoundOn(!soundOn);
        saveSoundOn(!soundOn);
      },
    },
    "separator",
    { label: "Exit", onSelect: close },
  ];

  const helpMenu = (): ContextMenuItem[] => [
    {
      label: "How to Play",
      onSelect: () =>
        setDialog({
          kind: "message",
          info: true,
          text: "Find every burger without eating any. Kara recommends eating them.",
        }),
    },
    "separator",
    {
      label: "About Burger Sweeper",
      onSelect: () => setDialog({ kind: "message", info: true, text: "No ads. Kiri checked." }),
    },
  ];

  const burgersLeft = game.burgers - flagCount(game);

  return (
    <div className="kara-sweeper">
      <div className="kara-menu-bar">
        <button type="button" className="kara-menu-button" onClick={(event) => openMenu(event.currentTarget, gameMenu())}>
          Game
        </button>
        <button type="button" className="kara-menu-button" onClick={(event) => openMenu(event.currentTarget, helpMenu())}>
          Help
        </button>
      </div>

      <div className="kara-sweeper__header">
        <Counter value={burgersLeft} label="Burgers left" />
        <div className="kara-sweeper__middle">
          {/* Kara herself, peeking out of the scoreboard: cut off at its bottom edge, ears wherever they end up. */}
          <button
            type="button"
            className="kara-sweeper__kara"
            aria-label="New game"
            onClick={() => restart()}
            onPointerDown={pressKara}
            onPointerUp={releaseKara}
            onPointerLeave={releaseKara}
            onPointerCancel={releaseKara}
          >
            {/* Mouth open while she's pressed and while she talks, the same as the pet. */}
            {/* Her seat: the desktop pet flies here and takes it while the game is open. Empty until she arrives. */}
            <img
              className={`kara-sweeper__kara-image${karaIsHere ? "" : " kara-sweeper__kara-image--empty"}`}
              ref={seatRef}
              data-pet-seat
              src={pressed || balloon !== null ? talkSprite : muteSprite}
              alt=""
              draggable={false}
            />
          </button>
        </div>
        <Timer startedAt={game.startedAt} endedAt={game.endedAt} />
      </div>

      <div ref={areaRef} className="kara-sweeper__area">
        <BoardView game={game} mode={mode} onDig={onDig} onFlag={onFlag} />
      </div>

      {touch && (
        // Two buttons, the one in use pressed in: what a tap does is always on screen.
        <div className="kara-sweeper__footer" role="group" aria-label="What a tap does">
          <button
            type="button"
            className="kara-sweeper__mode"
            aria-label="Dig"
            aria-pressed={mode === "dig"}
            onClick={() => setMode("dig")}
          >
            <ForkIcon size={22} />
          </button>
          <button
            type="button"
            className="kara-sweeper__mode"
            aria-label="Flag"
            aria-pressed={mode === "flag"}
            onClick={() => setMode("flag")}
          >
            <FlagIcon size={22} />
          </button>
        </div>
      )}

      {/* Gone with her, if she leaves mid-sentence. */}
      {balloon &&
        karaIsHere &&
        balloonHost &&
        createPortal(
          <span ref={balloonElementRef} className="kara-sweeper__balloon" role="status">
            {balloon}
          </span>,
          balloonHost,
        )}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}

      {dialog?.kind === "message" && (
        <MessageBox
          title="Burger Sweeper"
          message={dialog.text}
          kind={dialog.info ? "info" : "error"}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "custom" && (
        <CustomDialog
          board={customBoard}
          onCancel={() => setDialog(null)}
          // Already made to fit by the form.
          onConfirm={(board) => {
            setCustomBoard(board);
            setDifficulty("custom");
            setDialog(null);
            restart(board);
          }}
        />
      )}
      {dialog?.kind === "bestTimes" && (
        <BestTimesDialog
          best={best}
          onReset={() => {
            const reset = defaultBestTimes();
            setBest(reset);
            saveBestTimes(reset);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "record" && (
        <RecordDialog
          onConfirm={(name) => {
            const next = { ...best, [dialog.difficulty]: { name: name.trim() || "KARA", seconds: dialog.seconds } };
            setBest(next);
            saveBestTimes(next);
            setDialog({ kind: "bestTimes" });
          }}
        />
      )}
    </div>
  );
}

export default BurgerSweeperApp;
