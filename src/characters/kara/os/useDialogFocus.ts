import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

/**
 * Keyboard behaviour for a modal dialog: focus starts on `initialFocusRef` and returns where it was on closing,
 * Tab stays inside, and Escape closes from anywhere inside. Mouse use is untouched.
 */
export function useDialogFocus<T extends HTMLElement = HTMLButtonElement>(onClose: () => void) {
  const initialFocusRef = useRef<T>(null);

  useLayoutEffect(() => {
    const previous = document.activeElement;
    initialFocusRef.current?.focus();
    return () => {
      // What opened the dialog may be gone by now, such as a button in the start menu.
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
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
