import { ErrorIcon, InfoIcon } from "../../icons";
import { useDialogFocus } from "../../os/useDialogFocus";
import "./messageBox.css";

interface MessageBoxProps {
  title: string;
  message: string;
  /** Most boxes here are refusals. "info" is for the few that only tell you something. */
  kind?: "error" | "info";
  onClose: () => void;
}

/** A message box over the app that raised it. The app's root element must be positioned. */
function MessageBox({ title, message, kind = "error", onClose }: MessageBoxProps) {
  const { initialFocusRef, onKeyDown } = useDialogFocus(onClose);

  return (
    <div className="kara-message">
      <div className="kara-message__box" role="alertdialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown}>
        <div className="kara-message__title">{title}</div>
        <div className="kara-message__body">
          {kind === "info" ? <InfoIcon size={32} /> : <ErrorIcon size={32} />}
          <p className="kara-message__text">{message}</p>
        </div>
        <div className="kara-message__actions">
          <button ref={initialFocusRef} type="button" className="kara-button kara-message__ok" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageBox;
