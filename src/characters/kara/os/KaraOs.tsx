import { lazy, Suspense, useEffect, useState } from "react";
import { loadXnenWorld } from "../xnen/load";
import XnenBoundary from "../xnen/XnenBoundary";
import { useOsState } from "./context";
import Desktop from "./Desktop";
import DesktopPet from "./DesktopPet";
import ShutdownDialog from "./ShutdownDialog";
import Taskbar from "./Taskbar";
import Window from "./Window";

const XnenWorld = lazy(loadXnenWorld);

/** Dev builds only: Ctrl+Shift+X opens XN's door straight away, for working on what's behind it. */
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
  const [xnenOpen, setXnenOpen] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isXnenShortcut(e)) return;
      e.preventDefault();
      setXnenOpen(true);
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
      {xnenOpen && (
        <XnenBoundary onFail={() => setXnenOpen(false)}>
          <Suspense fallback={null}>
            <XnenWorld onLeave={() => setXnenOpen(false)} />
          </Suspense>
        </XnenBoundary>
      )}
    </div>
  );
}

export default KaraOs;
