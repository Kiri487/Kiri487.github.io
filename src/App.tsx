import { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import { videoBgmPairs, getRandomIndex } from "./config/assets";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Works from "./pages/Works";
import Cited from "./pages/Cited";
import NotFound from "./pages/NotFound";

function App() {
  const [homeKey, setHomeKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [bgmEnabled, setBgmEnabled] = useState(() => {
    const saved = localStorage.getItem("bgmEnabled");
    return saved ? JSON.parse(saved) : false;
  });

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    return saved ? parseFloat(saved) : 0.5;
  });

  const [currentPairIndex, setCurrentPairIndex] = useState(() => {
    const savedIndex = sessionStorage.getItem("bgmIndex");
    
    if (savedIndex !== null) {
      const index = parseInt(savedIndex, 10);
      if (!isNaN(index) && index >= 0 && index < videoBgmPairs.length) {
        return index;
      }
    }
    return getRandomIndex();
  });

  const selectedPair = videoBgmPairs[currentPairIndex];

  const handleRefresh = () => {
    setHomeKey(prevKey => prevKey + 1);
    let newIndex = getRandomIndex();
    while (newIndex === currentPairIndex && videoBgmPairs.length > 1) {
      newIndex = getRandomIndex();
    }
    setCurrentPairIndex(newIndex);
  };

  const initAudioContext = () => {
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
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

  const toggleBgm = () => {
    initAudioContext();
    setBgmEnabled(!bgmEnabled);
  };

  useEffect(() => {
    localStorage.setItem("bgmEnabled", JSON.stringify(bgmEnabled));
  }, [bgmEnabled]);

  useEffect(() => {
    localStorage.setItem("bgmVolume", volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    sessionStorage.setItem("bgmIndex", currentPairIndex.toString());
  }, [currentPairIndex]);

  useEffect(() => {
    if (bgmEnabled) {
      initAudioContext();
      audioRef.current?.play()
        .catch((e) => {
          console.log("Audio play error:", e);
          setBgmEnabled(false); 
        });
    }
    else {
      audioRef.current?.pause();
    }
  }, [bgmEnabled, currentPairIndex]);

  return (
    <HelmetProvider>
      <Router basename="/">
        <audio ref={audioRef} src={selectedPair.bgm} loop crossOrigin="anonymous" />
        <Navbar onRefresh={handleRefresh} bgmEnabled={bgmEnabled} toggleBgm={toggleBgm} volume={volume} setVolume={setVolume}/>
        <div className="App">  
          <div className="routes-container">
            <Routes>
              <Route path="/" element={<Home key={homeKey} videoWebm={selectedPair.webm} videoMov={selectedPair.mov} analyser={analyserRef.current} />} />
              <Route path="/about" element={<About />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/works" element={<Works />} />
              <Route path="/cited" element={<Cited />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
        <Footer />
      </Router>
    </HelmetProvider>
  );
}

export default App;