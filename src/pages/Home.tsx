import { useState } from "react";
import ANIMATION from "../assets/KiriSleep.webm";
import BGM from "../assets/Soul and Mind - E's Jammy Jams.mp3";
import Contact from "../components/Contact";
import P5Canvas from "../components/P5Canvas";
import { FaCat } from "react-icons/fa";
import { MdMusicNote, MdMusicOff } from "react-icons/md";

function Home() {
  const [musicEnabled, setMusicEnabled] = useState(false);

  const toggleMusic = () => {
    setMusicEnabled(!musicEnabled);
  };

  return (
    <div className="home">
      <P5Canvas/>
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

      <video autoPlay loop muted playsInline id="homeVideo">
        <source src={ANIMATION} type="video/webm" />
        Your browser does not support video playback.
      </video>

      <audio autoPlay loop muted={!musicEnabled} id="homeBGM">
        <source src={BGM} type="audio/mp3" />
        Your browser does not support the audio element.
      </audio>

      <button onClick={toggleMusic} className="music-button">
        {musicEnabled ? <MdMusicNote size={30} /> : <MdMusicOff size={30} />}
      </button>
    </div>
  );
}

export default Home;