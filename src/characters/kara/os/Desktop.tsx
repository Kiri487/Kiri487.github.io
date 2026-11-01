import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { APPS, DESKTOP_ICONS } from "../apps/registry";
import { useOs } from "./context";

/** Keep in sync with --kara-icon-width in ../style.css. */
const ICON_WIDTH = 88;

function ShortcutArrow() {
  return (
    <svg className="kara-icon__shortcut" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect width="14" height="14" fill="#fff" />
      <path d="M3 11l6-6M5 4h5v5" fill="none" stroke="#1d5fb5" strokeWidth="2" />
    </svg>
  );
}

function Desktop() {
  const os = useOs();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const handleDesktopPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    os.blurWindows();
    if (event.target === event.currentTarget) setSelectedLabel(null);
  };

  return (
    <div className="kara-desktop" onPointerDown={handleDesktopPointerDown}>
      {DESKTOP_ICONS.map(({ label, appId, x, y, shortcut }) => {
        const Icon = APPS[appId].icon;
        return (
          <button
            key={label}
            type="button"
            className={`kara-icon${selectedLabel === label ? " kara-icon--selected" : ""}`}
            style={{
              // Percentages keep the mess on screen at any size; min() stops the last column running off the edge.
              left: `min(${x}%, calc(100% - ${ICON_WIDTH}px))`,
              top: `${y}%`,
            }}
            onPointerDown={() => setSelectedLabel(label)}
            onDoubleClick={() => os.openApp(appId)}
            onKeyDown={(event) => {
              if (event.key === "Enter") os.openApp(appId);
            }}
          >
            <span className="kara-icon__image">
              <Icon size={40} />
              {shortcut && <ShortcutArrow />}
            </span>
            <span className="kara-icon__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Desktop;
