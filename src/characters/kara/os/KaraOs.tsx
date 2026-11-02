import { useState } from "react";
import { useOsState } from "./context";
import Desktop from "./Desktop";
import DesktopPet from "./DesktopPet";
import ShutdownDialog from "./ShutdownDialog";
import Taskbar from "./Taskbar";
import Window from "./Window";

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

  return (
    <div className="kara-os">
      <Desktop />
      <DesktopPet />
      <WindowLayer />
      <Taskbar onTurnOff={() => setShuttingDown(true)} />
      {shuttingDown && <ShutdownDialog onCancel={() => setShuttingDown(false)} />}
    </div>
  );
}

export default KaraOs;
