import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { SpeakerIcon } from "../../icons";
import { useWindow } from "../../os/context";
import { openGesture } from "../../os/openGesture";
import { shuffledTracks } from "./tracks";
import { loadYouTubeApi, PLAYER_STATE, type YouTubePlayer } from "./youtubePlayer";
import "./radio.css";

type RadioStatus = "tuning" | "ready" | "playing" | "paused" | "skipping" | "noSignal";

const INITIAL_VOLUME = 50;
const PROGRESS_INTERVAL_MS = 500;

const STATUS_TEXT: Record<Exclude<RadioStatus, "playing">, string> = {
  tuning: "Tuning...",
  ready: "Ready when you are.",
  paused: "Taking a break. It's not you.",
  skipping: "This station doesn't want to be here. Skipping.",
  noSignal: "No signal.",
};

/** Past the end of its range, like the taskbar's clock: 1 minute 14 seconds reads 1:74. */
function formatKaraDuration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60) + 60}`;
}

function TrackRow({
  name,
  current,
  disabled,
  onOpen,
}: {
  name: string;
  current: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`kara-radio__track${current ? " kara-radio__track--current" : ""}`}
        disabled={disabled}
        {...openGesture(onOpen)}
      >
        <span className="kara-radio__track-name">{name}</span>
        {current && <span aria-hidden="true">◀</span>}
      </button>
    </li>
  );
}

function RadioApp() {
  const { isMinimized } = useWindow();
  const hostRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const indexRef = useRef(0);
  const failuresRef = useRef(0);
  const resumeOnRestoreRef = useRef(false);
  const isMinimizedRef = useRef(isMinimized);

  // Kept for as long as the window stays open: only closing it and coming back reshuffles.
  const [tracks] = useState(shuffledTracks);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<RadioStatus>("tuning");
  const [volume, setVolume] = useState(INITIAL_VOLUME);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  /** Where the visitor is dragging to. The video only jumps on release, so dragging doesn't buffer at every step. */
  const [scrub, setScrub] = useState<number | null>(null);

  const syncProgress = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // Right after an error the player can answer with nothing at all, whatever its documentation says.
    const current = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;
    // The display only shows whole seconds, so the polls in between shouldn't re-render anything.
    setProgress((previous) =>
      Math.floor(previous.current) === Math.floor(current) && previous.duration === duration
        ? previous
        : { current, duration },
    );
  }, []);

  const playTrack = useCallback((next: number) => {
    const wrapped = (next + tracks.length) % tracks.length;
    indexRef.current = wrapped;
    setIndex(wrapped);
    setProgress({ current: 0, duration: 0 });
    setScrub(null);
    playerRef.current?.loadVideoById(tracks[wrapped].videoId);
  }, [tracks]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        // The API replaces this element with its iframe, so React must never own it.
        const target = document.createElement("div");
        host.appendChild(target);

        new api.Player(target, {
          width: "100%",
          height: "100%",
          videoId: tracks[indexRef.current].videoId,
          playerVars: { controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
          events: {
            onReady: ({ target: player }) => {
              playerRef.current = player;
              player.setVolume(INITIAL_VOLUME);
              syncProgress();
              setStatus("ready");
              // A radio is already on when you get to it. If the browser refuses, the Play button is right there.
              player.playVideo();
            },
            onStateChange: ({ data }) => {
              if (data === PLAYER_STATE.PLAYING) {
                // A track loaded just before minimizing only starts now, after the check on minimizing has passed.
                if (isMinimizedRef.current) {
                  resumeOnRestoreRef.current = true;
                  playerRef.current?.pauseVideo();
                  return;
                }
                failuresRef.current = 0;
                syncProgress();
                setStatus("playing");
              } else if (data === PLAYER_STATE.PAUSED) {
                syncProgress();
                setStatus("paused");
              } else if (data === PLAYER_STATE.ENDED) {
                playTrack(indexRef.current + 1);
              }
            },
            // Mostly videos whose owner doesn't allow embedding. Stop once every track has failed in a row.
            onError: ({ data }) => {
              console.warn(`Kara Radio: YouTube error ${data} on ${tracks[indexRef.current].videoId}`);
              failuresRef.current += 1;
              if (failuresRef.current >= tracks.length) {
                setStatus("noSignal");
                return;
              }
              setStatus("skipping");
              playTrack(indexRef.current + 1);
            },
            onAutoplayBlocked: () => setStatus("ready"),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("noSignal");
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [playTrack, syncProgress, tracks]);

  // YouTube's policies don't allow playing from a player that isn't on screen, so a minimized radio waits.
  useEffect(() => {
    isMinimizedRef.current = isMinimized;
    const player = playerRef.current;
    if (!player) return;

    if (isMinimized) {
      const state = player.getPlayerState();
      resumeOnRestoreRef.current = state === PLAYER_STATE.PLAYING || state === PLAYER_STATE.BUFFERING;
      if (resumeOnRestoreRef.current) player.pauseVideo();
    } else if (resumeOnRestoreRef.current) {
      resumeOnRestoreRef.current = false;
      player.playVideo();
    }
  }, [isMinimized]);

  // Moves only the list. scrollIntoView could also move the desktop behind it.
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>(".kara-radio__track--current");
    if (!list || !current) return;

    const top = current.offsetTop - list.offsetTop;
    const bottom = top + current.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [index]);

  const canControl = status !== "tuning" && status !== "noSignal";
  const playing = status === "playing";

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(syncProgress, PROGRESS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, syncProgress]);

  const commitScrub = () => {
    if (scrub === null) return;
    playerRef.current?.seekTo(scrub, true);
    setProgress((current) => ({ ...current, current: scrub }));
    setScrub(null);
  };

  const handleScrubPointerDown = (event: ReactPointerEvent<HTMLInputElement>) => {
    // Keeps the release on this slider even if the pointer has wandered off it.
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleScrubKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab") commitScrub();
  };

  const shownTime = scrub ?? progress.current;

  return (
    <div className="kara-radio">
      <div className="kara-radio__station">FM 25.61 (visual radio)</div>
      <div ref={hostRef} className="kara-radio__stage" />

      <div className="kara-radio__status" aria-live="polite">
        {playing ? `Now playing: ${tracks[index].label}` : STATUS_TEXT[status]}
      </div>

      <div className="kara-radio__progress">
        <span className="kara-radio__time">{formatKaraDuration(shownTime)}</span>
        <input
          type="range"
          className="kara-radio__seek"
          aria-label="Position"
          aria-valuetext={formatKaraDuration(shownTime)}
          min={0}
          max={progress.duration}
          step={1}
          value={shownTime}
          disabled={!canControl || progress.duration === 0}
          onChange={(event) => setScrub(Number(event.target.value))}
          onPointerDown={handleScrubPointerDown}
          onPointerUp={commitScrub}
          onPointerCancel={commitScrub}
          onKeyUp={handleScrubKeyUp}
        />
        <span className="kara-radio__time">{formatKaraDuration(progress.duration)}</span>
      </div>

      <div className="kara-radio__controls">
        <button
          type="button"
          className="kara-button kara-radio__button"
          aria-label="Previous track"
          disabled={!canControl}
          onClick={() => playTrack(index - 1)}
        >
          |◀
        </button>
        <button
          type="button"
          className="kara-button kara-radio__button"
          aria-label={playing ? "Pause" : "Play"}
          disabled={!canControl}
          onClick={() => (playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className="kara-button kara-radio__button"
          aria-label="Next track"
          disabled={!canControl}
          onClick={() => playTrack(index + 1)}
        >
          ▶|
        </button>
        <span className="kara-radio__volume">
          <SpeakerIcon size={16} />
          <input
            type="range"
            className="kara-radio__volume-slider"
            aria-label="Volume"
            min={0}
            max={100}
            value={volume}
            disabled={!canControl}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              playerRef.current?.setVolume(next);
            }}
          />
        </span>
      </div>

      <ol ref={listRef} className="kara-radio__tracks">
        {tracks.map((track, trackIndex) => (
          <TrackRow
            key={track.videoId}
            name={`${trackIndex + 1}. ${track.label}`}
            current={trackIndex === index}
            disabled={!canControl}
            onOpen={() => playTrack(trackIndex)}
          />
        ))}
      </ol>
    </div>
  );
}

export default RadioApp;
