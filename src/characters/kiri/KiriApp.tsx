import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { videoBgmPairs, getRandomIndex } from "../../config/assets";
import { resumeAudioContext } from "../../shared/audio";
import { readBoolean, readNumber, readString, writeBoolean, writeString } from "../../shared/storage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Projects from "./pages/Projects";
import Works from "./pages/Works";
import Cited from "./pages/Cited";
import NotFound from "./pages/NotFound";
import "./style.css";

function KiriApp() {
  const [homeKey, setHomeKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const [bgmEnabled, setBgmEnabled] = useState(() => {
    return readBoolean("bgmEnabled", false);
  });

  const [volume, setVolume] = useState(() => {
    return readNumber("bgmVolume", 0.5, { min: 0, max: 1 });
  });

  const [currentPairIndex, setCurrentPairIndex] = useState(() => {
    const savedIndex = readString("bgmIndex", "session");

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

  // The site shares one audio context, so coming back to Kiri doesn't start another. Each visit has a new <audio>
  // element, which gets its own source.
  const initAudioContext = useCallback(() => {
    if (!audioRef.current) return;
    const ctx = resumeAudioContext();

    if (!sourceRef.current) {
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;
      source.connect(analyserNode);
      analyserNode.connect(ctx.destination);

      setAnalyser(analyserNode);
    }
  }, []);

  // Leaving Kiri unplugs this visit's source and analyser, so the old <audio> and its buffered song can be freed.
  // The context itself stays for the next visit. Plugging in again is harmless, and keeps the music playing when
  // the effect is re-run without leaving (as React does while developing).
  useEffect(() => {
    const source = sourceRef.current;
    if (!analyser || !source) return;
    source.connect(analyser);
    analyser.connect(analyser.context.destination);
    return () => {
      source.disconnect();
      analyser.disconnect();
    };
  }, [analyser]);

  const toggleBgm = () => {
    initAudioContext();
    setBgmEnabled(!bgmEnabled);
  };

  useEffect(() => {
    writeBoolean("bgmEnabled", bgmEnabled);
  }, [bgmEnabled]);

  useEffect(() => {
    writeString("bgmVolume", volume.toString());
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    writeString("bgmIndex", currentPairIndex.toString(), "session");
  }, [currentPairIndex]);

  useEffect(() => {
    if (bgmEnabled) {
      initAudioContext();
      audioRef.current?.play()
        .catch((e) => {
          if (e.name === "AbortError") return;
          setBgmEnabled(false);
        });
    }
    else {
      audioRef.current?.pause();
    }
  }, [bgmEnabled, currentPairIndex, initAudioContext]);

  return (
    <Router basename="/">
      <audio ref={audioRef} src={selectedPair.bgm} loop crossOrigin="anonymous" />
      <Navbar onRefresh={handleRefresh} bgmEnabled={bgmEnabled} toggleBgm={toggleBgm} volume={volume} setVolume={setVolume}/>
      <div className="App">
        <div className="routes-container">
          <Routes>
            <Route path="/" element={<Home key={homeKey} videoWebm={selectedPair.webm} videoMov={selectedPair.mov} analyser={analyser} />} />
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
  );
}

export default KiriApp;
