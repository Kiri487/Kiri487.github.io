import { useEffect, type RefObject } from "react";
import { MOBILE_QUERY } from "../../../shared/breakpoints";

/**
 * Phones: the chat panel goes full screen. Mobile browsers lay the on-screen keyboard over the page instead of
 * shrinking it, so size the panel to the part of the screen that's actually visible, and lock the page behind it.
 * Shared by Kere's chat and XR's.
 */
export function useChatViewport(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  logRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open || !window.matchMedia(MOBILE_QUERY).matches) return;
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const fitToViewport = () => {
      if (!panel || !viewport) return;
      panel.style.setProperty("--kere-viewport-height", `${viewport.height}px`);
      panel.style.setProperty("--kere-viewport-top", `${viewport.offsetTop}px`);
      const log = logRef.current;
      if (log) log.scrollTop = log.scrollHeight;
    };
    fitToViewport();
    viewport?.addEventListener("resize", fitToViewport);
    viewport?.addEventListener("scroll", fitToViewport);
    return () => {
      root.style.overflow = previousOverflow;
      viewport?.removeEventListener("resize", fitToViewport);
      viewport?.removeEventListener("scroll", fitToViewport);
    };
  }, [open, panelRef, logRef]);
}
