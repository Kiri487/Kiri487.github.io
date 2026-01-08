import { Helmet } from 'react-helmet-async';
import { PiMusicNotesFill } from "react-icons/pi";
import { FaRegCirclePlay } from "react-icons/fa6";
import { bgmList, videoMotionList } from "../data/cited";

function Cited() {
  return (
    <div className="cited">
      <Helmet>
        <title>Kiri487 | Cited</title>
      </Helmet>
      
      <h2 className="title"><PiMusicNotesFill />BGM</h2>
      <div className="content">
        <ul className="cited-content">
          {bgmList.map((item, index) => (
            <li key={index}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </li>
          ))}
        </ul>
      </div>

      <h2 className="title"><FaRegCirclePlay />Video Motion</h2>
      <div className="content">
        <ul className="cited-content">
          {videoMotionList.map((item, index) => (
            <li key={index}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Cited;