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
        <meta name="description" content="Kiri487's personal website." />
      </Helmet>
      <div className="P5-canvas">
        <P5Canvas bgmEnabled={!!analyser} analyser={analyser} />
      </div>
      <div className="intro">
        <p className="intro-greeting">Hi, I'm Kiri!</p>
        <p className="intro-desc">
          A programmer, a creator, and a cat <FaCat aria-hidden="true"/>
        </p>
        <div className="intro-contact">
          <Contact />
        </div>
        <p className="model-info">
          The character model was purchased from{" "}
          <a href="https://mukumi.booth.pm/items/5813187" aria-label="Purchase the character model on BOOTH">here</a>
        </p>
      </div>

      <div className="home-video">
        {!isLoaded && <CircularProgress color="inherit" size="5rem"/>}
        <video 
          autoPlay loop muted playsInline 
          id="homeVideo" src={videoSrc} 
          onCanPlay={() => setIsLoaded(true) } 
          style={{ display: isLoaded ? 'block' : 'none' }}
          aria-label="Looping animation of Kiri's 3D character model">
          Your browser does not support video playback.
        </video>
      </div>
    </div>
  );
}

export default Home;