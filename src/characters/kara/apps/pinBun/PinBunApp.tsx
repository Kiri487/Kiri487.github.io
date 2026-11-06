import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import ContextMenu, { type ContextMenuItem } from "../../os/ContextMenu";
import { useWindow } from "../../os/context";
import { isTouchPointer } from "../../os/openGesture";
import { useDialogFocus } from "../../os/useDialogFocus";
import { DialogFrame, RecordDialog } from "../common/gameDialogs";
import { Counter, KaraScoreboard } from "../common/KaraScoreboard";
import MessageBox from "../common/MessageBox";
import { pickDifferent } from "../common/pickDifferent";
import { useKaraVoice } from "../common/useKaraVoice";
import "../common/menuBar.css";
import { drawTable } from "./draw";
import {
  ballOnPlunger,
  missionText,
  RANKS,
  HEIGHT,
  insertCoin,
  newGame,
  pressCoinReturn,
  releaseAll,
  setCharging,
  setFlipper,
  step,
  WIDTH,
  type Game,
} from "./engine";
import {
  playBumperSfx,
  playCoinSfx,
  playDrainSfx,
  playFlipperSfx,
  playLaunchSfx,
  playRecordSfx,
  playSpicySfx,
  playStrawSfx,
  playRefusedSfx,
  playSetSfx,
  playSlingSfx,
  playTargetSfx,
} from "./pinBunSfx";
import { DEFAULT_BEST, loadBest, loadSoundOn, saveBest, saveSoundOn, type BestScore } from "./scores";
import "./pinBun.css";

const HELLO_LINE = "the ball is a meatball. don't ask";
const DRAIN_LINE = "meatball!!";
const OVER_LINE = "all the meatballs are gone";
const RECORD_LINE = "the machine is scared of you";
const RESTART_LINES = ["fresh meatballs", "the machine forgot everything", "again!!"];
/** Said on being promoted, by what the meatball is now. */
const RANK_LINES: Record<string, string> = {
  Patty: "it's a patty now",
  Chickenburger: "it's a chickenburger. like me",
  "Double Double": "double double. i'm so proud",
};
const SPICY_LINE = "mr. spicy owes me rent";
const THURSDAY_LINE = "thursday? never heard of it";
const FOUR_TWENTY_LINE = "it's time";
const RUSH_HOUR_LINE = "rush hour!! everyone wants meatballs";
const JACKPOT_LINE = "jackpot. it was there the whole time";
/** A moment after the table's own sound, so she isn't talking over it. */
const EVENT_TO_TALK_MS = 300;
/** Between the game's sound and her saying something about it, so the two don't land on top of each other. */
const DRAIN_TO_TALK_MS = 500;
const FANFARE_TO_TALK_MS = 500;
/** How long NO REFUNDS stays lit after a ball goes down. */
const NO_REFUNDS_SECONDS = 2.5;
/** A frame longer than this is the tab waking up, not time the ball should have moved for. */
const MAX_FRAME_SECONDS = 0.05;

/** The HOW TO PLAY card: what to press, then what it does. The last line is the only joke. */
const KEY_CONTROLS = [
  ["Z", "left flipper"],
  ["/", "right flipper"],
  ["Space", "hold, let go"],
  ["P", "pause"],
  ["4:20", "you'll see"],
];
const TOUCH_CONTROLS = [
  ["Left half", "left flipper"],
  ["Right half", "right flipper"],
  ["Hold", "launch"],
  ["4:20", "you'll see"],
];

const LEFT_KEYS = new Set(["KeyZ", "ArrowLeft", "ShiftLeft"]);
const RIGHT_KEYS = new Set(["Slash", "ArrowRight", "ShiftRight"]);
const PLUNGER_KEYS = new Set(["Space", "ArrowDown", "Enter"]);

type Dialog = { kind: "message"; text: string } | { kind: "best" } | { kind: "record"; score: number };

