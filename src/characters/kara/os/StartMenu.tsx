import { useCallback, useRef, useState } from "react";
import { APP_IDS, APPS, type AppId } from "../apps/registry";
import CharacterAvatar from "../CharacterAvatar";
import { PawIcon, PowerIcon } from "../icons";
import { useOs } from "./context";
import { useDismiss } from "./useDismiss";

const LEFT_APPS = APP_IDS.filter((id) => APPS[id].startMenu === "left");
const RIGHT_APPS = APP_IDS.filter((id) => APPS[id].startMenu === "right");

function StartMenu({ onTurnOff }: { onTurnOff: () => void }) {
  const os = useOs();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  const launch = (appId: AppId) => {
    setOpen(false);
    os.openApp(appId);
  };

  const renderItems = (ids: AppId[]) =>
    ids.map((appId) => {
      const { title, icon: Icon } = APPS[appId];
      return (
        <button key={appId} type="button" className="kara-start-menu__item" onClick={() => launch(appId)}>
          <Icon size={24} />
          <span>{title}</span>
        </button>
      );
    });

  return (
    <div ref={rootRef} className="kara-start">
      <button
        type="button"
        className="kara-start__button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <PawIcon size={18} />
        start?
      </button>

      {open && (
        <div className="kara-start-menu">
          <div className="kara-start-menu__header">
            <CharacterAvatar character="kara" size={42} />
            Kara
          </div>
          <div className="kara-start-menu__columns">
            <div className="kara-start-menu__column">{renderItems(LEFT_APPS)}</div>
            <div className="kara-start-menu__column kara-start-menu__column--side">{renderItems(RIGHT_APPS)}</div>
          </div>
          <div className="kara-start-menu__footer">
            <button
              type="button"
              className="kara-start-menu__power"
              onClick={() => {
                setOpen(false);
                onTurnOff();
              }}
            >
              <PowerIcon size={22} />
              Turn Off Computer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StartMenu;
