import { ErrorIcon } from "../../icons";
import "./messageBox.css";

interface MessageBoxProps {
  title: string;
  message: string;
  onClose: () => void;
}

/** An error box over the app that raised it. The app's root element must be positioned. */
function MessageBox({ title, message, onClose }: MessageBoxProps) {
  return (
    <div className="kara-message">
      <div className="kara-message__box" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="kara-message__title">{title}</div>
        <div className="kara-message__body">
          <ErrorIcon size={32} />
          <p className="kara-message__text">{message}</p>
        </div>
        <div className="kara-message__actions">
          <button
            type="button"
            className="kara-message__ok"
            autoFocus
            onClick={onClose}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageBox;
