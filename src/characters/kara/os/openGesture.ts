import type { KeyboardEvent } from "react";

/** A finger has no double click, on tablets as much as on phones. */
const TOUCH_QUERY = "(pointer: coarse)";

export function isTouchPointer(): boolean {
  return window.matchMedia(TOUCH_QUERY).matches;
}

/** How anything on this desktop opens: spread onto its element. */
export function openGesture(open: () => void) {
  const pointer = isTouchPointer() ? { onClick: () => open() } : { onDoubleClick: () => open() };

  return {
    ...pointer,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      // Otherwise the same key press goes on to click whatever opening just focused, such as a message box's OK.
      event.preventDefault();
      open();
    },
  };
}
