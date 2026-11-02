import { APPS } from "../apps/registry";
import { useOs, useOsState } from "./context";
import StartMenu from "./StartMenu";
import Tray from "./Tray";

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

      <Tray />
    </div>
  );
}

export default Taskbar;
