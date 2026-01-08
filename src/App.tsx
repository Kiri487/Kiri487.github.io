import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { getRandomPair } from "./config/assets";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Cited from "./pages/Cited";

function App() {
  const [homeKey, setHomeKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [musicEnabled, setMusicEnabled] = useState(() => {
    const saved = localStorage.getItem("musicEnabled");
    return saved ? JSON.parse(saved) : false;
  });

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    return saved ? parseFloat(saved) : 0.5;
  });

  const [selectedPair, setSelectedPair] = useState(getRandomPair);

  useEffect(() => {
    localStorage.setItem("musicEnabled", JSON.stringify(musicEnabled));
  }, [musicEnabled]);

  useEffect(() => {
    localStorage.setItem("bgmVolume", volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleRefresh = () => {
    setHomeKey(prevKey => prevKey + 1);
    setSelectedPair(getRandomPair());
  };

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
    if (musicEnabled) {
      initAudioContext();
      audioRef.current?.play()
        .then(() => {
          console.log("Autoplay success");
        })
        .catch((e) => {
          console.log("Audio play error:", e);
          setMusicEnabled(false); 
        });
    }
    else {
      audioRef.current?.pause();
    }
  }, [musicEnabled, selectedPair]);

  const toggleMusic = () => {
    initAudioContext();
    setMusicEnabled(!musicEnabled);
  };

  return (
    <HelmetProvider>
      <Router basename="/">
        <audio ref={audioRef} src={selectedPair.music} loop crossOrigin="anonymous" />
        <Navbar onRefresh={handleRefresh} musicEnabled={musicEnabled} toggleMusic={toggleMusic} volume={volume} setVolume={setVolume}/>
        <div className="App">  
          <div className="routes-container">
            <Routes>
            <Route path="/" element={<Home key={homeKey} videoSrc={selectedPair.video} analyser={analyserRef.current} />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/cited" element={<Cited />} />
            </Routes>
          </div>
        </div>
        <Footer />
      </Router>
    </HelmetProvider>
  );
}

export default App;