/** What the React side shows of the game. Only changes when one of these does, not every frame. */
interface Hud {
  score: number;
  ball: number;
  over: boolean;
  /** Something the table just said, if it's still saying it. */
  message: string | null;
  onPlunger: boolean;
  /** Lit for a while after every ball that goes down, and for good once the game's over. */
  noRefunds: boolean;
  /** Which of RANKS the meatball is. */
  rank: number;
  /** The mission to do, and how far along it is. */
  mission: string;
}

function hudOf(game: Game): Hud {
  return {
    score: game.score,
    ball: game.ballNumber,
    over: game.status === "over",
    message: game.message && game.message.until > game.time ? game.message.text : null,
    onPlunger: ballOnPlunger(game),
    rank: game.rank,
    mission: missionText(game),
    noRefunds:
      game.status === "over" ||
      game.time - game.drainedAt < NO_REFUNDS_SECONDS ||
      game.time - game.refusedAt < NO_REFUNDS_SECONDS,
  };
}

function sameHud(a: Hud, b: Hud) {
  return (
    a.score === b.score &&
    a.ball === b.ball &&
    a.over === b.over &&
    a.message === b.message &&
    a.onPlunger === b.onPlunger &&
    a.noRefunds === b.noRefunds &&
    a.rank === b.rank &&
    a.mission === b.mission
  );
}

const formatScore = (score: number) => score.toLocaleString("en-US");

/** The scoreboard's red digits, but as many as the score needs. */
function ScoreLed({ score }: { score: number }) {
  return (
    <span className="kara-scoreboard__counter kara-pinbun__score" role="timer" aria-label={`Score: ${score}`}>
      {score}
    </span>
  );
}

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
      <p className="kara-pinbun__best-line">
        {formatScore(best.score)} points, by {best.name}
      </p>
    </DialogFrame>
  );
}

