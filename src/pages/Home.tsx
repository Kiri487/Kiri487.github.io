import { useState } from "react";
import ANIMATION1 from "../assets/KiriSleep.webm";
import ANIMATION2 from "../assets/KiriRoll.webm";
import ANIMATION3 from "../assets/KiriOjousama.webm";
import BGM1 from "../assets/Soul and Mind - E's Jammy Jams.mp3";
import BGM2 from "../assets/Rick Astley - Never Gonna Give You Up.mp3";
import BGM3 from "../assets/ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana).mp3";
import Contact from "../components/Contact";
import P5Canvas from "../components/P5Canvas";
import { FaCat } from "react-icons/fa";
import { MdMusicNote, MdMusicOff } from "react-icons/md";
import CircularProgress from "@mui/material/CircularProgress";

function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [animationClass, setAnimationClass] = useState("");

  const videoMusicPairs = [
    { video: ANIMATION1, music: BGM1 },
    { video: ANIMATION2, music: BGM2 },
    { video: ANIMATION3, music: BGM3 }
  ];

  const randomIndex = Math.floor(Math.random() * videoMusicPairs.length);
  const selectedPair = videoMusicPairs[randomIndex];

  const toggleMusic = () => {
    const audioElement = document.getElementById("homeBGM") as HTMLAudioElement;
    if (audioElement) {
      setAnimationClass("fade-out");
      
      setTimeout(() => {
        if (musicEnabled) {
          audioElement.pause();
        } else {
          audioElement.play().catch((e) => console.error("Audio play error:", e));
        }
        setMusicEnabled(!musicEnabled);

        setAnimationClass("fade-in");
      }, 250);
    }
  };
  
  return (
    <div className="home">
      <div className={`P5-canvas ${animationClass}`}>
        <P5Canvas musicEnabled={musicEnabled} />
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
        <video autoPlay loop muted playsInline id="homeVideo" onCanPlay={() => setIsLoaded(true)}>
          <source src={selectedPair.video} type="video/webm" />
          Your browser does not support video playback.
        </video>
      </div>

      <audio loop id="homeBGM">
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