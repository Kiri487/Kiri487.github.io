import { useSkin } from "../../../SkinContext";
import { PowerIcon, RestartIcon } from "../icons";
import { useOs } from "./context";

function ShutdownDialog({ onCancel }: { onCancel: () => void }) {
  const os = useOs();
  const { setSkin } = useSkin();

  return (
    <div className="kara-shutdown">
      <div
        className="kara-shutdown__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kara-shutdown-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <h2 id="kara-shutdown-title" className="kara-shutdown__title">
          Turn off computer
        </h2>
        <div className="kara-shutdown__options">
          <button type="button" className="kara-shutdown__option" onClick={() => setSkin("kiri")}>
            <span className="kara-shutdown__option-icon kara-shutdown__option-icon--off">
              <PowerIcon size={32} />
            </span>
            Turn Off
          </button>
          <button
            type="button"
            className="kara-shutdown__option"
            onClick={() => {
              os.reset();
              onCancel();
            }}
          >
            <span className="kara-shutdown__option-icon kara-shutdown__option-icon--restart">
              <RestartIcon size={32} />
            </span>
            Restart
          </button>
        </div>
        <div className="kara-shutdown__footer">
          <button type="button" className="kara-shutdown__cancel" autoFocus onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ShutdownDialog;
