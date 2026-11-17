import { useEffect, useRef, useState } from "react";
import { visuallyHidden } from "../../../shared/visuallyHidden";
import { isTouchPointer } from "../os/openGesture";
import atlasUrl from "./assets/statue-atlas.png";
import { STATUE } from "./assets/statueModel";
import xnAtlasUrl from "./assets/xn-atlas.png";
import xnMeshUrl from "./assets/xn-mesh.bin?url";
import DevPanel from "./DevPanel";
import { XN_DEV_TOOLS } from "./devFlags";
import { loadTuning } from "./devTuning";
import { refocusOpener } from "./door";
import { DEFAULT_TUNING } from "./engine/tuning";
import { createGame, type Exit, type Game, type Mode, type XnPreview } from "./game";
import { DEFAULT_CROUCH, DEFAULT_SIT, NOTICE_RANGE } from "./xn";
import "./xnen.css";

/*
 * Behind Kara's door: XN's backrooms, full screen, on a videotape. The page here is only the frame (the picture,
 * the tape's on-screen text, the phone's stick and stop button); game.ts runs the place itself.
 */

/** Phones and tablets: no mouse lock, a stick and a stop button instead. */
const TOUCH = isTouchPointer();

type TapeKind = "play" | "pause" | "rewind" | "stop";

/** The tape symbols, drawn: the VT323 font doesn't have them, and the fallback fonts look nothing alike. */
function TapeSymbol({ kind }: { kind: TapeKind }) {
  return (
    <svg
      className={`kara-xnen__symbol kara-xnen__symbol--${kind}`}
      viewBox={kind === "rewind" ? "0 0 20 10" : "0 0 10 10"}
      aria-hidden="true"
    >
      {kind === "play" && <polygon points="1,0.5 9.5,5 1,9.5" />}
      {kind === "rewind" && (
        <>
          <polygon points="9.5,0.5 1,5 9.5,9.5" />
          <polygon points="19,0.5 10.5,5 19,9.5" />
        </>
      )}
      {kind === "stop" && <rect x="1" y="1" width="8" height="8" />}
      {kind === "pause" && (
        <>
          <rect x="1.5" y="0.5" width="2.5" height="9" />
          <rect x="6" y="0.5" width="2.5" height="9" />
        </>
      )}
    </svg>
  );
}

/** Top left: what the tape is doing. */
function ModeReadout({ mode }: { mode: Mode }) {
  switch (mode) {
    case "play":
      return (
        <>
          PLAY <TapeSymbol kind="play" />
        </>
      );
    case "pause":
      return (
        <>
          <TapeSymbol kind="pause" /> PAUSE
        </>
      );
    case "rewind":
      return (
        <>
          <TapeSymbol kind="rewind" /> REW
        </>
      );
    case "stop":
      return (
        <>
          <TapeSymbol kind="stop" /> STOP
        </>
      );
  }
}

/** XN as she is until the dev panel says otherwise: on the floor, standing, minding the visitor. */
const FIRST_PREVIEW: XnPreview = {
  surface: "floor",
  action: "stand",
  tailUp: false,
  swingArms: false,
  crouch: DEFAULT_CROUCH,
  sit: DEFAULT_SIT,
  ignore: false,
  noticeRange: NOTICE_RANGE,
  auto: true,
};

const SPOKEN_MODE: Record<Mode, string> = { play: "Playing", pause: "Paused", rewind: "Rewinding", stop: "Stopped" };

interface XnenWorldProps {
  onLeave: (exit: Exit) => void;
}

