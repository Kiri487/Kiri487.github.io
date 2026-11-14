import type { HotspotId } from "./types";
import { visuallyHidden } from "../../shared/visuallyHidden";

/** Left to right as the street shows them. Kuru moves between two spots, so she comes last. */
const HOTSPOTS: { id: HotspotId; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "exit", label: "Back to Kiri" },
  { id: "works", label: "Works" },
  { id: "credits", label: "Credits" },
  { id: "about", label: "About" },
  { id: "cat", label: "Talk to Kuru" },
];

interface HotspotKeysProps {
  onFocusChange: (id: HotspotId | null) => void;
  onActivate: (id: HotspotId) => void;
}

/**
 * The street's clickable things, as buttons the keyboard and screen readers can reach. They're never seen:
 * the thing itself lights up in the scene instead, as it does under the mouse.
 */
function HotspotKeys({ onFocusChange, onActivate }: HotspotKeysProps) {
  return (
    <nav style={visuallyHidden} aria-label="Street">
      {HOTSPOTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onFocus={() => onFocusChange(id)}
          onBlur={() => onFocusChange(null)}
          onClick={() => onActivate(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export default HotspotKeys;
