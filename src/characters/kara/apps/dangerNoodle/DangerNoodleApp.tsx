import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import hamburger from "../../assets/fluent-emoji/hamburger.svg";
import ContextMenu, { type ContextMenuItem } from "../../os/ContextMenu";
import { useWindow } from "../../os/context";
import { isTouchPointer } from "../../os/openGesture";
import { useIsPhone } from "../../os/useIsPhone";
import { DialogFrame, RecordDialog } from "../common/gameDialogs";
import { Counter, KaraScoreboard } from "../common/KaraScoreboard";
import MessageBox from "../common/MessageBox";
import { pickDifferent } from "../common/pickDifferent";
import { useKaraVoice } from "../common/useKaraVoice";
import { useRasterIcon } from "../common/rasterIcon";
import { useDialogFocus } from "../../os/useDialogFocus";
import "../common/menuBar.css";
import { playCrashSfx, playEatSfx, playRecordSfx } from "./noodleSfx";
import { DEFAULT_BEST, loadBest, loadSoundOn, saveBest, saveSoundOn, type BestScore } from "./scores";
import { newNoodle, SIZE, step, stepMs, turn, type Direction, type Noodle } from "./snake";
import "./dangerNoodle.css";

/** A cell's size when the window opens: the window is made to fit it. Matches dangerNoodle.css. */
const CELL = 20;
/** The field's sunken border and the padding around it, both sides together. Matches dangerNoodle.css. */
const FIELD_CHROME = 22;
/** How far a finger has to slide before it counts as a turn. */
const SWIPE_DISTANCE = 24;

const HELLO_LINE = "it's always hungry. like me";
const CRASH_LINE = "it was full anyway";
const RECORD_LINE = "that's a lot of burgers";
const RESTART_LINES = ["it's hungry again", "new noodle", "it already forgot"];
/** Between the game's sound and her saying something about it, so the two don't land on top of each other. */
const CRASH_TO_TALK_MS = 400;
const FANFARE_TO_TALK_MS = 500;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

type Dialog = { kind: "message"; text: string } | { kind: "best" } | { kind: "record"; score: number };

type CellKind = "" | "head" | "body" | "tail" | "burger";

/** One cell, given only plain values, so a step only redraws the few cells it changed. */
const Cell = memo(function Cell({ kind, burgerSrc }: { kind: CellKind; burgerSrc: string }) {
  let className = "kara-noodle__cell";
  if (kind && kind !== "burger") className += ` kara-noodle__cell--${kind}`;
  return <div className={className}>{kind === "burger" && <img src={burgerSrc} alt="" draggable={false} />}</div>;
});

const Field = memo(function Field({ noodle, burgerSrc }: { noodle: Noodle; burgerSrc: string }) {
  const kinds: CellKind[] = new Array<CellKind>(SIZE * SIZE).fill("");
  if (noodle.burger >= 0) kinds[noodle.burger] = "burger";
  noodle.body.forEach((index, n) => {
    kinds[index] = n === 0 ? "head" : n === noodle.body.length - 1 ? "tail" : "body";
  });
  return (
    <>
      {kinds.map((kind, index) => (
        <Cell key={index} kind={kind} burgerSrc={burgerSrc} />
      ))}
    </>
  );
});

function BestScoreDialog({ best, onReset, onClose }: { best: BestScore; onReset: () => void; onClose: () => void }) {
  const { initialFocusRef, onKeyDown } = useDialogFocus(onClose);
  return (
    <DialogFrame
      title="Best Score"
      onSubmit={onClose}
      onKeyDown={onKeyDown}
      actions={
        <>
          <button type="button" className="kara-button kara-message__ok" onClick={onReset}>
            Reset Score
          </button>
          <button ref={initialFocusRef} type="submit" className="kara-button kara-message__ok">
            OK
          </button>
        </>
      }
    >
      <p className="kara-noodle__best">
        {best.score} burgers, by {best.name}
      </p>
    </DialogFrame>
  );
}

