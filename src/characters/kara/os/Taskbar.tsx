import { APPS } from "../apps/registry";
import { SpeakerIcon } from "../icons";
import Clock from "./Clock";
import { useOs, useOsState } from "./context";
import StartMenu from "./StartMenu";

function Taskbar({ onTurnOff }: { onTurnOff: () => void }) {
  const os = useOs();
  const { windows, focusedId } = useOsState();

  return (
    <div className="kara-taskbar">
      <StartMenu onTurnOff={onTurnOff} />

      <div className="kara-taskbar__windows">
        {windows.map((win) => {
          const Icon = APPS[win.appId].icon;
          const active = win.id === focusedId;
          return (
            <button
              key={win.id}
              type="button"
              className={`kara-taskbar__window${active ? " kara-taskbar__window--active" : ""}`}
              aria-pressed={active}
              onClick={() => (active ? os.minimizeWindow(win.id) : os.focusWindow(win.id))}
            >
              <Icon size={16} />
              <span className="kara-taskbar__window-title">{win.title}</span>
            </button>
          );
        })}
      </div>

      <div className="kara-tray">
        <SpeakerIcon size={16} />
        <Clock />
      </div>
    </div>
  );
}

export default Taskbar;
