import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

/** What Tab can land on inside a dialog. */
const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Keyboard behaviour for a modal dialog: focus starts on `initialFocusRef` and returns where it was on closing,
 * Tab stays inside, and Escape closes from anywhere inside. Mouse use is untouched.
 * Spread `onKeyDown` onto the dialog's own element. `enabled` lets a dialog that animates open take the focus
 * only once it has finished (Kuru's panels); most dialogs leave it on.
 */
export function useDialogFocus<T extends HTMLElement = HTMLButtonElement>(onClose: () => void, enabled = true) {
  const initialFocusRef = useRef<T>(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement;
    initialFocusRef.current?.focus();
    return () => {
      // What opened the dialog may be gone by now, such as a button in Kara's start menu.
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [enabled]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  return { initialFocusRef, onKeyDown };
}
