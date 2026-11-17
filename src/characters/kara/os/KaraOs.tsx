import { lazy, Suspense, useEffect, useState } from "react";
import { abandonVisit, enterBackrooms, leaveBackrooms, useXnVisit } from "../xnen/door";
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
