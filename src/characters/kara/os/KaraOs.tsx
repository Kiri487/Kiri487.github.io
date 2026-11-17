import { lazy, Suspense, useEffect, useState } from "react";
import { abandonVisit, enterBackrooms, leaveBackrooms, useXnVisit } from "../xnen/door";
import DoorGlitch from "../xnen/DoorGlitch";
import { loadXnenWorld } from "../xnen/load";
import { passSanTime } from "../xnen/san";
import XnenBoundary from "../xnen/XnenBoundary";
import { useOsState } from "./context";
import Desktop from "./Desktop";
import DesktopPet from "./DesktopPet";
import ShutdownDialog from "./ShutdownDialog";
import Taskbar from "./Taskbar";
import Window from "./Window";

/** Made again after a failed load: lazy() keeps a failure for good, and the next try at the door should really try. */
let XnenWorld = lazy(loadXnenWorld);

function backroomsFailed() {
  XnenWorld = lazy(loadXnenWorld);
  leaveBackrooms("stop");
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

  // Leaving Kara's page from behind the door shouldn't leave the next visit to it stuck back there.
  useEffect(() => abandonVisit, []);

  // Time on the plain desktop gives SAN back, a second for a second, but only while the page is in front.
  useEffect(() => {
    if (visit !== "none") return;
    const timer = window.setInterval(() => {
      if (!document.hidden) passSanTime(-1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [visit]);

  return (
    <div className="kara-os">
      <Desktop />
      <DesktopPet shuttingDown={shuttingDown} />
      <WindowLayer />
      <Taskbar onTurnOff={() => setShuttingDown(true)} />
      {shuttingDown && <ShutdownDialog onCancel={() => setShuttingDown(false)} />}
      {visit === "glitch" && <DoorGlitch onDone={enterBackrooms} onGiveUp={backroomsFailed} />}
      {visit === "inside" && (
        <XnenBoundary onFail={backroomsFailed}>
          <Suspense fallback={null}>
            <XnenWorld onLeave={leaveBackrooms} />
          </Suspense>
        </XnenBoundary>
      )}
    </div>
  );
}

export default KaraOs;