function XnenWorld({ onLeave }: XnenWorldProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const leaveRef = useRef(onLeave);
  const [mode, setMode] = useState<Mode>("play");
  const [prompt, setPrompt] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [xnPreview, setXnPreview] = useState(FIRST_PREVIEW);

  useEffect(() => {
    leaveRef.current = onLeave;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const timeLine = timeRef.current;
    const dateLine = dateRef.current;
    const joystick = joystickRef.current;
    const knob = knobRef.current;
    if (!stage || !canvas || !timeLine || !dateLine || !joystick || !knob) return;

    // The desktop underneath sleeps while the tape plays: no focus, no clicks, nothing read out.
    const asleep: HTMLElement[] = [];
    for (const sibling of Array.from(stage.parentElement?.children ?? [])) {
      if (sibling !== stage && sibling instanceof HTMLElement && !sibling.inert) {
        sibling.inert = true;
        asleep.push(sibling);
      }
    }
    stage.focus();

    const game = createGame({
      stage,
      canvas,
      timeLine,
      dateLine,
      joystick,
      knob,
      devPanel: () => devRef.current,
      model: STATUE,
      atlasUrl,
      xnMeshUrl,
      xnAtlasUrl,
      tuning: XN_DEV_TOOLS ? loadTuning() : { ...DEFAULT_TUNING },
      xnPreview: FIRST_PREVIEW,
      touch: TOUCH,
      onMode: setMode,
      onPrompt: setPrompt,
      onLine: setLine,
      onLeave: (exit) => leaveRef.current(exit),
    });
    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
      for (const sibling of asleep) sibling.inert = false;
      refocusOpener();
    };
  }, []);

  const leaving = mode === "rewind" || mode === "stop";

  return (
    <div
      ref={stageRef}
      className={`kara-xnen${leaving ? " kara-xnen--leaving" : ""}`}
      role="application"
      aria-label="The backrooms"
      tabIndex={-1}
    >
      <canvas ref={canvasRef} className="kara-xnen__view" />
      <p style={visuallyHidden}>
        {TOUCH
          ? "Drag on the left to walk and on the right to look around. Tap to touch what's in front of you. The stop button leaves."
          : "W, A, S and D or the arrow keys walk, the mouse looks around. E touches what's in front of you. Escape pauses the tape; Escape again stops it."}
      </p>
      <p style={visuallyHidden} aria-live="polite">
        {SPOKEN_MODE[mode]}
      </p>

      <div ref={joystickRef} className="kara-xnen__joystick" hidden>
        <div ref={knobRef} className="kara-xnen__knob" />
      </div>

      <div className="kara-xnen__osd kara-xnen__mode" aria-hidden="true">
        <ModeReadout mode={mode} />
      </div>
      <div className="kara-xnen__osd kara-xnen__stamp" aria-hidden="true">
        <span ref={timeRef} />
        <span ref={dateRef} />
      </div>
      {/* The [ E ] and XN's subtitle share a spot and take turns: while she's talking, it's her line. */}
      {prompt && mode === "play" && line === null && (
        <div className="kara-xnen__osd kara-xnen__prompt">{TOUCH ? "[ TAP ]" : "[ E ]"}</div>
      )}
      {/* XN's subtitle: what she says, read out as it's shown (her ROT13 included). */}
      <p className="kara-xnen__osd kara-xnen__line" aria-live="polite">
        {line !== null && !leaving && <span>{line}</span>}
      </p>
      {mode === "pause" && (
        <div className="kara-xnen__osd kara-xnen__paused" aria-hidden="true">
          {TOUCH ? (
            <>
              tap to play <TapeSymbol kind="play" />
            </>
          ) : (
            <>
              click to play <TapeSymbol kind="play" /> · esc to stop <TapeSymbol kind="stop" />
            </>
          )}
        </div>
      )}

      <div className="kara-xnen__corner">
        {XN_DEV_TOOLS && (
          <button
            type="button"
            className="kara-xnen__button"
            aria-expanded={devOpen}
            onClick={() => {
              gameRef.current?.pause();
              setDevOpen(!devOpen);
            }}
          >
            調整
          </button>
        )}
        {TOUCH && !leaving && (
          <button type="button" className="kara-xnen__stop" onClick={() => gameRef.current?.stop()}>
            <TapeSymbol kind="stop" /> STOP
          </button>
        )}
      </div>
      {XN_DEV_TOOLS && devOpen && (
        <DevPanel
          panelRef={devRef}
          onTune={(next, freshMap) => gameRef.current?.tune(next, freshMap)}
          xnPreview={xnPreview}
          onXnPreview={(next, restart) => {
            setXnPreview(next);
            gameRef.current?.previewXn(next, restart);
          }}
          onMoveXnOn={() => gameRef.current?.moveXnOn()}
          onForgetXn={() => gameRef.current?.forgetXnMeetings()}
        />
      )}
    </div>
  );
}

export default XnenWorld;
