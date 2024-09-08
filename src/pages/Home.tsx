import ANIMATION from "../assets/KiriSleep.mp4";
import Contact from "../components/Contact";

function Home() {
  return (
    <div className="home">
      <div className="home-title">
        <p style={{ fontSize: "2rem"}}>Hi, I'm Kiri!</p>
        <Contact />
      </div>
      <video autoPlay loop muted playsInline className="home-video">
        <source src={ANIMATION} type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

export default Home;