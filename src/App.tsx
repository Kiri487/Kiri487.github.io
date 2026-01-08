import { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Drawer from "./components/Drawer";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import About from "./pages/About";
import Portfolio from "./pages/Portfolio";
import Cited from "./pages/Cited";

function App() {
  const [homeKey, setHomeKey] = useState(0);
  
  const [musicEnabled, setMusicEnabled] = useState(false);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("bgmVolume");
    return saved ? parseFloat(saved) : 0.5;
  });

  const handleRefresh = () => {
    setHomeKey(prevKey => prevKey + 1);
  };

  useEffect(() => {
    localStorage.setItem("bgmVolume", volume.toString());
  }, [volume]);

  return (
    <HelmetProvider>
      <Router basename="/">
        <Drawer onRefresh={handleRefresh} />
        <div className="App">  
          <div className="routes-container">
            <Routes>
            <Route path="/" element={<Home key={homeKey} musicEnabled={musicEnabled} setMusicEnabled={setMusicEnabled} volume={volume} setVolume={setVolume} />} />
            <Route path="/about" element={<About />} />
            <Route path="/portfolio" element={<Portfolio />} />
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