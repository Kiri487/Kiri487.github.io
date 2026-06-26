import { useRef, useState, useEffect, useCallback } from "react";
import { IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp, IoPlaySkipForwardSharp, IoVolumeHighSharp, IoVolumeMuteSharp } from "react-icons/io5";

const TRACKS = [
  { file: "/kuru/bgm/tunetank-lo-fi-hip-hop-background-347200.mp3", title: "Lo-Fi Hip Hop Background" },
  { file: "/kuru/bgm/tunetank-lo-fi-hip-hop-cozy-music-349641.mp3", title: "Lo-Fi Hip Hop Cozy Music" },
  { file: "/kuru/bgm/tunetank-lofi-hip-hop-348398.mp3", title: "Lofi Hip Hop" },
];

function randomIdx() {
  return Math.floor(Math.random() * TRACKS.length);
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(() => {
    const saved = localStorage.getItem("bgmEnabled");
    return saved ? JSON.parse(saved) === true : false;
  });
  const [trackIdx, setTrackIdx] = useState(randomIdx);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    return saved ? parseFloat(saved) : 0.5;
  });
  const prevVolume = useRef(volume);

  const track = TRACKS[trackIdx];

  const toggle = useCallback(() => {
    const next = !playing;
    if (next) {
      audioRef.current?.play().catch(() => {});
    } else {
      audioRef.current?.pause();
    }
    setPlaying(next);
    localStorage.setItem("bgmEnabled", JSON.stringify(next));
  }, [playing]);

  const next = useCallback(() => {
    let idx = randomIdx();
    while (idx === trackIdx && TRACKS.length > 1) idx = randomIdx();
    setTrackIdx(idx);
    setPlaying(true);
    localStorage.setItem("bgmEnabled", "true");
  }, [trackIdx]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      const idx = (trackIdx - 1 + TRACKS.length) % TRACKS.length;
      setTrackIdx(idx);
      setPlaying(true);
      localStorage.setItem("bgmEnabled", "true");
    }
  }, [trackIdx]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem("bgmVolume", volume.toString());
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (playing) {
      audio.play().catch((e) => {
        if (e.name === "AbortError") return;
        setPlaying(false);
        localStorage.setItem("bgmEnabled", "false");
      });
    }
  }, [trackIdx]);

  const rafRef = useRef(0);
  const lastSecRef = useRef(-1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => next();
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    const tick = () => {
      const sec = Math.floor(audio.currentTime);
      if (sec !== lastSecRef.current) {
        lastSecRef.current = sec;
        setCurrentTime(audio.currentTime);
        if (audio.duration) setDuration(audio.duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [next, playing]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="kuru-bgm">
      <audio ref={audioRef} src={track.file} preload="auto" />
      <button className="kuru-bgm__btn" onClick={prev} aria-label="Previous">
        <IoPlaySkipBackSharp />
      </button>
      <button className="kuru-bgm__btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <IoPauseSharp /> : <IoPlaySharp />}
      </button>
      <button className="kuru-bgm__btn" onClick={next} aria-label="Next">
        <IoPlaySkipForwardSharp />
      </button>
      <span className="kuru-bgm__track">{track.title}</span>
      <span className="kuru-bgm__time">{fmt(currentTime)}</span>
      <div className="kuru-bgm__bar" onClick={seek}>
        <div className="kuru-bgm__fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="kuru-bgm__time">{fmt(duration)}</span>
      <div className="kuru-bgm__vol-wrap">
        <button
          className="kuru-bgm__btn kuru-bgm__vol-icon"
          aria-label="Volume"
          onClick={() => {
            if (volume > 0) {
              prevVolume.current = volume;
              setVolume(0);
            } else {
              setVolume(prevVolume.current || 0.5);
            }
          }}
        >
          {volume === 0 ? <IoVolumeMuteSharp /> : <IoVolumeHighSharp />}
        </button>
        <input
          className="kuru-bgm__vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}

export default BgmPlayer;