function PinBunApp() {
  const { close, isMinimized } = useWindow();
  const [touch] = useState(isTouchPointer);
  // The table itself changes every frame, so it lives outside React. `round` says when there's a new one.
  const gameRef = useRef<Game>(newGame());
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState(() => hudOf(newGame()));
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [best, setBest] = useState(loadBest);
  // The game's own sounds. Kara talking is hers, not the game's, so it carries on either way.
  const [soundOn, setSoundOn] = useState(loadSoundOn);
  /** On screen, and in canvas pixels per table pixel, which is sharper on high-density screens. */
  const [size, setSize] = useState<{
    width: number;
    height: number;
    pixelScale: number;
  } | null>(null);
  const { say, sayLater, seatRef, seatId, karaIsHere, talking, balloon } = useKaraVoice(HELLO_LINE);

  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** What each finger or mouse button is holding: a flipper, or the plunger. */
  const pointersRef = useRef(new Map<number, 0 | 1 | "plunger">());

  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // The table keeps its shape and takes as much of the window as the panel beside it leaves.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const panel = panelRef.current;
    if (!body || !panel) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(body);
      let roomX = body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const roomY = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      // Narrow, the panel floats over the table and takes no room of its own.
      const cabinet = panel.parentElement;
      if (cabinet && getComputedStyle(panel).position !== "absolute") {
        roomX -= panel.offsetWidth + (parseFloat(getComputedStyle(cabinet).columnGap) || 0);
      }
      const scale = Math.max(0, Math.min(roomX / WIDTH, roomY / HEIGHT));
      const width = Math.max(1, Math.floor(WIDTH * scale));
      const height = Math.max(1, Math.floor(HEIGHT * scale));
      setSize({
        width,
        height,
        pixelScale: Math.round(width * window.devicePixelRatio) / WIDTH,
      });
    });
    observer.observe(body);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const pixelScale = size?.pixelScale ?? 1;

  // A hidden tab would otherwise go on playing without anyone watching.
  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);

  const gameOver = (score: number) => {
    if (score > best.score) {
      if (soundOn) playRecordSfx();
      sayLater(RECORD_LINE, FANFARE_TO_TALK_MS);
      setDialog({ kind: "record", score });
      return;
    }
    if (soundOn) playDrainSfx();
    sayLater(OVER_LINE, DRAIN_TO_TALK_MS);
  };

  /** After each frame: what happened gets its sounds and Kara's say, and the panel catches up. */
  const afterFrame = () => {
    const game = gameRef.current;
    const context = canvasRef.current?.getContext("2d");
    if (context) drawTable(context, game, pixelScale);
    // Of everything worth a word this frame, she says only the biggest.
    let line: string | null = null;
    for (const event of game.events) {
      if (event === "over") gameOver(game.score);
      else if (event === "drain") {
        if (soundOn) playDrainSfx();
        sayLater(DRAIN_LINE, DRAIN_TO_TALK_MS);
      } else {
        if (event === "fourTwenty") line = FOUR_TWENTY_LINE;
        else if (event === "rushHour") line = RUSH_HOUR_LINE;
        else if (event === "jackpot") line ??= JACKPOT_LINE;
        else if (event === "rank" && line !== FOUR_TWENTY_LINE) line = RANK_LINES[RANKS[game.rank]] ?? null;
        else if (event === "spicy") line ??= SPICY_LINE;
        else if (event === "thursday") line ??= THURSDAY_LINE;
        if (!soundOn) continue;
        if (event === "bumper") playBumperSfx();
        else if (event === "sling") playSlingSfx();
        else if (event === "target" || event === "lane") playTargetSfx();
        else if (event === "spicy") playSpicySfx();
        else if (event === "fourTwenty" || event === "rushHour" || event === "jackpot") playRecordSfx();
        else if (event === "straw") playStrawSfx();
        else if (event === "kara" || event === "lanes" || event === "thursday" || event === "mission" || event === "rank")
          playSetSfx();
        else if (event === "launch") playLaunchSfx();
      }
    }
    if (line) sayLater(line, EVENT_TO_TALK_MS);
    game.events.length = 0;
    const next = hudOf(game);
    setHud((current) => (sameHud(current, next) ? current : next));
  };

  // The loop runs on whatever afterFrame is now, so it never uses an old best score or sound setting.
  const afterFrameRef = useRef(afterFrame);
  useEffect(() => {
    afterFrameRef.current = afterFrame;
  });

  const running = !paused && !isMinimized && dialog === null && menu === null && !hud.over;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      step(gameRef.current, Math.min(MAX_FRAME_SECONDS, (now - last) / 1000));
      last = now;
      afterFrameRef.current();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  // Stopped, the table still needs drawing whenever its size or the game changes.
  useEffect(() => {
    if (!running) afterFrameRef.current();
  }, [running, size, round]);

  const restart = () => {
    const game = gameRef.current;
    const started = game.score > 0 || game.ballNumber > 1 || !ballOnPlunger(game);
    releaseAll(game);
    pointersRef.current.clear();
    const next = newGame();
    gameRef.current = next;
    setRound(round + 1);
    setHud(hudOf(next));
    setPaused(false);
    say(started ? pickDifferent(RESTART_LINES, null) : null);
  };

  const pressFlipper = (index: 0 | 1, pressed: boolean) => {
    const game = gameRef.current;
    if (pressed && !game.flippers[index].pressed && game.status === "playing" && soundOn) playFlipperSfx();
    setFlipper(game, index, pressed);
  };

  const pressPlunger = (pressed: boolean) => {
    if (pressed && gameRef.current.status === "over") {
      restart();
      return;
    }
    if (pressed) setPaused(false);
    setCharging(gameRef.current, pressed);
  };

  // The coin door. Stopped, the game doesn't run its frames, so the panel is caught up by hand. The keyboard goes
  // back to the flippers, or Space would press the button again instead of the plunger.
  const handleCoin = () => {
    if (soundOn) playCoinSfx();
    insertCoin(gameRef.current);
    afterFrameRef.current();
    rootRef.current?.focus({ preventScroll: true });
  };

  const handleCoinReturn = () => {
    if (soundOn) playRefusedSfx();
    pressCoinReturn(gameRef.current);
    afterFrameRef.current();
    rootRef.current?.focus({ preventScroll: true });
  };

  const togglePause = () => {
    if (gameRef.current.status !== "playing") return;
    if (!paused) releaseAll(gameRef.current);
    setPaused(!paused);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Typing a name for a record is not playing.
    if (dialog !== null || event.target instanceof HTMLTextAreaElement) return;
    const { code } = event;
    if (LEFT_KEYS.has(code) || RIGHT_KEYS.has(code) || PLUNGER_KEYS.has(code)) {
      event.preventDefault();
      if (event.repeat) return;
      if (paused && !PLUNGER_KEYS.has(code)) setPaused(false);
      if (LEFT_KEYS.has(code)) pressFlipper(0, true);
      else if (RIGHT_KEYS.has(code)) pressFlipper(1, true);
      else pressPlunger(true);
    } else if (code === "KeyP" || code === "Escape") {
      event.preventDefault();
      togglePause();
    } else if (code === "F2") {
      event.preventDefault();
      restart();
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    const { code } = event;
    if (LEFT_KEYS.has(code)) pressFlipper(0, false);
    else if (RIGHT_KEYS.has(code)) pressFlipper(1, false);
    else if (PLUNGER_KEYS.has(code)) pressPlunger(false);
  };

  // Clicking anywhere else, the start menu or another window included, pauses. Focus moving inside doesn't.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    releaseAll(gameRef.current);
    pointersRef.current.clear();
    if (gameRef.current.status === "playing") setPaused(true);
  };

  // Either half of the table is that side's flipper, for fingers and the mouse alike. With the ball waiting on the
  // plunger, anywhere is the plunger: nothing is in play for the flippers to hit. After the game, anywhere is a
  // new one. So a phone needs no buttons of its own.
  const handleTablePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    const game = gameRef.current;
    if (game.status === "over") {
      restart();
      return;
    }
    if (paused) setPaused(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (ballOnPlunger(game)) {
      pointersRef.current.set(event.pointerId, "plunger");
      pressPlunger(true);
      return;
    }
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const side = event.clientX < left + width / 2 ? 0 : 1;
    pointersRef.current.set(event.pointerId, side);
    pressFlipper(side, true);
  };

  const handleTablePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    const side = pointers.get(event.pointerId);
    if (side === undefined) return;
    pointers.delete(event.pointerId);
    // Another finger may still be holding the same thing.
    if ([...pointers.values()].includes(side)) return;
    if (side === "plunger") pressPlunger(false);
    else pressFlipper(side, false);
  };

  /** Back to playing: a dialog took the keyboard with it, and gives it back to nowhere. */
  const closeDialog = () => {
    setDialog(null);
    rootRef.current?.focus({ preventScroll: true });
  };

  const openMenu = (button: HTMLElement, items: ContextMenuItem[]) => {
    const { left, bottom } = button.getBoundingClientRect();
    releaseAll(gameRef.current);
    setMenu({ x: left, y: bottom, items });
  };

  const gameMenu = (): ContextMenuItem[] => [
    { label: "New", bold: true, onSelect: restart },
    paused
      ? { label: "Resume", onSelect: () => setPaused(false) }
      : {
          label: "Pause",
          onSelect: () => setPaused(gameRef.current.status === "playing"),
        },
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
      onSelect: () =>
        setDialog({
          kind: "message",
          text: touch
            ? "Tap the left or right half of the table for that flipper. With the meatball on the spring, hold anywhere, then let go. Keep it out of the middle."
            : "Z and / (or the arrow keys) are the flippers. Hold Space, then let go to launch. Keep the meatball out of the middle.",
        }),
    },
    "separator",
    {
      label: "About Pin Bun",
      onSelect: () =>
        setDialog({
          kind: "message",
          text: "No ads. Kiri checked. The ball is still a meatball.",
        }),
    },
  ];

  // The panel's display: what the table just said, or else what to do now.
  // Over, it's the table's last word, and how to go again sits on the table itself.
  let display: string;
  if (hud.message) display = hud.message;
  else if (hud.onPlunger) display = touch ? "Hold anywhere, then let go" : "Hold Space, then let go";
  else display = hud.mission;

  let notice: string | null = null;
  if (hud.over) notice = touch ? "Game over. Tap to play again" : "Game over. Press Space to play again";
  else if (paused) notice = touch ? "Paused. Tap to go on" : "Paused. Press P to go on";

  return (
    <div
      ref={rootRef}
      className="kara-pinbun"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleBlur}
      aria-label="Pin Bun"
    >
      <div className="kara-menu-bar">
        <button
          type="button"
          className="kara-menu-button"
          onClick={(event) => openMenu(event.currentTarget, gameMenu())}
        >
          Game
        </button>
        <button
          type="button"
          className="kara-menu-button"
          onClick={(event) => openMenu(event.currentTarget, helpMenu())}
        >
          Help
        </button>
      </div>

      <KaraScoreboard
        seatRef={seatRef}
        seatId={seatId}
        karaIsHere={karaIsHere}
        talking={talking}
        left={<ScoreLed score={hud.score} />}
        right={<Counter value={hud.ball} label="Ball" />}
        onPress={restart}
        pressLabel="New game"
      />

      <div ref={bodyRef} className="kara-pinbun__body">
        <div className="kara-pinbun__cabinet">
          <div className="kara-pinbun__area">
            <canvas
              ref={canvasRef}
              className="kara-pinbun__table"
              width={size ? Math.round(WIDTH * pixelScale) : WIDTH}
              height={size ? Math.round(HEIGHT * pixelScale) : HEIGHT}
              style={size ? { width: size.width, height: size.height } : undefined}
              role="img"
              aria-label={`Pin Bun table. Ball ${hud.ball}, ${hud.score} points`}
              onPointerDown={handleTablePointerDown}
              onPointerUp={handleTablePointerUp}
              onPointerCancel={handleTablePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            />
            {notice && <div className="kara-pinbun__notice">{notice}</div>}
          </div>

          <div ref={panelRef} className="kara-pinbun__panel">
            <div className="kara-pinbun__logo" aria-hidden="true">
              Pin Bun
            </div>
            <div className="kara-pinbun__display" role="status">
              {display}
            </div>
            <dl className="kara-pinbun__facts">
              <div className="kara-pinbun__fact">
                <dt>Ball</dt>
                <dd>{hud.ball}/3</dd>
              </div>
              <div className="kara-pinbun__fact">
                <dt>Rank</dt>
                <dd>{RANKS[hud.rank]}</dd>
              </div>
              <div className="kara-pinbun__fact">
                <dt>Best</dt>
                <dd>
                  <span className="kara-pinbun__holder">{hud.score > best.score ? "YOU" : best.name}</span>
                  <span className="kara-pinbun__number">{formatScore(Math.max(best.score, hud.score))}</span>
                </dd>
              </div>
            </dl>
            {/* What used to be printed on the apron: how to play, and what it costs. */}
            {/* Read like a drive-thru menu: what to press, dotted across to what it does. */}
            <div className="kara-pinbun__card">
              <h3>How to Play</h3>
              <dl className="kara-pinbun__menu">
                {(touch ? TOUCH_CONTROLS : KEY_CONTROLS).map(([key, does]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{does}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="kara-pinbun__card">
              <h3>3 Meatballs</h3>
              <p>
                <b>25¢</b>
                <br />
                or one chicken burger
              </p>
              <span className={`kara-pinbun__refunds${hud.noRefunds ? " kara-pinbun__refunds--lit" : ""}`}>
                No Refunds
              </span>
            </div>
            <div className="kara-pinbun__coin-door">
              <button type="button" className="kara-pinbun__coin-slot" onClick={handleCoin} aria-label="Insert coin">
                <span className="kara-pinbun__slot" aria-hidden="true" />
                <span className="kara-pinbun__coin-label">25¢</span>
              </button>
              <button type="button" className="kara-pinbun__coin-return" onClick={handleCoinReturn}>
                Coin
                <br />
                Return
              </button>
            </div>
          </div>
        </div>
      </div>

      {balloon}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => {
            setMenu(null);
            // The menu took the keyboard; the flippers need it back, whatever was chosen.
            rootRef.current?.focus({ preventScroll: true });
          }}
        />
      )}

      {dialog?.kind === "message" && (
        <MessageBox title="Pin Bun" message={dialog.text} kind="info" onClose={closeDialog} />
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
          title="Pin Bun"
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

export default PinBunApp;
