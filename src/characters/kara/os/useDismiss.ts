import { useEffect, type RefObject } from "react";

/** Closes a menu when the visitor presses outside `rootRef`, presses inside an iframe, or hits Escape. */
export function useDismiss(rootRef: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    let blurTimer: number | undefined;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Presses inside an iframe never reach this document. All it sees is the page losing focus to the iframe,
    // and browsers only update activeElement once the blur has finished.
    const closeOnIframeFocus = () => {
      blurTimer = window.setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) close();
      });
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("blur", closeOnIframeFocus);
    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("blur", closeOnIframeFocus);
    };
  }, [rootRef, open, close]);
}