function DangerNoodleApp() {
  const { close, resizeBy } = useWindow();
  const isPhone = useIsPhone();
  const [touch] = useState(isTouchPointer);
  const [noodle, setNoodle] = useState(newNoodle);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [best, setBest] = useState(loadBest);
  // The game's own sounds. Kara talking is hers, not the game's, so it carries on either way.
  const [soundOn, setSoundOn] = useState(loadSoundOn);
  const { say, sayLater, seatRef, seatId, karaIsHere, talking, balloon } = useKaraVoice(HELLO_LINE);
  const burgerSrc = useRasterIcon(hamburger);

  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // The window is made to fit the field once, at full size where the screen allows. Resized by hand after that,
  // the field grows or shrinks with it.
  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const area = areaRef.current;
    if (!area || isPhone) return;
    const dWidth = SIZE * CELL + FIELD_CHROME - area.clientWidth;
    const dHeight = SIZE * CELL + FIELD_CHROME - area.clientHeight;
    if (Math.abs(dWidth) > 1 || Math.abs(dHeight) > 1) resizeBy(dWidth, dHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hidden tab would otherwise go on playing without anyone watching.
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const crash = (score: number) => {
    if (score > best.score) {
      if (soundOn) playRecordSfx();
      sayLater(RECORD_LINE, FANFARE_TO_TALK_MS);
      setDialog({ kind: "record", score });
      return;
    }
    if (soundOn) playCrashSfx();
    sayLater(CRASH_LINE, CRASH_TO_TALK_MS);
  };

  const tick = () => {
    const { noodle: next, ate } = step(noodle);
    setNoodle(next);
    if (ate && soundOn) playEatSfx();
    if (next.status === "over") crash(next.score);
  };

  const steer = (direction: Direction) => {
    setPaused(false);
    // After a crash, any direction is a new noodle heading that way.
    const from = noodle.status === "over" ? newNoodle() : noodle;
    setNoodle(turn(from, direction));
  };

  const restart = () => {
    setNoodle(newNoodle());
    setPaused(false);
    say(noodle.status === "ready" ? null : pickDifferent(RESTART_LINES, null));
  };

  const togglePause = () => {
    if (noodle.status === "playing") setPaused(!paused);
  };

  // The loop runs on whatever tick is now, so it never steps an old noodle.
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });
  const running = noodle.status === "playing" && !paused && dialog === null;
  const interval = stepMs(noodle.score);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => tickRef.current(), interval);
    return () => window.clearInterval(timer);
  }, [running, interval]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Typing a name for a record is not steering.
    if (dialog !== null || event.target instanceof HTMLTextAreaElement) return;
    const direction = KEY_DIRECTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (direction) {
      event.preventDefault();
      steer(direction);
      return;
    }
    if (event.key === " " || event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
    } else if (event.key === "F2") {
      event.preventDefault();
      restart();
    }
  };

  // Clicking anywhere else, the start menu or another window included, pauses. Focus moving inside doesn't.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      if (noodle.status === "playing") setPaused(true);
    }
  };

  const handleSwipeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    swipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  // One finger can steer several times without lifting: each turn starts measuring again from there.
  const handleSwipeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    swipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handleSwipeEnd = () => {
    swipeRef.current = null;
  };

  /** Back to steering: a dialog took the keyboard with it, and gives it back to nowhere. */
  const closeDialog = () => {
    setDialog(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  const openMenu = (button: HTMLElement, items: ContextMenuItem[]) => {
    const { left, bottom } = button.getBoundingClientRect();
    setMenu({ x: left, y: bottom, items });
  };

  const gameMenu = (): ContextMenuItem[] => [
    { label: "New", bold: true, onSelect: restart },
    // Opening this menu has already paused a running game, so each choice says what it does, not "the other one".
    paused
      ? { label: "Resume", onSelect: () => setPaused(false) }
      : { label: "Pause", onSelect: () => setPaused(noodle.status === "playing") },
    "separator",
    { label: "Best Score...", onSelect: () => setDialog({ kind: "best" }) },
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
      onSelect: () => setDialog({ kind: "message", text: "Eat the burgers. Not the walls. Not yourself." }),
    },
    "separator",
    {
      label: "About Danger Noodle",
      onSelect: () => setDialog({ kind: "message", text: "No ads. Kiri checked." }),
    },
  ];

  // What the field says over itself, if anything.
  let notice: string | null = null;
  if (noodle.status === "ready") notice = touch ? "Swipe to start" : "Press an arrow key to start";
  else if (noodle.status === "over") notice = touch ? "Swipe to play again" : "Press an arrow key to play again";
  else if (paused) notice = touch ? "Paused. Tap to go on" : "Paused. Press Space to go on";

  const fieldStyle = { "--size": SIZE } as CSSProperties;
  const steerOnClick = (direction: Direction) => () => steer(direction);

  return (
    <div
      ref={rootRef}
      className="kara-noodle"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      aria-label="Danger Noodle"
    >
      <div className="kara-menu-bar">
        <button type="button" className="kara-menu-button" onClick={(event) => openMenu(event.currentTarget, gameMenu())}>
          Game
        </button>
        <button type="button" className="kara-menu-button" onClick={(event) => openMenu(event.currentTarget, helpMenu())}>
          Help
        </button>
      </div>

      <KaraScoreboard
        seatRef={seatRef}
        seatId={seatId}
        karaIsHere={karaIsHere}
        talking={talking}
        left={<Counter value={noodle.score} label="Score" />}
        right={<Counter value={Math.max(best.score, noodle.score)} label="Best score" />}
        onPress={restart}
        pressLabel="New game"
      />

      <div ref={areaRef} className="kara-noodle__area">
        <div
          className="kara-noodle__field"
          style={fieldStyle}
          role="img"
          aria-label={`Noodle, ${noodle.body.length} long`}
          onPointerDown={handleSwipeStart}
          onPointerMove={handleSwipeMove}
          onPointerUp={handleSwipeEnd}
          onPointerCancel={handleSwipeEnd}
          onClick={() => {
            if (paused) setPaused(false);
          }}
        >
          <Field noodle={noodle} burgerSrc={burgerSrc} />
          {notice && <div className="kara-noodle__notice">{notice}</div>}
        </div>
      </div>

      {touch && (
        // A cross of arrows, with pause in the middle.
        <div className="kara-pad kara-noodle__pad" role="group" aria-label="Steering">
          <button type="button" className="kara-pad__button kara-noodle__up" aria-label="Up" onClick={steerOnClick("up")}>
            ▲
          </button>
          <button
            type="button"
            className="kara-pad__button kara-noodle__left"
            aria-label="Left"
            onClick={steerOnClick("left")}
          >
            ◀
          </button>
          <button
            type="button"
            className="kara-pad__button kara-noodle__pause"
            aria-label={paused ? "Resume" : "Pause"}
            aria-pressed={paused}
            onClick={togglePause}
          >
            ❚❚
          </button>
          <button
            type="button"
            className="kara-pad__button kara-noodle__right"
            aria-label="Right"
            onClick={steerOnClick("right")}
          >
            ▶
          </button>
          <button
            type="button"
            className="kara-pad__button kara-noodle__down"
            aria-label="Down"
            onClick={steerOnClick("down")}
          >
            ▼
          </button>
        </div>
      )}

      {balloon}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => {
            setMenu(null);
            // The menu took the keyboard; steering needs it back, whatever was chosen.
            rootRef.current?.focus({ preventScroll: true });
          }}
        />
      )}

      {dialog?.kind === "message" && (
        <MessageBox title="Danger Noodle" message={dialog.text} kind="info" onClose={closeDialog} />
      )}
      {dialog?.kind === "best" && (
        <BestScoreDialog
          best={best}
          onReset={() => {
            setBest(DEFAULT_BEST);
            saveBest(DEFAULT_BEST);
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "record" && (
        <RecordDialog
          title="Danger Noodle"
          message="New best score. Who did this?"
          onConfirm={(name) => {
            const next = { name: name.trim() || "KARA", score: dialog.score };
            setBest(next);
            saveBest(next);
            setDialog({ kind: "best" });
          }}
        />
      )}
    </div>
  );
}

export default DangerNoodleApp;
