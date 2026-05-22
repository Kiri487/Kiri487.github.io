import { useState } from "react";
import Contact from "../components/Contact";
import P5Canvas from "../components/P5Canvas";
import { FaCat } from "react-icons/fa";
import CircularProgress from "@mui/material/CircularProgress";

interface HomeProps {
  videoWebm: string;
  videoMov: string;
  analyser: AnalyserNode | null;
}


function Home({ videoWebm, videoMov, analyser }: HomeProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="home">
      <title>Kiri487</title>
      <meta name="description" content="Kiri487's personal website — a programmer, a creator, and a cat." />
      <div className="P5-canvas">
        <P5Canvas analyser={analyser} />
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
          <a href="https://mukumi.booth.pm/items/5813187" aria-label="Purchase the character model on BOOTH">BOOTH</a>
        </p>
      </div>

      <div className="home-video">
        {!isLoaded && <CircularProgress color="inherit" size="5rem"/>}
        <video
          key={videoWebm}
          autoPlay loop muted playsInline
          onCanPlay={() => setIsLoaded(true) }
          style={{ display: isLoaded ? 'block' : 'none' }}
          aria-label="Looping animation of Kiri's 3D character model">
          <source src={videoMov} type="video/quicktime" />
          <source src={videoWebm} type="video/webm" />
          Your browser does not support video playback.
        </video>
      </div>
    </div>
  );
}

export default Home;
