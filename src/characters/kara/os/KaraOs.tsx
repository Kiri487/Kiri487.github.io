import { lazy, Suspense, useEffect, useState } from "react";
import { enterBackrooms, leaveBackrooms, openDoor, useXnVisit } from "../xnen/door";
import DoorGlitch from "../xnen/DoorGlitch";
import { loadXnenWorld } from "../xnen/load";
import XnenBoundary from "../xnen/XnenBoundary";
import { useOsState } from "./context";
import Desktop from "./Desktop";
import DesktopPet from "./DesktopPet";
import ShutdownDialog from "./ShutdownDialog";
import Taskbar from "./Taskbar";
import Window from "./Window";

const XnenWorld = lazy(loadXnenWorld);

/** Dev builds only: Ctrl+Shift+X goes through XN's door, found or not, for working on what's behind it. */
function isXnenShortcut(e: KeyboardEvent) {
  return e.ctrlKey && e.shiftKey && e.code === "KeyX";
}

function WindowLayer() {
  const { windows, focusedId } = useOsState();

  return (
    <div className="kara-windows">
      {windows.map((win) => (
        <Window key={win.id} win={win} focused={win.id === focusedId} />
      ))}
    </div>
  );
}

function KaraOs() {
  const [shuttingDown, setShuttingDown] = useState(false);
  const visit = useXnVisit();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isXnenShortcut(e)) return;
      e.preventDefault();
      openDoor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="kara-os">
      <Desktop />
      <DesktopPet shuttingDown={shuttingDown} />
      <WindowLayer />
      <Taskbar onTurnOff={() => setShuttingDown(true)} />
      {shuttingDown && <ShutdownDialog onCancel={() => setShuttingDown(false)} />}
      {visit === "glitch" && <DoorGlitch onDone={enterBackrooms} />}
      {visit === "inside" && (
        <XnenBoundary onFail={() => leaveBackrooms("stop")}>
          <Suspense fallback={null}>
            <XnenWorld onLeave={leaveBackrooms} />
          </Suspense>
        </XnenBoundary>
      )}
    </div>
  );
}

export default KaraOs;
