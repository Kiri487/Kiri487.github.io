import leaf from "./assets/entry-leaf.webp";
import computer from "./assets/tango/computer.svg";
import "./entry.css";

/** Kara's badge on kiri's skin switcher: her computer, and what's on its screen. */
function KaraEntry() {
  return (
    <span className="kara-badge">
      <img className="kara-badge__computer" src={computer} alt="" draggable={false} />
      <img className="kara-badge__leaf" src={leaf} alt="" draggable={false} />
    </span>
  );
}

export default KaraEntry;
