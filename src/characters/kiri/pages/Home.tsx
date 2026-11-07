import { useEffect, useRef, useState } from "react";
import Contact from "../components/Contact";
import WaveCanvas from "../components/WaveCanvas";
import { FaCat } from "react-icons/fa";

interface HomeProps {
  videoWebm: string;
  videoMov: string;
  poster: string;
  analyser: AnalyserNode | null;
}

function Home({ videoWebm, videoMov, poster, analyser }: HomeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Which video is ready to show. Tied to the source, so a new video starts on its poster again.
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const isLoaded = readySrc === videoWebm;

  // Waits for the video by looking, not by its canplay event: a video already in the browser's cache can be ready
  // before React listens, and then the event never arrives and the poster would stay forever.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let frame = 0;
    const check = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setReadySrc(videoWebm);
      else frame = requestAnimationFrame(check);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [videoWebm]);

  return (
    <div className="home">
      <title>Kiri487</title>
      <meta name="description" content="Kiri487's personal website — a programmer, a creator, and a cat." />
      <div className="home-background">
        <WaveCanvas analyser={analyser} />
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
        {/* The video's first frame, so Kiri is there at once. The video starts from that same frame. */}
        {!isLoaded && <img className="home-video-poster" src={poster} alt="" fetchPriority="high" />}
        <video
          key={videoWebm}
          ref={videoRef}
          autoPlay loop muted playsInline
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
