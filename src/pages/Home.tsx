import ANIMATION from "../assets/KiriSleep.mp4";
import Contact from "../components/Contact";
import { FaCat } from "react-icons/fa";

function Home() {
  return (
    <div className="home">
      <div className="intro">
        <p style={{ fontSize: "2rem"}}>Hi, I'm Kiri!</p>
        <p style={{ fontSize: "1.2rem"}}>A programmer, a creator, and a cat <FaCat /></p>
        <div  style={{padding: "1rem 0"}}><Contact /></div>
        <p className="model-info" style={{ fontSize: "0.9rem"}}>The character model was purchased from <a href="https://mukumi.booth.pm/items/5813187">here</a></p>
      </div>
      <video autoPlay loop muted playsInline className="home-video">
        <source src={ANIMATION} type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

export default Home;