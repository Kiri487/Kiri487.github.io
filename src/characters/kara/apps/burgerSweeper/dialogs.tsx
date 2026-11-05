import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useDialogFocus } from "../../os/useDialogFocus";
import "../common/messageBox.css";
import { CUSTOM_LIMITS, DIFFICULTIES, DIFFICULTY_IDS, maxBurgers, type BestTimes, type Board } from "./difficulties";

interface DialogFrameProps {
  title: string;
  onSubmit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
  actions: ReactNode;
}

/** The message box's frame, holding a form instead of a single line. */
function DialogFrame({ title, onSubmit, onKeyDown, children, actions }: DialogFrameProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className="kara-message">
      <form className="kara-message__box" role="dialog" aria-modal="true" aria-label={title} onKeyDown={onKeyDown} onSubmit={submit}>
        <div className="kara-message__title">{title}</div>
        <div className="kara-message__body kara-sweeper-dialog__body">{children}</div>
        <div className="kara-message__actions kara-sweeper-dialog__actions">{actions}</div>
      </form>
    </div>
  );
}

interface CustomValues {
  rows: string;
  cols: string;
  burgers: string;
}

function toValues({ rows, cols, burgers }: Board): CustomValues {
  return { rows: String(rows), cols: String(cols), burgers: String(burgers) };
}

/**
 * What the form says, made to fit: each number moved to the nearest one allowed, and anything that isn't a number
 * counted as the smallest. The burgers' limit depends on the size, so it's checked last.
 */
function fitBoard(values: CustomValues): Board {
  const { minRows, maxRows, minCols, maxCols, minBurgers } = CUSTOM_LIMITS;
  const clamp = (value: string, min: number, max: number) => Math.min(Math.max(Number.parseInt(value, 10) || 0, min), max);
  const rows = clamp(values.rows, minRows, maxRows);
  const cols = clamp(values.cols, minCols, maxCols);
  return { rows, cols, burgers: clamp(values.burgers, minBurgers, maxBurgers(rows, cols)) };
}

export function CustomDialog({
  board,
  onConfirm,
  onCancel,
}: {
  board: Board;
  onConfirm: (board: Board) => void;
  onCancel: () => void;
}) {
  const { initialFocusRef, onKeyDown } = useDialogFocus<HTMLInputElement>(onCancel);
  const [values, setValues] = useState(() => toValues(board));

  const fields: { key: keyof CustomValues; label: string }[] = [
    { key: "rows", label: "Height" },
    { key: "cols", label: "Width" },
    { key: "burgers", label: "Burgers" },
  ];

  const confirm = () => onConfirm(fitBoard(values));

  return (
    <DialogFrame
      title="Custom"
      onSubmit={confirm}
      onKeyDown={onKeyDown}
      actions={
        <>
          <button type="submit" className="kara-button kara-message__ok">
            OK
          </button>
          <button type="button" className="kara-button kara-message__ok" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <div className="kara-sweeper-dialog__fields">
        {fields.map(({ key, label }, index) => (
          <label key={key} className="kara-sweeper-dialog__field">
            {label}:
            <input
              ref={index === 0 ? initialFocusRef : undefined}
              type="number"
              inputMode="numeric"
              className="kara-sweeper-dialog__input"
              value={values[key]}
              onChange={(event) => setValues({ ...values, [key]: event.target.value })}
              // Fixed on the way out of the field, so a number that can't be used never sits there looking fine.
              onBlur={() => setValues(toValues(fitBoard(values)))}
            />
          </label>
        ))}
      </div>
    </DialogFrame>
  );
}

export function BestTimesDialog({
  best,
  onReset,
  onClose,
}: {
  best: BestTimes;
  onReset: () => void;
  onClose: () => void;
}) {
  const { initialFocusRef, onKeyDown } = useDialogFocus(onClose);

  return (
    <DialogFrame
      title="Best Times"
      onSubmit={onClose}
      onKeyDown={onKeyDown}
      actions={
        <>
          <button type="button" className="kara-button kara-message__ok" onClick={onReset}>
            Reset Scores
          </button>
          <button ref={initialFocusRef} type="submit" className="kara-button kara-message__ok">
            OK
          </button>
        </>
      }
    >
      <table className="kara-sweeper-dialog__times">
        <tbody>
          {DIFFICULTY_IDS.map((id) => (
            <tr key={id}>
              <th scope="row">{DIFFICULTIES[id].shortLabel}:</th>
              <td>{best[id].seconds} seconds</td>
              <td>{best[id].name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DialogFrame>
  );
}

/** Asks who set a new best time, already filled in with the answer Kara expects. */
export function RecordDialog({ onConfirm }: { onConfirm: (name: string) => void }) {
  const [name, setName] = useState("KARA");
  const confirm = () => onConfirm(name);
  const { initialFocusRef, onKeyDown } = useDialogFocus<HTMLInputElement>(confirm);

  return (
    <DialogFrame
      title="Burger Sweeper"
      onSubmit={confirm}
      onKeyDown={onKeyDown}
      actions={
        <button type="submit" className="kara-button kara-message__ok">
          OK
        </button>
      }
    >
      <label className="kara-sweeper-dialog__record">
        New best time. Who did this?
        <input
          ref={initialFocusRef}
          type="text"
          maxLength={32}
          className="kara-sweeper-dialog__input kara-sweeper-dialog__input--name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
    </DialogFrame>
  );
}
