import { useState, useEffect } from "react";
import { Helmet } from 'react-helmet-async';
import Contact from "../components/Contact";
import P5Canvas from "../components/P5Canvas";
import { FaCat } from "react-icons/fa";
import CircularProgress from "@mui/material/CircularProgress";

interface HomeProps {
  videoSrc: string;
  analyser: AnalyserNode | null;
}


function Home({ videoSrc, analyser }: HomeProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
  }, [videoSrc]);
  
  return (
    <div className="home">
      <Helmet>
        <title>Kiri487</title>
      </Helmet>
      <div className="P5-canvas">
        <P5Canvas musicEnabled={!!analyser} analyser={analyser} />
      </div>
      <div className="intro">
        <p style={{ fontSize: "2rem" }}>Hi, I'm Kiri!</p>
        <p style={{ fontSize: "1.2rem" }}>
          A programmer, a creator, and a cat <FaCat />
        </p>
        <div style={{ padding: "1rem 0" }}>
          <Contact />
        </div>
        <p className="model-info">
          The character model was purchased from{" "}
          <a href="https://mukumi.booth.pm/items/5813187">here</a>
        </p>
      </div>

      <div className="home-video">
        {!isLoaded && <CircularProgress color="inherit" size="5rem"/>}
        <video autoPlay loop muted playsInline id="homeVideo" src={videoSrc} onCanPlay={() => setIsLoaded(true) } style={{ display: isLoaded ? 'block' : 'none' }}>
          Your browser does not support video playback.
        </video>
      </div>
    </div>
  );
}

export default Home;