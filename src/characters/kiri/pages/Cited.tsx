import { PiMusicNotesFill } from "react-icons/pi";
import { FaRegCirclePlay } from "react-icons/fa6";
import { bgmList, videoMotionList } from "../credits";

function Cited() {
  return (
    <div className="cited">
      <title>Kiri487 | Cited</title>
      <meta name="description" content="Sources and credits for the background music and video motions used on this website." />

      <h2 className="title"><PiMusicNotesFill />BGM</h2>
      <div className="content">
        <ul className="cited-content">
          {bgmList.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="title"><FaRegCirclePlay />Video Motion</h2>
      <div className="content">
        <ul className="cited-content">
          {videoMotionList.map((item) => (
            <li key={item.url}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Cited;