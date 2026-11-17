import { lazy, Suspense, useEffect, useState } from "react";
import { abandonVisit, enterBackrooms, leaveBackrooms, useXnVisit } from "../xnen/door";
import { XN_DEV_TOOLS } from "../xnen/devFlags";
import DoorGlitch from "../xnen/DoorGlitch";
import { loadXnenWorld } from "../xnen/load";
import { passSanTime, setDesktopAsleep } from "../xnen/san";
import SanDevControl from "../xnen/SanDevControl";
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

/** The most one tick of the desktop gives back, in seconds, after a throttled or stalled stretch. */
const SAN_TICK_LIMIT = 2;

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

  // Time on the plain desktop gives SAN back, second for second, but only while the page is in front: shown and
  // focused, so two windows side by side don't give it back twice. Measured, not counted in ticks, since timers drift.
  useEffect(() => {
    setDesktopAsleep(visit !== "none");
    if (visit !== "none") return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const passed = Math.min(SAN_TICK_LIMIT, (now - last) / 1000);
      last = now;
      if (!document.hidden && document.hasFocus()) passSanTime(-passed);
    }, 1000);
    // Back in front: only the time from here on counts, not the time away before the next tick.
    const restart = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", restart);
    window.addEventListener("focus", restart);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", restart);
      window.removeEventListener("focus", restart);
    };
  }, [visit]);

  return (
    <div className="kara-os">
      <Desktop />
      <DesktopPet shuttingDown={shuttingDown} />
      <WindowLayer />
      <Taskbar onTurnOff={() => setShuttingDown(true)} />
      {shuttingDown && <ShutdownDialog onCancel={() => setShuttingDown(false)} />}
      {XN_DEV_TOOLS && visit === "none" && <SanDevControl />}
      {visit === "glitch" && <DoorGlitch onDone={enterBackrooms} onGiveUp={backroomsFailed} />}
      {visit === "inside" && (
        <XnenBoundary onFail={backroomsFailed}>
          {/* The door's glitch waits for the backrooms to load, but lazy() still holds back the first render a moment
              after: the backrooms' dark covers the desktop meanwhile, or it would flash through. */}
          <Suspense fallback={<div className="kara-xnen" aria-hidden="true" />}>
            <XnenWorld onLeave={leaveBackrooms} />
          </Suspense>
        </XnenBoundary>
      )}
    </div>
  );
}

export default KaraOs;
