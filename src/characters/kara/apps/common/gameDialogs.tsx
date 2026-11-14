import {
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useDialogFocus } from "../../../../shared/useDialogFocus";
import "./gameDialogs.css";
import "./messageBox.css";

interface DialogFrameProps {
  title: string;
  onSubmit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
  actions: ReactNode;
}

/**
 * A one-line text field that's really a textarea: Chrome on phones puts its password, card and address bar above
 * the keyboard for any input, autocomplete="off" or not, but never for a textarea. Kere's chat does the same.
 * Enter sends the form instead of starting a new line, except while an IME is still picking characters.
 */
export function LineField({
  value,
  onValueChange,
  digitsOnly = false,
  inputRef,
  ...rest
}: Omit<ComponentProps<"textarea">, "value" | "onChange" | "rows" | "ref"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** For numbers: anything else typed or pasted is dropped. */
  digitsOnly?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <textarea
      {...rest}
      ref={inputRef}
      rows={1}
      wrap="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      inputMode={digitsOnly ? "numeric" : rest.inputMode}
      value={value}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        const text = event.target.value.replace(/\r?\n/g, " ");
        onValueChange(digitsOnly ? text.replace(/\D/g, "") : text);
      }}
    />
  );
}

/** The message box's frame, holding a form instead of a single line. */
export function DialogFrame({ title, onSubmit, onKeyDown, children, actions }: DialogFrameProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="kara-message">
      <form className="kara-message__box" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown} onSubmit={submit}>
        <div className="kara-message__title">{title}</div>
        <div className="kara-message__body kara-game-dialog__body">{children}</div>
        <div className="kara-message__actions kara-game-dialog__actions">{actions}</div>
      </form>
    </div>
  );
}

/** Asks who set a new record, already filled in with the answer Kara expects. */
export function RecordDialog({
  title,
  message,
  onConfirm,
}: {
  title: string;
  /** Such as "New best time. Who did this?" */
  message: string;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("KARA");
  const confirm = () => onConfirm(name);
  const { initialFocusRef, onKeyDown } = useDialogFocus<HTMLTextAreaElement>(confirm);

  return (
    <DialogFrame
      title={title}
      onSubmit={confirm}
      onKeyDown={onKeyDown}
      actions={
        <button type="submit" className="kara-button kara-message__ok">
          OK
        </button>
      }
    >
      <label className="kara-game-dialog__record">
        {message}
        <LineField
          inputRef={initialFocusRef}
          maxLength={32}
          className="kara-game-dialog__input kara-game-dialog__input--name"
          value={name}
          onValueChange={setName}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
    </DialogFrame>
  );
}
