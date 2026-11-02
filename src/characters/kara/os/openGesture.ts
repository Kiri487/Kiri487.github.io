import type { KeyboardEvent } from "react";

/** How anything on this desktop opens: spread onto its element. */
export function openGesture(open: () => void) {
  return {
    onDoubleClick: () => open(),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      // Otherwise the same key press goes on to click whatever opening just focused, such as a message box's OK.
      event.preventDefault();
      open();
    },
  };
}
