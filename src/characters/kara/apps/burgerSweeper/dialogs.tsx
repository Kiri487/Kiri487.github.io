import { useState } from "react";
import { useDialogFocus } from "../../../../shared/useDialogFocus";
import { DialogFrame, LineField } from "../common/gameDialogs";
import { CUSTOM_LIMITS, DIFFICULTIES, DIFFICULTY_IDS, maxBurgers, type BestTimes, type Board } from "./difficulties";
import { clamp } from "../../../../shared/math";

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
  const fit = (value: string, min: number, max: number) => clamp(Number.parseInt(value, 10) || 0, min, max);
  const rows = fit(values.rows, minRows, maxRows);
  const cols = fit(values.cols, minCols, maxCols);
  return { rows, cols, burgers: fit(values.burgers, minBurgers, maxBurgers(rows, cols)) };
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
  const { initialFocusRef, onKeyDown } = useDialogFocus<HTMLTextAreaElement>(onCancel);
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
      <div className="kara-game-dialog__fields">
        {fields.map(({ key, label }, index) => (
          <label key={key} className="kara-game-dialog__field">
            {label}:
            <LineField
              inputRef={index === 0 ? initialFocusRef : undefined}
              digitsOnly
              maxLength={3}
              className="kara-game-dialog__input"
              value={values[key]}
              onValueChange={(value) => setValues({ ...values, [key]: value })}
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
      <table className="kara-game-dialog__times">
        <tbody>
          {DIFFICULTY_IDS.map((id) => (
            <tr key={id}>
              <th scope="row">{DIFFICULTIES[id].shortLabel}:</th>
              <td>{best[id].seconds}s</td>
              <td>{best[id].name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DialogFrame>
  );
}
