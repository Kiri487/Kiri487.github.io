import { useState, useEffect, useRef } from "react";
import { Helmet } from 'react-helmet-async';
import ANIMATION1 from "../assets/video/KiriSleep.webm";
import ANIMATION2 from "../assets/video/KiriRoll.webm";
import ANIMATION3 from "../assets/video/KiriOjousama.webm";
import ANIMATION4 from "../assets/video/KiriHeadspin.webm";
import ANIMATION5 from "../assets/video/KiriLook.webm";
import ANIMATION6 from "../assets/video/KiriIrisOut.webm";
import ANIMATION7 from "../assets/video/KiriPolishCow.webm";
import BGM1 from "../assets/bgm/Soul and Mind - E's Jammy Jams.mp3";
import BGM2 from "../assets/bgm/Rick Astley - Never Gonna Give You Up.mp3";
import BGM3 from "../assets/bgm/ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana).mp3";
import BGM4 from "../assets/bgm/Bizzie - The Grand Affair.mp3";
import BGM5 from "../assets/bgm/Jane Street - TrackTribe.mp3";
import BGM6 from "../assets/bgm/米津玄師  Kenshi Yonezu - IRIS OUT.mp3";
import BGM7 from "../assets/bgm/Cypis - Gdzie jest biały węgorz (Zejście).mp3";
import Contact from "../components/Contact";
import P5Canvas from "../components/P5Canvas";
import { FaCat } from "react-icons/fa";
import { MdMusicNote, MdMusicOff } from "react-icons/md";
import CircularProgress from "@mui/material/CircularProgress";

interface HomeProps {
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
}

const videoMusicPairs = [
  { video: ANIMATION1, music: BGM1 },
  { video: ANIMATION2, music: BGM2 },
  { video: ANIMATION3, music: BGM3 },
  { video: ANIMATION4, music: BGM4 },
  { video: ANIMATION5, music: BGM5 },
  { video: ANIMATION6, music: BGM6 },
  { video: ANIMATION7, music: BGM7 },
];

function Home({ musicEnabled, setMusicEnabled }: HomeProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [selectedPair] = useState(() => {
    const randomIndex = Math.floor(Math.random() * videoMusicPairs.length);
    return videoMusicPairs[randomIndex];
  });

  const initAudioContext = () => {
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      if (!sourceRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);
      }
    }

    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    if (musicEnabled && audioRef.current) {
      initAudioContext();
      audioRef.current.play().catch((e) => console.log("Auto-play blocked by browser policy:", e));
    }
  }, []);

  const toggleMusic = () => {
    if (audioRef.current) {
      initAudioContext();

      if (musicEnabled) {
        audioRef.current?.pause();
      } else {
        audioRef.current?.play().catch((e) => console.error("Audio play error:", e));
      }
      setMusicEnabled(!musicEnabled);
    }
  };
  
  return (
    <div className="home">
      <Helmet>
        <title>Kiri487</title>
      </Helmet>
      <div className={`P5-canvas`}>
        <P5Canvas musicEnabled={musicEnabled} analyser={analyserRef.current} />
      </div>
      <div className="intro">
        <p style={{ fontSize: "2rem" }}>Hi, I'm Kiri!</p>
        <p style={{ fontSize: "1.2rem" }}>
          A programmer, a creator, and a cat <FaCat />
        </p>
        <div style={{ padding: "1rem 0" }}>
          <Contact />
        </div>
        <p className="model-info" style={{ fontSize: "0.9rem" }}>
          The character model was purchased from{" "}
          <a href="https://mukumi.booth.pm/items/5813187">here</a>
        </p>
      </div>

      <div className="home-video">
        {!isLoaded && <CircularProgress color="inherit" size="5rem"/>}
        <video autoPlay loop muted playsInline id="homeVideo" onCanPlay={() => setIsLoaded(true) } style={{ display: isLoaded ? 'block' : 'none' }}>
          <source src={selectedPair.video} type="video/webm" />
          Your browser does not support video playback.
        </video>
      </div>

      <audio ref={audioRef} loop crossOrigin="anonymous">
        <source src={selectedPair.music} type="audio/mp3" />
        Your browser does not support the audio element.
      </audio>

      <button onClick={toggleMusic} className="music-button">
        {musicEnabled ? <MdMusicNote size={30} /> : <MdMusicOff size={30} />}
      </button>
    </div>
  );
}

export default Home;