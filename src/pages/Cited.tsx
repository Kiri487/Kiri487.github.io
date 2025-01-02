import { Helmet } from 'react-helmet-async';

function Cited() {
  return (
    <div className="cited">
      <Helmet>
        <title>Kiri487 | Cited</title>
      </Helmet>
      <h2 className="title">BGM</h2>
      <div className="content">
        <ul>
          <li><a href="https://youtu.be/fXWwBsPMQJU?si=bu8XYlq02fvDAfXz">Soul and Mind - E's Jammy Jams</a></li>
          <li><a href="https://youtu.be/dQw4w9WgXcQ?si=231WlXHr8URdbYHK">Rick Astley - Never Gonna Give You Up</a></li>
          <li><a href="https://youtu.be/FoO7Pmx0bE4?si=biTM0TvoSg6YCvkq">ASMRZ(TANAKA, NEEDMORECASH) - 잘자요 아가씨(prod. Gwana)</a></li>
        </ul>
      </div>
      <h2 className="title">Video Motion</h2>
      <div className="content">
        <ul>
          <li><a href="https://vrcmods.com/item?id=6751">Rick Roll Emote</a></li>
          <li><a href="https://www.aplaybox.com/details/motion/cDPiKFCxvbcB">大小姐晚安【动作配布】</a></li>
        </ul>
      </div>
    </div>
  );
}

export default Cited;