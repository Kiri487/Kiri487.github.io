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
  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(randomIdx);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("kuruBgmVolume");
    return saved ? parseFloat(saved) : 0.4;
  });
  const prevVolume = useRef(volume);

  const track = TRACKS[trackIdx];

  const toggle = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      audioRef.current?.play();
      setPlaying(true);
    }
  }, [playing]);

  const next = useCallback(() => {
    let idx = randomIdx();
    while (idx === trackIdx && TRACKS.length > 1) idx = randomIdx();
    setTrackIdx(idx);
    setPlaying(true);
  }, [trackIdx]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      const idx = (trackIdx - 1 + TRACKS.length) % TRACKS.length;
      setTrackIdx(idx);
      setPlaying(true);
    }
  }, [trackIdx]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem("kuruBgmVolume", volume.toString());
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (playing) audio.play();
  }, [trackIdx]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setDuration(audio.duration);
    };
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => next();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [next]);

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
              setVolume(prevVolume.current || 0.4);
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
